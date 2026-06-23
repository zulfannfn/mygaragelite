import { getDatabase } from '../database/db';
import { ServiceReminderDue, Transaction } from '../types';
import { generateId } from '../utils/id';
import { addMonths, endOfMonth, formatDate, startOfMonth } from '../utils/date';
import { receiptService } from './receiptService';
import { settingsService } from './settingsService';
import { transactionService } from './transactionService';

export type ReminderRange = 'this_month' | 'next_month';

export const serviceReminderService = {
  async getDueList(range: ReminderRange): Promise<ServiceReminderDue[]> {
    const db = await getDatabase();
    const now = Date.now();
    const targetMonth = range === 'this_month' ? now : addMonths(now, 1);
    const rangeStart = startOfMonth(targetMonth);
    const rangeEnd = endOfMonth(targetMonth);

    return db.getAllAsync<ServiceReminderDue>(
      `WITH latest_tx AS (
         SELECT t.*
         FROM transactions t
         WHERE t.next_service_date IS NOT NULL
           AND t.next_service_date >= ?
           AND t.next_service_date <= ?
           AND t.customer_id IS NOT NULL
           AND t.id = (
             SELECT t2.id FROM transactions t2
             WHERE t2.customer_id = t.customer_id
               AND t2.next_service_date IS NOT NULL
             ORDER BY t2.created_at DESC
             LIMIT 1
           )
       )
       SELECT
         c.id as customer_id, c.name as customer_name, c.phone as customer_phone,
         c.plate_number as customer_plate, c.vehicle_brand as customer_vehicle_brand,
         c.customer_type as customer_type,
         lt.id as transaction_id, lt.next_service_date, lt.created_at as last_service_date,
         lt.recommendation,
         (SELECT COUNT(*) FROM service_reminder_sends s WHERE s.transaction_id = lt.id) as sent_count
       FROM latest_tx lt
       JOIN customers c ON c.id = lt.customer_id
       ORDER BY lt.next_service_date ASC`,
      rangeStart, rangeEnd
    );
  },

  async getLastServiceDetail(transactionId: string): Promise<Transaction | null> {
    return transactionService.getById(transactionId);
  },

  async buildReminderMessage(due: ServiceReminderDue): Promise<string> {
    const settings = await settingsService.getAll();
    const shopName = settings.workshop_name ?? 'MyGarage Bengkel';
    const lines: string[] = [];
    lines.push(`Halo *${due.customer_name}* 👋`);
    lines.push('');
    lines.push(
      `Ini pengingat dari *${shopName}*. Kendaraan Anda${due.customer_plate ? ` (${due.customer_plate})` : ''} dijadwalkan servis berikutnya pada *${formatDate(due.next_service_date)}*.`
    );
    if (due.recommendation && due.recommendation.trim()) {
      lines.push('');
      lines.push(`💡 Rekomendasi sebelumnya: _${due.recommendation.trim()}_`);
    }
    lines.push('');
    lines.push('Yuk jadwalkan kunjungan Anda agar kendaraan tetap dalam kondisi terbaik. Terima kasih 🙏');
    return lines.join('\n');
  },

  async sendReminder(
    customerId: string,
    transactionId: string,
    phone: string,
    message: string
  ): Promise<{ ok: boolean; reason?: string }> {
    const result = await receiptService.sendWhatsAppText(phone, message);
    if (result.ok) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO service_reminder_sends (id, customer_id, transaction_id, sent_at) VALUES (?, ?, ?, ?)`,
        generateId(), customerId, transactionId, Date.now()
      );
    }
    return result;
  },
};
