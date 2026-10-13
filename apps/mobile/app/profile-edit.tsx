import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { errorMessage } from '@/api/errors';
import { copy } from '@/constants/copy';
import { INTERESTS } from '@/constants/interests';
import { config } from '@/lib/config';
import { spacing } from '@/theme';
import {
  Button,
  Chip,
  Header,
  Screen,
  Text,
  TextField,
  useToast,
} from '@/ui';
import {
  useMe,
  useNicknameAvailability,
  useUpdateMe,
} from '@/features/profile/useProfile';

const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

/**
 * Profile editing. Birth date is intentionally not editable here — changing it
 * would let someone work around the age floor after the fact, so it is a
 * support-side change.
 */
export default function ProfileEditRoute() {
  const router = useRouter();
  const toast = useToast();

  const me = useMe();
  const updateMe = useUpdateMe();

  const [nickname, setNickname] = useState(me.data?.nickname ?? '');
  const [bio, setBio] = useState(me.data?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(
    me.data?.interests ?? [],
  );

  const nicknameChanged = nickname.trim() !== (me.data?.nickname ?? '');
  const availability = useNicknameAvailability(
    nicknameChanged ? nickname : '',
    config.rules.minNicknameLength,
  );

  const nicknameError = useMemo(() => {
    const trimmed = nickname.trim();
    if (trimmed.length === 0) return copy.profileSetup.nicknameRequired;
    if (trimmed.length < config.rules.minNicknameLength) return null;
    if (!NICKNAME_PATTERN.test(trimmed)) {
      return copy.profileSetup.nicknameInvalid;
    }
    if (nicknameChanged && availability.state === 'taken') {
      return copy.profileSetup.nicknameTaken;
    }
    if (nicknameChanged && availability.state === 'forbidden') {
      return copy.profileSetup.nicknameForbidden;
    }
    return null;
  }, [availability.state, nickname, nicknameChanged]);

  const canSave =
    !nicknameError &&
    nickname.trim().length >= config.rules.minNicknameLength &&
    interests.length >= config.rules.minInterests &&
    (!nicknameChanged ||
      availability.state === 'available' ||
      availability.state === 'unknown');

  const onSave = async () => {
    try {
      await updateMe.mutateAsync({
        nickname: nickname.trim(),
        bio: bio.trim() || null,
        interests,
      });
      toast.show({ message: copy.profile.saved, tone: 'success' });
      router.back();
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <Screen
      edges={['top']}
      footer={
        <Button
          label={copy.common.save}
          disabled={!canSave}
          loading={updateMe.isPending}
          onPress={() => void onSave()}
        />
      }
    >
      <Header title={copy.my.editProfile} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <TextField
          label={copy.profile.nicknameLabel}
          value={nickname}
          onChangeText={setNickname}
          maxLength={config.rules.maxNicknameLength}
          showCounter
          autoCapitalize="none"
          autoCorrect={false}
          error={nicknameError}
          hint={
            nicknameChanged && availability.state === 'checking'
              ? copy.profileSetup.nicknameChecking
              : nicknameChanged && availability.state === 'available'
                ? copy.profileSetup.nicknameAvailable
                : undefined
          }
        />
        {nicknameChanged &&
        availability.state === 'taken' &&
        availability.suggestion ? (
          <Chip
            label={copy.profileSetup.nicknameSuggestion(
              availability.suggestion,
            )}
            onPress={() => setNickname(availability.suggestion!)}
            style={styles.suggestion}
          />
        ) : null}

        <TextField
          label={copy.profile.bioLabel}
          value={bio}
          onChangeText={setBio}
          placeholder={copy.profileSetup.bioPlaceholder}
          maxLength={config.rules.maxBioLength}
          showCounter
          multiline
          containerStyle={styles.field}
        />

        <View style={styles.field}>
          <Text variant="label" tone="secondary">
            {copy.profile.interests}
          </Text>
          <Text variant="micro" tone="tertiary" style={styles.hint}>
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

        {me.data?.birthDate ? (
          <Text variant="micro" tone="tertiary" style={styles.note}>
            {copy.profile.birthLocked}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.base, paddingBottom: spacing.xxl },
  field: { marginTop: spacing.xl },
  suggestion: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  hint: { marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  chip: { marginRight: spacing.xs, marginBottom: spacing.xs },
  note: { marginTop: spacing.xxl },
});
