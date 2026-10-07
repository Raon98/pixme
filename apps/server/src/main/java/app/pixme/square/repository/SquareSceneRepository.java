package app.pixme.square.repository;

import java.util.List;

import app.pixme.square.domain.SquareScene;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SquareSceneRepository extends JpaRepository<SquareScene, String> {

    /** Highest priority first; the service takes the first that matches now. */
    List<SquareScene> findByActiveTrueOrderByPriorityDesc();
}
