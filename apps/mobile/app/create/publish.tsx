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
  Header,
  PixelCharacter,
  Screen,
  Text,
  TextField,
  useToast,
} from '@/ui';
import { useGenerationStore } from '@/features/generation/generationStore';
import { useKeepGeneration } from '@/features/generation/useKeepGeneration';
import { useUpsertDailyStatus } from '@/features/dailyStatus/useUpsertDailyStatus';
import { usePushRegistration } from '@/features/notifications/useNotifications';

/**
 * Keep the new PIXME as Current, and optionally leave today's status.
 *
 * <p>Mood, message and tags are all optional — the character alone is a
 * complete Current PIXME switch. Unlike the old one-post-per-day model, this
 * never asks to "replace" anything: generating and keeping a new look is
 * always allowed, any number of times, because only the AI call itself was
 * ever paid for. We ask for push permission *here*, right after the first
 * keep, because "someone reacted to your PIXME" is now a concrete thing the
 * user wants rather than an abstract permission prompt at launch.
 */
export default function PublishRoute() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();

  const draft = useGenerationStore((state) => state.draft);
  const caption = useGenerationStore((state) => state.caption);
  const mood = useGenerationStore((state) => state.mood);
  const tags = useGenerationStore((state) => state.tags);
  const setCaption = useGenerationStore((state) => state.setCaption);
  const setMood = useGenerationStore((state) => state.setMood);
  const toggleTag = useGenerationStore((state) => state.toggleTag);

  const keep = useKeepGeneration();
  const upsertStatus = useUpsertDailyStatus();
  const { promptNow } = usePushRegistration();

  const [customTag, setCustomTag] = useState('');

  const generation = draft?.generation ?? null;
  const isPending = keep.isPending || upsertStatus.isPending;

  const suggestions = useMemo(() => {
    // Show selected custom tags alongside the suggestions so they stay
    // visible and removable.
    const extras = tags.filter((tag) => !SUGGESTED_TAGS.includes(tag));
    return [...extras, ...SUGGESTED_TAGS];
  }, [tags]);

  const onSubmit = useCallback(async () => {
    if (!generation) return;
    try {
      const character = await keep.mutateAsync({
        generationId: generation.id,
        body: { asCurrent: true, keepOriginal: true, label: null },
      });

      await upsertStatus.mutateAsync({
        mood,
        message: caption.trim() || null,
        tags,
        pixelCharacterId: character.id,
      });

      // First-keep moment: ask for notifications now.
      await promptNow();

      toast.show({
        message: copy.publish.successTitle,
        tone: 'success',
        icon: 'sparkle',
      });
      router.replace('/(tabs)');
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  }, [caption, generation, keep, mood, promptNow, router, tags, toast, upsertStatus]);

  const addCustomTag = useCallback(() => {
    const normalized = normalizeTag(customTag);
    if (!normalized) return;
    if (!tags.includes(normalized)) {
      toggleTag(normalized, config.rules.maxTagsPerPost);
    }
    setCustomTag('');
  }, [customTag, tags, toggleTag]);

  if (!generation?.characterImageUrl) {
    return (
      <Screen>
        <Header title={copy.publish.title} onBack={() => router.back()} />
        <View style={styles.center}>
          <Text variant="body" tone="secondary" align="center">
            먼저 PIXME를 만들어주세요.
          </Text>
          <Button
            label={copy.today.emptyCta}
            fullWidth={false}
            style={styles.cta}
            onPress={() => router.replace('/create')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={copy.publish.cta}
          loading={isPending}
          onPress={() => void onSubmit()}
        />
      }
    >
      <Header title={copy.publish.title} onBack={() => router.back()} />

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
            uri={generation.characterImageUrl}
            size={150}
            idle
            accessibilityLabel="오늘의 Current PIXME"
          />
        </View>

        <TextField
          label={copy.publish.captionLabel}
          value={caption}
          onChangeText={setCaption}
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
                  disabled={
                    !selected && tags.length >= config.rules.maxTagsPerPost
                  }
                  onPress={() => toggleTag(tag, config.rules.maxTagsPerPost)}
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
                    opacity:
                      tags.length >= config.rules.maxTagsPerPost
                        ? opacity.disabled
                        : 1,
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cta: { marginTop: spacing.lg, minWidth: 180 },
});
