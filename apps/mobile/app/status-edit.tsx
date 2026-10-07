import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { errorMessage } from '@/api/errors';
import { copy } from '@/constants/copy';
import { MOODS } from '@/constants/moods';
import { normalizeTag, SUGGESTED_TAGS } from '@/constants/tags';
import { config } from '@/lib/config';
import { opacity, radius, spacing, useTheme } from '@/theme';
import {
  Button,
  Chip,
  EmptyState,
  Header,
  PixelCharacter,
  Screen,
  Text,
  TextField,
  useToast,
} from '@/ui';
import { useTodayStatus } from '@/features/feed/useTodayFeed';
import { useUpsertDailyStatus } from '@/features/dailyStatus/useUpsertDailyStatus';

/**
 * "오늘 상태 바꾸기" — free, and completely independent of generating a new
 * PIXME. Changing the Current PIXME is a separate, paid-or-not decision made
 * on the create flow; this screen only ever touches mood/message/tags.
 */
export default function StatusEditRoute() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();

  const todayStatus = useTodayStatus();
  const upsertStatus = useUpsertDailyStatus();

  const existing = todayStatus.data?.myTodayStatus ?? null;

  const [mood, setMood] = useState<string | null>(existing?.mood ?? null);
  const [message, setMessage] = useState(existing?.message ?? '');
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [customTag, setCustomTag] = useState('');

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
      toast.show({ message: '오늘의 상태를 남겼어요.', tone: 'success', icon: 'sparkle' });
      router.back();
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  }, [message, mood, router, tags, toast, upsertStatus]);

  if (todayStatus.isPending) return null;

  if (!existing && !todayStatus.data) {
    return (
      <Screen edges={['top']}>
        <Header title="오늘 상태 바꾸기" onBack={() => router.back()} />
        <EmptyState
          glyph="👾"
          title="먼저 PIXME를 만들어주세요."
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
          label="오늘의 상태 남기기"
          loading={upsertStatus.isPending}
          onPress={() => void onSubmit()}
        />
      }
    >
      <Header title="오늘 상태 바꾸기" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {existing?.characterImageUrl ? (
          <View
            style={[
              styles.stage,
              { backgroundColor: colors.stage, borderColor: colors.border },
            ]}
          >
            <PixelCharacter
              uri={existing.characterImageUrl}
              size={120}
              idle
              accessibilityLabel="오늘의 Current PIXME"
            />
          </View>
        ) : null}

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
            placeholder="직접 입력"
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
                추가
              </Text>
            }
          />
        </View>
      </ScrollView>
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
