package app.pixme.connection.domain;

public enum ConnectionRequestStatus {
    /** One-sided wave. The recipient is never shown a queue of these. */
    REQUESTED,
    CONNECTED,
    CANCELLED,
    BLOCKED
}
