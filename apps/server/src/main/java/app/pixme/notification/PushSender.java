package app.pixme.notification;

import java.util.List;
import java.util.Map;

/** Transport abstraction, so Expo can be swapped for raw APNs/FCM later. */
public interface PushSender {

    record PushMessage(
            String token,
            String title,
            String body,
            Map<String, Object> data,
            boolean playSound,
            String channelId) {}

    /** @return tokens the service reported as permanently invalid */
    List<String> send(List<PushMessage> messages);
}
