-- ===========================================================================
-- V6 — decouple square and feed participation from AI generation.
--
-- The old model: a "PIXME post" was one thing — a generated character, a
-- caption/mood/tags, and "today's representative appearance" — all collapsed
-- into `pixel_posts`, gated on publishing a NEW AI generation each day. That
-- conflicts with generation being a paid feature: a free user who doesn't
-- generate today would otherwise vanish from the square and the feed.
--
-- The new model separates four concepts that used to be one row:
--
--   PixelCharacter   a confirmed, owned "look" (the Collection). Not dated.
--   UserCurrentPixel One pointer per user to the PixelCharacter representing
--                    them right now. Free to repoint among owned characters.
--   DailyStatus      Today's mood/message/tags, ALWAYS free, independent of
--                    whether a new character was generated today. One per
--                    (user, date). What Today Feed and hearts target.
--   SquarePresence   Whether — and since when — a user is standing in today's
--                    square. Opt-in (`user_settings.square_visible`),
--                    independent of DailyStatus.
--
-- Pre-launch, no production data: this is a clean replacement, not a
-- data-preserving migration.
-- ===========================================================================

-- --------------------------------------------------------- drop the old shape

DROP TABLE IF EXISTS pixel_post_tags;
DROP TABLE IF EXISTS square_placements;
DROP TABLE IF EXISTS feed_exposures;
DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS pixel_posts;

ALTER TABLE user_profiles DROP COLUMN IF EXISTS representative_post_id;

ALTER TABLE user_stats RENAME COLUMN last_post_date TO last_status_date;
COMMENT ON COLUMN user_stats.last_status_date IS
    'Last date with a DailyStatus row — the streak now tracks free daily engagement, not paid generation.';
COMMENT ON COLUMN user_stats.pixel_count IS
    'Size of the PixelCharacter Collection, not a count of daily posts.';

-- A user can enter the square without ever writing a status; make that an
-- explicit, consent-gated preference rather than a default.
ALTER TABLE user_settings
    ADD COLUMN square_visible BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN square_onboarded BOOLEAN NOT NULL DEFAULT FALSE;

-- ------------------------------------------------------------ pixel_characters

-- The Collection: every confirmed character a user owns. Created once, when a
-- generation is kept (never when a generation is merely compared and
-- discarded) — see PixelCharacterService.
CREATE TABLE pixel_characters (
    id                   UUID PRIMARY KEY,
    user_id              UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    generation_id        UUID         NOT NULL REFERENCES pixel_generations (id),
    character_object_key VARCHAR(512) NOT NULL,
    -- Nullable: cleared when the user deletes the original or opted out of
    -- retention, same privacy contract as before.
    original_object_key  VARCHAR(512),
    style                VARCHAR(32)  NOT NULL DEFAULT 'PIXME_BASIC',
    -- Optional user-given name for the Collection ("정장 PIXME"). Never
    -- required; the UI falls back to a date-based label.
    label                VARCHAR(30),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ
);

-- One PixelCharacter per generation: a generation that was kept cannot be
-- kept twice, which is what makes "선택" idempotent.
CREATE UNIQUE INDEX pixel_characters_generation_key ON pixel_characters (generation_id);
CREATE INDEX pixel_characters_user_idx
    ON pixel_characters (user_id, created_at DESC) WHERE deleted_at IS NULL;

-- --------------------------------------------------------- user_current_pixel

