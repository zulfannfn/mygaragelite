import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { theme } from '../../constants/theme';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

interface Props {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'neutral', style }: Props) {
  const colors: Record<Variant, { bg: string; fg: string }> = {
    success: { bg: 'rgba(0,200,150,0.15)', fg: theme.colors.success },
    warning: { bg: 'rgba(255,184,0,0.15)', fg: theme.colors.warning },
    danger: { bg: 'rgba(255,71,87,0.15)', fg: theme.colors.danger },
    info: { bg: 'rgba(30,144,255,0.15)', fg: theme.colors.info },
    neutral: { bg: 'rgba(160,160,176,0.15)', fg: theme.colors.textSecondary },
    accent: { bg: 'rgba(255,107,53,0.15)', fg: theme.colors.accent },
  };
  const c = colors[variant];

  return (
    <View
      style={[
        {
          backgroundColor: c.bg,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: theme.radius.full,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={{ color: c.fg, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
