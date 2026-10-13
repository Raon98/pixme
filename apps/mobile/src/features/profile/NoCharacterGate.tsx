import { useRouter } from 'expo-router';

import { copy } from '@/constants/copy';
import { EmptyState } from '@/ui';

/**
 * Shown in place of the square and the chat list until the account owns a
 * character.
 *
 * <p>Both of those tabs are built around a character: the square literally
 * places yours on a map, and a conversation only ever starts from someone's
 * card. Landing on either with nothing to stand on read as the tab being
 * broken, so the requirement is stated plainly and the one thing that fixes
 * it is a tap away. The first generation is free, which is why this can be a
 * straight instruction rather than an upsell.
 */
export function NoCharacterGate() {
  const router = useRouter();

  return (
    <EmptyState
      icon="sparkle"
      title={copy.gate.title}
      body={copy.gate.body}
      actionLabel={copy.gate.cta}
      onAction={() => router.push('/create')}
    />
  );
}
