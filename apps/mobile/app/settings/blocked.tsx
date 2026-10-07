import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import type { BlockedUser } from '@/api';
import { copy } from '@/constants/copy';
import { formatRelative } from '@/lib/format';
import { spacing, useTheme } from '@/theme';
import {
  Avatar,
  Button,
  ConfirmDialog,
  Divider,
  EmptyState,
  ErrorState,
  Header,
  ListSkeleton,
  Screen,
  Text,
  useToast,
} from '@/ui';
import { useBlockedUsers, useUnblockUser } from '@/features/safety/useSafety';

export default function BlockedUsersRoute() {
  const toast = useToast();
  const { colors } = useTheme();

  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();
  const [target, setTarget] = useState<BlockedUser | null>(null);

  if (blocked.isPending) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.settings.blocked} />
        <ListSkeleton />
      </Screen>
    );
  }

  if (blocked.isError) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.settings.blocked} />
        <ErrorState error={blocked.error} onRetry={() => void blocked.refetch()} />
      </Screen>
    );
  }

  if ((blocked.data ?? []).length === 0) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.settings.blocked} />
        <EmptyState icon="shield" title={copy.safety.emptyBlockedTitle} />
      </Screen>
    );
  }

  return (
    <>
      <Screen edges={['top']}>
        <Header title={copy.settings.blocked} />

        <FlatList
          data={blocked.data}
          keyExtractor={(item) => item.userId}
          ItemSeparatorComponent={() => <Divider inset />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={blocked.isRefetching}
              onRefresh={() => void blocked.refetch()}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar
                uri={item.representativeCharacterUrl}
                nickname={item.nickname}
                size={44}
              />
              <View style={styles.body}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {item.nickname}
                </Text>
                <Text variant="micro" tone="tertiary">
                  {formatRelative(item.blockedAt)} 차단
                </Text>
              </View>
              <Button
                label={copy.safety.unblock}
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={() => setTarget(item)}
              />
            </View>
          )}
          ListFooterComponent={
            <Text variant="micro" tone="tertiary" style={styles.note}>
              차단을 해제하면 서로의 PIXME가 다시 보일 수 있어요. 이전 대화는
              복구되지 않아요.
            </Text>
          }
        />
      </Screen>

      <ConfirmDialog
        visible={target !== null}
        title={`${target?.nickname ?? ''} 차단을 해제할까요?`}
        body="해제하면 서로의 오늘의 PIXME가 다시 보일 수 있어요."
        confirmLabel={copy.safety.unblock}
        loading={unblock.isPending}
        onConfirm={() => {
          if (!target) return;
          unblock.mutate(target.userId, {
            onSuccess: () => {
              setTarget(null);
              toast.show({ message: '차단을 해제했어요.', tone: 'success' });
            },
            onError: () =>
              toast.show({ message: copy.errors.generic, tone: 'error' }),
          });
        }}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  body: { flex: 1, marginHorizontal: spacing.md },
  note: { marginTop: spacing.xl },
});
