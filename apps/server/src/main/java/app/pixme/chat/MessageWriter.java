package app.pixme.chat;

import app.pixme.chat.domain.Message;
import app.pixme.chat.repository.MessageRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The one write in {@link ChatService#send} that can lose a race, isolated in
 * its own transaction on purpose.
 *
 * <p>The client sends every message over both the socket and REST — whichever
 * lands first wins, idempotent on {@code clientMessageId} — so two inserts
 * racing on the same id is the expected case, not a bug. Catching the
 * resulting {@link DataIntegrityViolationException} inside the caller's own
 * {@code @Transactional} method does not actually recover anything: Hibernate
 * marks that transaction rollback-only at the moment the flush fails, so the
 * method returning normally afterward still blows up with
 * {@code UnexpectedRollbackException} when Spring tries to commit it.
 * {@code REQUIRES_NEW} runs the insert on its own connection, so a lost race
 * rolls back only this, and the caller's transaction is never touched by it.
 */
@Component
class MessageWriter {

    private final MessageRepository messageRepository;

    MessageWriter(MessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    /**
     * Throws {@link DataIntegrityViolationException} on a lost race rather
     * than swallowing it here: catching it inside this method would mark
     * *this* transaction rollback-only just the same, and returning normally
     * afterward would still blow up at commit. The proxy needs to see the
     * exception to roll back cleanly instead — the caller catches it once
     * that has already happened.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    Message insert(Message message) {
        return messageRepository.saveAndFlush(message);
    }
}
