# 🔧 MyGarage Lite

Aplikasi manajemen bengkel motor & mobil modern, ringan, dan offline-first untuk bengkel kecil-menengah di Indonesia.

Dibangun dengan **React Native (Expo) + TypeScript + SQLite + Zustand + NativeWind**.

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 📊 **Dashboard** | Pendapatan harian, jumlah servis, sparepart terjual, stok menipis, quick action |
| 👥 **Pelanggan** | CRUD pelanggan, plat nomor, kendaraan, riwayat servis, panggil/WA langsung |
| 🛠️ **Servis** | Pilih pelanggan, tambah jasa & sparepart, hitung total otomatis, status pembayaran |
| 📦 **Sparepart** | CRUD, stok, kategori, alert stok menipis, update otomatis saat transaksi |
| 🧾 **Transaksi** | List + filter status + filter tanggal + search + detail lengkap |
| ⏰ **Reminder** | Reminder ganti oli & servis berkala per pelanggan |
| 📈 **Laporan** | Harian, bulanan, sparepart terlaris, chart, export PDF & CSV |
| ⚙️ **Pengaturan** | Nama bengkel, alamat, backup/restore database, dark mode |

## 🎨 Tema

- Hitam/Dark Charcoal `#0A0A0F`
- Biru tua `#0F3460`
- Orange aksen otomotif `#FF6B35`
- Modern garage style ✨

## 🚀 Menjalankan

```bash
npm install
npm start
```

Lalu pilih:
- `a` untuk Android
- `i` untuk iOS
- `w` untuk Web

## 📁 Struktur Folder

```
MyGarageLite/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout + DB init + Toast
│   ├── index.tsx                 # Entry redirect
│   ├── onboarding.tsx            # Onboarding 3 slide
│   ├── (tabs)/                   # Bottom tabs
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Dashboard
│   │   ├── customers.tsx
│   │   ├── transactions.tsx
│   │   ├── spareparts.tsx
│   │   └── reports.tsx
│   ├── customer-form.tsx         # Modal form
│   ├── customer-detail.tsx
│   ├── sparepart-form.tsx
│   ├── transaction-form.tsx      # Form servis lengkap
│   ├── transaction-detail.tsx
│   ├── reminders.tsx
│   └── settings.tsx
│
├── src/
│   ├── components/ui/            # Button, Card, Input, Modal, Badge, etc.
│   ├── constants/                # theme.ts, config.ts
│   ├── database/                 # SQLite: db, migrations, seed
│   ├── hooks/                    # Reusable hooks
│   ├── services/                 # Business logic per domain
│   ├── store/                    # Zustand stores
│   ├── types/                    # TypeScript types
│   └── utils/                    # currency, date, id, validation
│
├── assets/
├── tailwind.config.js
├── babel.config.js
├── metro.config.js
├── global.css
└── tsconfig.json
```

## 🗄️ Database Schema

7 tabel SQLite dengan foreign key + index:
- `customers`
- `spareparts`
- `transactions`
- `service_items`
- `transaction_spareparts`
- `reminders`
- `settings`

Auto-seed dengan **8 pelanggan + 15 sparepart + 12 transaksi** dummy saat pertama kali buka.

## 🎯 Catatan AdMob

`src/components/ui/AdBanner.tsx` adalah placeholder. Untuk produksi, ganti dengan `react-native-google-mobile-ads`:

```bash
npx expo install react-native-google-mobile-ads
```

Lalu update komponen `AdBanner` & `InterstitialAd.show()`.

## 🔄 Backup / Restore

- **Backup**: Settings → Backup Database → file JSON dapat dishare
- **Restore**: Settings → Restore Database → pilih file JSON
- **Reset**: Settings → Reset & muat ulang data dummy

## 📦 Stack

- Expo SDK 54
- React Native 0.81 + React 19
- TypeScript 5.9 (strict)
- expo-router 6 (file-based)
- expo-sqlite (async API)
- Zustand 4
- NativeWind v4 + Tailwind v3
- expo-print, expo-sharing, expo-document-picker, expo-file-system
- @expo/vector-icons (Ionicons)

## 📱 Optimasi Performa

- Offline-first (no network needed)
- Indexed SQLite queries
- FlatList virtualization
- Async DB ops dengan transaction batching
- Skeleton loaders + lazy loads
- Hardware-accelerated animations (Reanimated)

---

Made with ❤️ for Indonesian workshops 🛠️
