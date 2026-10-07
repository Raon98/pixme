-- Reference data: interests, square scenes, store catalog.
-- All of it is intentionally data rather than code so product can change the
-- taxonomy, re-dress the square, or reprice the store without a deploy.

-- ------------------------------------------------------------- interests --

INSERT INTO interests (code, label, emoji, sort_order) VALUES
    ('MUSIC',      '음악',  '🎧', 10),
    ('CAFE',       '카페',  '☕️', 20),
    ('MOVIE',      '영화',  '🎬', 30),
    ('TRAVEL',     '여행',  '✈️', 40),
    ('WORKOUT',    '운동',  '🏃', 50),
    ('WALK',       '산책',  '🌿', 60),
    ('GAME',       '게임',  '🎮', 70),
    ('FASHION',    '패션',  '🧥', 80),
    ('FOOD',       '맛집',  '🍜', 90),
    ('PHOTO',      '사진',  '📷', 100),
    ('EXHIBITION', '전시',  '🖼', 110),
    ('READING',    '독서',  '📚', 120);

-- ---------------------------------------------------------- square scenes --
-- Selection is by hour-of-day first (priority), then season. `BASIC` is the
-- always-matching fallback so the square can never fail to render.

INSERT INTO square_scenes
    (code, name, version, sky_color, ground_color, accent_color, from_hour, to_hour, from_month, to_month, priority, props_json)
