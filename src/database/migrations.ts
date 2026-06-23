import * as SQLite from 'expo-sqlite';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  plate_number TEXT DEFAULT '',
  vehicle_type TEXT DEFAULT 'Motor',
  vehicle_brand TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS spareparts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Lainnya',
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  buy_price REAL DEFAULT 0,
  sell_price REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  mechanic_notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  type TEXT DEFAULT 'service',
  paid_amount REAL DEFAULT 0,
  change_amount REAL DEFAULT 0,
  total_service REAL DEFAULT 0,
  total_sparepart REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS service_items (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  price REAL DEFAULT 0,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transaction_spareparts (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  sparepart_id TEXT,
  sparepart_name TEXT,
  quantity INTEGER DEFAULT 1,
  sell_price REAL DEFAULT 0,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (sparepart_id) REFERENCES spareparts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL,
  due_date INTEGER NOT NULL,
  is_sent INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_service_items_tx ON service_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_sparepart_tx ON transaction_spareparts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_plate ON customers(plate_number);
CREATE INDEX IF NOT EXISTS idx_spareparts_name ON spareparts(name);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Mekanik',
  phone TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);

CREATE TABLE IF NOT EXISTS stock_history (
  id TEXT PRIMARY KEY,
  sparepart_id TEXT NOT NULL,
  sparepart_name TEXT NOT NULL,
  delta INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (sparepart_id) REFERENCES spareparts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stock_history_sparepart ON stock_history(sparepart_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_history(created_at);

CREATE TABLE IF NOT EXISTS operational_costs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Lainnya',
  amount REAL DEFAULT 0,
  cost_date INTEGER NOT NULL,
  notes TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_operational_costs_date ON operational_costs(cost_date);

CREATE TABLE IF NOT EXISTS service_reminder_sends (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reminder_sends_tx ON service_reminder_sends(transaction_id);
CREATE INDEX IF NOT EXISTS idx_reminder_sends_customer ON service_reminder_sends(customer_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pre_order',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  sparepart_id TEXT NOT NULL,
  sparepart_name TEXT NOT NULL,
  qty_ordered INTEGER NOT NULL DEFAULT 0,
  qty_received INTEGER NOT NULL DEFAULT 0,
  qty_stocked INTEGER NOT NULL DEFAULT 0,
  buy_price REAL DEFAULT 0,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sparepart_id) REFERENCES spareparts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_sparepart ON purchase_order_items(sparepart_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
`;

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  ddl: string
): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  if (!cols.some((c) => c.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
  }
}

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
  // Idempotent column additions for existing installs
  await addColumnIfMissing(db, 'transactions', 'mechanic_id', 'TEXT');
  await addColumnIfMissing(db, 'transactions', 'complaint', "TEXT DEFAULT ''");
  await addColumnIfMissing(db, 'transactions', 'recommendation', "TEXT DEFAULT ''");
  await addColumnIfMissing(db, 'transactions', 'type', "TEXT DEFAULT 'service'");
  await addColumnIfMissing(db, 'transactions', 'paid_amount', 'REAL DEFAULT 0');
  await addColumnIfMissing(db, 'transactions', 'change_amount', 'REAL DEFAULT 0');
  await addColumnIfMissing(db, 'transactions', 'cashier_id', 'TEXT');
  await addColumnIfMissing(db, 'transactions', 'cashier_name', "TEXT DEFAULT ''");
  await addColumnIfMissing(db, 'transactions', 'kilometer', 'INTEGER');
  await addColumnIfMissing(db, 'transactions', 'custom_discount', 'REAL DEFAULT 0');
  await addColumnIfMissing(db, 'spareparts', 'supplier', "TEXT DEFAULT ''");
  await addColumnIfMissing(db, 'spareparts', 'barcode', "TEXT DEFAULT ''");
  await addColumnIfMissing(db, 'transaction_spareparts', 'discount_per_item', 'REAL DEFAULT 0');
  await addColumnIfMissing(db, 'spareparts', 'brand', "TEXT DEFAULT ''");
  await addColumnIfMissing(db, 'spareparts', 'rack_name', "TEXT DEFAULT ''");
  await addColumnIfMissing(db, 'spareparts', 'rack_row', "TEXT DEFAULT ''");
  await addColumnIfMissing(db, 'stock_history', 'buy_price_after', 'REAL');
  await addColumnIfMissing(db, 'stock_history', 'sell_price_after', 'REAL');
  await addColumnIfMissing(db, 'transactions', 'next_service_date', 'INTEGER');
  await addColumnIfMissing(db, 'customers', 'customer_type', "TEXT DEFAULT 'orang'");
}
