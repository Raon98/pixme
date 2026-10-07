package app.pixme.pixel.domain;

public enum GenerationFailureReason {
    UNSAFE_IMAGE,
    NO_PERSON_DETECTED,
    PROVIDER_ERROR,
    TIMEOUT,
    INTERNAL
}
