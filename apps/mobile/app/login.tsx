import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { copy } from '@/constants/copy';
import { config } from '@/lib/config';
import { spacing, useTheme } from '@/theme';
import { Button, Icon, Screen, Text } from '@/ui';
import { useSignIn } from '@/features/auth/useSignIn';
import { isAppleSignInAvailable } from '@/features/auth/providers/apple';

/**
 * Sign-in.
 *
 * Two providers, no identity verification. PIXME ships without PASS / phone /
 * real-name verification by design: the safety model is reporting, blocking
 * and content screening rather than identity collection, which keeps the
 * sign-up to a single tap and the data we hold to a minimum.
 */
export default function LoginRoute() {
  const { colors } = useTheme();
  const { signIn, pending, error } = useSignIn();
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text variant="display" style={styles.wordmark}>
          {copy.auth.title}
        </Text>
        <Text variant="body" tone="secondary" style={styles.subtitle}>
          {copy.auth.subtitle}
        </Text>
      </View>

      <View style={styles.actions}>
        {appleAvailable ? (
          <Button
            label={copy.auth.apple}
            variant="primary"
            loading={pending === 'apple'}
            disabled={pending !== null}
            onPress={() => void signIn('apple')}
            icon={<AppleGlyph color={colors.textOnAccent} />}
            style={[styles.button, { backgroundColor: colors.text, borderColor: colors.text }]}
          />
        ) : null}

        <Button
          label={copy.auth.kakao}
          variant="secondary"
          loading={pending === 'kakao'}
          disabled={pending !== null}
          onPress={() => void signIn('kakao')}
          icon={<Icon name="chat" size={18} color="#3C1E1E" />}
          style={[styles.button, { backgroundColor: '#FEE500', borderColor: '#FEE500' }]}
        />

        {error ? (
          <Text variant="caption" tone="danger" align="center" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Text variant="micro" tone="tertiary" align="center" style={styles.legal}>
          {copy.auth.legal}
        </Text>

        <View style={styles.legalLinks}>
          <Pressable
            accessibilityRole="link"
            hitSlop={12}
            onPress={() => void Linking.openURL(config.links.terms)}
          >
            <Text variant="micro" tone="secondary" style={styles.legalLink}>
              {copy.settings.terms}
            </Text>
          </Pressable>
          <Text variant="micro" tone="tertiary">
            ·
          </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={12}
            onPress={() => void Linking.openURL(config.links.privacy)}
          >
            <Text variant="micro" tone="secondary" style={styles.legalLink}>
              {copy.settings.privacy}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

/** Minimal Apple mark; avoids pulling in a brand asset pack for one glyph. */
function AppleGlyph({ color }: { color: string }) {
  return (
    <Text variant="body" style={{ color, marginRight: 0 }}>
      
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: { letterSpacing: 4 },
  subtitle: { marginTop: spacing.md },
  actions: { paddingBottom: spacing.xxl },
  button: { marginBottom: spacing.md },
  error: { marginTop: spacing.sm },
  legal: { marginTop: spacing.base, paddingHorizontal: spacing.lg },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  legalLink: { marginHorizontal: spacing.sm, textDecorationLine: 'underline' },
});
