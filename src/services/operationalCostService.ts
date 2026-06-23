import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database/db';
import { OperationalCost } from '../types';

export const operationalCostService = {
  async getAll(start?: number, end?: number): Promise<OperationalCost[]> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    return db.getAllAsync<OperationalCost>(
      `SELECT * FROM operational_costs
       ${hasRange ? 'WHERE cost_date BETWEEN ? AND ?' : ''}
       ORDER BY cost_date DESC`,
      ...(hasRange ? [start!, end!] : [])
    );
  },

  async create(input: {
    name: string;
    category: string;
    amount: number;
    cost_date: number;
    notes?: string;
  }): Promise<OperationalCost> {
    const db = await getDatabase();
    const id = Crypto.randomUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO operational_costs (id, name, category, amount, cost_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, input.name, input.category, input.amount, input.cost_date, input.notes ?? '', now
    );
    return { id, name: input.name, category: input.category, amount: input.amount, cost_date: input.cost_date, notes: input.notes ?? '', created_at: now };
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM operational_costs WHERE id = ?', id);
  },
};
