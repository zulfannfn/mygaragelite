import React from 'react';
import { Pressable, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: number | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'light' | 'outline';
  accent?: boolean;
  elevated?: boolean;
}

const PADDING_MAP = { sm: 12, md: 18, lg: 22 } as const;

export function Card({
  children,
  onPress,
  style,
  padding = 'md',
  variant = 'default',
  accent = false,
  elevated = true,
}: Props) {
  const { theme } = useTheme();
  const pad =
    typeof padding === 'number' ? padding : PADDING_MAP[padding];

  const baseStyle: ViewStyle = {
    backgroundColor:
      variant === 'light'
        ? theme.colors.cardLight
        : variant === 'outline'
          ? 'transparent'
          : theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: pad,
    borderWidth: 1,
    borderColor: variant === 'outline' ? theme.colors.borderLight : theme.colors.border,
    ...(accent
      ? {
          borderLeftWidth: 4,
          borderLeftColor: theme.colors.accent,
        }
      : null),
    ...(elevated && variant !== 'outline'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
          elevation: 2,
        }
      : null),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          pressed && {
            backgroundColor:
              variant === 'light' ? theme.colors.card : theme.colors.cardLight,
            transform: [{ scale: 0.99 }],
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[baseStyle, style]}>{children}</View>;
}
