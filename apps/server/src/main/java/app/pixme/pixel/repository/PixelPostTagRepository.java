package app.pixme.pixel.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import app.pixme.pixel.domain.PixelPostTag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PixelPostTagRepository
        extends JpaRepository<PixelPostTag, PixelPostTag.Key> {

    @Query("select t.key.tag from PixelPostTag t where t.key.postId = :postId order by t.key.tag")
    List<String> findTagsByPostId(@Param("postId") UUID postId);

    /** Batch lookup so rendering N feed cards is one query, not N. */
    @Query("select t.key.postId, t.key.tag from PixelPostTag t where t.key.postId in :postIds")
    List<Object[]> findTagsByPostIds(@Param("postIds") Collection<UUID> postIds);

    @Modifying
    @Query("delete from PixelPostTag t where t.key.postId = :postId")
    void deleteByPostId(@Param("postId") UUID postId);

    /** Tag-based discovery within one day. */
    @Query("""
            select t.key.postId from PixelPostTag t, PixelPost p
            where t.key.postId = p.id
              and t.key.tag = :tag
              and p.postDate = :postDate
              and p.representative = true
              and p.visibility = 'PUBLIC'
              and p.deletedAt is null
            order by p.publishedAt desc
            """)
    List<UUID> findPostIdsByTagAndDate(
            @Param("tag") String tag,
            @Param("postDate") LocalDate postDate,
            Pageable pageable);
}
