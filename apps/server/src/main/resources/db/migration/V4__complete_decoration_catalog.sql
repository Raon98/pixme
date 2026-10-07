-- ===========================================================================
-- V4 — the remaining 꾸미기 categories from the product brief.
--
-- V2 seeded backgrounds, a frame, a particle effect, a nickname effect and a
-- profile theme. The brief also lists Animated Background, Character Pose,
-- Character Emotion and Special Profile Theme; this adds them.
--
-- Prices are display fallbacks only — the platform store's localised price
-- always wins in the app, and these values exist for the moment before the
-- store responds.
-- ===========================================================================

INSERT INTO products
    (code, kind, ios_product_id, android_product_id, name, description,
     fallback_price_krw, credit_amount, unlock_code, badge, sort_order)
VALUES
    ('DECOR_BG_ANIMATED_RAIN', 'DECORATION',
     'app.pixme.decor.bg.animated.rain', 'app.pixme.decor.bg.animated.rain',
     '움직이는 비 배경', '카드 뒤로 픽셀 빗방울이 조용히 내려요.',
     2900, NULL, 'BG_ANIMATED_RAIN', NULL, 70),

    ('DECOR_BG_ANIMATED_SNOW', 'DECORATION',
     'app.pixme.decor.bg.animated.snow', 'app.pixme.decor.bg.animated.snow',
     '움직이는 눈 배경', '천천히 쌓이는 픽셀 눈.',
     2900, NULL, 'BG_ANIMATED_SNOW', NULL, 80),

    -- Pose and emotion change how YOUR card and profile render. They do not
    -- apply in the square: see docs/PRODUCT.md — the square is the one place
    -- where everyone standing the same way is the point.
    ('DECOR_POSE_HANDS_POCKET', 'DECORATION',
     'app.pixme.decor.pose.pocket', 'app.pixme.decor.pose.pocket',
     '주머니 포즈', '내 카드에서만 손을 주머니에 넣은 모습으로.',
     2900, NULL, 'POSE_HANDS_POCKET', NULL, 90),

    ('DECOR_POSE_WAVE', 'DECORATION',
     'app.pixme.decor.pose.wave', 'app.pixme.decor.pose.wave',
     '손 흔드는 포즈', '프로필에서 가볍게 인사하는 모습.',
     2900, NULL, 'POSE_WAVE', NULL, 100),

    ('DECOR_EMOTION_PACK', 'DECORATION',
     'app.pixme.decor.emotion.pack', 'app.pixme.decor.emotion.pack',
     '표정 모음', '오늘의 기분에 맞춰 캐릭터 표정이 바뀌어요.',
     1900, NULL, 'EMOTION_PACK', NULL, 110),

    ('DECOR_THEME_NIGHT', 'DECORATION',
     'app.pixme.decor.theme.night', 'app.pixme.decor.theme.night',
     '밤하늘 프로필 테마', '프로필 전체를 깊은 밤 색으로.',
     3900, NULL, 'THEME_NIGHT', '스페셜', 120),

    ('DECOR_THEME_FILM', 'DECORATION',
     'app.pixme.decor.theme.film', 'app.pixme.decor.theme.film',
     '필름 프로필 테마', '오래된 필름 질감의 특별 테마.',
     3900, NULL, 'THEME_FILM', '스페셜', 130);
