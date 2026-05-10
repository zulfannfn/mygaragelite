import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { theme } from '../../constants/theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = 'cube-outline', title, description, action }: Props) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: theme.colors.cardLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name={icon} size={40} color={theme.colors.textMuted} />
      </View>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 17,
          fontWeight: '600',
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: 13,
            textAlign: 'center',
            marginBottom: 16,
            lineHeight: 19,
          }}
        >
          {description}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
