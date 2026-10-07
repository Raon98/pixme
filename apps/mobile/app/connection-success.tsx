import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { copy } from '@/constants/copy';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';
import { Button, PixelCharacter, Screen, Text } from '@/ui';
import { useAcknowledgeConnection } from '@/features/connections/useConnectionRequest';
import { useConnections } from '@/features/connections/useConnections';

/**
 * Mutual connection celebration.
 *
 * Shown once per connection. Tone matters a lot here: this is the moment the
 * app is most at risk of feeling like a dating match screen, so the copy
 * credits the PIXME ("오늘의 PIXME를 계기로"), the two characters simply stand
 * next to each other, and "나중에" is a first-class option.
 */
export default function ConnectionSuccessRoute() {
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const connections = useConnections();
  const acknowledge = useAcknowledgeConnection();

  const connection = useMemo(
    () =>
      connections.data?.connections.find((item) => item.id === connectionId) ??
      null,
    [connectionId, connections.data],
  );

  useEffect(() => {
    haptics.celebrate();
  }, []);

  useEffect(() => {
    if (connection && !connection.acknowledged) {
      acknowledge.mutate(connection);
    }
    // Acknowledge exactly once per connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.id]);

  const close = () => router.back();

  return (
    <Screen
      background="elevated"
      footer={
        <View>
          <Button
            label={copy.reactions.connectedCta}
            disabled={!connection}
            onPress={() => {
              if (!connection) return;
              router.replace(`/chat/${connection.conversationId}`);
            }}
          />
          <Button
            label={copy.reactions.connectedLater}
            variant="ghost"
            onPress={close}
            style={styles.ghost}
          />
        </View>
      }
    >
      <View style={styles.body}>
        <Animated.View entering={FadeIn.duration(260)}>
          <Text variant="title1" align="center">
            {copy.reactions.connectedTitle}
          </Text>
          <Text
            variant="body"
            tone="secondary"
            align="center"
            style={styles.subtitle}
          >
            {copy.reactions.connectedBody}
          </Text>
        </Animated.View>

        <Animated.View
          entering={ZoomIn.duration(320).delay(120)}
          style={[
            styles.stage,
            { backgroundColor: colors.connectionSubtle, borderColor: colors.connection },
          ]}
        >
          <PixelCharacter
            uri={connection?.peer.representativeCharacterUrl ?? null}
            size={120}
            idle
            idleVariant={1}
            accessibilityLabel={
              connection ? `${connection.peer.nickname}의 PIXME` : 'PIXME'
            }
          />
          <Text style={styles.spark}>✨</Text>
        </Animated.View>

        {connection ? (
          <Text variant="title3" align="center" style={styles.nickname}>
            @{connection.peer.nickname}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { marginTop: spacing.md, maxWidth: 300 },
  stage: {
    marginTop: spacing.xxxl,
    padding: spacing.xl,
    borderRadius: radius.xxl,
    borderWidth: 1,
    alignItems: 'center',
  },
  spark: { fontSize: 26, marginTop: spacing.sm },
  nickname: { marginTop: spacing.lg },
  ghost: { marginTop: spacing.xs },
});
