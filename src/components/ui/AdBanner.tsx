import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { ADMOB_CONFIG, AD_REQUEST_KEYWORDS } from '../../constants/admob';
import { theme } from '../../constants/theme';
import { initializeAds, isAdsSDKReady } from '../../services/adsInit';
import {
  getBannerAd,
  getBannerAdSize,
  getInterstitialAd,
  getRewardedAd,
  getAdEventType,
  getRewardedAdEventType,
  isAdsAvailable,
  loadNativeAds,
} from './AdsNative';
type AdFormat = 'banner' | 'interstitial' | 'rewarded';

function resolveAdUnitId(format: AdFormat): string {
  const { android } = ADMOB_CONFIG;
  if (format === 'banner') return android.banner;
  if (format === 'interstitial') return android.interstitial;
  return android.rewarded;
}

const adRequestOptions = {
  requestNonPersonalizedAdsOnly: true,
  keywords: AD_REQUEST_KEYWORDS,
};

const SHOW_WAIT_MS = 10000;
const BANNER_RETRY_MAX = 4;
const BANNER_RETRY_DELAY_MS = 6000;

type FullScreenFormat = 'interstitial' | 'rewarded';

function createFullScreenAdManager(format: FullScreenFormat) {
  let instance: { show: () => Promise<void>; load: () => void } | null = null;
  let isLoaded = false;
  let wantShow = false;
  let showWaiters: Array<() => void> = [];
  let unsubs: Array<() => void> = [];

  const label = format === 'interstitial' ? 'Interstitial' : 'Rewarded';

  const clearListeners = () => {
    unsubs.forEach((u) => u());
    unsubs = [];
  };

  const finishShowWaiters = () => {
    showWaiters.forEach((w) => w());
    showWaiters = [];
  };

  const preload = () => {
    if (!loadNativeAds()) return;

    clearListeners();
    isLoaded = false;

    const AdEventType = getAdEventType();
    const RewardedAdEventType = getRewardedAdEventType();
    const AdClass = format === 'interstitial' ? getInterstitialAd() : getRewardedAd();

    instance = AdClass.createForAdRequest(resolveAdUnitId(format), adRequestOptions);

    const onLoaded = () => {
      isLoaded = true;
      if (__DEV__) console.log(`[AdMob] ${label} loaded`);
      if (wantShow) {
        wantShow = false;
        void showInternal();
      }
    };

    const onClosed = () => {
      isLoaded = false;
      preload();
    };

    const onError = (error: unknown) => {
      isLoaded = false;
      wantShow = false;
      if (__DEV__) console.log(`[AdMob] ${label} failed:`, error);
      finishShowWaiters();
    };

    if (AdEventType) {
      if (format === 'interstitial') {
        unsubs.push(
          instance.addAdEventListener(AdEventType.LOADED, onLoaded),
          instance.addAdEventListener(AdEventType.CLOSED, onClosed),
          instance.addAdEventListener(AdEventType.ERROR, onError),
        );
      } else if (RewardedAdEventType) {
        unsubs.push(
          instance.addAdEventListener(RewardedAdEventType.LOADED, onLoaded),
          instance.addAdEventListener(AdEventType.CLOSED, onClosed),
          instance.addAdEventListener(AdEventType.ERROR, onError),
          instance.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward: unknown) => {
            if (__DEV__) console.log('[AdMob] Reward earned:', reward);
          }),
        );
      }
    }

    instance.load();
  };

  const showInternal = async () => {
    if (!instance || !isLoaded) {
      finishShowWaiters();
      return;
    }
    try {
      await instance.show();
    } catch (error) {
      if (__DEV__) console.log(`[AdMob] ${label} show failed:`, error);
      isLoaded = false;
      preload();
    } finally {
      finishShowWaiters();
    }
  };

  /** Tampilkan hanya jika iklan sudah dimuat (atau tunggu max 10 detik). */
  const show = async (): Promise<void> => {
    await initializeAds();
    if (!isAdsAvailable()) {
      if (__DEV__) console.log(`[AdMob] ${label} skipped (not available)`);
      return;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        wantShow = false;
        if (__DEV__) console.log(`[AdMob] ${label} tidak tersedia (timeout)`);
        finishShowWaiters();
        resolve();
      }, SHOW_WAIT_MS);

      showWaiters.push(() => {
        clearTimeout(timeout);
        resolve();
      });

      if (isLoaded && instance) {
        void showInternal();
        return;
      }

      wantShow = true;
      if (!instance) {
        preload();
      } else {
        instance.load();
      }
    });
  };

  return { load: preload, show };
}

const interstitialManager = createFullScreenAdManager('interstitial');
const rewardedManager = createFullScreenAdManager('rewarded');

function getBannerSize(): string {
  const BannerAdSize = getBannerAdSize();
  if (!BannerAdSize) return 'BANNER';
  if (Platform.OS === 'android' && BannerAdSize.INLINE_ADAPTIVE_BANNER) {
    return BannerAdSize.INLINE_ADAPTIVE_BANNER;
  }
  if (BannerAdSize.ANCHORED_ADAPTIVE_BANNER) {
    return BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
  }
  return BannerAdSize.BANNER;
}

/**
 * Banner dashboard — memuat otomatis; tampil hanya jika AdMob mengirim iklan (fill).
 */
export function AdBanner() {
  const [sdkReady, setSdkReady] = useState(isAdsSDKReady());
  const [retryKey, setRetryKey] = useState(0);
  const [hasFill, setHasFill] = useState(false);

  const unitId = useMemo(() => resolveAdUnitId('banner'), []);

  const refreshSdk = useCallback(() => {
    initializeAds().finally(() => setSdkReady(isAdsSDKReady()));
  }, []);

  useEffect(() => {
    refreshSdk();
  }, [refreshSdk]);

  useFocusEffect(
    useCallback(() => {
      refreshSdk();
    }, [refreshSdk]),
  );

  useEffect(() => {
    setHasFill(false);
    setRetryKey(0);
  }, [unitId]);

  if (!isAdsAvailable()) {
    if (!__DEV__) return null;
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
          Iklan (hanya di APK / dev build)
        </Text>
      </View>
    );
  }

  if (!sdkReady) {
    return null;
  }

  const BannerAdComponent = getBannerAd();
  const adSize = getBannerSize();

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        alignItems: 'center',
        minHeight: hasFill ? undefined : 50,
      }}
    >
      <BannerAdComponent
        key={`${unitId}-${retryKey}`}
        unitId={unitId}
        size={adSize}
        requestOptions={adRequestOptions}
        onAdLoaded={() => {
          setHasFill(true);
          if (__DEV__) console.log('[AdMob] Banner loaded');
        }}
        onAdFailedToLoad={(error: unknown) => {
          setHasFill(false);
          console.warn('[AdMob] Banner no fill / error:', error);
          if (retryKey < BANNER_RETRY_MAX) {
            setTimeout(() => setRetryKey((k) => k + 1), BANNER_RETRY_DELAY_MS);
          }
        }}
      />
    </View>
  );
}

export const InterstitialAd = interstitialManager;
export const RewardAd = rewardedManager;
