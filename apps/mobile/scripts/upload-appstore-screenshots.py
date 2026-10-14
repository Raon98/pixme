#!/usr/bin/env python3
"""
Uploads apps/mobile/build/screenshots/*.png to App Store Connect, replacing
whatever is currently in the 6.7" (APP_IPHONE_67, 1290x2796) screenshot set
for a given locale on the editable app version.

    PIXME_ASC_KEY_ID=... PIXME_ASC_ISSUER_ID=... PIXME_ASC_KEY_PATH=... \
      python3 apps/mobile/scripts/upload-appstore-screenshots.py

No credential is hardcoded here — all three come from the environment, and
the private key file itself is never read from or copied into the repo.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import jwt

APP_ID = "6821331238"
LOCALE = "ko"
DISPLAY_TYPE = "APP_IPHONE_67"
SHOTS_DIR = Path(__file__).resolve().parent.parent / "build" / "screenshots"
API_BASE = "https://api.appstoreconnect.apple.com/v1"

# Upload order, left to right in App Store Connect.
ORDER = ["01-create.png", "02-result.png", "03-square.png", "04-chat.png", "05-my.png"]


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"Missing required env var: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def make_token(key_id: str, issuer_id: str, key_path: str) -> str:
    private_key = Path(key_path).read_text()
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer_id, "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"},
        private_key,
        algorithm="ES256",
        headers={"kid": key_id, "typ": "JWT"},
    )


class Client:
    def __init__(self, token: str):
        self.token = token

    def request(self, method: str, path_or_url: str, body: dict | None = None,
                extra_headers: dict | None = None, raw: bytes | None = None,
                authenticated: bool = True):
        url = path_or_url if path_or_url.startswith("http") else f"{API_BASE}{path_or_url}"
        # The upload URLs are pre-signed (S3-style): any header beyond exactly
        # what Apple hands back in `requestHeaders` breaks the signature and
        # S3 rejects the PUT with a bare 400. Our bearer token has no business
        # there anyway — it authenticates to Apple's API, not to S3.
        headers = {"Authorization": f"Bearer {self.token}"} if authenticated else {}
        data = None
        if raw is not None:
            data = raw
        elif body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                raw_body = resp.read()
                return resp.status, (json.loads(raw_body) if raw_body else {})
        except urllib.error.HTTPError as e:
            raw_body = e.read()
            try:
                return e.code, json.loads(raw_body)
            except json.JSONDecodeError:
                return e.code, {"raw": raw_body.decode(errors="replace")}

    def get(self, path: str):
        return self.request("GET", path)

    def post(self, path: str, body: dict):
        return self.request("POST", path, body=body)

    def patch(self, path: str, body: dict):
        return self.request("PATCH", path, body=body)

    def delete(self, path: str):
        return self.request("DELETE", path)


def must(status: int, body: dict, context: str):
    if status >= 300:
        print(f"FAILED {context}: HTTP {status}\n{json.dumps(body, indent=2)}", file=sys.stderr)
        sys.exit(1)


def find_editable_version(client: Client) -> str:
    status, body = client.get(f"/apps/{APP_ID}/appStoreVersions?limit=10")
    must(status, body, "list appStoreVersions")
    editable_states = {
        "PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED",
    }
    for v in body["data"]:
        if v["attributes"]["appStoreState"] in editable_states:
            print(f"Using version {v['attributes']['versionString']} "
                  f"({v['attributes']['appStoreState']})")
            return v["id"]
    print("No editable app version found (none in PREPARE_FOR_SUBMISSION or a "
          "rejected state) — create/open a version draft in App Store Connect first.",
          file=sys.stderr)
    sys.exit(1)


def find_localization(client: Client, version_id: str) -> str:
    status, body = client.get(f"/appStoreVersions/{version_id}/appStoreVersionLocalizations")
    must(status, body, "list localizations")
    for loc in body["data"]:
        if loc["attributes"]["locale"] == LOCALE:
            return loc["id"]
    print(f"No '{LOCALE}' localization found on this version.", file=sys.stderr)
    sys.exit(1)


def find_or_create_screenshot_set(client: Client, localization_id: str) -> str:
    status, body = client.get(
        f"/appStoreVersionLocalizations/{localization_id}/appScreenshotSets"
    )
    must(status, body, "list screenshot sets")
    for s in body["data"]:
        if s["attributes"]["screenshotDisplayType"] == DISPLAY_TYPE:
            return s["id"]

    status, body = client.post("/appScreenshotSets", {
        "data": {
            "type": "appScreenshotSets",
            "attributes": {"screenshotDisplayType": DISPLAY_TYPE},
            "relationships": {
                "appStoreVersionLocalization": {
                    "data": {"type": "appStoreVersionLocalizations", "id": localization_id}
                }
            },
        }
    })
    must(status, body, "create screenshot set")
    return body["data"]["id"]


def clear_existing(client: Client, set_id: str):
    status, body = client.get(f"/appScreenshotSets/{set_id}/appScreenshots")
    must(status, body, "list existing screenshots")
    for s in body["data"]:
        print(f"Deleting old screenshot {s['attributes'].get('fileName')} ({s['id']})")
        status, _ = client.delete(f"/appScreenshots/{s['id']}")
        if status not in (200, 204):
            print(f"  warning: delete returned {status}", file=sys.stderr)


def upload_one(client: Client, set_id: str, path: Path):
    data = path.read_bytes()
    checksum = hashlib.md5(data).hexdigest()

    status, body = client.post("/appScreenshots", {
        "data": {
            "type": "appScreenshots",
            "attributes": {"fileName": path.name, "fileSize": len(data)},
            "relationships": {
                "appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}
            },
        }
    })
    must(status, body, f"reserve upload for {path.name}")
    screenshot_id = body["data"]["id"]
    operations = body["data"]["attributes"]["uploadOperations"]

    for op in operations:
        chunk = data[op["offset"]: op["offset"] + op["length"]]
        headers = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
        status, resp = client.request(
            op["method"], op["url"], extra_headers=headers, raw=chunk, authenticated=False
        )
        if status >= 300:
            print(f"FAILED uploading chunk for {path.name}: HTTP {status}\n{resp}",
                  file=sys.stderr)
            sys.exit(1)

    status, body = client.patch(f"/appScreenshots/{screenshot_id}", {
        "data": {
            "type": "appScreenshots",
            "id": screenshot_id,
            "attributes": {"uploaded": True, "sourceFileChecksum": checksum},
        }
    })
    must(status, body, f"finalize {path.name}")
    print(f"Uploaded {path.name} -> {screenshot_id}")
    return screenshot_id


def set_order(client: Client, set_id: str, screenshot_ids: list[str]):
    status, body = client.request(
        "PATCH",
        f"{API_BASE}/appScreenshotSets/{set_id}/relationships/appScreenshots",
        body={"data": [{"type": "appScreenshots", "id": sid} for sid in screenshot_ids]},
    )
    must(status, body if isinstance(body, dict) else {}, "set screenshot order")


def main():
    key_id = env("PIXME_ASC_KEY_ID")
    issuer_id = env("PIXME_ASC_ISSUER_ID")
    key_path = env("PIXME_ASC_KEY_PATH")

    files = [SHOTS_DIR / name for name in ORDER]
    missing = [f for f in files if not f.exists()]
    if missing:
        print(f"Missing screenshot files: {missing}", file=sys.stderr)
        sys.exit(1)

    token = make_token(key_id, issuer_id, key_path)
    client = Client(token)

    version_id = find_editable_version(client)
    localization_id = find_localization(client, version_id)
    set_id = find_or_create_screenshot_set(client, localization_id)

    clear_existing(client, set_id)

    screenshot_ids = [upload_one(client, set_id, f) for f in files]
    set_order(client, set_id, screenshot_ids)

    print(f"\nDone. {len(screenshot_ids)} screenshots uploaded to {DISPLAY_TYPE} / {LOCALE}.")


if __name__ == "__main__":
    main()
