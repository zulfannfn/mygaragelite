import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translate, { toValue: 0, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translate, { toValue: -40, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [toast, opacity, translate]);

  if (!toast) return null;

  const colors = {
    success: theme.colors.success,
    error: theme.colors.danger,
    info: theme.colors.info,
  };
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    success: 'checkmark-circle',
    error: 'close-circle',
    info: 'information-circle',
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        opacity,
        transform: [{ translateY: translate }],
        zIndex: 9999,
      }}
    >
      <View
        style={{
          backgroundColor: theme.colors.card,
          borderLeftWidth: 4,
          borderLeftColor: colors[toast.type],
          padding: 14,
          borderRadius: theme.radius.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Ionicons name={icons[toast.type]} size={20} color={colors[toast.type]} />
        <Text style={{ color: theme.colors.text, fontSize: 14, flex: 1 }}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
}
