-- ===========================================================================
-- V7 — make decorations usable, not just purchasable.
--
-- Until now a decoration could be bought (products + user_unlocks) but there
-- was nowhere to record that the user actually wants it applied, and no way
-- for the client to know which decorations conflict with each other. Two
-- things fix that:
--
--   1. products.decoration_slot — which "place" on the card/profile an item
--      occupies. One active item per slot per user, so applying a new
--      background replaces the old one rather than stacking.
--   2. user_active_decorations — the chosen item per slot.
--
-- Access is deliberately NOT stored here. Whether the user may use a slot's
-- item is decided at read time from (owned outright) OR (PIXME+ active), so
-- a lapsed subscription stops rendering immediately without a cleanup job.
-- ===========================================================================

ALTER TABLE products ADD COLUMN decoration_slot varchar(24);

UPDATE products SET decoration_slot = 'BACKGROUND'
 WHERE unlock_code IN ('BG_SUNSET', 'BG_STARRY', 'BG_ANIMATED_RAIN', 'BG_ANIMATED_SNOW');

UPDATE products SET decoration_slot = 'FRAME'    WHERE unlock_code = 'FRAME_PIXEL';
UPDATE products SET decoration_slot = 'PARTICLE' WHERE unlock_code = 'PARTICLE_HEART';
UPDATE products SET decoration_slot = 'NICKNAME' WHERE unlock_code = 'NICKNAME_GLOW';

UPDATE products SET decoration_slot = 'THEME'
 WHERE unlock_code IN ('THEME_PAPER', 'THEME_NIGHT', 'THEME_FILM');

UPDATE products SET decoration_slot = 'POSE'
 WHERE unlock_code IN ('POSE_HANDS_POCKET', 'POSE_WAVE');

UPDATE products SET decoration_slot = 'EMOTION' WHERE unlock_code = 'EMOTION_PACK';

-- Pose and emotion need character art that the generation pipeline does not
-- produce yet — a pose is a different render of the character, not a layer
-- the client can draw. Selling them before that exists would sell something
-- undeliverable, so they are parked here rather than deleted: flip active
-- back to true in the same migration style once generation supports them.
UPDATE products SET active = false
 WHERE unlock_code IN ('POSE_HANDS_POCKET', 'POSE_WAVE', 'EMOTION_PACK');

CREATE TABLE user_active_decorations (
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    slot        varchar(24) NOT NULL,
    unlock_code varchar(48) NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, slot)
);

CREATE INDEX idx_user_active_decorations_user ON user_active_decorations (user_id);
