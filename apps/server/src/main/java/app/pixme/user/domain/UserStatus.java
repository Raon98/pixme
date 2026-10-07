package app.pixme.user.domain;

public enum UserStatus {
    /** Signed in, but nickname / birth date / interests are not set yet. */
    PENDING_PROFILE,
    ACTIVE,
    SUSPENDED,
    /** Deletion requested; invisible everywhere, awaiting the hard purge. */
    DELETED
}
