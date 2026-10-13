# PIXME web

The public site behind the three URLs the app already points at
(`termsUrl`, `privacyUrl`, `supportEmail` in `apps/mobile/app.config.ts`):

| Path        | Purpose                                                |
| ----------- | ------------------------------------------------------ |
| `/`         | Landing page                                            |
| `/privacy/` | 개인정보처리방침 — **required** for App Store / Play review |
| `/terms/`   | 서비스 이용약관                                          |
| `/support/` | 고객지원 — the Support URL App Store Connect asks for    |

Static HTML and one stylesheet. No build step, no dependencies: these pages
have to stay reachable for as long as the app is listed, so there is nothing
between the text and the browser that can rot.

## Before launch

Every value the operator has to supply is wrapped in `<span class="fill">` and
renders with a yellow highlight, so an unfilled one is impossible to miss on
the page. Search for `class="fill"` and replace all of them:

- 운영 주체명 (상호), 대표자, 사업장 주소
- 개인정보 보호책임자 성명 / 직책
- 시행일 / 최종 개정일
- 클라우드 저장소 사업자명과 리전 (privacy §7, §8)
- 오류 수집 사업자 (privacy §7) — remove the row if Sentry is not shipped
- OpenAI의 데이터 보유기간 (privacy §8) — confirm against the current API terms

Two things worth confirming with a lawyer rather than assuming, since both
drive concrete clauses: whether the entity is a 통신판매업자 (adds a
신고번호 and a few mandatory disclosures), and whether the AI provider's terms
let the uploaded photo or its description become training data — the privacy
policy currently states it does not.

## Running locally

```bash
cd apps/web && python3 -m http.server 8099
```

Then open <http://localhost:8099>. Directory-style paths (`/privacy/` rather
than `/privacy.html`) are used so the same tree serves correctly on any static
host without rewrite rules.

## Deploying

Any static host works. The directory layout is already the published layout —
upload `apps/web` as the site root.

```bash
# Cloudflare Pages
npx wrangler pages deploy apps/web --project-name pixme

# or GitHub Pages / Netlify / Vercel: set the publish directory to apps/web
```

Point `pixme.app` at it, then verify the two URLs the app links to actually
resolve before submitting a build for review — a dead privacy policy URL is a
guaranteed rejection.

## Keeping it honest

`docs/PRIVACY.md` is the engineering account of what the system actually does;
`/privacy/` is the user-facing promise. When the data flow changes, change the
engineering doc first, then make this page match it — not the other way round.
