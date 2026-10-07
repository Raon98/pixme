package app.pixme.pixel.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import app.pixme.ai.PixelStyle;
import app.pixme.store.domain.SpendKind;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One attempt at turning a photo into a character.
 *
 * <p>Several generations can exist per day — the user may press "다시
 * 만들어보기" — and each records exactly what it cost ({@code usedFreeGeneration}
 * / {@code usedCredit}) and which prompt version produced it. That pairing is
 * what makes both the automatic refund and prompt-version comparison possible
 * after the fact.
 */
@Entity
@Table(name = "pixel_generations")
@Getter
@Setter
@NoArgsConstructor
public class PixelGeneration {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private GenerationStatus status = GenerationStatus.QUEUED;

    @Enumerated(EnumType.STRING)
    @Column(name = "style", nullable = false, length = 32)
    private PixelStyle style = PixelStyle.PIXME_BASIC;

    @Column(name = "provider", nullable = false, length = 32)
    private String provider;

    @Column(name = "model", length = 64)
    private String model;

    @Column(name = "prompt_version", nullable = false, length = 32)
    private String promptVersion;

    @Column(name = "original_object_key", nullable = false, length = 512)
    private String originalObjectKey;

    @Column(name = "generated_object_key", length = 512)
    private String generatedObjectKey;

    /** Serialised {@code ImageAnalysis}; reused by variants and by prompt A/B. */
    @Column(name = "analysis_json")
    private String analysisJson;

    @Column(name = "progress", nullable = false)
    private short progress;

    @Enumerated(EnumType.STRING)
    @Column(name = "failure_reason", length = 32)
    private GenerationFailureReason failureReason;

    @Column(name = "error_message", length = 512)
    private String errorMessage;

    /**
     * Authoritative record of what this generation consumed, so the refund path
     * can return exactly that currency. The two booleans below are the
     * denormalised form the API already returns to the client.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "spend_kind", nullable = false, length = 24)
    private SpendKind spendKind = SpendKind.PAID_CREDIT;

    @Column(name = "used_free_generation", nullable = false)
    private boolean usedFreeGeneration;

    @Column(name = "used_credit", nullable = false)
    private boolean usedCredit;

    /**
     * Client-supplied idempotency key. A double-tapped button or a network
     * retry resolves to the same generation instead of a second charge.
     */
    @Column(name = "client_request_id", length = 64)
    private String clientRequestId;

    /** Which Master Character Reference governed this render. */
    @Column(name = "reference_version", length = 32)
    private String referenceVersion;

    /** Set when this is a re-render of an earlier generation's analysis. */
    @Column(name = "retry_of_generation_id")
    private UUID retryOfGenerationId;

    @Column(name = "credit_refunded_at")
    private Instant creditRefundedAt;

    @Column(name = "post_date", nullable = false)
    private LocalDate postDate;

    @Column(name = "attempt", nullable = false)
    private short attempt = 1;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    public static PixelGeneration create(
            UUID userId,
            String originalObjectKey,
            PixelStyle style,
            String provider,
            String promptVersion,
            LocalDate postDate,
            short attempt) {
        PixelGeneration generation = new PixelGeneration();
        generation.id = UUID.randomUUID();
        generation.userId = userId;
        generation.originalObjectKey = originalObjectKey;
        generation.style = style;
        generation.provider = provider;
        generation.promptVersion = promptVersion;
        generation.postDate = postDate;
        generation.attempt = attempt;
        generation.status = GenerationStatus.QUEUED;
        generation.progress = 0;
        generation.createdAt = Instant.now();
        return generation;
    }

    public void markProcessing(short progress) {
        this.status = GenerationStatus.PROCESSING;
        this.progress = progress;
        if (this.startedAt == null) {
            this.startedAt = Instant.now();
        }
    }

    public void markCompleted(String generatedObjectKey, String model, String analysisJson) {
        this.status = GenerationStatus.COMPLETED;
        this.generatedObjectKey = generatedObjectKey;
        this.model = model;
        this.analysisJson = analysisJson;
        this.progress = 100;
        this.completedAt = Instant.now();
        this.failureReason = null;
        this.errorMessage = null;
    }

    public void markFailed(GenerationFailureReason reason, String message) {
        // An unsafe photo is a distinct terminal state, not a failure: nothing
        // was charged for it and it must never trigger a refund.
        this.status = reason == GenerationFailureReason.UNSAFE_IMAGE
                ? GenerationStatus.REJECTED_UNSAFE
                : GenerationStatus.FAILED;
        this.failureReason = reason;
        this.errorMessage = message == null || message.length() <= 512
                ? message
                : message.substring(0, 512);
        this.progress = 100;
        this.completedAt = Instant.now();
    }

    public void markRefunded() {
        this.creditRefundedAt = Instant.now();
    }

    /** Records what was spent, keeping the denormalised flags consistent. */
    public void recordSpend(SpendKind kind) {
        this.spendKind = kind;
        this.usedFreeGeneration = kind.isFree();
        this.usedCredit = kind == SpendKind.PAID_CREDIT;
    }

    /** True when this generation consumed something that has not been returned. */
    public boolean isRefundable() {
        return creditRefundedAt == null && status.warrantsRefund();
    }
}
