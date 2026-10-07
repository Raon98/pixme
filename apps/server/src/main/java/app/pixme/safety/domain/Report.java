package app.pixme.safety.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reports")
@Getter
@Setter
@NoArgsConstructor
public class Report {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "reporter_id", nullable = false)
    private UUID reporterId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 24)
    private ReportTargetType targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    /**
     * Resolved at report time. A post or message may be deleted before a human
     * reviews the report; the account behind it still needs to be actionable.
     */
    @Column(name = "target_user_id")
    private UUID targetUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, length = 32)
    private ReportReason reason;

    @Column(name = "detail", length = 500)
    private String detail;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private ReportStatus status = ReportStatus.OPEN;

    @Column(name = "resolution", length = 32)
    private String resolution;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static Report create(
            UUID reporterId,
            ReportTargetType targetType,
            UUID targetId,
            UUID targetUserId,
            ReportReason reason,
            String detail) {
        Report report = new Report();
        report.id = UUID.randomUUID();
        report.reporterId = reporterId;
        report.targetType = targetType;
        report.targetId = targetId;
        report.targetUserId = targetUserId;
        report.reason = reason;
        report.detail = detail;
        report.status = ReportStatus.OPEN;
        report.createdAt = Instant.now();
        return report;
    }
}
