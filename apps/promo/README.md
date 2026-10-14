# PIXME 홍보 모션그래픽

Remotion으로 만든 40초 앱 소개 영상. 앱 빌드와 완전히 분리된 패키지로,
`apps/mobile`·`apps/server`에는 아무 영향이 없다.

## 산출물

- `out/pixme-vertical.mp4` — 1080x1920 · 릴스/쇼츠/틱톡
- `out/pixme-horizontal.mp4` — 1920x1080 · 유튜브/웹
- 두 규격은 크롭이 아니라 각자 레이아웃(세로: 상하 스택, 가로: 좌우 배치)

## 구성 (40s · 30fps · 1200f)

| 씬 | 구간 | 내용 |
|---|---|---|
| Hook | 0–5s | 실제 사용자 사진 → 픽셀화 → Y2K 캐릭터 변신. "사진 한 장, 오늘의 내가 픽셀로." |
| Make | 5–13.3s | 실제 UI 3장: 미리보기(탭) → 생성 중 → 완성. "찍고, 고르고, 끝." |
| Square | 13.3–19.3s | 실제 광장 화면에서 분수 앞 무리만 크게 크롭 + 푸시인 |
| Connect | 19.3–26.6s | ♥ 하트버스트 · 👋 서로 인사 → 연결 → 대화 버블 |
| Styles | 26.6–32.6s | **같은 사진**의 기본↔Y2K 스왑 + 7개 스타일 칩 |
| Outro | 32.6–40s | 캐릭터 아이콘 + PIXME + 공식 슬로건 + "첫 PIXME는 무료예요" |

## 소재와 라이선스

- UI: 목 프리뷰(한국어)에서 Playwright로 캡처한 실제 화면 — `public/ui/`.
  `node tools/capture-ui.mjs` 로 전부 다시 뜬다 (아래 참고).
- 캐릭터·사진: 사용자 본인 소재 — `public/char/`.
  `cheol-basic.png` 와 `cheol-y2k.png` 는 **같은 사진**(`cheol-photo.jpg`)을
  실제 API로 두 스타일에 돌린 결과다. 다른 사진에서 나온 렌더를 섞으면
  "옷과 머리는 사진 그대로"라는 문구가 거짓이 된다.
- 폰트: Pretendard (SIL OFL) — `public/fonts/`
- 오디오: **전부 자체 합성** (`tools/make-audio.mjs`) — 효과음 9종 + 46초 BGM.
  외부 샘플 0개라 상업 이용에 라이선스 문제 없음.

## 수정하는 법

- 타이밍(그림+소리 동시 이동): `src/lib/timeline.ts` 의 `SCENE` / `CUE` 숫자만
- 카피: 각 `src/scenes/*.tsx` 의 한국어 문자열
- 사운드 질감: `tools/make-audio.mjs` 수정 후 `node tools/make-audio.mjs`
- 히어로 사진/캐릭터 교체: `public/char/cheol-photo.jpg` 와
  `public/char/cheol-y2k.png` 를 같은 이름으로 덮어쓰면 끝
- 화면 다시 캡처:
  ```
  cd ../mobile && EXPO_PUBLIC_PIXME_MOCK=1 EXPO_PUBLIC_PIXME_MOCK_PROMO=1 \
    npx expo start --web --port 8082
  node tools/capture-ui.mjs
  ```
  `MOCK_PROMO` 는 광장의 실제 3명을 분수 앞에 모으고, 생성 결과를 광고가
  연 그 사진의 Y2K 렌더로 고정한다 (가짜 인물은 넣지 않는다).
- 다른 스타일 렌더 추가 (같은 사진으로):
  ```
  cd ../server && set -a && source .env && set +a
  PIXME_VERIFY_INPUT=../promo/public/char/cheol-photo.jpg \
  PIXME_VERIFY_STYLE=ARCADE PIXME_VERIFY_OUTPUT=/tmp/cheol-arcade.png \
    mvn -q -Dtest=OpenAiLiveVerificationManualCheck test
  ```
- 미리보기: `npm run studio`
- 렌더:
  ```
  npx remotion render src/index.ts Vertical   out/pixme-vertical.mp4
  npx remotion render src/index.ts Horizontal out/pixme-horizontal.mp4
  ```

## 주의

- react/react-dom 은 **19.0.0 고정** — 19.3에서 Remotion 루트 로딩이 깨진다.
- `<Sequence>` 안의 `useCurrentFrame()`은 씬-로컬이다. 절대 큐는
  `timeline.local(CUE.x, SCENE.y)` 로 변환해서 쓸 것.
- 배경(`Backdrop`)과 컷 전환(`PixelWipe`)은 `Video.tsx`에서 **씬 바깥에**
  한 번만 깔린다. 씬 안에 두면 컷마다 모션이 0프레임으로 되감겨 튄다.
- `Pop` 은 wrapper 에 transform 을 걸어 containing block 이 된다. 자식에
  `position: absolute` 를 주면 바깥 기준이 아니라 `Pop` 기준으로 잡히니,
  절대 위치는 `Pop` 의 `style` 로 줄 것.
