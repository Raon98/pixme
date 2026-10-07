package app.pixme.pixel.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import app.pixme.pixel.domain.UserCurrentPixel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserCurrentPixelRepository extends JpaRepository<UserCurrentPixel, UUID> {

    Optional<UserCurrentPixel> findByUserId(UUID userId);

    List<UserCurrentPixel> findByUserIdIn(Collection<UUID> userIds);

    /** Batch resolution for feed/square rendering: userId → characterId. */
    @Query("select u.userId, u.pixelCharacterId from UserCurrentPixel u where u.userId in :userIds")
    List<Object[]> findCharacterIdsByUserIds(@Param("userIds") Collection<UUID> userIds);
}
