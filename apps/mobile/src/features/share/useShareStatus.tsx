import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { copy } from '@/constants/copy';
import { logger } from '@/lib/logger';
import { useToast } from '@/ui';

import {
  ShareCard,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_PIXEL_RATIO,
  SHARE_CARD_WIDTH,
  type ShareCardProps,
} from './ShareCard';
import { shareStoryImage } from './shareStory';

const log = logger('share');

/**
 * Turns a day into a shareable image.
 *
 * <p>The card is a real mounted view rather than a server-rendered image, so
 * it always matches the app it came from. It is parked off-screen instead of
 * being hidden: `display: none` and zero opacity both produce a blank capture
 * on iOS, and a modal preview would put a screen between the user and the
 * thing they already asked for.
 *
 * <p>Returns the element to mount; a caller renders `{sheet}` anywhere in its
 * tree and calls `share()` from a button.
 */
export function useShareStatus(card: ShareCardProps) {
  const cardRef = useRef<View>(null);
  const toast = useToast();
  const [sharing, setSharing] = useState(false);
  // Tracks the specific uri that last finished painting, not just a boolean —
  // a different day selected is a different character to wait on again, and
  // comparing values (rather than resetting a flag in an effect) needs no
  // extra render pass to stay correct.
  const [readyUri, setReadyUri] = useState<string | null>(null);
  const ready = !card.characterUrl || readyUri === card.characterUrl;

  const share = useCallback(async () => {
    if (sharing) return;
    // Capturing before the character has painted yields a card with a hole in
    // it — and this one is going somewhere public.
    if (!ready) {
      toast.show({ message: copy.common.loading });
      return;
    }
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        // `width`/`height` are logical points; the ratio is what lifts the
        // capture to a 1080×1920 story.
        width: SHARE_CARD_WIDTH * SHARE_CARD_PIXEL_RATIO,
        height: SHARE_CARD_HEIGHT * SHARE_CARD_PIXEL_RATIO,
      });
      const outcome = await shareStoryImage(uri);
      if (outcome === 'unavailable') {
        toast.show({ message: copy.share.unavailable, tone: 'error' });
      }
    } catch (error) {
      log.warn('share failed', error);
      toast.show({ message: copy.errors.generic, tone: 'error' });
    } finally {
      setSharing(false);
    }
  }, [ready, sharing, toast]);

  const sheet = (
    <View pointerEvents="none" style={styles.offscreen}>
      <View ref={cardRef} collapsable={false}>
        <ShareCard
          {...card}
          onCharacterReady={() => setReadyUri(card.characterUrl)}
        />
      </View>
    </View>
  );

  return { share, sharing, sheet };
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    // Far enough left that it never paints over the screen, while staying
    // laid out and therefore capturable.
    left: -9999,
    top: 0,
  },
});
