/**
 * Re-captures the app screenshots the video is built from.
 *
 * Start the preview in promo dress first, on a port of its own so an everyday
 * dev server on 8081 is left alone:
 *
 *   cd ../mobile && EXPO_PUBLIC_PIXME_MOCK=1 EXPO_PUBLIC_PIXME_MOCK_PROMO=1 \
 *     npx expo start --web --port 8082
 *   node tools/capture-ui.mjs
 *
 * Every frame in the video is a real screen — nothing in `src/scenes`
 * composites or redraws app UI — so when a screen changes, the fix is to
 * re-run this rather than to touch a scene.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROMO_BASE_URL ?? 'http://localhost:8082';
const OUT = join(HERE, '..', 'public', 'ui');
const PHOTO = join(HERE, '..', 'public', 'char', 'cheol-photo.jpg');

/** iPhone 14/15 logical size, which is the aspect the Phone frame expects. */
const VIEWPORT = { width: 393, height: 852 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name) {
  await sleep(600);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`captured ${name}`);
}

async function tap(page, text, after = 1200) {
  await page.getByText(text, { exact: false }).first().click();
  await sleep(after);
}

const main = async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    locale: 'ko-KR',
  });

  await page.goto(BASE, { waitUntil: 'load', timeout: 120_000 });
  // Metro's first bundle is slow enough that `load` still lands on a blank
  // root; the app has mounted once today's feed has painted.
  await sleep(12_000);

  await shoot(page, 'today');
  await tap(page, '광장');
  await shoot(page, 'square');
  await tap(page, '대화');
  await shoot(page, 'chats');
  await tap(page, 'MY');
  await shoot(page, 'my');

  // --- the create flow, driven end to end ---
  await page.goto(`${BASE}/create`, { waitUntil: 'load' });
  await sleep(3000);
  await shoot(page, 'create');

  const chooser = page.waitForEvent('filechooser', { timeout: 20_000 });
  await page.getByText('사진에서 선택', { exact: false }).first().click();
  await (await chooser).setFiles(PHOTO);
  await sleep(5000);

  // The render that comes back is the Y2K one (MOCK_PROMO), so the style
  // selected here has to be Y2K or the result contradicts the choice.
  await tap(page, 'Y2K 픽셀');
  await shoot(page, 'preview');

  await page.getByText('이 사진으로 만들기', { exact: false }).first().click();
  await sleep(1200);
  await shoot(page, 'generating');

  // The route carries ?generationId=..., so the glob needs the trailing wildcard.
  await page.waitForURL('**/create/result*', { timeout: 60_000 });
  await sleep(2500);
  await shoot(page, 'result');

  await tap(page, '이걸로 할래요', 2500);
  await page.getByPlaceholder('오늘은 어떤 하루인가요?').fill('오늘은 그냥 산책.');
  await tap(page, '좋아요', 400);
  await tap(page, '#산책', 400);
  await tap(page, '#카페', 600);
  await shoot(page, 'publish');

  // Keeping the character is only half of it — until "이 모습으로 오늘
  // 남기기" is tapped, nothing is published and the current character never
  // changes, so every tab below would still show whatever the mock seeded.
  // Publishing lands back on 오늘 by itself.
  await tap(page, '이 모습으로 오늘 남기기', 4000);

  // --- re-shoot the tabs now that the Y2K render is the current character ---
  // Taken before the flow too, but those show whatever the mock seeded. Once
  // it is published, 오늘/광장/MY all show the character the viewer just
  // watched being made, so the whole set (and the film) is one person on one
  // day rather than three unrelated renders.
  //
  // Navigated by tapping, never `page.goto`: mock state lives in module-level
  // variables, so a full reload throws the publish away and these shots go
  // back to showing the seeded character.
  await shoot(page, 'today');
  await tap(page, '광장', 2000);
  await shoot(page, 'square');
  await tap(page, 'MY', 2000);
  await shoot(page, 'my');

  // Mock mode never opens a real socket (there is nothing to connect to), so
  // the chat header's "연결 중…" never resolves — a preview-only artifact,
  // not a state a real user sees. Hidden for the capture only.
  await tap(page, '대화', 1500);
  await shoot(page, 'chats');
  await page.getByText('준서', { exact: false }).first().click({ force: true });
  await sleep(1800);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('div, span')) {
      if (el.textContent?.trim() === '연결 중…' && el.children.length === 0) {
        el.style.visibility = 'hidden';
      }
    }
  });
  await shoot(page, 'thread');

  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
