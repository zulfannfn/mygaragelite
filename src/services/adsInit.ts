import { InteractionManager } from 'react-native';
import { getMobileAds, isAdsAvailable, loadNativeAds } from '../components/ui/AdsNative';

let sdkInitialized = false;
let fullScreenPreloaded = false;
let initPromise: Promise<void> | null = null;

/** Panggil sekali saat app start (APK / dev build). Aman jika gagal — tidak crash app. */
export function initializeAds(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(async () => {
        try {
          if (!loadNativeAds()) {
            resolve();
            return;
          }

          const mobileAds = getMobileAds();
          if (mobileAds && !sdkInitialized) {
            await mobileAds().initialize();
            sdkInitialized = true;
            if (__DEV__) console.log('[AdMob] SDK initialized');
          }

          if (!fullScreenPreloaded) {
            const { InterstitialAd, RewardAd } = await import('../components/ui/AdBanner');
            InterstitialAd.load();
            RewardAd.load();
            fullScreenPreloaded = true;
          }
        } catch (e) {
          if (__DEV__) console.warn('[AdMob] initialize failed:', e);
        } finally {
          resolve();
        }
      }, 800);
    });
  });

  return initPromise;
}

/** SDK AdMob siap — cukup untuk banner. */
export function isAdsSDKReady(): boolean {
  return isAdsAvailable() && sdkInitialized;
}

/** @deprecated gunakan isAdsSDKReady */
export function adsReady(): boolean {
  return isAdsSDKReady();
}

export function isAdsInitialized(): boolean {
  return sdkInitialized;
}
