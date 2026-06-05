# Build AAB — Google Play Store

## Profil build

| Perintah | Profil | Output |
|----------|--------|--------|
| `npm run build:apk` | `preview` | APK (uji di HP) |
| `npm run build:aab` | `production` | **AAB** (upload Play Store) |

- **Package:** `com.zulfan.mygaragelite`
- **Versi app:** `1.0.0` (di `app.json`)
- **versionCode:** naik otomatis tiap build production (`autoIncrement` di EAS)

## Langkah build AAB

```powershell
cd C:\Zulfan\MyGarageLite\mygaragelite
eas login
npm run build:aab
```

Atau:

```powershell
eas build --platform android --profile production
```

- Pilih **Yes** jika ditanya generate keystore (pertama kali).
- Tunggu selesai → download `.aab` dari https://expo.dev atau link di terminal.

Build ulang setelah ubah native (`app.json`, plugin, AdMob):

```powershell
eas build --platform android --profile production --clear-cache
```

## Upload ke Play Console

1. https://play.google.com/console
2. Buat app / pilih **MyGarage Lite**
3. **Testing** → Internal testing (disarankan dulu) atau **Production**
4. **Create new release** → upload file `.aab`
5. Lengkapi: deskripsi, screenshot, ikon, kebijakan privasi, kategori, konten iklan (AdMob)

Upload lewat CLI (opsional):

```powershell
eas submit --platform android --profile production
```

## Checklist sebelum rilis

- [ ] APK preview sudah diuji (transaksi, cetak, backup, iklan)
- [ ] AdMob App ID & unit ID sudah di `app.json` dan `src/constants/admob.ts`
- [ ] Kebijakan privasi URL (wajib jika ada iklan / data pengguna)
- [ ] `version` di `app.json` dinaikkan untuk update berikutnya (mis. `1.0.1`)

## Catatan

- **AAB** tidak bisa di-install langsung di HP — hanya untuk Play Store.
- Uji di HP tetap pakai **APK** (`npm run build:apk`).
- Iklan produksi bisa `no-fill` sampai app aktif di Play — itu normal.
