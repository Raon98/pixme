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
    if (trimmed.length === 0) return '닉네임을 입력해주세요.';
    if (trimmed.length < config.rules.minNicknameLength) return null;
    if (!NICKNAME_PATTERN.test(trimmed)) {
      return '한글, 영문, 숫자, _만 쓸 수 있어요.';
    }
    if (nicknameChanged && availability.state === 'taken') {
      return copy.profileSetup.nicknameTaken;
    }
    return null;
  }, [availability.state, nickname, nicknameChanged]);

  const canSave =
    !nicknameError &&
    nickname.trim().length >= config.rules.minNicknameLength &&
    interests.length >= config.rules.minInterests &&
    (!nicknameChanged || availability.state === 'available');

  const onSave = async () => {
    try {
      await updateMe.mutateAsync({
        nickname: nickname.trim(),
        bio: bio.trim() || null,
        interests,
      });
      toast.show({ message: '프로필을 저장했어요.', tone: 'success' });
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
          label="닉네임"
          value={nickname}
          onChangeText={setNickname}
          maxLength={config.rules.maxNicknameLength}
          showCounter
          autoCapitalize="none"
          autoCorrect={false}
          error={nicknameError}
          hint={
            nicknameChanged && availability.state === 'checking'
              ? '확인 중…'
              : nicknameChanged && availability.state === 'available'
                ? '사용할 수 있어요.'
                : undefined
          }
        />

        <TextField
          label="한줄소개"
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
            생년월일은 변경할 수 없어요. 잘못 입력했다면 고객센터로 알려주세요.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.base, paddingBottom: spacing.xxl },
  field: { marginTop: spacing.xl },
  hint: { marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  chip: { marginRight: spacing.xs, marginBottom: spacing.xs },
  note: { marginTop: spacing.xxl },
});
