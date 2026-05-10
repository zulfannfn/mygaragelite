import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase, resetDatabase } from '../database/db';
import { generateId } from '../utils/id';

interface BackupData {
  version: number;
  timestamp: number;
  customers: any[];
  spareparts: any[];
  transactions: any[];
  service_items: any[];
  transaction_spareparts: any[];
  reminders: any[];
  settings: any[];
  employees?: any[];
}

export const backupService = {
  async exportBackup(): Promise<void> {
    const db = await getDatabase();
    const backup: BackupData = {
      version: 2,
      timestamp: Date.now(),
      customers: await db.getAllAsync('SELECT * FROM customers'),
      spareparts: await db.getAllAsync('SELECT * FROM spareparts'),
      transactions: await db.getAllAsync('SELECT * FROM transactions'),
      service_items: await db.getAllAsync('SELECT * FROM service_items'),
      transaction_spareparts: await db.getAllAsync('SELECT * FROM transaction_spareparts'),
      reminders: await db.getAllAsync('SELECT * FROM reminders'),
      settings: await db.getAllAsync('SELECT * FROM settings'),
      employees: await db.getAllAsync('SELECT * FROM employees'),
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
      const backup: BackupData = JSON.parse(content);
      if (!backup.version || !backup.customers) {
        return { ok: false, message: 'File backup tidak valid' };
      }

      await resetDatabase();
      const db = await getDatabase();

      // Clear seed data
      await db.execAsync(`
        DELETE FROM transaction_spareparts;
        DELETE FROM service_items;
        DELETE FROM reminders;
        DELETE FROM transactions;
        DELETE FROM spareparts;
        DELETE FROM customers;
        DELETE FROM employees;
      `);

      const insertAll = async (table: string, rows: any[]) => {
        if (rows.length === 0) return;
        const cols = Object.keys(rows[0]);
        const placeholders = cols.map(() => '?').join(',');
        const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
        for (const row of rows) {
          await db.runAsync(sql, ...cols.map((c) => row[c]));
        }
      };

      await insertAll('customers', backup.customers);
      await insertAll('spareparts', backup.spareparts);
      await insertAll('employees', backup.employees ?? []);
      await insertAll('transactions', backup.transactions);
      await insertAll('service_items', backup.service_items);
      await insertAll('transaction_spareparts', backup.transaction_spareparts);
      await insertAll('reminders', backup.reminders);
      await insertAll('settings', backup.settings);

      return { ok: true, message: 'Restore berhasil' };
    } catch (e: any) {
      return { ok: false, message: 'Gagal: ' + (e?.message ?? 'unknown error') };
    }
  },

  // Helper to silence unused-import warning
  _id: generateId,
};
