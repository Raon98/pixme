import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

import { config } from '@/lib/config';
import { logger } from '@/lib/logger';

const log = logger('share');

export type ShareOutcome = 'shared' | 'cancelled' | 'unavailable';

/**
 * Hands a rendered card to Instagram Stories, falling back to the system
 * share sheet.
 *
 * <p>The Stories path needs a Facebook app id — Instagram's own API requires
 * one to attribute the post, and `react-native-share` makes it mandatory. It
 * is configuration we may not have, so its absence degrades to the share
 * sheet rather than removing the feature: that sheet still reaches KakaoTalk,
 * Messages, AirDrop and the camera roll, which is most of why people share a
 * card at all.
 */
export async function shareStoryImage(fileUri: string): Promise<ShareOutcome> {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const outcome = await tryInstagramStory(fileUri);
    if (outcome !== 'unavailable') return outcome;
  }
  return shareSheet(fileUri);
}

async function tryInstagramStory(fileUri: string): Promise<ShareOutcome> {
  const appId = config.share.facebookAppId;
  if (!appId) return 'unavailable';

  try {
    // Imported here rather than at module scope: the package reads native
    // constants as it loads, which throws on web and would take the whole
    // preview bundle down with it.
    const { default: Share, Social } = await import('react-native-share');
    await Share.shareSingle({
      social: Social.InstagramStories,
      appId,
      backgroundImage: fileUri,
      // Matches the card's own paper so the story has no visible seam around
      // it on a screen taller than 16:9.
      backgroundBottomColor: '#FFFDF8',
      backgroundTopColor: '#FFFDF8',
    });
    return 'shared';
  } catch (error) {
    // Instagram not installed, or the user backed out of the hand-off.
    log.info('instagram story share unavailable', error);
    return 'unavailable';
  }
}

async function shareSheet(fileUri: string): Promise<ShareOutcome> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  try {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'image/png',
      UTI: 'public.png',
    });
    return 'shared';
  } catch (error) {
    log.info('share sheet dismissed', error);
    return 'cancelled';
  }
}