VALUES
    ('BASIC', '오늘의 광장', 1, '#EAF2FF', '#F6F1E4', '#7C6CF0', 0, 24, 1, 12, 0,
     '[{"code":"TREE","x":120,"y":430,"scale":1.4,"zIndex":1},
       {"code":"BENCH","x":320,"y":560,"scale":1.1,"zIndex":2},
       {"code":"STREET_LAMP","x":760,"y":400,"scale":1.3,"zIndex":1},
       {"code":"CAFE","x":820,"y":250,"scale":1.6,"zIndex":0},
       {"code":"FOUNTAIN","x":500,"y":760,"scale":1.5,"zIndex":2},
       {"code":"BUS_STOP","x":160,"y":900,"scale":1.2,"zIndex":3},
       {"code":"PLANT","x":640,"y":980,"scale":0.9,"zIndex":4},
       {"code":"TREE","x":900,"y":1080,"scale":1.3,"zIndex":4},
       {"code":"PLANT","x":240,"y":1180,"scale":0.9,"zIndex":5},
       {"code":"SIGN","x":540,"y":1260,"scale":1.0,"zIndex":5},
       {"code":"CLOUD","x":220,"y":140,"scale":1.2,"zIndex":0},
       {"code":"SUN","x":860,"y":110,"scale":1.1,"zIndex":0}]'),

    ('NIGHT', '밤의 광장', 1, '#1F1C33', '#2A2540', '#B0A5F7', 19, 24, 1, 12, 10,
     '[{"code":"MOON","x":820,"y":120,"scale":1.3,"zIndex":0},
       {"code":"STREET_LAMP","x":200,"y":420,"scale":1.4,"zIndex":1},
       {"code":"STREET_LAMP","x":780,"y":520,"scale":1.4,"zIndex":2},
       {"code":"BENCH","x":420,"y":620,"scale":1.1,"zIndex":2},
       {"code":"CAFE","x":820,"y":260,"scale":1.6,"zIndex":0},
       {"code":"LANTERN","x":540,"y":880,"scale":1.0,"zIndex":3},
       {"code":"TREE","x":140,"y":980,"scale":1.3,"zIndex":4},
       {"code":"BUS_STOP","x":700,"y":1120,"scale":1.2,"zIndex":4},
       {"code":"PLANT","x":300,"y":1240,"scale":0.9,"zIndex":5}]'),

    ('DAWN', '새벽 광장', 1, '#DCE6FF', '#EFE7F5', '#9183F2', 0, 7, 1, 12, 10,
     '[{"code":"MOON","x":200,"y":130,"scale":1.0,"zIndex":0},
       {"code":"CLOUD","x":700,"y":180,"scale":1.3,"zIndex":0},
       {"code":"STREET_LAMP","x":260,"y":460,"scale":1.3,"zIndex":1},
       {"code":"BENCH","x":560,"y":600,"scale":1.1,"zIndex":2},
       {"code":"TREE","x":860,"y":700,"scale":1.4,"zIndex":2},
       {"code":"FOUNTAIN","x":420,"y":860,"scale":1.4,"zIndex":3},
       {"code":"PLANT","x":180,"y":1100,"scale":0.9,"zIndex":4},
       {"code":"BUS_STOP","x":760,"y":1180,"scale":1.2,"zIndex":5}]'),

    ('SPRING', '봄의 광장', 1, '#EDF7EC', '#FBF1F4', '#F9AE2B', 7, 19, 3, 5, 5,
     '[{"code":"TREE","x":160,"y":400,"scale":1.5,"zIndex":1},
       {"code":"FLOWER","x":300,"y":620,"scale":1.0,"zIndex":2},
       {"code":"FLOWER","x":700,"y":700,"scale":1.0,"zIndex":2},
       {"code":"BENCH","x":480,"y":560,"scale":1.1,"zIndex":2},
       {"code":"CAFE","x":840,"y":280,"scale":1.6,"zIndex":0},
       {"code":"FOUNTAIN","x":520,"y":840,"scale":1.5,"zIndex":3},
       {"code":"FLOWER","x":220,"y":1000,"scale":1.0,"zIndex":4},
       {"code":"TREE","x":880,"y":1060,"scale":1.4,"zIndex":4},
       {"code":"SIGN","x":560,"y":1240,"scale":1.0,"zIndex":5}]'),

    ('WINTER', '겨울 광장', 1, '#E7EEF6', '#F4F6F9', '#7C6CF0', 7, 19, 12, 2, 5,
     '[{"code":"SNOWMAN","x":300,"y":620,"scale":1.2,"zIndex":2},
       {"code":"TREE","x":140,"y":420,"scale":1.4,"zIndex":1},
       {"code":"STREET_LAMP","x":780,"y":480,"scale":1.3,"zIndex":2},
       {"code":"CAFE","x":820,"y":260,"scale":1.6,"zIndex":0},
       {"code":"BENCH","x":520,"y":700,"scale":1.1,"zIndex":3},
       {"code":"SNOWMAN","x":720,"y":960,"scale":1.1,"zIndex":4},
       {"code":"BUS_STOP","x":200,"y":1080,"scale":1.2,"zIndex":4},
       {"code":"SIGN","x":540,"y":1240,"scale":1.0,"zIndex":5}]'),

    ('RAIN', '비 오는 광장', 1, '#DDE3EA', '#E8ECF0', '#6453DD', 0, 24, 6, 8, 3,
     '[{"code":"CLOUD","x":240,"y":140,"scale":1.4,"zIndex":0},
       {"code":"CLOUD","x":720,"y":180,"scale":1.5,"zIndex":0},
       {"code":"PUDDLE","x":420,"y":680,"scale":1.1,"zIndex":2},
       {"code":"PUDDLE","x":760,"y":880,"scale":1.0,"zIndex":3},
       {"code":"BUS_STOP","x":200,"y":560,"scale":1.3,"zIndex":2},
       {"code":"CAFE","x":840,"y":280,"scale":1.6,"zIndex":0},
       {"code":"STREET_LAMP","x":560,"y":460,"scale":1.3,"zIndex":1},
       {"code":"TREE","x":140,"y":1020,"scale":1.3,"zIndex":4},
       {"code":"PUDDLE","x":300,"y":1220,"scale":1.0,"zIndex":5}]');

-- ------------------------------------------------------------ store catalog --
-- Prices here are display fallbacks only. The app always prefers the store's
-- localised price; these values exist for the moment before the store answers.

INSERT INTO products
    (code, kind, ios_product_id, android_product_id, name, description,
     fallback_price_krw, credit_amount, unlock_code, badge, sort_order)
