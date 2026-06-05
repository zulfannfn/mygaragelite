// Dynamic load react-native-google-mobile-ads (tidak jalan di Expo Go)
import Constants from 'expo-constants';

let adsAvailable = false;
let BannerAd: any = null;
let BannerAdSize: any = null;
let RNInterstitialAd: any = null;
let RNRewardedAd: any = null;
let TestIds: any = null;
let mobileAdsModule: any = null;
let AdEventType: any = null;
let RewardedAdEventType: any = null;

/** true saat dibuka lewat Expo Go — native ads tidak tersedia */
export function isExpoGoClient(): boolean {
  return (
    Constants.executionEnvironment === 'storeClient' ||
    Constants.appOwnership === 'expo'
  );
}

export function loadNativeAds(): boolean {
  if (adsAvailable) return true;

  if (isExpoGoClient()) {
    if (__DEV__) {
      console.log('[AdMob] Expo Go — gunakan development build / APK untuk iklan asli');
    }
    return false;
  }

  try {
    const ads = require('react-native-google-mobile-ads');
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
    RNInterstitialAd = ads.InterstitialAd;
    RNRewardedAd = ads.RewardedAd;
    TestIds = ads.TestIds;
    mobileAdsModule = ads.default;
    AdEventType = ads.AdEventType;
    RewardedAdEventType = ads.RewardedAdEventType;
    adsAvailable = true;
    if (__DEV__) console.log('[AdMob] Native ads loaded');
    return true;
  } catch (error) {
    if (__DEV__) console.log('[AdMob] Native ads not available:', error);
    adsAvailable = false;
    return false;
  }
}

export function getMobileAds() {
  return mobileAdsModule;
}

export function getBannerAd() {
  return BannerAd;
}

export function getBannerAdSize() {
  return BannerAdSize;
}

export function getInterstitialAd() {
  return RNInterstitialAd;
}

export function getRewardedAd() {
  return RNRewardedAd;
}

export function getTestIds() {
  return TestIds;
}

export function getAdEventType() {
  return AdEventType;
}

export function getRewardedAdEventType() {
  return RewardedAdEventType;
}

export function isAdsAvailable() {
  return adsAvailable;
}

