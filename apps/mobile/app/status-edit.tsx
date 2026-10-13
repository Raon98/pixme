import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { errorMessage } from '@/api/errors';
import { copy } from '@/constants/copy';
import { MOODS } from '@/constants/moods';
import { normalizeTag, SUGGESTED_TAGS } from '@/constants/tags';
import { config } from '@/lib/config';
import { storage, StorageKey } from '@/lib/storage';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Header,
  ListSkeleton,
  PixelCharacter,
  Screen,
  Text,
  TextField,
  useToast,
} from '@/ui';
import { useMe } from '@/features/profile/useProfile';
import { useTodayStatus } from '@/features/feed/useTodayFeed';
import { useUpsertDailyStatus } from '@/features/dailyStatus/useUpsertDailyStatus';
import { usePushRegistration } from '@/features/notifications/useNotifications';

/**
 * `copy.today.statusCta` — free, and completely independent of generating a new
 * PIXME. Changing the Current PIXME is a separate, paid-or-not decision made
 * on the create flow; this screen only ever touches mood/message/tags.
 */
export default function StatusEditRoute() {
  const router = useRouter();
  const toast = useToast();
  const { promptNow } = usePushRegistration();
  const { colors } = useTheme();

  const todayStatus = useTodayStatus();
  const upsertStatus = useUpsertDailyStatus();
  const me = useMe();

  /** Today's status, if one has already been left. Null is the normal case. */
  const existing = todayStatus.data?.myTodayStatus ?? null;

  /**
   * What this screen actually requires is a *character* — the status points at
   * one. It used to gate on `existing` instead, which meant anyone who had not
   * yet left today's status (that is, everyone this screen is for) was told to
   * go and make a PIXME they already had. Leaving a status was only ever
   * reachable as an edit of one that somehow already existed.
   */
  const characterUrl =
    existing?.characterImageUrl ?? me.data?.representativeCharacterUrl ?? null;

  const [mood, setMood] = useState<string | null>(existing?.mood ?? null);
  const [message, setMessage] = useState(existing?.message ?? '');
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [customTag, setCustomTag] = useState('');
  const [askingPush, setAskingPush] = useState(false);

  /**
   * `useState` initial values are only read on the first render, and on a
   * cold open `todayStatus` has not resolved yet — so the form used to come
   * up blank and then overwrite today's real mood/message/tags with that
   * blankness on submit, since the request is a full upsert. Seeded once,
   * when the data actually lands, and never again (so it can't stomp on
   * edits in progress when the query refetches).
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !existing) return;
    seeded.current = true;
    setMood(existing.mood ?? null);
    setMessage(existing.message ?? '');
    setTags(existing.tags ?? []);
  }, [existing]);

  const suggestions = useMemo(() => {
    const extras = tags.filter((tag) => !SUGGESTED_TAGS.includes(tag));
    return [...extras, ...SUGGESTED_TAGS];
  }, [tags]);

  const toggleTag = useCallback((tag: string) => {
    setTags((current) => {
      if (current.includes(tag)) return current.filter((item) => item !== tag);
      if (current.length >= config.rules.maxTagsPerPost) return current;
      return [...current, tag];
    });
  }, []);

  const addCustomTag = useCallback(() => {
    const normalized = normalizeTag(customTag);
    if (!normalized) return;
    if (!tags.includes(normalized)) toggleTag(normalized);
    setCustomTag('');
  }, [customTag, tags, toggleTag]);

  const onSubmit = useCallback(async () => {
    try {
      await upsertStatus.mutateAsync({
        mood,
        message: message.trim() || null,
        tags,
      });
      toast.show({
        message: copy.today.statusDoneTitle,
        tone: 'success',
        icon: 'sparkle',
      });

      // Leaving a status is the first thing most people do, and for anyone who
      // never buys a generation it is the only moment we get: the prompt used
      // to live solely after a paid publish, so free users were never asked
      // and had no way to hear about a like, a mutual 👋 or a message.
      const alreadyAsked = await storage.getItem<boolean>(
        StorageKey.PushPromptSeen,
      );
      if (alreadyAsked) {
        router.back();
        return;
      }
      setAskingPush(true);
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  }, [message, mood, router, tags, toast, upsertStatus]);

  const resolvePushPrompt = useCallback(
    async (accepted: boolean) => {
      setAskingPush(false);
      await storage.setItem(StorageKey.PushPromptSeen, true);
      // The OS dialog is only worth spending after our own explanation, since
      // iOS never shows it a second time.
      if (accepted) await promptNow();
      router.back();
    },
    [promptNow, router],
  );

  if (todayStatus.isPending || me.isPending) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.today.statusCta} onBack={() => router.back()} />
        <ListSkeleton />
      </Screen>
    );
  }

  // A load failure must not be dressed up as "you don't have a PIXME yet" —
  // that reads as an empty account and pushes the user into the paid create
  // flow to fix a network error.
  if (todayStatus.isError) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.today.statusCta} onBack={() => router.back()} />
        <ErrorState error={todayStatus.error} onRetry={() => void todayStatus.refetch()} />
      </Screen>
    );
  }

  if (!characterUrl) {
    return (
      <Screen edges={['top']}>
        <Header title={copy.today.statusCta} onBack={() => router.back()} />
        <EmptyState
          icon="sparkle"
          title={copy.create.needPixelFirst}
          actionLabel={copy.today.emptyCta}
          onAction={() => router.replace('/create')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={copy.today.statusCta}
          loading={upsertStatus.isPending}
          onPress={() => void onSubmit()}
        />
      }
    >
      <Header title={copy.today.statusCta} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.stage,
            { backgroundColor: colors.stage, borderColor: colors.border },
          ]}
        >
          <PixelCharacter
            uri={characterUrl}
            size={120}
            idle
            accessibilityLabel={copy.a11y.todayCurrentPixel}
          />
        </View>

        <TextField
          label={copy.publish.captionLabel}
          value={message}
          onChangeText={setMessage}
          placeholder={copy.publish.captionPlaceholder}
          maxLength={config.rules.maxCaptionLength}
          showCounter
          containerStyle={styles.section}
        />

        <View style={styles.section}>
          <Text variant="label" tone="secondary">
            {copy.publish.moodLabel}
          </Text>
          <View style={styles.moods}>
            {MOODS.map((item) => {
              const selected = mood === item.code;
              return (
                <Chip
                  key={item.code}
                  label={item.label}
                  prefix={item.emoji}
                  selected={selected}
                  size="sm"
                  style={styles.chip}
                  onPress={() => setMood(selected ? null : item.code)}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="label" tone="secondary">
            {copy.publish.tagLabel}
          </Text>
          <Text variant="micro" tone="tertiary" style={styles.tagHint}>
            {copy.publish.tagHint}
          </Text>

          <View style={styles.tags}>
            {suggestions.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <Chip
                  key={tag}
                  label={`#${tag}`}
                  selected={selected}
                  size="sm"
                  style={styles.chip}
                  disabled={!selected && tags.length >= config.rules.maxTagsPerPost}
                  onPress={() => toggleTag(tag)}
                />
              );
            })}
          </View>

          <TextField
            value={customTag}
            onChangeText={setCustomTag}
            placeholder={copy.publish.customTagPlaceholder}
            maxLength={12}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={addCustomTag}
            containerStyle={styles.customTag}
            right={
              <Text
                variant="label"
                tone="accent"
                onPress={addCustomTag}
                style={[
                  styles.addTag,
                  {
                    opacity: tags.length >= config.rules.maxTagsPerPost ? opacity.disabled : 1,
                  },
                ]}
              >
                {copy.publish.addTag}
              </Text>
            }
          />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={askingPush}
        title={copy.notifications.promptTitle}
        body={copy.notifications.promptBody}
        confirmLabel={copy.notifications.promptAccept}
        cancelLabel={copy.notifications.promptDecline}
        onConfirm={() => void resolvePushPrompt(true)}
        onCancel={() => void resolvePushPrompt(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  stage: {
    alignSelf: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { marginTop: spacing.xl },
  moods: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  chip: { marginRight: spacing.xs, marginBottom: spacing.xs },
  tagHint: { marginTop: spacing.xs },
  customTag: { marginTop: spacing.sm },
  addTag: { paddingHorizontal: spacing.xs },
});