VALUES
    ('CREDIT_1', 'CREDIT_PACK', 'app.pixme.credit.1', 'app.pixme.credit.1',
     'PIXME 1회', '오늘 한 번 더 만들어볼 수 있어요.', 900, 1, NULL, NULL, 10),
    ('CREDIT_3', 'CREDIT_PACK', 'app.pixme.credit.3', 'app.pixme.credit.3',
     'PIXME 3회', '마음에 드는 모습이 나올 때까지.', 1900, 3, NULL, '인기', 20),
    ('CREDIT_10', 'CREDIT_PACK', 'app.pixme.credit.10', 'app.pixme.credit.10',
     'PIXME 10회', '여러 스타일을 충분히 시도해보세요.', 4900, 10, NULL, '가장 알뜰', 30),

    ('STYLE_Y2K', 'STYLE', 'app.pixme.style.y2k', 'app.pixme.style.y2k',
     'Y2K 픽셀', '2000년대 감성의 선명한 색과 굵은 외곽선.', 2900, NULL, 'Y2K_PIXEL', NULL, 10),
    ('STYLE_16BIT', 'STYLE', 'app.pixme.style.bit16', 'app.pixme.style.bit16',
     '16비트', '한 단계 더 촘촘한 픽셀과 풍부한 음영.', 2900, NULL, 'BIT_16', NULL, 20),
    ('STYLE_RETRO_PC', 'STYLE', 'app.pixme.style.retropc', 'app.pixme.style.retropc',
     '레트로 PC', '제한된 팔레트의 초기 PC 화면 느낌.', 2900, NULL, 'RETRO_PC', NULL, 30),
    ('STYLE_ARCADE', 'STYLE', 'app.pixme.style.arcade', 'app.pixme.style.arcade',
     '아케이드', '오락실 캐비닛에서 막 나온 듯한 대비.', 2900, NULL, 'ARCADE', NULL, 40),
    ('STYLE_MINI', 'STYLE', 'app.pixme.style.mini', 'app.pixme.style.mini',
     '미니 픽셀', '더 작고 동글동글한 비율.', 2900, NULL, 'MINI_PIXEL', NULL, 50),
    ('STYLE_SOFT', 'STYLE', 'app.pixme.style.soft', 'app.pixme.style.soft',
     '소프트 픽셀', '부드러운 파스텔 톤의 차분한 마감.', 2900, NULL, 'SOFT_PIXEL', NULL, 60),

    ('DECOR_BG_SUNSET', 'DECORATION', 'app.pixme.decor.bg.sunset', 'app.pixme.decor.bg.sunset',
     '노을 배경', '카드 배경을 노을빛으로.', 1900, NULL, 'BG_SUNSET', NULL, 10),
    ('DECOR_BG_STARRY', 'DECORATION', 'app.pixme.decor.bg.starry', 'app.pixme.decor.bg.starry',
     '별밤 배경', '작은 픽셀 별이 반짝이는 배경.', 1900, NULL, 'BG_STARRY', NULL, 20),
    ('DECOR_FRAME_PIXEL', 'DECORATION', 'app.pixme.decor.frame.pixel', 'app.pixme.decor.frame.pixel',
     '픽셀 프레임', '카드 테두리를 픽셀 프레임으로.', 1900, NULL, 'FRAME_PIXEL', NULL, 30),
    ('DECOR_PARTICLE_HEART', 'DECORATION', 'app.pixme.decor.particle.heart', 'app.pixme.decor.particle.heart',
     '하트 파티클', '하트를 받을 때 더 특별한 연출.', 1900, NULL, 'PARTICLE_HEART', NULL, 40),
    ('DECOR_NICKNAME_GLOW', 'DECORATION', 'app.pixme.decor.nickname.glow', 'app.pixme.decor.nickname.glow',
     '닉네임 글로우', '닉네임에 은은한 빛을 더해요.', 1900, NULL, 'NICKNAME_GLOW', NULL, 50),
    ('DECOR_THEME_PAPER', 'DECORATION', 'app.pixme.decor.theme.paper', 'app.pixme.decor.theme.paper',
     '종이 프로필 테마', '프로필 전체를 종이 질감으로.', 2900, NULL, 'THEME_PAPER', NULL, 60),

    ('PLUS_MONTHLY', 'SUBSCRIPTION', 'app.pixme.plus.monthly', 'app.pixme.plus.monthly',
     'PIXME+', '매일의 나를 더 자유롭게.', 4900, 10, 'PLUS', NULL, 10);
