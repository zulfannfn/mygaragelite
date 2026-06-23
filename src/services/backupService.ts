import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import { clearDatabase, getDatabase } from '../database/db';

interface BackupData {
  version: number;
  timestamp: number;
  customers: Record<string, unknown>[];
  spareparts: Record<string, unknown>[];
  services?: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  service_items: Record<string, unknown>[];
  transaction_spareparts: Record<string, unknown>[];
  reminders: Record<string, unknown>[];
  settings: Record<string, unknown>[];
  employees?: Record<string, unknown>[];
  stock_history?: Record<string, unknown>[];
}

async function insertRows(
  db: SQLite.SQLiteDatabase,
  table: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  if (rows.length === 0) return;

  const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const validCols = new Set(tableInfo.map((c) => c.name));

  for (const row of rows) {
    const cols = Object.keys(row).filter((c) => validCols.has(c));
    if (cols.length === 0) continue;
    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
    await db.runAsync(sql, ...cols.map((c) => row[c] as any));
  }
}

export const backupService = {
  async exportBackup(): Promise<void> {
    const db = await getDatabase();
    const backup: BackupData = {
      version: 4,
      timestamp: Date.now(),
      customers: await db.getAllAsync('SELECT * FROM customers'),
      spareparts: await db.getAllAsync('SELECT * FROM spareparts'),
      services: await db.getAllAsync('SELECT * FROM services'),
      transactions: await db.getAllAsync('SELECT * FROM transactions'),
      service_items: await db.getAllAsync('SELECT * FROM service_items'),
      transaction_spareparts: await db.getAllAsync('SELECT * FROM transaction_spareparts'),
      reminders: await db.getAllAsync('SELECT * FROM reminders'),
      settings: await db.getAllAsync('SELECT * FROM settings'),
      employees: await db.getAllAsync('SELECT * FROM employees'),
      stock_history: await db.getAllAsync('SELECT * FROM stock_history'),
    };

    const filename = `mygarage_backup_${Date.now()}.json`;
    const fileUri = (FileSystem.documentDirectory ?? '') + filename;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2));

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Backup MyGarage Lite',
      });
    }
  },

  async importBackup(): Promise<{ ok: boolean; message: string }> {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      return { ok: false, message: 'Dibatalkan' };
    }

    try {
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const backup = JSON.parse(content) as BackupData;

      if (!backup.version || !Array.isArray(backup.customers) || !Array.isArray(backup.transactions)) {
        return { ok: false, message: 'File backup tidak valid' };
      }

      await clearDatabase();
      const db = await getDatabase();

      // Urutan insert mengikuti FK dependency
      await insertRows(db, 'customers', backup.customers);
      await insertRows(db, 'employees', backup.employees ?? []);
      await insertRows(db, 'services', backup.services ?? []);
      await insertRows(db, 'spareparts', backup.spareparts);
      await insertRows(db, 'transactions', backup.transactions);
      await insertRows(db, 'service_items', backup.service_items ?? []);
      await insertRows(db, 'transaction_spareparts', backup.transaction_spareparts ?? []);
      await insertRows(db, 'reminders', backup.reminders ?? []);
      await insertRows(db, 'settings', backup.settings ?? []);
      // stock_history harus setelah spareparts (FK: sparepart_id → spareparts.id)
      await insertRows(db, 'stock_history', backup.stock_history ?? []);

      return { ok: true, message: 'Restore berhasil' };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      return { ok: false, message: 'Gagal: ' + msg };
    }
  },
};
