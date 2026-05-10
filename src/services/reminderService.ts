import { getDatabase } from '../database/db';
import { Reminder, ReminderType } from '../types';
import { generateId } from '../utils/id';

export interface ReminderInput {
  customer_id: string;
  type: ReminderType;
  due_date: number;
  notes?: string;
}

export const reminderService = {
  async getAll(): Promise<Reminder[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Reminder>(
      `SELECT r.*, c.name as customer_name, c.plate_number as customer_plate
       FROM reminders r
       LEFT JOIN customers c ON c.id = r.customer_id
       ORDER BY r.due_date ASC`
    );
  },

  async getUpcoming(days: number = 30): Promise<Reminder[]> {
    const db = await getDatabase();
    const until = Date.now() + days * 86400000;
    return await db.getAllAsync<Reminder>(
      `SELECT r.*, c.name as customer_name, c.plate_number as customer_plate
       FROM reminders r
       LEFT JOIN customers c ON c.id = r.customer_id
       WHERE r.due_date <= ? AND r.is_sent = 0
       ORDER BY r.due_date ASC`,
      until
    );
  },

  async create(input: ReminderInput): Promise<Reminder> {
    const db = await getDatabase();
    const id = generateId();
    await db.runAsync(
      `INSERT INTO reminders (id, customer_id, type, due_date, is_sent, notes) VALUES (?, ?, ?, ?, 0, ?)`,
      id, input.customer_id, input.type, input.due_date, input.notes ?? ''
    );
    return {
      id,
      customer_id: input.customer_id,
      type: input.type,
      due_date: input.due_date,
      is_sent: 0,
      notes: input.notes ?? '',
    };
  },

  async markSent(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE reminders SET is_sent = 1 WHERE id = ?', id);
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM reminders WHERE id = ?', id);
  },
};
