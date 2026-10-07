import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { chatApi, type Message } from '@/api';
import { copy } from '@/constants/copy';
import { analytics } from '@/lib/analytics';
import { formatClock } from '@/lib/format';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  ListSkeleton,
  Screen,
  Sheet,
  Text,
  useToast,
} from '@/ui';
import { useAuthStore } from '@/features/auth/authStore';
import { useSocketStatus } from '@/features/chat/useChatSocket';
import {
  flattenMessages,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from '@/features/chat/useMessages';
import { useBlockUser } from '@/features/safety/useSafety';

/**
 * 1:1 chat.
 *
 * Text-only on purpose for v1: photo and voice would re-introduce exactly the
 * risks that identity-free sign-up is designed to avoid, and the product's
 * conversation starter is already the character, not an album.
 */
export default function ChatRoute() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const myId = useAuthStore((state) => state.user?.id ?? null);
  const socketStatus = useSocketStatus();

  const conversation = useQuery({
    queryKey: ['chat', 'conversation', conversationId],
    queryFn: () => chatApi.conversation(conversationId),
    staleTime: 30_000,
  });

  const messages = useMessages(conversationId);
  const { send, isPending } = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const blockUser = useBlockUser();

  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [blockPrompt, setBlockPrompt] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const items = useMemo(() => flattenMessages(messages.data), [messages.data]);

  useEffect(() => {
    analytics.track('CHAT_STARTED', { conversationId });
  }, [conversationId]);

  /* Mark read whenever the newest message changes. */
  useEffect(() => {
    const newest = items[0];
    if (newest && newest.senderId !== myId && !newest.readAt) {
      markRead(newest.id);
    }
  }, [items, markRead, myId]);

  const peer = conversation.data?.peer;
  const inactive = conversation.data?.inactive ?? false;

  const onSend = useCallback(() => {
    const value = draft;
    if (!value.trim()) return;
    setDraft('');
    send(value);
  }, [draft, send]);

  const header = (
    <Header
      title={peer?.nickname ?? ''}
      subtitle={socketStatus === 'open' ? undefined : copy.chat.reconnecting}
      right={
        <IconButton label="더보기" onPress={() => setMenuOpen(true)}>
          <Icon name="more" size={20} color={colors.text} />
        </IconButton>
      }
    />
  );

  if (messages.isPending || conversation.isPending) {
    return (
      <Screen edges={['top']}>
        {header}
        <ListSkeleton count={5} />
      </Screen>
    );
  }

  if (messages.isError || conversation.isError) {
    return (
      <Screen edges={['top']}>
        {header}
        <ErrorState
          error={messages.error ?? conversation.error}
          onRetry={() => {
            void messages.refetch();
            void conversation.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <>
      <Screen edges={['top']} gutter={false}>
        <View style={styles.headerWrap}>{header}</View>

        {/* peer summary */}
        {peer ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${peer.nickname}의 프로필 열기`}
            onPress={() => router.push(`/user/${peer.id}`)}
            style={({ pressed }) => [
              styles.peerBar,
              {
                borderBottomColor: colors.border,
                opacity: pressed ? opacity.pressed : 1,
              },
            ]}
          >
            <Avatar
              uri={peer.representativeCharacterUrl}
              nickname={peer.nickname}
              size={36}
              ring="connection"
            />
            <Text variant="caption" tone="secondary" style={styles.peerText}>
              오늘의 PIXME를 계기로 연결된 사이예요.
            </Text>
            <Icon name="chevron-right" size={16} color={colors.textTertiary} />
          </Pressable>
        ) : null}

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            inverted
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage) {
                void messages.fetchNextPage();
              }
            }}
            ListEmptyComponent={
              <EmptyState
                compact
                glyph="💬"
                title={copy.chat.emptyMessagesTitle}
                body={copy.chat.systemConnected}
              />
            }
            renderItem={({ item }) => (
              <MessageBubble message={item} mine={item.senderId === myId} />
            )}
          />

          {inactive ? (
            <View
              style={[
                styles.disabledBar,
                { borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md },
              ]}
            >
              <Text variant="caption" tone="tertiary" align="center">
                {copy.chat.leftConversation}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.composer,
                {
                  borderTopColor: colors.border,
                  backgroundColor: colors.background,
                  paddingBottom: insets.bottom + spacing.sm,
                },
              ]}
            >
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder={copy.chat.inputPlaceholder}
                placeholderTextColor={colors.textTertiary}
                selectionColor={colors.accent}
                multiline
                maxLength={500}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              />
              <IconButton
                label="보내기"
                variant="surface"
                size={40}
                disabled={!draft.trim() || isPending}
                onPress={onSend}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: draft.trim()
                      ? colors.accent
                      : colors.surfaceSubtle,
                  },
                ]}
              >
                <Icon
                  name="send"
                  size={18}
                  color={draft.trim() ? colors.textOnAccent : colors.textTertiary}
                />
              </IconButton>
            </View>
          )}
        </KeyboardAvoidingView>
      </Screen>

      <Sheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={peer ? `@${peer.nickname}` : ''}
      >
        <Button
          label={copy.safety.report}
          variant="secondary"
          icon={<Icon name="flag" size={18} color={colors.text} />}
          onPress={() => {
            setMenuOpen(false);
            if (!peer) return;
            router.push({
              pathname: '/report',
              params: {
                targetType: 'USER',
                targetId: peer.id,
                nickname: peer.nickname,
              },
            });
          }}
        />
        <Button
          label={copy.safety.block}
          variant="ghost"
          onPress={() => {
            setMenuOpen(false);
            setBlockPrompt(true);
          }}
          style={styles.menuSecondary}
        />
      </Sheet>

      <ConfirmDialog
        visible={blockPrompt}
        title={copy.safety.blockTitle}
        body={copy.safety.blockBody}
        confirmLabel={copy.safety.block}
        destructive
        loading={blockUser.isPending}
        onConfirm={() => {
          if (!peer) return;
          blockUser.mutate(peer.id, {
            onSuccess: () => {
              setBlockPrompt(false);
              toast.show({ message: copy.safety.blockedTitle, tone: 'success' });
              router.replace('/(tabs)/chats');
            },
          });
        }}
        onCancel={() => setBlockPrompt(false)}
      />
    </>
  );
}

function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const { colors } = useTheme();

  if (message.type === 'SYSTEM') {
    return (
      <View style={styles.systemWrap}>
        <View
          style={[
            styles.systemBubble,
            { backgroundColor: colors.connectionSubtle },
          ]}
        >
          <Text variant="micro" tone="secondary" align="center">
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.accent, borderBottomRightRadius: radius.xs }
            : {
                backgroundColor: colors.surfaceSubtle,
                borderBottomLeftRadius: radius.xs,
              },
        ]}
      >
        <Text variant="body" tone={mine ? 'onAccent' : 'default'}>
          {message.content}
        </Text>
      </View>
      <Text variant="micro" tone="tertiary" style={styles.time}>
        {formatClock(message.createdAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerWrap: { paddingHorizontal: spacing.lg },
  peerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  peerText: { flex: 1, marginHorizontal: spacing.md },
  list: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  bubbleRowMine: { flexDirection: 'row-reverse' },
  bubble: {
    maxWidth: '76%',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.base,
  },
  time: { marginHorizontal: spacing.sm },
  systemWrap: { alignItems: 'center', marginVertical: spacing.base },
  systemBubble: {
    maxWidth: '86%',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  sendButton: { marginLeft: spacing.sm },
  disabledBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  menuSecondary: { marginTop: spacing.xs },
});
