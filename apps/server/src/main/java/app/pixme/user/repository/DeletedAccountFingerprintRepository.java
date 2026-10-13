package app.pixme.user.repository;

import app.pixme.user.domain.DeletedAccountFingerprint;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeletedAccountFingerprintRepository
        extends JpaRepository<DeletedAccountFingerprint, String> {

    boolean existsByIdentityHash(String identityHash);
}
