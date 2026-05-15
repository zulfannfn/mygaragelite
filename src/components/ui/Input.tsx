import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function Input({
  label,
  error,
  containerStyle,
  leftIcon,
  rightElement,
  style,
  ...rest
}: Props) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ marginBottom: 8 }, containerStyle]}>
      {label && (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: 13,
            marginBottom: 4,
            fontWeight: '500',
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.cardLight,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: error
            ? theme.colors.danger
            : focused
              ? theme.colors.accent
              : theme.colors.border,
          paddingHorizontal: 12,
        }}
      >
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={theme.colors.textMuted}
          style={[
            {
              flex: 1,
              color: theme.colors.text,
              paddingVertical: 12,
              fontSize: 15,
            },
            style,
          ]}
        />
        {rightElement}
      </View>
      {error ? (
        <Text style={{ color: theme.colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
}
