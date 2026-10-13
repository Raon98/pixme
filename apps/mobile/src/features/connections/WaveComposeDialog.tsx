import { useEffect, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { copy } from '@/constants/copy';
import { radius, spacing, useTheme } from '@/theme';
import { Button, Text, TextField } from '@/ui';

const MAX_LENGTH = 140;

export interface WaveComposeDialogProps {
  visible: boolean;
  loading?: boolean;
  onSend: (message: string | null) => void;
  onCancel: () => void;
}

/**
 * The one-line note attached to "👋 친해지고 싶어요".
 *
 * Modal-based, same as `ConfirmDialog` — do not render this from inside
 * another already-open `Sheet`/`Modal` (e.g. `OccupantSheet`); a second
 * native modal stacked on an open one silently fails to present on iOS. Swap
 * it in as inline content there instead.
 */
export function WaveComposeDialog({
  visible,
  loading = false,
  onSend,
  onCancel,
}: WaveComposeDialogProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');

  /**
   * The card is vertically centred, and `autoFocus` raises the keyboard
   * immediately — which covered the "메시지 없이 보내기" button underneath.
   * Shrinking the centring area by however much the keyboard covers keeps the
   * whole card in the space that's actually left.
   */
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);

  useEffect(() => {
    if (!visible) return;

    const apply = (event: KeyboardEvent) => {
      setKeyboardOverlap(
        Math.max(0, Dimensions.get('screen').height - event.endCoordinates.screenY),
      );
    };

    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillChangeFrame', apply),
            Keyboard.addListener('keyboardWillHide', () => setKeyboardOverlap(0)),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', apply),
            Keyboard.addListener('keyboardDidHide', () => setKeyboardOverlap(0)),
          ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [visible]);

  const send = () => {
    const trimmed = text.trim();
    onSend(trimmed.length > 0 ? trimmed : null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
        style={[
          styles.scrim,
          { backgroundColor: colors.overlay, paddingBottom: keyboardOverlap },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={copy.common.cancel}
          onPress={loading ? undefined : onCancel}
        />
        <Animated.View
          entering={ZoomIn.duration(200)}
          style={[styles.card, { backgroundColor: colors.backgroundElevated }]}
        >
          <Text variant="title3" align="center">
            {copy.reactions.waveComposeTitle}
          </Text>
          <Text variant="caption" tone="secondary" align="center" style={styles.body}>
            {copy.reactions.waveComposeBody}
          </Text>

          <TextField
            value={text}
            onChangeText={setText}
            placeholder={copy.reactions.waveComposePlaceholder}
            maxLength={MAX_LENGTH}
            showCounter
            multiline
            autoFocus
            containerStyle={styles.field}
          />

          <View style={styles.actions}>
            <Button
              label={copy.reactions.waveComposeSend}
              loading={loading}
              onPress={send}
            />
            <Button
              label={copy.reactions.waveComposeSkip}
              variant="ghost"
              disabled={loading}
              onPress={() => onSend(null)}
              style={styles.skip}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  body: { marginTop: spacing.md },
  field: { marginTop: spacing.lg },
  actions: { marginTop: spacing.xl },
  skip: { marginTop: spacing.xs },
});
