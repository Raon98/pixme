package app.pixme.user.repository;

import java.util.Optional;

import app.pixme.user.domain.ReservedSignupAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReservedSignupAssignmentRepository
        extends JpaRepository<ReservedSignupAssignment, String> {

    @Query("select a from ReservedSignupAssignment a where lower(a.email) = lower(:email)")
    Optional<ReservedSignupAssignment> findByEmailIgnoreCase(@Param("email") String email);
}
