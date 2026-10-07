package app.pixme.chat.domain;

public enum MessageType {
    TEXT,
    /** Service-authored, e.g. the "마음이 통했어요" opener. No sender. */
    SYSTEM
}
