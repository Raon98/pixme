import React, { forwardRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { fontSize, lineHeight, radius, spacing, useTheme } from '@/theme';

import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Shows "12/60" under the field. Requires `maxLength`. */
  showCounter?: boolean;
  right?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextInputProps['style'];
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  function TextField(
    {
      label,
      hint,
      error,
      showCounter = false,
      right,
      containerStyle,
      inputStyle,
      value,
      maxLength,
      multiline,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? colors.danger
      : focused
        ? colors.borderFocus
        : colors.border;

    return (
      <View style={containerStyle}>
        {label ? (
          <Text variant="label" tone="secondary" style={styles.label}>
            {label}
          </Text>
        ) : null}

        <View
          style={[
            styles.field,
            {
              borderColor,
              backgroundColor: colors.surface,
              minHeight: multiline ? 92 : 50,
              alignItems: multiline ? 'flex-start' : 'center',
            },
          ]}
        >
          <TextInput
            ref={ref}
            value={value}
            maxLength={maxLength}
            multiline={multiline}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={[
              styles.input,
              { color: colors.text },
              multiline ? styles.inputMultiline : null,
              inputStyle,
            ]}
            {...rest}
          />
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerText}>
            {error ? (
              <Text variant="micro" tone="danger">
                {error}
              </Text>
            ) : hint ? (
              <Text variant="micro" tone="tertiary">
                {hint}
              </Text>
            ) : null}
          </View>
          {showCounter && maxLength ? (
            <Text variant="micro" tone="tertiary">
              {(value ?? '').length}/{maxLength}
            </Text>
          ) : null}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm },
  field: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    padding: 0,
  },
  inputMultiline: { textAlignVertical: 'top', minHeight: 68 },
  right: { marginLeft: spacing.sm, justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    minHeight: 16,
  },
  footerText: { flex: 1, paddingRight: spacing.sm },
});
