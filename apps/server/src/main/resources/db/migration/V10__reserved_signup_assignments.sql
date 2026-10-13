-- Pre-assigns a Current PIXME (and, for one account, a permanent PIXME+
-- grant) to specific people BEFORE they've ever signed in. Applied the
-- moment each email actually creates an account — see
-- ReservedSignupService — not by this migration, which only records the
-- intent. Nothing happens to an email that never signs up.

CREATE TABLE reserved_signup_assignments (
    email               VARCHAR(255) PRIMARY KEY,
    -- Matches a file under resources/pixme/seed-characters/<key>.png.
    character_asset_key VARCHAR(64),
    grant_plus_forever  BOOLEAN     NOT NULL DEFAULT FALSE,
    applied_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- cheol1998 / ahdzz11 are already on the master allowlist (PIXME_MASTER_EMAILS),
-- which grants PIXME+ unconditionally and without a stored row — see
-- MasterAccountService. grant_plus_forever stays false for both; adding a
-- redundant Subscription row here would just be a second, inconsistent
-- source of truth for something the master check already guarantees.
INSERT INTO reserved_signup_assignments (email, character_asset_key, grant_plus_forever) VALUES
    ('cheol1998@kakao.com',   'cheol', FALSE),
    ('ahdzz11@naver.com',     'ahdzz', FALSE),
    -- cheer997979 is not on the master allowlist, so her PIXME+ has to be a
    -- real (if synthetic) Subscription row to actually take effect.
    ('cheer997979@naver.com','minju', TRUE);
