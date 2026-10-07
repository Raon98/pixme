package app.pixme.user.repository;

import java.util.List;

import app.pixme.user.domain.Interest;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterestRepository extends JpaRepository<Interest, String> {

    List<Interest> findByActiveTrueOrderBySortOrderAsc();
}
