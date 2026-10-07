package app.pixme.notification.domain;

public enum NotificationType {
    HEART,
    /** Deliberately anonymous: "누군가" waved, never who. */
    CONNECTION_REQUEST,
    CONNECTED,
    MESSAGE,
    REACTION_SPIKE,
    DAILY_REMINDER,
    GENERATION_COMPLETED,
    SYSTEM
}
