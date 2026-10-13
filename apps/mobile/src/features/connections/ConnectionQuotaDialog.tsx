import { useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { ConfirmDialog } from '@/ui';

export interface ConnectionQuotaDialogProps {
  visible: boolean;
  plusActive: boolean;
  onDismiss: () => void;
}

/**
 * Shown when the daily `reactions.wave` quota (free 2 / PIXME+ 5) runs out.
 *
 * <p>A real dialog, not just a toast — the user explicitly asked to show the
 * reset timing and give a way to act, not just notice and forget. The tone is
 * still deliberately soft: no upgrade-and-get-more urgency copy, no red,
 * and PIXME+ is the *cancel-adjacent* secondary action, not the one button in
 * the user's way. A hard paywall block on a relationship gesture is exactly
 * the dating-app pattern this product isn't.
 */
export function ConnectionQuotaDialog({
  visible,
  plusActive,
  onDismiss,
}: ConnectionQuotaDialogProps) {
  const router = useRouter();

  return (
    <ConfirmDialog
      visible={visible}
      title={copy.quota.title}
      body={plusActive ? copy.quota.body : copy.quota.bodyUpsell}
      confirmLabel={plusActive ? copy.common.confirm : copy.quota.plusCta}
      cancelLabel={copy.common.close}
      onConfirm={() => {
        onDismiss();
        if (!plusActive) router.push('/store/plus');
      }}
      onCancel={onDismiss}
    />
  );
}
