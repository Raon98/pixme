-- A short note attached to "친해지고 싶어요" — delivered as the opening chat
-- message once (and only if) the wave becomes mutual. Never shown to the
-- recipient before that point; see ConnectionService for why.
ALTER TABLE connection_requests ADD COLUMN message VARCHAR(140);
