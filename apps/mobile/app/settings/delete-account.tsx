import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { copy } from '@/constants/copy';
import { radius, spacing, useTheme } from '@/theme';
import {
  Button,
  Chip,
  ConfirmDialog,
  Header,
  Screen,
  Text,
  TextField,
  useToast,
} from '@/ui';
import { useDeleteAccount } from '@/features/profile/useDeleteAccount';

const REASONS = [
  '잘 안 쓰게 돼요',
  '사진 올리는 게 부담돼요',
  '사람이 적어요',
  '알림이 많아요',
  '기타',
];

/**
 * Account deletion.
 *
 * Deliberately a typed confirmation, not a one-tap destructive button: this
 * removes the user's whole pixel record, which is the thing they'd most regret
 * losing. The reason chips are optional and exist to tell us why people leave.
 */
export default function DeleteAccountRoute() {
  const toast = useToast();
  const { colors } = useTheme();

  const deleteAccount = useDeleteAccount();

  const [reason, setReason] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [prompt, setPrompt] = useState(false);

  const canDelete = confirmText.trim() === copy.settings.deleteConfirmWord;

  return (
    <>
      <Screen
        edges={['top']}
        footer={
          <Button
            label={copy.settings.deleteCta}
            variant="danger"
            haptic={false}
            disabled={!canDelete}
            loading={deleteAccount.isPending}
            onPress={() => setPrompt(true)}
          />
        }
      >
        <Header title={copy.settings.deleteAccount} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View
            style={[
              styles.warning,
              { backgroundColor: colors.dangerSubtle, borderColor: colors.danger },
            ]}
          >
            <Text variant="title3">{copy.settings.deleteTitle}</Text>
            <Text variant="caption" tone="secondary" style={styles.warningBody}>
              {copy.settings.deleteBody}
            </Text>
          </View>

          <Text variant="label" tone="secondary" style={styles.sectionTitle}>
            삭제되는 항목
          </Text>
          {[
            '프로필과 닉네임',
            '지금까지 만든 PIXME와 원본 사진',
            '받은 하트와 연결 기록',
            '모든 대화 내용',
          ].map((item) => (
            <Text key={item} variant="caption" tone="secondary" style={styles.item}>
              · {item}
            </Text>
          ))}

          <Text variant="micro" tone="tertiary" style={styles.retention}>
            삭제 요청 즉시 모든 공개 화면에서 사라지고, 법령상 보관이 필요한
            결제 기록을 제외한 개인정보는 정책에 따라 영구 삭제돼요. 구독 중이라면
            스토어에서 별도로 해지해주세요.
          </Text>

          <Text variant="label" tone="secondary" style={styles.sectionTitle}>
            떠나는 이유를 알려주실 수 있나요? (선택)
          </Text>
          <View style={styles.chips}>
            {REASONS.map((item) => (
              <Chip
                key={item}
                label={item}
                size="sm"
                selected={reason === item}
                tone="default"
                style={styles.chip}
                onPress={() => setReason(reason === item ? null : item)}
              />
            ))}
          </View>

          <TextField
            label={copy.settings.deleteConfirmHint}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={copy.settings.deleteConfirmWord}
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={styles.confirmField}
          />
        </ScrollView>
      </Screen>

      <ConfirmDialog
        visible={prompt}
        title={copy.settings.deleteTitle}
        body={copy.settings.deleteBody}
        confirmLabel={copy.settings.deleteCta}
        destructive
        loading={deleteAccount.isPending}
        onConfirm={() => {
          deleteAccount.mutate(reason ?? undefined, {
            onSuccess: () => {
              setPrompt(false);
              toast.show({ message: copy.settings.deleted });
            },
            onError: (error) => {
              setPrompt(false);
              toast.show({ message: errorMessage(error), tone: 'error' });
            },
          });
        }}
        onCancel={() => setPrompt(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.base, paddingBottom: spacing.xxl },
  warning: {
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  warningBody: { marginTop: spacing.sm },
  sectionTitle: { marginTop: spacing.xl },
  item: { marginTop: spacing.xs },
  retention: { marginTop: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  chip: { marginRight: spacing.xs, marginBottom: spacing.xs },
  confirmField: { marginTop: spacing.xl },
});