-- One row per user: today's "me", regardless of when it was generated.
CREATE TABLE user_current_pixel (
    user_id            UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    pixel_character_id UUID        NOT NULL REFERENCES pixel_characters (id),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------- daily_status

-- Today's mood/message/tags. Free, overwritten in place, independent of
-- whether a new character was generated today.
--
-- `pixel_character_id` is a *live-synced snapshot*: it is kept equal to the
-- user's UserCurrentPixel for as long as the row represents *today*, so
-- switching Current PIXME (free or paid) is reflected immediately in the feed
-- and square without the user also having to touch their status text. Once
-- the day ends the row is historical and is never touched again, so past
-- calendar entries correctly show what the user looked like on that day.
CREATE TABLE daily_status (
    id                 UUID         PRIMARY KEY,
    user_id            UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status_date        DATE         NOT NULL,
    mood               VARCHAR(16),
    message            VARCHAR(60),
    pixel_character_id UUID         NOT NULL REFERENCES pixel_characters (id),
    -- Set when this row's character pointer was touched by a PIXME switch
    -- (free or paid) rather than a pure status-text edit. Feeds the feed
    -- ranker's "new look today" freshness bonus — see FeedRanker.
    fresh_character    BOOLEAN      NOT NULL DEFAULT FALSE,
    heart_count        INTEGER      NOT NULL DEFAULT 0,
    view_count         INTEGER      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT daily_status_heart_count_check CHECK (heart_count >= 0)
);

CREATE UNIQUE INDEX daily_status_user_date_key ON daily_status (user_id, status_date);
CREATE INDEX daily_status_today_idx ON daily_status (status_date DESC, updated_at DESC);
CREATE INDEX daily_status_character_idx ON daily_status (pixel_character_id);

CREATE TABLE daily_status_tags (
    daily_status_id UUID        NOT NULL REFERENCES daily_status (id) ON DELETE CASCADE,
    tag             VARCHAR(12) NOT NULL,
    PRIMARY KEY (daily_status_id, tag)
);
CREATE INDEX daily_status_tags_tag_idx ON daily_status_tags (tag, daily_status_id);

-- "오늘의 상태" can still be tagged as the reason behind a 👋, same spirit as
-- the old `source_post_id` just repointed at the new target.
ALTER TABLE connection_requests
    DROP COLUMN IF EXISTS source_post_id,
    ADD COLUMN source_daily_status_id UUID REFERENCES daily_status (id);

-- -------------------------------------------------------------------- reactions

-- Hearts now target a DailyStatus (today's appearance), not a generated post.
CREATE TABLE reactions (
    id              UUID        PRIMARY KEY,
    from_user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    daily_status_id UUID        NOT NULL REFERENCES daily_status (id) ON DELETE CASCADE,
    type            VARCHAR(16) NOT NULL DEFAULT 'HEART',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reactions_type_check CHECK (type IN ('HEART'))
);

CREATE UNIQUE INDEX reactions_unique_per_user_status_type
    ON reactions (from_user_id, daily_status_id, type);
CREATE INDEX reactions_daily_status_idx ON reactions (daily_status_id, created_at DESC);
CREATE INDEX reactions_from_user_idx ON reactions (from_user_id, created_at DESC);

-- --------------------------------------------------------------- square_presence

-- Today's square roster. Opt-in via `user_settings.square_visible`; a row
-- here means "this user was active today while visibility was on" — not a
-- live position, just a day-scoped flag plus timestamps for the "지금 있어요 /
-- 방금 도착했어요" copy.
CREATE TABLE square_presence (
    user_id        UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    presence_date  DATE        NOT NULL,
    entered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A per-day override: "오늘만 광장에서 숨기기" without changing the
    -- persistent `square_visible` preference.
    visible        BOOLEAN     NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, presence_date)
);

CREATE INDEX square_presence_date_idx
    ON square_presence (presence_date, last_active_at DESC) WHERE visible;

-- square_placements now keys off presence instead of a post.
CREATE TABLE square_placements (
    presence_date DATE        NOT NULL,
    user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    x             INTEGER     NOT NULL,
    y             INTEGER     NOT NULL,
    depth         SMALLINT    NOT NULL DEFAULT 0,
    idle_variant  SMALLINT    NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (presence_date, user_id)
);

CREATE INDEX square_placements_date_idx ON square_placements (presence_date, y);

-- -------------------------------------------------------------- feed_exposures

-- Per-viewer exposure log, now against DailyStatus rather than a post.
CREATE TABLE feed_exposures (
    viewer_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    daily_status_id UUID        NOT NULL REFERENCES daily_status (id) ON DELETE CASCADE,
    author_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status_date     DATE        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (viewer_id, daily_status_id)
);

CREATE INDEX feed_exposures_author_day_idx
    ON feed_exposures (viewer_id, author_id, status_date);
CREATE INDEX feed_exposures_day_idx ON feed_exposures (status_date);
