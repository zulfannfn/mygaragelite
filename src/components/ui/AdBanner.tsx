import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { theme } from '../../constants/theme';

/**
 * AdMob banner placeholder.
 * Replace with: import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
 */
export function AdBanner() {
  return (
    <View
      style={{
        height: 60,
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: theme.colors.cardLight,
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderStyle: 'dashed',
        flexDirection: 'row',
        gap: 8,
      }}
    >
      <Ionicons name="megaphone-outline" size={18} color={theme.colors.textMuted} />
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        AdMob Banner Placeholder
      </Text>
    </View>
  );
}

/**
 * Interstitial ads placeholder helper.
 * Call this between major actions (e.g., after creating a transaction).
 */
export const InterstitialAd = {
  show: () => {
    // No-op placeholder
    if (__DEV__) console.log('[AdMob] Interstitial would show here');
  },
};
