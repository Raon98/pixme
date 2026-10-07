package app.pixme.pixel.domain;

public enum GenerationStatus {
    QUEUED,
    PROCESSING,
    COMPLETED,
    FAILED,
    /** The uploaded photo failed the pre-generation safety screen. */
    REJECTED_UNSAFE;

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == REJECTED_UNSAFE;
    }

    /**
     * Any terminal state other than success returns what was spent.
     *
     * <p>This includes a photo rejected by the safety screen. The user did not
     * get a character, so they do not pay — "생성권은 사용되지 않았어요" has to be
     * literally true, including for the cases that are arguably their fault.
     */
    public boolean warrantsRefund() {
        return this == FAILED || this == REJECTED_UNSAFE;
    }
}
