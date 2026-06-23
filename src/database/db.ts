import * as SQLite from 'expo-sqlite';
import { APP_CONFIG } from '../constants/config';
import { runMigrations } from './migrations';
import { seedDatabaseIfEmpty } from './seed';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(APP_CONFIG.dbName);
  return dbInstance;
}

async function initDefaultSettings(db: SQLite.SQLiteDatabase): Promise<void> {
  // Only insert default settings if they don't exist yet
  const existing = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM settings WHERE key = 'workshop_name'"
  );
  if (existing && existing.count > 0) return;

  const now = Date.now();
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'workshop_name', 'MyGarage Bengkel'
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'workshop_address', ''
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'workshop_phone', ''
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'onboarding_done', 'false'
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'receipt_paper_size', '80mm'
  );
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  await initDefaultSettings(db);
}

export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS purchase_order_items;
    DROP TABLE IF EXISTS purchase_orders;
    DROP TABLE IF EXISTS service_reminder_sends;
    DROP TABLE IF EXISTS stock_history;
    DROP TABLE IF EXISTS transaction_spareparts;
    DROP TABLE IF EXISTS service_items;
    DROP TABLE IF EXISTS reminders;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS spareparts;
    DROP TABLE IF EXISTS services;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS employees;
    DROP TABLE IF EXISTS settings;
  `);
  await runMigrations(db);
  await seedDatabaseIfEmpty(db, true);
}

export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS purchase_order_items;
    DROP TABLE IF EXISTS purchase_orders;
    DROP TABLE IF EXISTS service_reminder_sends;
    DROP TABLE IF EXISTS stock_history;
    DROP TABLE IF EXISTS transaction_spareparts;
    DROP TABLE IF EXISTS service_items;
    DROP TABLE IF EXISTS reminders;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS spareparts;
    DROP TABLE IF EXISTS services;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS employees;
    DROP TABLE IF EXISTS settings;
  `);
  await runMigrations(db);
  await initDefaultSettings(db);
}
