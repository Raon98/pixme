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
            {copy.settings.deleteItemsTitle}
          </Text>
          {copy.settings.deleteItems.map((item) => (
            <Text key={item} variant="caption" tone="secondary" style={styles.item}>
              · {item}
            </Text>
          ))}

          <Text variant="micro" tone="tertiary" style={styles.retention}>
            {copy.settings.deleteRetention}
          </Text>

          <Text variant="label" tone="secondary" style={styles.sectionTitle}>
            {copy.settings.deleteReasonTitle}
          </Text>
          <View style={styles.chips}>
            {copy.settings.deleteReasons.map((item) => (
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
