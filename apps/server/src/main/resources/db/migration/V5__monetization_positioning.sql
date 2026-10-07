-- ===========================================================================
-- V5 — final monetisation shape.
--
-- PIXME+ is an OPTIONAL premium subscription for people who generate and
-- decorate often. It is explicitly NOT the base plan: the social product —
-- feed, square, hearts, waves, connections, chat, profiles, history, and
-- re-selecting an already-generated character — stays free for everyone.
--
-- Each product therefore has one clear job, and no two overlap:
--
--   occasional generation      1회 / 3회
--   buying several up front    10회 (never expires)
--   generating often           PIXME+
--
-- Previously CREDIT_10 and PLUS_MONTHLY were both ₩4,900 for 10 generations,
-- which made the pack strictly dominated — PIXME+ gave the same credits plus
-- cosmetics, so nobody rational would buy the pack. Re-pricing PIXME+ to
-- ₩5,900 for 15 separates them on both price and volume.
-- ===========================================================================

UPDATE products
SET fallback_price_krw = 5900,
    credit_amount = 15,
    description = '자주 만드는 사람을 위한 선택형 구독. 매월 생성권 15회와 꾸미기.'
WHERE code = 'PLUS_MONTHLY';

-- Make the role of each pack legible in the store, since the price ladder
-- alone does not say what each one is for.
UPDATE products
SET description = '가끔 한 번 더 만들고 싶을 때.', badge = NULL
WHERE code = 'CREDIT_1';

UPDATE products
SET description = '마음에 드는 모습이 나올 때까지.', badge = '인기'
WHERE code = 'CREDIT_3';

UPDATE products
SET description = '미리 넉넉히. 구매한 생성권은 기간 제한 없이 보유해요.',
    badge = '가장 알뜰'
WHERE code = 'CREDIT_10';

-- Per-generation price after this change, so the ladder stays reviewable:
--   1회   ₩900   ₩900/generation
--   3회   ₩1,900 ₩633/generation
--   10회  ₩4,900 ₩490/generation, no expiry
--   PIXME+ ₩5,900 ₩393/generation + cosmetics, monthly
