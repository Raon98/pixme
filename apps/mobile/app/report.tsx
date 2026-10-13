import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import type { ReportReason, ReportTargetType } from '@/api';
import { errorMessage } from '@/api/errors';
import { copy } from '@/constants/copy';
import { spacing, useTheme } from '@/theme';
import {
  Button,
  Header,
  Icon,
  ListRow,
  Screen,
  Text,
  TextField,
  Toggle,
  useToast,
} from '@/ui';
import { useReport } from '@/features/safety/useSafety';

const REASON_CODES: ReportReason[] = [
  'INAPPROPRIATE_CONTENT',
  'HARASSMENT',
  'IMPERSONATION',
  'SPAM',
  'SEXUAL_CONTENT',
  'HATE_SPEECH',
  'OTHER',
];

const REASONS: { code: ReportReason; label: string; hint: string }[] =
  REASON_CODES.map((code) => ({
    code,
    label: copy.safety.reportReasons[code].label,
    hint: copy.safety.reportReasons[code].hint,
  }));

/**
 * Reporting.
 *
 * Reachable from a profile, a post and a chat, so the target type comes in as
 * a param. `safety.reportAlsoBlock` defaults to on: someone who has just
 * been bothered enough to report almost always wants the person gone too.
 */
export default function ReportRoute() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();

  const params = useLocalSearchParams<{
    targetType?: string;
    targetId?: string;
    nickname?: string;
  }>();

  const targetType = (params.targetType ?? 'USER') as ReportTargetType;
  const targetId = params.targetId ?? '';

  const report = useReport();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);

  const onSubmit = async () => {
    if (!reason || !targetId) return;
    try {
      await report.mutateAsync({
        targetType,
        targetId,
        reason,
        detail: detail.trim() || undefined,
        alsoBlock,
      });
      toast.show({ message: copy.safety.reportDone, tone: 'success' });
      router.back();
    } catch (error) {
      toast.show({ message: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <Screen
      footer={
        <Button
          label={copy.safety.reportSubmit}
          disabled={!reason || !targetId}
          loading={report.isPending}
          onPress={() => void onSubmit()}
        />
      }
    >
      <Header
        title={copy.safety.report}
        subtitle={params.nickname ? `@${params.nickname}` : undefined}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text variant="title3">{copy.safety.reportTitle}</Text>

        <View style={styles.reasons}>
          {REASONS.map((item) => (
            <ListRow
              key={item.code}
              title={item.label}
              subtitle={item.hint}
              onPress={() => setReason(item.code)}
              showChevron={false}
              right={
                reason === item.code ? (
                  <Icon name="check" size={20} color={colors.accent} />
                ) : (
                  <View style={styles.checkPlaceholder} />
                )
              }
            />
          ))}
        </View>

        <TextField
          value={detail}
          onChangeText={setDetail}
          placeholder={copy.safety.reportDetailPlaceholder}
          maxLength={300}
          showCounter
          multiline
          containerStyle={styles.detail}
        />

        <View style={styles.blockRow}>
          <Text variant="body" style={styles.blockLabel}>
            {copy.safety.reportAlsoBlock}
          </Text>
          <Toggle
            value={alsoBlock}
            onChange={setAlsoBlock}
            label={copy.safety.reportAlsoBlock}
          />
        </View>

        <Text variant="micro" tone="tertiary" style={styles.note}>
          {copy.safety.reportNote}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.base, paddingBottom: spacing.xxl },
  reasons: { marginTop: spacing.md },
  checkPlaceholder: { width: 20 },
  detail: { marginTop: spacing.lg },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  blockLabel: { flex: 1, marginRight: spacing.base },
  note: { marginTop: spacing.xl },
});
