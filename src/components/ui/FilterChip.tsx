import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View, ViewStyle } from 'react-native';
import { theme } from '../../constants/theme';

interface Props {
  label: string;
  active?: boolean;
  count?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Custom accent color when active. Defaults to theme accent (orange). */
  color?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * Modern pill-style filter chip with optional icon + count badge.
 * Active state: filled bg + subtle glow shadow.
 * Inactive: card-light bg with border.
 */
export function FilterChip({
  label,
  active = false,
  count,
  icon,
  color,
  onPress,
  style,
}: Props) {
  const accent = color ?? theme.colors.accent;
  const hasCount = typeof count === 'number';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: theme.radius.full,
          backgroundColor: active ? accent : theme.colors.cardLight,
          borderWidth: 1,
          borderColor: active ? accent : theme.colors.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          alignSelf: 'flex-start',
          ...(active
            ? {
                shadowColor: accent,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.45,
                shadowRadius: 6,
                elevation: 4,
              }
            : null),
        },
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={13}
          color={active ? '#fff' : theme.colors.textSecondary}
        />
      ) : null}
      <Text
        style={{
          color: active ? '#fff' : theme.colors.textSecondary,
          fontSize: 12.5,
          fontWeight: '700',
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
      {hasCount && count > 0 ? (
        <View
          style={{
            minWidth: 22,
            height: 18,
            paddingHorizontal: 6,
            borderRadius: 9,
            backgroundColor: active ? 'rgba(255,255,255,0.28)' : theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: active ? 0 : 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              color: active ? '#fff' : theme.colors.textMuted,
              fontSize: 10,
              fontWeight: '800',
              lineHeight: 12,
            }}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
