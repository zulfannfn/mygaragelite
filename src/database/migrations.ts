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
}
