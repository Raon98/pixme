-- `SpendKind.MASTER` records a generation that debited nothing at all, which is
-- how master accounts (PIXME_MASTER_EMAILS) and seeded reviewer characters are
-- charged. The enum gained the value but this CHECK still rejected it, so every
-- such insert failed its constraint — master accounts could not generate at
-- all, and the reserved-signup seeding silently failed on the same write.
ALTER TABLE pixel_generations
    DROP CONSTRAINT pixel_generations_spend_kind_check;

ALTER TABLE pixel_generations
    ADD CONSTRAINT pixel_generations_spend_kind_check
        CHECK (spend_kind IN
            ('FREE_FIRST', 'FREE_FIRST_RETRY', 'FREE_BONUS', 'PAID_CREDIT', 'MASTER'));
