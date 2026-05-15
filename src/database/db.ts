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

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  await seedDatabaseIfEmpty(db);
}

export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS transaction_spareparts;
    DROP TABLE IF EXISTS service_items;
    DROP TABLE IF EXISTS reminders;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS spareparts;
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
    DROP TABLE IF EXISTS transaction_spareparts;
    DROP TABLE IF EXISTS service_items;
    DROP TABLE IF EXISTS reminders;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS spareparts;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS employees;
    DROP TABLE IF EXISTS settings;
  `);
  await runMigrations(db);
}
