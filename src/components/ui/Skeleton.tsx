import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { theme } from '../../constants/theme';

interface Props {
  width?: number | `${number}%` | 'auto';
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = 6, style }: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.cardLight,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        padding: 16,
        borderRadius: theme.radius.lg,
        marginBottom: 12,
      }}
    >
      <Skeleton width="60%" height={18} style={{ marginBottom: 10 }} />
      <Skeleton width="40%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="80%" height={14} />
    </View>
  );
}
