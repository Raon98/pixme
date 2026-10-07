package app.pixme.pixel.repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.pixel.domain.GenerationStatus;
import app.pixme.pixel.domain.PixelGeneration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PixelGenerationRepository extends JpaRepository<PixelGeneration, UUID> {

    Optional<PixelGeneration> findByIdAndUserId(UUID id, UUID userId);

    /** Idempotency lookup: the same client request resolves to the same row. */
    Optional<PixelGeneration> findByUserIdAndClientRequestId(UUID userId, String clientRequestId);

    /**
     * The first-character flow lets the user compare the original with its free
     * retry, so both candidates are fetched together.
     */
    List<PixelGeneration> findByUserIdAndRetryOfGenerationId(
            UUID userId, UUID retryOfGenerationId);

    long countByUserIdAndPostDate(UUID userId, LocalDate postDate);

    /** The newest completed-but-unpublished candidate, used to resume the flow. */
    @Query("""
            select g from PixelGeneration g
            where g.userId = :userId
              and g.postDate = :postDate
              and g.status = 'COMPLETED'
              and not exists (
                  select 1 from PixelPost p where p.generationId = g.id and p.deletedAt is null
              )
            order by g.createdAt desc
            """)
    List<PixelGeneration> findUnpublishedCandidates(
            @Param("userId") UUID userId, @Param("postDate") LocalDate postDate);

    /**
     * Generations stuck mid-flight — the process died, or the provider never
     * answered. The reaper fails them and refunds, so a crash can't silently
     * swallow a paid credit.
     */
    @Query("""
            select g from PixelGeneration g
            where g.status in ('QUEUED', 'PROCESSING') and g.createdAt < :threshold
            """)
    List<PixelGeneration> findStuck(@Param("threshold") Instant threshold);

    List<PixelGeneration> findByUserIdAndStatusOrderByCreatedAtDesc(
            UUID userId, GenerationStatus status);

    List<PixelGeneration> findByUserId(UUID userId);
}
