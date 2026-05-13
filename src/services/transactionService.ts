import { getDatabase } from '../database/db';
import {
    PaymentMethod,
    ServiceItem,
    Transaction,
    TransactionSparepart,
    TransactionStatus,
} from '../types';
import { generateId } from '../utils/id';
import { sparepartService } from './sparepartService';

export interface TransactionInput {
  customer_id: string;
  mechanic_id?: string | null;
  mechanic_notes?: string;
  complaint?: string;
  recommendation?: string;
  status?: TransactionStatus;
  payment_method?: PaymentMethod | null;
  service_items: { service_name: string; price: number }[];
  spareparts: {
    sparepart_id: string | null;
    sparepart_name: string;
    quantity: number;
    sell_price: number;
  }[];
}

export const transactionService = {
  async getAll(filters?: {
    search?: string;
    status?: TransactionStatus;
    startDate?: number;
    endDate?: number;
  }): Promise<Transaction[]> {
    const db = await getDatabase();
    let sql = `
      SELECT t.*, c.name as customer_name, c.plate_number as customer_plate, c.phone as customer_phone,
             e.name as mechanic_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN employees e ON e.id = t.mechanic_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      sql += ' AND (c.name LIKE ? OR c.plate_number LIKE ?)';
      params.push(q, q);
    }
    if (filters?.status) {
      sql += ' AND t.status = ?';
      params.push(filters.status);
    }
    if (filters?.startDate) {
      sql += ' AND t.created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ' AND t.created_at <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY t.created_at DESC';
    return await db.getAllAsync<Transaction>(sql, ...params);
  },

  async getById(id: string): Promise<Transaction | null> {
    const db = await getDatabase();
    const tx = await db.getFirstAsync<Transaction>(
      `SELECT t.*, c.name as customer_name, c.plate_number as customer_plate, c.phone as customer_phone,
              e.name as mechanic_name
       FROM transactions t
       LEFT JOIN customers c ON c.id = t.customer_id
       LEFT JOIN employees e ON e.id = t.mechanic_id
       WHERE t.id = ?`,
      id
    );
    if (!tx) return null;
    tx.service_items = await db.getAllAsync<ServiceItem>(
      'SELECT * FROM service_items WHERE transaction_id = ?',
      id
    );
    tx.spareparts = await db.getAllAsync<TransactionSparepart>(
      'SELECT * FROM transaction_spareparts WHERE transaction_id = ?',
      id
    );
    return tx;
  },

  async getByCustomer(customerId: string): Promise<Transaction[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Transaction>(
      `SELECT t.*, c.name as customer_name, c.plate_number as customer_plate, c.phone as customer_phone,
              e.name as mechanic_name
       FROM transactions t
       LEFT JOIN customers c ON c.id = t.customer_id
       LEFT JOIN employees e ON e.id = t.mechanic_id
       WHERE t.customer_id = ?
       ORDER BY t.created_at DESC`,
      customerId
    );
  },

  async create(input: TransactionInput): Promise<Transaction> {
    const db = await getDatabase();
    const now = Date.now();
    const id = generateId();

    const totalService = input.service_items.reduce((s, x) => s + x.price, 0);
    const totalSparepart = input.spareparts.reduce(
      (s, x) => s + x.sell_price * x.quantity,
      0
    );
    const total = totalService + totalSparepart;

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO transactions (id, customer_id, mechanic_id, mechanic_notes, complaint, recommendation, status, payment_method, total_service, total_sparepart, total_amount, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.customer_id,
        input.mechanic_id ?? null,
        input.mechanic_notes ?? '',
        input.complaint ?? '',
        input.recommendation ?? '',
        input.status ?? 'pending',
        input.payment_method ?? null,
        totalService,
        totalSparepart,
        total,
        now,
        now
      );

      for (const si of input.service_items) {
        await db.runAsync(
          'INSERT INTO service_items (id, transaction_id, service_name, price) VALUES (?, ?, ?, ?)',
          generateId(),
          id,
          si.service_name,
          si.price
        );
      }
      for (const sp of input.spareparts) {
        await db.runAsync(
          `INSERT INTO transaction_spareparts (id, transaction_id, sparepart_id, sparepart_name, quantity, sell_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          generateId(),
          id,
          sp.sparepart_id,
          sp.sparepart_name,
          sp.quantity,
          sp.sell_price
        );
        // Decrement stock
        if (sp.sparepart_id) {
          await db.runAsync(
            'UPDATE spareparts SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?',
            sp.quantity,
            now,
            sp.sparepart_id
          );
        }
      }
    });

    const tx = await this.getById(id);
    return tx!;
  },

  async updateStatus(
    id: string,
    status: TransactionStatus,
    paymentMethod?: PaymentMethod | null
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE transactions SET status = ?, payment_method = ?, updated_at = ? WHERE id = ?',
      status,
      paymentMethod ?? null,
      Date.now(),
      id
    );
  },

  async updateMeta(
    id: string,
    data: { complaint?: string; recommendation?: string; mechanic_notes?: string; mechanic_id?: string | null }
  ): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: any[] = [];
    if (data.complaint !== undefined) { fields.push('complaint = ?'); params.push(data.complaint); }
    if (data.recommendation !== undefined) { fields.push('recommendation = ?'); params.push(data.recommendation); }
    if (data.mechanic_notes !== undefined) { fields.push('mechanic_notes = ?'); params.push(data.mechanic_notes); }
    if (data.mechanic_id !== undefined) { fields.push('mechanic_id = ?'); params.push(data.mechanic_id); }
    if (fields.length === 0) return;
    fields.push('updated_at = ?'); params.push(Date.now());
    params.push(id);
    await db.runAsync(
      `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
      ...params
    );
  },

  /**
   * Recalculate and persist totals (service, sparepart, grand) from current line items.
   */
  async recalcTotals(id: string): Promise<void> {
    const db = await getDatabase();
    const svcRow = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(price), 0) as total FROM service_items WHERE transaction_id = ?',
      id
    );
    const spRow = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(sell_price * quantity), 0) as total FROM transaction_spareparts WHERE transaction_id = ?',
      id
    );
    const totalService = svcRow?.total ?? 0;
    const totalSparepart = spRow?.total ?? 0;
    await db.runAsync(
      'UPDATE transactions SET total_service = ?, total_sparepart = ?, total_amount = ?, updated_at = ? WHERE id = ?',
      totalService,
      totalSparepart,
      totalService + totalSparepart,
      Date.now(),
      id
    );
  },

  async addServiceItem(
    transactionId: string,
    serviceName: string,
    price: number
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO service_items (id, transaction_id, service_name, price) VALUES (?, ?, ?, ?)',
      generateId(),
      transactionId,
      serviceName,
      price
    );
    await this.recalcTotals(transactionId);
  },

  async removeServiceItem(serviceItemId: string, transactionId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM service_items WHERE id = ?', serviceItemId);
    await this.recalcTotals(transactionId);
  },

  async addSparepartLine(
    transactionId: string,
    line: {
      sparepart_id: string | null;
      sparepart_name: string;
      quantity: number;
      sell_price: number;
    }
  ): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO transaction_spareparts (id, transaction_id, sparepart_id, sparepart_name, quantity, sell_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        generateId(),
        transactionId,
        line.sparepart_id,
        line.sparepart_name,
        line.quantity,
        line.sell_price
      );
      if (line.sparepart_id) {
        await db.runAsync(
          'UPDATE spareparts SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?',
          line.quantity,
          Date.now(),
          line.sparepart_id
        );
      }
    });
    await this.recalcTotals(transactionId);
  },

  async removeSparepartLine(
    transactionSparepartId: string,
    transactionId: string
  ): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<TransactionSparepart>(
      'SELECT * FROM transaction_spareparts WHERE id = ?',
      transactionSparepartId
    );
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'DELETE FROM transaction_spareparts WHERE id = ?',
        transactionSparepartId
      );
      if (row?.sparepart_id) {
        // Restore stock
        await sparepartService.adjustStock(row.sparepart_id, row.quantity);
      }
    });
    await this.recalcTotals(transactionId);
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    // Restore stock
    const items = await db.getAllAsync<TransactionSparepart>(
      'SELECT * FROM transaction_spareparts WHERE transaction_id = ?',
      id
    );
    await db.withTransactionAsync(async () => {
      for (const it of items) {
        if (it.sparepart_id) {
          await sparepartService.adjustStock(it.sparepart_id, it.quantity);
        }
      }
      await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
    });
  },
};
