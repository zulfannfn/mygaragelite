/**
 * AdMob — ganti ID di bawah ini dengan ID asli dari https://admob.google.com
 * sebelum upload ke Google Play Store.
 *
 * Saat testing APK (preview), boleh pakai ID sample Google di bawah.
 * App ID Android juga harus di app.json → plugins → react-native-google-mobile-ads
 */
export const ADMOB_CONFIG = {
  android: {
    /** Banner — dashboard */
    banner: 'ca-app-pub-5264878264518462/2105230250',
    /** Interstitial — cetak struk / aksi lain (bukan saat simpan transaksi) */
    interstitial: 'ca-app-pub-5264878264518462/3482268405',
    /** Rewarded — setelah hapus transaksi */
    rewarded: 'ca-app-pub-5264878264518462/8393334216',
  },
};

export const AD_REQUEST_KEYWORDS = [
  'automotive',
  'motor',
  'mobil',
  'bengkel',
  'garage',
  'sparepart',
  'servis',
];
