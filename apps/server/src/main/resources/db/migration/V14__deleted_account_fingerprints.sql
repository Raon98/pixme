-- Survives account purge on purpose: it carries no personal data, only a
-- one-way hash of (provider, provider_user_id) — the hash input already
-- includes the provider, so it alone is enough to tell a re-signup apart
-- from a genuinely new account, without granting onboarding bonuses twice to
-- the same social identity.
CREATE TABLE deleted_account_fingerprints (
    identity_hash   VARCHAR(64)  PRIMARY KEY,
    provider        VARCHAR(32)  NOT NULL,
    purged_at       TIMESTAMPTZ  NOT NULL
);
