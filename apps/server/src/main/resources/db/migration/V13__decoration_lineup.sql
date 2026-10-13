-- Profile themes are withdrawn. They recoloured the whole app, which is a lot
-- of surface area for one cosmetic and never read as "mine" the way a card
-- does; the slot is retired rather than left half-sold.
UPDATE products SET active = FALSE
WHERE unlock_code IN ('THEME_PAPER', 'THEME_NIGHT', 'THEME_FILM');

-- Clearing a slot means removing the row: `unlock_code` is NOT NULL, and the
-- absence of a row is already how "nothing applied" is represented.
DELETE FROM user_active_decorations WHERE slot = 'THEME';

-- New variants, all PIXME+ only: no `ios_product_id`, so they are never sold
-- individually and need no store product of their own. The decoration catalog
-- already grants every active item while a subscription is live, so this is
-- the cheapest honest way to deepen the lineup — and it gives PIXME+ content
-- that cannot simply be bought around.
INSERT INTO products
    (code, kind, ios_product_id, android_product_id, name, description,
     fallback_price_krw, unlock_code, badge, sort_order, active, decoration_slot)
VALUES
    ('DECOR_FRAME_GOLD', 'DECORATION', NULL, NULL,
     '골드 테두리', '얇은 금선이 카드를 두릅니다.',
     0, 'FRAME_GOLD', NULL, 210, TRUE, 'FRAME'),

    ('DECOR_FRAME_TAPE', 'DECORATION', NULL, NULL,
     '테이프 테두리', '모서리를 마스킹 테이프로 붙인 느낌.',
     0, 'FRAME_TAPE', NULL, 220, TRUE, 'FRAME'),

    ('DECOR_NICKNAME_NEON', 'DECORATION', NULL, NULL,
     '네온 닉네임', '닉네임이 파란 네온처럼 빛나요.',
     0, 'NICKNAME_NEON', NULL, 320, TRUE, 'NICKNAME'),

    ('DECOR_PARTICLE_STAR', 'DECORATION', NULL, NULL,
     '별 연출', '좋아요를 누르면 별이 흩어져요.',
     0, 'PARTICLE_STAR', NULL, 420, TRUE, 'PARTICLE');
