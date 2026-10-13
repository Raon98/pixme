package app.pixme.connection;

import app.pixme.connection.domain.Connection;
import app.pixme.connection.repository.ConnectionRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one write in {@link ConnectionService#createConnection} that can lose a
 * race, isolated in its own transaction for the same reason as
 * {@code app.pixme.chat.MessageWriter}: catching the resulting
 * {@link DataIntegrityViolationException} inside the caller's own
 * {@code @Transactional} method doesn't actually recover anything, because
 * Hibernate marks that transaction rollback-only at the moment the flush
 * fails — the method returning normally afterward still blows up with
 * {@code UnexpectedRollbackException} when Spring tries to commit it.
 * {@code REQUIRES_NEW} runs the insert on its own connection, so a lost race
 * rolls back only this, never the caller.
 */
@Component
class ConnectionWriter {

    private final ConnectionRepository connectionRepository;

    ConnectionWriter(ConnectionRepository connectionRepository) {
        this.connectionRepository = connectionRepository;
    }

    /** Throws on a lost race — see the class doc for why that's deliberate. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    Connection insert(Connection connection) {
        return connectionRepository.saveAndFlush(connection);
    }
}
