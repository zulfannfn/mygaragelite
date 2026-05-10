import * as SQLite from 'expo-sqlite';
import { generateId } from '../utils/id';

const DUMMY_CUSTOMERS = [
  { name: 'Budi Santoso', phone: '081234567890', plate: 'B 1234 ABC', type: 'Motor', brand: 'Honda Vario 150', notes: 'Pelanggan setia' },
  { name: 'Siti Rahayu', phone: '085678901234', plate: 'B 5678 XYZ', type: 'Mobil', brand: 'Toyota Avanza', notes: '' },
  { name: 'Ahmad Hidayat', phone: '081298765432', plate: 'B 9012 DEF', type: 'Motor', brand: 'Yamaha NMax', notes: 'Suka ganti oli rutin' },
  { name: 'Dewi Lestari', phone: '087812345678', plate: 'B 3456 GHI', type: 'Mobil', brand: 'Daihatsu Xenia', notes: '' },
  { name: 'Rudi Hartono', phone: '081345678912', plate: 'B 7890 JKL', type: 'Motor', brand: 'Honda Beat', notes: 'Servis bulanan' },
  { name: 'Maya Putri', phone: '082134567890', plate: 'B 1357 MNO', type: 'Motor', brand: 'Yamaha Mio', notes: '' },
  { name: 'Eko Prasetyo', phone: '081567891234', plate: 'B 2468 PQR', type: 'Mobil', brand: 'Honda Brio', notes: 'AC bermasalah' },
  { name: 'Linda Wijaya', phone: '085234567891', plate: 'B 9753 STU', type: 'Motor', brand: 'Suzuki Address', notes: '' },
];

const DUMMY_SPAREPARTS = [
  { name: 'Oli Mesin Shell 1L', cat: 'Oli', stock: 25, min: 10, buy: 45000, sell: 65000 },
  { name: 'Oli Mesin Castrol 1L', cat: 'Oli', stock: 15, min: 8, buy: 50000, sell: 75000 },
  { name: 'Filter Udara Honda Vario', cat: 'Filter', stock: 12, min: 5, buy: 30000, sell: 50000 },
  { name: 'Filter Oli Universal', cat: 'Filter', stock: 30, min: 10, buy: 15000, sell: 25000 },
  { name: 'Ban IRC 70/90-14', cat: 'Ban', stock: 8, min: 4, buy: 180000, sell: 250000 },
  { name: 'Ban FDR 80/90-14', cat: 'Ban', stock: 6, min: 4, buy: 200000, sell: 280000 },
  { name: 'Kampas Rem Depan Honda', cat: 'Kampas Rem', stock: 18, min: 8, buy: 35000, sell: 60000 },
  { name: 'Kampas Rem Belakang Yamaha', cat: 'Kampas Rem', stock: 14, min: 8, buy: 30000, sell: 55000 },
  { name: 'Aki GS Astra NS40', cat: 'Aki', stock: 5, min: 3, buy: 280000, sell: 400000 },
  { name: 'Aki Yuasa N50', cat: 'Aki', stock: 3, min: 3, buy: 320000, sell: 450000 },
  { name: 'Busi NGK CR7HSA', cat: 'Busi', stock: 40, min: 15, buy: 18000, sell: 30000 },
  { name: 'Busi Denso U22EPR9', cat: 'Busi', stock: 22, min: 10, buy: 22000, sell: 35000 },
  { name: 'Lampu LED Motor 12V', cat: 'Lampu', stock: 16, min: 5, buy: 25000, sell: 45000 },
  { name: 'Bohlam Depan H4', cat: 'Lampu', stock: 2, min: 5, buy: 35000, sell: 60000 },
  { name: 'Kanvas Kopling Set', cat: 'Mesin', stock: 7, min: 4, buy: 120000, sell: 180000 },
];

const DUMMY_EMPLOYEES = [
  { name: 'Pak Joko', role: 'Mekanik', phone: '081299988877' },
  { name: 'Bang Rizki', role: 'Mekanik', phone: '085711122233' },
  { name: 'Mbak Nur', role: 'Kasir', phone: '081344455566' },
] as const;

const COMPLAINTS = [
  'Mesin terasa kasar saat idle',
  'Rem kurang pakem',
  'Lampu utama redup',
  'Suara aneh dari mesin',
  'Akselerasi terasa lemah',
  'Oli sudah waktunya ganti',
];

const RECOMMENDATIONS = [
  'Disarankan ganti oli kembali pada 2.000 km berikutnya',
  'Cek kampas rem 1 bulan lagi',
  'Servis berkala 3 bulan ke depan',
  'Periksa aki bulan depan',
  'Ganti busi pada servis berikutnya',
];

const SERVICE_PRESETS = [
  ['Ganti Oli', 50000],
  ['Tune Up', 100000],
  ['Servis Ringan', 75000],
  ['Servis Berat', 250000],
  ['Ganti Ban', 30000],
  ['Ganti Kampas Rem', 60000],
  ['Cuci Motor', 15000],
] as const;

