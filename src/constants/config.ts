export const APP_CONFIG = {
  name: 'MyGarage Lite',
  version: '1.0.0',
  dbName: 'mygarage_lite.db',
  defaultWorkshopName: 'MyGarage Bengkel',
  currency: 'Rp',
  locale: 'id-ID',
  lowStockThreshold: 5,
};

export const VEHICLE_TYPES = ['Motor', 'Mobil'] as const;
export const CUSTOMER_TYPES = ['orang', 'bengkel'] as const;
export const PAYMENT_METHODS = ['Tunai', 'Transfer', 'QRIS', 'Debit'] as const;
export const TRANSACTION_STATUS = ['pending', 'paid', 'cancelled'] as const;
export const REMINDER_TYPES = ['oil_change', 'periodic_service', 'tune_up'] as const;

export const SPAREPART_CATEGORIES = [
  'Oli',
  'Filter',
  'Ban',
  'Kampas Rem',
  'Aki',
  'Busi',
  'Lampu',
  'Body',
  'Mesin',
  'Lainnya',
] as const;

export const SERVICE_PRESETS = [
  { name: 'Ganti Oli', price: 50000 },
  { name: 'Tune Up', price: 100000 },
  { name: 'Servis Ringan', price: 75000 },
  { name: 'Servis Berat', price: 250000 },
  { name: 'Ganti Ban', price: 30000 },
  { name: 'Ganti Kampas Rem', price: 60000 },
  { name: 'Ganti Aki', price: 40000 },
  { name: 'Cuci Motor', price: 15000 },
  { name: 'Cuci Mobil', price: 50000 },
];
