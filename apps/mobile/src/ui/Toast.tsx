import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { radius, shadow, spacing, useTheme, zIndex } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ToastTone = 'neutral' | 'success' | 'error' | 'heart' | 'wave';

interface ToastOptions {
  message: string;
  tone?: ToastTone;
  icon?: IconName;
  durationMs?: number;
}

interface ToastContextValue {
  show: (options: ToastOptions | string) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => undefined });

/**
 * Lightweight top toast. PIXME uses it for ephemeral confirmations ("하트를
 * 보냈어요") where a modal would be heavy-handed; anything the user must
 * acknowledge uses `ConfirmDialog` instead.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const show = useCallback((options: ToastOptions | string) => {
    const normalized: ToastOptions =
      typeof options === 'string' ? { message: options } : options;

    counter.current += 1;
    setToast({ ...normalized, id: counter.current });

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setToast(null),
      normalized.durationMs ?? 2200,
    );
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} {...toast} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ message, tone = 'neutral', icon }: ToastOptions) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const accent =
    tone === 'success'
      ? colors.connection
      : tone === 'error'
        ? colors.danger
        : tone === 'heart'
          ? colors.heart
          : tone === 'wave'
            ? colors.wave
            : colors.textSecondary;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      style={[
        styles.root,
        {
          top: insets.top + spacing.sm,
          backgroundColor: colors.surfaceInverse,
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        {icon ? (
          <Icon name={icon} size={18} color={accent} />
        ) : null}
        <Text
          variant="label"
          tone="inverse"
          style={icon ? styles.messageWithIcon : undefined}
          numberOfLines={2}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    zIndex: zIndex.toast,
    ...shadow.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  messageWithIcon: { marginLeft: spacing.sm },
});