export async function seedDatabaseIfEmpty(
  db: SQLite.SQLiteDatabase,
  force = false
): Promise<void> {
  const row = (await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM customers'
  )) ?? { count: 0 };

  if (!force && row.count > 0) return;

  const now = Date.now();

  // Settings
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'workshop_name',
    'MyGarage Bengkel'
  );
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'workshop_address',
    'Jl. Otomotif No. 123, Jakarta'
  );
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'workshop_phone',
    '021-12345678'
  );
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'onboarding_done',
    'false'
  );

  // Employees
  const employeeIds: string[] = [];
  for (const e of DUMMY_EMPLOYEES) {
    const id = generateId();
    employeeIds.push(id);
    await db.runAsync(
      `INSERT INTO employees (id, name, role, phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      id, e.name, e.role, e.phone, now, now
    );
  }
  const mechanicIds = employeeIds.slice(0, 2);

  // Customers
  const customerIds: string[] = [];
  for (const c of DUMMY_CUSTOMERS) {
    const id = generateId();
    customerIds.push(id);
    await db.runAsync(
      `INSERT INTO customers (id, name, phone, plate_number, vehicle_type, vehicle_brand, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, c.name, c.phone, c.plate, c.type, c.brand, c.notes, now, now
    );
  }

  // Spareparts
  const sparepartMap: Record<string, { id: string; name: string; price: number }> = {};
  for (const s of DUMMY_SPAREPARTS) {
    const id = generateId();
    sparepartMap[s.name] = { id, name: s.name, price: s.sell };
    await db.runAsync(
      `INSERT INTO spareparts (id, name, category, stock, min_stock, buy_price, sell_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, s.name, s.cat, s.stock, s.min, s.buy, s.sell, now, now
    );
  }

  // Sample transactions: 2 today, plus several in last 30 days
  const sparepartList = Object.values(sparepartMap);
  const today = new Date();
  today.setHours(10, 0, 0, 0);

  for (let i = 0; i < 12; i++) {
    const daysAgo = i < 3 ? 0 : Math.floor(Math.random() * 30) + 1;
    const txDate = new Date(today);
    txDate.setDate(txDate.getDate() - daysAgo);
    txDate.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
    const ts = txDate.getTime();

    const customerId = customerIds[i % customerIds.length];
    const txId = generateId();

    // Pick 1-2 services
    const numServices = 1 + Math.floor(Math.random() * 2);
    const usedServices = new Set<number>();
    let totalService = 0;
    const serviceItemsToInsert: { name: string; price: number }[] = [];
    for (let j = 0; j < numServices; j++) {
      let idx = Math.floor(Math.random() * SERVICE_PRESETS.length);
      while (usedServices.has(idx)) idx = (idx + 1) % SERVICE_PRESETS.length;
      usedServices.add(idx);
      const [name, price] = SERVICE_PRESETS[idx];
      serviceItemsToInsert.push({ name, price });
      totalService += price;
    }

    // Pick 0-2 spareparts
    const numSpareparts = Math.floor(Math.random() * 3);
    const usedSp = new Set<number>();
    let totalSparepart = 0;
    const spItems: { id: string; name: string; price: number; qty: number }[] = [];
    for (let j = 0; j < numSpareparts; j++) {
      let idx = Math.floor(Math.random() * sparepartList.length);
      while (usedSp.has(idx)) idx = (idx + 1) % sparepartList.length;
      usedSp.add(idx);
      const sp = sparepartList[idx];
      const qty = 1 + Math.floor(Math.random() * 2);
      spItems.push({ id: sp.id, name: sp.name, price: sp.price, qty });
      totalSparepart += sp.price * qty;
    }

    const total = totalService + totalSparepart;
    const status = i === 0 ? 'pending' : 'paid';
    const payment = status === 'paid' ? (Math.random() < 0.7 ? 'Tunai' : 'Transfer') : null;

    const mechanicId = mechanicIds[i % mechanicIds.length];
    const complaint = COMPLAINTS[i % COMPLAINTS.length];
    const recommendation = i % 2 === 0 ? RECOMMENDATIONS[i % RECOMMENDATIONS.length] : '';

    await db.runAsync(
      `INSERT INTO transactions (id, customer_id, mechanic_id, mechanic_notes, complaint, recommendation, status, payment_method, total_service, total_sparepart, total_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      txId, customerId, mechanicId, '', complaint, recommendation, status, payment, totalService, totalSparepart, total, ts, ts
    );

    for (const si of serviceItemsToInsert) {
      await db.runAsync(
        `INSERT INTO service_items (id, transaction_id, service_name, price) VALUES (?, ?, ?, ?)`,
        generateId(), txId, si.name, si.price
      );
    }
    for (const sp of spItems) {
      await db.runAsync(
        `INSERT INTO transaction_spareparts (id, transaction_id, sparepart_id, sparepart_name, quantity, sell_price) VALUES (?, ?, ?, ?, ?, ?)`,
        generateId(), txId, sp.id, sp.name, sp.qty, sp.price
      );
    }
  }

  // Reminders
  for (let i = 0; i < 4; i++) {
    const due = now + (i + 1) * 7 * 86400000;
    await db.runAsync(
      `INSERT INTO reminders (id, customer_id, type, due_date, is_sent, notes) VALUES (?, ?, ?, ?, 0, ?)`,
      generateId(),
      customerIds[i % customerIds.length],
      i % 2 === 0 ? 'oil_change' : 'periodic_service',
      due,
      i % 2 === 0 ? 'Reminder ganti oli rutin' : 'Servis berkala 3 bulan'
    );
  }
}
