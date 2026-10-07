package app.pixme.pixel.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.pixel.domain.PixelCharacter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PixelCharacterRepository extends JpaRepository<PixelCharacter, UUID> {

    @Query("select c from PixelCharacter c where c.id = :id and c.deletedAt is null")
    Optional<PixelCharacter> findAlive(@Param("id") UUID id);

    Optional<PixelCharacter> findByIdAndUserId(UUID id, UUID userId);

    Optional<PixelCharacter> findByGenerationId(UUID generationId);

    /** The Collection, newest first. */
    @Query("""
            select c from PixelCharacter c
            where c.userId = :userId and c.deletedAt is null
            order by c.createdAt desc
            """)
    List<PixelCharacter> findCollection(@Param("userId") UUID userId);

    List<PixelCharacter> findByIdInAndUserId(Collection<UUID> ids, UUID userId);

    List<PixelCharacter> findByUserId(UUID userId);

    long countByUserIdAndDeletedAtIsNull(UUID userId);

    /** Originals past the retention window, for the privacy purge job. */
    @Query("""
            select c from PixelCharacter c
            where c.originalObjectKey is not null and c.createdAt < :threshold
            """)
    List<PixelCharacter> findWithExpiredOriginals(@Param("threshold") Instant threshold);
}
