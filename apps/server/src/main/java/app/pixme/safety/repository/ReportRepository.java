package app.pixme.safety.repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import app.pixme.safety.domain.Report;
import app.pixme.safety.domain.ReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportRepository extends JpaRepository<Report, UUID> {

    @Query("""
            select count(r) from Report r
            where r.reporterId = :reporterId and r.createdAt >= :since
            """)
    long countByReporterSince(
            @Param("reporterId") UUID reporterId, @Param("since") Instant since);

    boolean existsByReporterIdAndTargetTypeAndTargetIdAndStatus(
            UUID reporterId,
            app.pixme.safety.domain.ReportTargetType targetType,
            UUID targetId,
            ReportStatus status);

    /**
     * Distinct reporters against one account since a cutoff. Used by the
     * auto-escalation rule: several independent reports in a short window
     * suspend the account pending review rather than waiting for a human.
     */
    @Query("""
            select count(distinct r.reporterId) from Report r
            where r.targetUserId = :targetUserId and r.createdAt >= :since
            """)
    long countDistinctReportersAgainst(
            @Param("targetUserId") UUID targetUserId, @Param("since") Instant since);

    List<Report> findByStatusOrderByCreatedAtAsc(ReportStatus status);
}
