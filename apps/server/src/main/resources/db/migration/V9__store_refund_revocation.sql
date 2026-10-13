-- A store (Apple/Google) can revoke a purchase after the fact — a refund, a
-- chargeback, family-sharing removal, or a subscription cancellation. Until
-- this migration there was no way to record that: `credit_ledger` had no
-- reason for "we are taking this back because the store did", so
-- `Purchase.markRevoked()` existed but nothing ever called it and nothing
-- could claw back the credits a refunded pack had granted.

ALTER TABLE credit_ledger DROP CONSTRAINT credit_ledger_reason_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_reason_check CHECK (reason IN
    ('PURCHASE', 'GENERATION', 'GENERATION_REFUND', 'SUBSCRIPTION_GRANT',
     'PROMOTION', 'REWARD_AD', 'REVOCATION'));

-- A revocation for a given purchase may happen at most once — the store can
-- (and does) send duplicate notifications for the same event.
CREATE UNIQUE INDEX credit_ledger_revocation_key
    ON credit_ledger (reference_id, reason)
    WHERE reason = 'REVOCATION';

-- Raw webhook deliveries, kept for replay/debugging and so a duplicate
-- notification (every store re-sends until it gets a 200) can be recognised
-- and skipped before it touches any business state.
CREATE TABLE store_webhook_events (
    id              UUID PRIMARY KEY,
    platform        VARCHAR(16) NOT NULL,
    notification_id VARCHAR(191) NOT NULL,
    notification_type VARCHAR(64) NOT NULL,
    payload         TEXT,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT store_webhook_events_unique UNIQUE (platform, notification_id)
);
