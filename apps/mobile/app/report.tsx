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

const REASONS: { code: ReportReason; label: string; hint: string }[] = [
  {
    code: 'INAPPROPRIATE_CONTENT',
    label: '부적절한 콘텐츠',
    hint: '서비스에 맞지 않는 사진이나 글이에요.',
  },
  { code: 'HARASSMENT', label: '괴롭힘', hint: '불쾌하게 하거나 위협했어요.' },
  { code: 'IMPERSONATION', label: '사칭', hint: '다른 사람인 척하고 있어요.' },
  { code: 'SPAM', label: '광고 / 스팸', hint: '홍보나 반복적인 메시지예요.' },
  { code: 'SEXUAL_CONTENT', label: '성적 콘텐츠', hint: '성적인 내용이 포함돼 있어요.' },
  { code: 'HATE_SPEECH', label: '혐오 표현', hint: '특정 집단을 비하했어요.' },
  { code: 'OTHER', label: '기타', hint: '위에 없는 다른 이유예요.' },
];

/**
 * Reporting.
 *
 * Reachable from a profile, a post and a chat, so the target type comes in as
 * a param. "이 사용자도 함께 차단하기" defaults to on: someone who has just
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
          접수된 신고는 운영팀이 확인하고, 필요한 경우 게시물 삭제나 이용 제한
          조치를 해요. 처리 결과는 알림으로 알려드려요.
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
