-- ===========================================================================
-- V3 — Master Character Reference support + the new free generation policy
--
-- The daily free generation is GONE. Free generation is now an onboarding
-- grant only:
--
--     1st generation           free   (once per account)
--     retry of that 1st result free   (once, only inside the first flow)
--     bonus free credit        free   (one, usable any time afterwards)
--     everything after that    paid
--
-- Generations record which of those four they consumed, so a refund returns
-- exactly that currency and nothing else.
-- ===========================================================================

-- ------------------------------------------------- free generation policy --

ALTER TABLE generation_credits
    -- When the very first PIXME was generated. Null ⇒ the first one is free.
    ADD COLUMN first_generation_at TIMESTAMPTZ,
    -- The single free retry, usable only on the first character's result
    -- screen. Its purpose is to stop someone leaving because the very first AI
    -- result disappointed them — so it is deliberately not a general credit.
    ADD COLUMN first_retry_used_at TIMESTAMPTZ,
    -- Non-expiring free credits granted at sign-up. Spent before paid credits
    -- and counted separately so a refund gives back the right currency.
    ADD COLUMN bonus_free_credit_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE generation_credits
    ADD CONSTRAINT generation_credits_bonus_non_negative
        CHECK (bonus_free_credit_count >= 0);

-- Existing rows (none pre-launch, but a migration must be correct anyway)
-- receive the onboarding grant.
UPDATE generation_credits SET bonus_free_credit_count = 1;

-- The daily allowance no longer exists. Dropping the columns rather than
-- leaving them unused is deliberate: a dormant "free today" field is exactly
-- the kind of thing that gets accidentally wired back in.
ALTER TABLE generation_credits
    DROP COLUMN last_free_generation_date,
    DROP COLUMN free_used_today;

-- ------------------------------------------------------------ generations --

ALTER TABLE pixel_generations
    -- Authoritative record of what was spent. `used_free_generation` and
    -- `used_credit` stay as the denormalised flags the API already returns.
    ADD COLUMN spend_kind VARCHAR(24),
    -- Client-supplied idempotency key: a double-tapped button or a network
    -- retry must return the same generation, never charge twice.
    ADD COLUMN client_request_id VARCHAR(64),
    -- Which Master Character Reference governed this render, so swapping the
    -- reference is as comparable after the fact as changing the prompt.
    ADD COLUMN reference_version VARCHAR(32),
    -- The first-character flow lets the user choose between the original and
    -- the retry, so a retry needs to know what it is a retry of.
    ADD COLUMN retry_of_generation_id UUID REFERENCES pixel_generations (id);

UPDATE pixel_generations
SET spend_kind = CASE WHEN used_credit THEN 'PAID_CREDIT' ELSE 'FREE_FIRST' END
WHERE spend_kind IS NULL;

ALTER TABLE pixel_generations
    ALTER COLUMN spend_kind SET NOT NULL,
    ALTER COLUMN spend_kind SET DEFAULT 'PAID_CREDIT';

ALTER TABLE pixel_generations
    ADD CONSTRAINT pixel_generations_spend_kind_check
        CHECK (spend_kind IN
            ('FREE_FIRST', 'FREE_FIRST_RETRY', 'FREE_BONUS', 'PAID_CREDIT'));

CREATE UNIQUE INDEX pixel_generations_client_request_key
    ON pixel_generations (user_id, client_request_id)
    WHERE client_request_id IS NOT NULL;

CREATE INDEX pixel_generations_retry_of_idx
    ON pixel_generations (retry_of_generation_id)
    WHERE retry_of_generation_id IS NOT NULL;

-- Note on auditability: free currencies are intentionally NOT written to
-- credit_ledger, which tracks the paid balance and whose `balance_after` would
-- become meaningless if free grants were mixed in. Which free allowance a
-- generation consumed is recorded on the generation itself (`spend_kind`),
-- together with the timestamps above — enough to answer "why is my free
-- generation gone?" from data.
