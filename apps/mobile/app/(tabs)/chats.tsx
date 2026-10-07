import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Conversation } from '@/api';
import { copy } from '@/constants/copy';
import { formatConversationTime, truncate } from '@/lib/format';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  Avatar,
  Badge,
  Divider,
  EmptyState,
  ErrorState,
  Header,
  ListSkeleton,
  PixelCharacter,
  Screen,
  Text,
} from '@/ui';
import { useConversations } from '@/features/chat/useConversations';
import { useSocketStatus } from '@/features/chat/useChatSocket';
import { useConnections } from '@/features/connections/useConnections';

/**
 * 대화 — only people with a mutual 👋 appear here.
 *
 * Incoming one-sided requests are deliberately NOT listed: showing "3 people
 * want to talk to you" would turn a light signal into a queue to triage, and
 * would leak who waved at you before you decided anything. The user discovers
 * them by waving back in the feed.
 */
export default function ChatsRoute() {
  const { colors } = useTheme();
  const router = useRouter();

  const conversations = useConversations();
  const connections = useConnections();
  const socketStatus = useSocketStatus();

  /** New connections that have no messages yet get their own top rail. */
  const { fresh, recent } = useMemo(() => {
    const items = conversations.data ?? [];
    return {
      fresh: items.filter((item) => item.lastMessage === null),
      recent: items.filter((item) => item.lastMessage !== null),
    };
  }, [conversations.data]);

  const header = (
    <Header
      large
      title={copy.chat.title}
      subtitle={
        socketStatus === 'open' || socketStatus === 'idle'
          ? undefined
          : copy.chat.reconnecting
      }
    />
  );

  if (conversations.isPending) {
    return (
      <Screen edges={['top']}>
        {header}
        <ListSkeleton />
      </Screen>
    );
  }

  if (conversations.isError) {
    return (
      <Screen edges={['top']}>
        {header}
        <ErrorState
          error={conversations.error}
          onRetry={() => void conversations.refetch()}
        />
      </Screen>
    );
  }

  if ((conversations.data ?? []).length === 0) {
    return (
      <Screen edges={['top']}>
        {header}
        <EmptyState
          glyph="👋"
          title={copy.chat.emptyTitle}
          body={copy.chat.emptyBody}
          actionLabel="오늘 구경하기"
          onAction={() => router.replace('/(tabs)')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {header}

      <FlatList
        data={recent}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <Divider inset />}
        refreshControl={
          <RefreshControl
            refreshing={conversations.isRefetching}
            onRefresh={() => {
              void conversations.refetch();
              void connections.refetch();
            }}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          fresh.length > 0 ? (
            <View style={styles.freshSection}>
              <Text variant="label" tone="secondary">
                {copy.chat.newConnections}
              </Text>
              <FlatList
                data={fresh}
                horizontal
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.freshRow}
                renderItem={({ item }) => (
                  <FreshConnection
                    conversation={item}
                    onPress={() => router.push(`/chat/${item.id}`)}
                  />
                )}
              />
              <Text variant="label" tone="secondary" style={styles.recentTitle}>
                {copy.chat.recent}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          fresh.length > 0 ? (
            <EmptyState
              compact
              title={copy.chat.emptyMessagesTitle}
              body={copy.chat.emptyMessagesBody}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            onPress={() => router.push(`/chat/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}

function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  const preview = conversation.lastMessage
    ? conversation.lastMessage.type === 'SYSTEM'
      ? copy.chat.systemConnected
      : truncate(conversation.lastMessage.content, 34)
    : copy.chat.emptyMessagesTitle;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${conversation.peer.nickname}와의 대화`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed ? { opacity: opacity.pressed } : null,
      ]}
    >
      <Avatar
        uri={conversation.peer.representativeCharacterUrl}
        nickname={conversation.peer.nickname}
        size={52}
        ring={conversation.unreadCount > 0 ? 'accent' : 'none'}
      />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.rowName}>
            {conversation.peer.nickname}
          </Text>
          {conversation.lastMessageAt ? (
            <Text variant="micro" tone="tertiary">
              {formatConversationTime(conversation.lastMessageAt)}
            </Text>
          ) : null}
        </View>

        <View style={styles.rowBottom}>
          <Text
            variant="caption"
            tone={conversation.unreadCount > 0 ? 'default' : 'secondary'}
            numberOfLines={1}
            style={styles.preview}
          >
            {conversation.inactive ? copy.chat.leftConversation : preview}
          </Text>
          <Badge count={conversation.unreadCount} />
        </View>
      </View>
    </Pressable>
  );
}

function FreshConnection({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${conversation.peer.nickname}와 대화 시작`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.freshItem,
        {
          backgroundColor: colors.connectionSubtle,
          borderColor: colors.connection,
          opacity: pressed ? opacity.pressed : 1,
        },
      ]}
    >
      <PixelCharacter
        uri={conversation.peer.representativeCharacterUrl}
        size={56}
      />
      <Text variant="micro" numberOfLines={1} style={styles.freshName}>
        {conversation.peer.nickname}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  rowBody: { flex: 1, marginLeft: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  rowName: { flex: 1, marginRight: spacing.sm },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
  },
  preview: { flex: 1, marginRight: spacing.sm },
  freshSection: { paddingTop: spacing.sm },
  freshRow: { paddingVertical: spacing.md },
  recentTitle: { marginTop: spacing.sm, marginBottom: spacing.xs },
  freshItem: {
    width: 80,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  freshName: { marginTop: spacing.xs, maxWidth: 68, textAlign: 'center' },
});
