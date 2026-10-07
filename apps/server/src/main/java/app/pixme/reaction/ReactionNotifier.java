package app.pixme.reaction;

import java.util.UUID;

/**
 * Hook for heart notifications.
 *
 * <p>Implementations are expected to <em>group</em>: five hearts in an hour
 * should be one "5명이 하트를 보냈어요", not five pushes. Hearts are the most
 * frequent event in the product and the quickest way to make the app feel
 * noisy.
 */
public interface ReactionNotifier {

    void onHeartReceived(UUID authorId, UUID fromUserId, UUID postId);
}
