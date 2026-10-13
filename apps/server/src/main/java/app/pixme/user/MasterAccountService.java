package app.pixme.user;

import java.util.UUID;

import app.pixme.config.PixmeProperties;
import app.pixme.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Accounts that bypass every paywall — see {@link PixmeProperties.Master}.
 *
 * <p>Deliberately matched by email rather than a stored flag: nothing to
 * migrate, nothing to forget to unset, and swapping the reviewer account for
 * a new one is a config change, not a deploy.
 */
@Service
public class MasterAccountService {

    private final UserRepository userRepository;
    private final PixmeProperties properties;

    public MasterAccountService(UserRepository userRepository, PixmeProperties properties) {
        this.userRepository = userRepository;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public boolean isMaster(UUID userId) {
        if (properties.master().emails().isEmpty()) {
            return false;
        }
        return userRepository
                .findById(userId)
                .map(user -> properties.master().isMaster(user.getEmail()))
                .orElse(false);
    }
}
