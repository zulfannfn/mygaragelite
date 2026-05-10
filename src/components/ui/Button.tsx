import React from 'react';
import { ActivityIndicator, Pressable, Text, View, ViewStyle } from 'react-native';
import { theme } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  fullWidth,
  style,
}: Props) {
  const isDisabled = disabled || loading;

  const bg: Record<Variant, string> = {
    primary: theme.colors.accent,
    secondary: theme.colors.primary,
    outline: 'transparent',
    ghost: 'transparent',
    danger: theme.colors.danger,
    success: theme.colors.success,
  };
  const border: Record<Variant, string> = {
    primary: 'transparent',
    secondary: 'transparent',
    outline: theme.colors.borderLight,
    ghost: 'transparent',
    danger: 'transparent',
    success: 'transparent',
  };
  const fg: Record<Variant, string> = {
    primary: '#fff',
    secondary: '#fff',
    outline: theme.colors.text,
    ghost: theme.colors.accent,
    danger: '#fff',
    success: '#fff',
  };

  const sizing: Record<Size, { minH: number; h: number; fs: number; gap: number }> = {
    sm: { minH: 36, h: 12, fs: 13, gap: 6 },
    md: { minH: 46, h: 16, fs: 15, gap: 8 },
    lg: { minH: 52, h: 20, fs: 16, gap: 10 },
  };

  const elevatedVariants: Variant[] = ['primary', 'secondary', 'danger', 'success'];
  const isElevated = elevatedVariants.includes(variant);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg[variant],
          borderColor: border[variant],
          borderWidth: variant === 'outline' ? 1 : 0,
          minHeight: sizing[size].minH,
          paddingHorizontal: sizing[size].h,
          paddingVertical: 6,
          borderRadius: theme.radius.lg,
          opacity: isDisabled ? 0.5 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'auto',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          ...(isElevated
            ? {
                shadowColor: bg[variant],
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: pressed ? 0.15 : 0.3,
                shadowRadius: 8,
                elevation: pressed ? 2 : 4,
              }
            : null),
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sizing[size].gap }}>
        {loading ? (
          <ActivityIndicator size="small" color={fg[variant]} />
        ) : (
          icon
        )}
        <Text
          style={{
            color: fg[variant],
            fontSize: sizing[size].fs,
            fontWeight: '700',
            letterSpacing: 0.3,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}
