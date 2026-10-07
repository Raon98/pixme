import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { INTERESTS } from '@/constants/interests';
import { copy } from '@/constants/copy';
import { analytics } from '@/lib/analytics';
import { calculateAge } from '@/lib/format';
import { config } from '@/lib/config';
import { spacing, useTheme } from '@/theme';
import { Button, Chip, Screen, Text, TextField, useToast } from '@/ui';
import {
  useNicknameAvailability,
  useUpdateMe,
} from '@/features/profile/useProfile';

type Step = 'nickname' | 'birth' | 'interests' | 'bio' | 'done';

const STEP_ORDER: Step[] = ['nickname', 'birth', 'interests', 'bio', 'done'];

const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

/**
 * First-run profile setup.
 *
 * Four short steps, each one screen, each independently valid — the point is
 * to reach "첫 PIXME를 만들어볼까요?" quickly, not to collect a full profile.
 * Only nickname, birth date and at least one interest are required; the bio is
 * optional and skippable.
 */
export default function ProfileSetupRoute() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const updateMe = useUpdateMe();

  const [step, setStep] = useState<Step>('nickname');
  const [nickname, setNickname] = useState('');
  const [birth, setBirth] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  const availability = useNicknameAvailability(
    nickname,
    config.rules.minNicknameLength,
  );

  const nicknameError = useMemo(() => {
    const trimmed = nickname.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length < config.rules.minNicknameLength) return null;
    if (!NICKNAME_PATTERN.test(trimmed)) {
      return '한글, 영문, 숫자, _만 쓸 수 있어요.';
    }
    if (availability.state === 'taken') return copy.profileSetup.nicknameTaken;
    return null;
  }, [availability.state, nickname]);

  const birthDate = useMemo(() => parseBirth(birth), [birth]);

  const birthError = useMemo(() => {
    if (birth.replace(/\D/g, '').length < 8) return null;
    if (!birthDate) return '날짜를 다시 확인해주세요.';
    const age = calculateAge(birthDate);
    if (age < config.rules.minAge) return copy.profileSetup.birthTooYoung;
    if (age > 100) return '날짜를 다시 확인해주세요.';
    return null;
  }, [birth, birthDate]);

  const canContinue = useMemo(() => {
    switch (step) {
      case 'nickname':
        return (
          nickname.trim().length >= config.rules.minNicknameLength &&
          !nicknameError &&
          availability.state === 'available'
        );
      case 'birth':
        return !!birthDate && !birthError;
      case 'interests':
        return interests.length >= config.rules.minInterests;
      case 'bio':
      case 'done':
        return true;
    }
  }, [
    availability.state,
    birthDate,
    birthError,
    interests.length,
    nickname,
    nicknameError,
    step,
  ]);

  const advance = useCallback(() => {
    const index = STEP_ORDER.indexOf(step);
    const next = STEP_ORDER[index + 1];
    if (next) setStep(next);
  }, [step]);

  const submit = useCallback(async () => {
    if (!birthDate) return;
    try {
      await updateMe.mutateAsync({
        nickname: nickname.trim(),
        birthDate,
        interests,
        bio: bio.trim() || null,
      });
      analytics.track('PROFILE_SETUP_COMPLETED', {
        interestCount: interests.length,
        hasBio: bio.trim().length > 0,
      });
      setStep('done');
    } catch {
      toast.show({ message: copy.errors.generic, tone: 'error' });
    }
  }, [bio, birthDate, interests, nickname, toast, updateMe]);

  /* ---------------------------------------------------------------- render */

  if (step === 'done') {
    return (
      <Screen
        footer={
          <View>
            <Button
              label={copy.profileSetup.doneCta}
              onPress={() => router.replace('/create')}
            />
            <Button
              label={copy.profileSetup.doneLater}
              variant="ghost"
              onPress={() => router.replace('/(tabs)')}
              style={styles.secondary}
            />
          </View>
        }
      >
        <View style={styles.doneBody}>
          <Text style={styles.doneGlyph}>👾</Text>
          <Text variant="title1" align="center">
            {copy.profileSetup.done}
          </Text>
          <Text
            variant="body"
            tone="secondary"
            align="center"
            style={styles.doneText}
          >
            {copy.profileSetup.doneBody}
          </Text>
        </View>
      </Screen>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <Screen
      footer={
        <View>
          <Button
            label={step === 'bio' ? copy.common.done : copy.common.next}
            disabled={!canContinue}
            loading={updateMe.isPending}
            onPress={() => {
              if (step === 'bio') void submit();
              else advance();
            }}
          />
          {step === 'bio' ? (
            <Button
              label={copy.profileSetup.skip}
              variant="ghost"
              onPress={() => {
                setBio('');
                void submit();
              }}
              style={styles.secondary}
            />
          ) : null}
        </View>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progress}>
          {STEP_ORDER.slice(0, 4).map((item, index) => (
            <View
              key={item}
              style={[
                styles.progressSegment,
                {
                  backgroundColor:
                    index <= stepIndex ? colors.accent : colors.border,
                },
              ]}
            />
          ))}
        </View>

        {step === 'nickname' ? (
          <View style={styles.step}>
            <Text variant="title1">{copy.profileSetup.nicknameTitle}</Text>
            <Text variant="caption" tone="secondary" style={styles.hint}>
              {copy.profileSetup.nicknameHint}
            </Text>
            <TextField
              value={nickname}
              onChangeText={setNickname}
              placeholder={copy.profileSetup.nicknamePlaceholder}
              maxLength={config.rules.maxNicknameLength}
              showCounter
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              error={nicknameError}
              hint={
                availability.state === 'checking'
                  ? '확인 중…'
                  : availability.state === 'available'
                    ? '사용할 수 있어요.'
                    : undefined
              }
              containerStyle={styles.field}
            />
          </View>
        ) : null}

        {step === 'birth' ? (
          <View style={styles.step}>
            <Text variant="title1">{copy.profileSetup.birthTitle}</Text>
            <Text variant="caption" tone="secondary" style={styles.hint}>
              {copy.profileSetup.birthHint}
            </Text>
            <TextField
              value={birth}
              onChangeText={(value) => setBirth(formatBirthInput(value))}
              placeholder="YYYY.MM.DD"
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
              error={birthError}
              containerStyle={styles.field}
            />
          </View>
        ) : null}

        {step === 'interests' ? (
          <View style={styles.step}>
            <Text variant="title1">{copy.profileSetup.interestTitle}</Text>
            <Text variant="caption" tone="secondary" style={styles.hint}>
              {copy.profileSetup.interestHint}
            </Text>
            <View style={styles.chips}>
              {INTERESTS.map((interest) => {
                const selected = interests.includes(interest.code);
                return (
                  <Chip
                    key={interest.code}
                    label={interest.label}
                    prefix={interest.emoji}
                    selected={selected}
                    style={styles.chip}
                    onPress={() =>
                      setInterests((current) =>
                        selected
                          ? current.filter((code) => code !== interest.code)
                          : current.length >= config.rules.maxInterests
                            ? current
                            : [...current, interest.code],
                      )
                    }
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 'bio' ? (
          <View style={styles.step}>
            <Text variant="title1">{copy.profileSetup.bioTitle}</Text>
            <Text variant="caption" tone="secondary" style={styles.hint}>
              {copy.profileSetup.bioHint}
            </Text>
            <TextField
              value={bio}
              onChangeText={setBio}
              placeholder={copy.profileSetup.bioPlaceholder}
              maxLength={config.rules.maxBioLength}
              showCounter
              multiline
              autoFocus
              containerStyle={styles.field}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ helpers */

/** Masks raw digits into `YYYY.MM.DD` as the user types. */
function formatBirthInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

/** Returns an ISO date (`YYYY-MM-DD`) or null when the input isn't a real day. */
function parseBirth(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', paddingTop: spacing.lg },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  step: { paddingTop: spacing.xxl },
  hint: { marginTop: spacing.md },
  field: { marginTop: spacing.xl },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xl,
  },
  chip: { marginRight: spacing.sm, marginBottom: spacing.sm },
  secondary: { marginTop: spacing.xs },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  doneGlyph: { fontSize: 64, marginBottom: spacing.xl },
  doneText: { marginTop: spacing.base },
});
