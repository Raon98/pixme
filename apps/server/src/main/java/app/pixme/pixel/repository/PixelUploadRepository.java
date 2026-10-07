package app.pixme.pixel.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.pixel.domain.PixelUpload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PixelUploadRepository extends JpaRepository<PixelUpload, UUID> {

    Optional<PixelUpload> findByIdAndUserId(UUID id, UUID userId);

    /** Abandoned uploads: never consumed and past their expiry. Reaped nightly. */
    @Query("""
            select u from PixelUpload u
            where u.consumedAt is null and u.expiresAt < :threshold
            """)
    List<PixelUpload> findAbandoned(@Param("threshold") Instant threshold);

    List<PixelUpload> findByUserId(UUID userId);
}
