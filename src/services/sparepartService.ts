import { getDatabase } from '../database/db';
import { Sparepart } from '../types';
import { generateId } from '../utils/id';

export interface SparepartInput {
  name: string;
  category?: string;
  stock?: number;
  min_stock?: number;
  buy_price?: number;
  sell_price?: number;
  supplier?: string;
  barcode?: string;
  brand?: string;
  rack_name?: string;
  rack_row?: string;
}

export const sparepartService = {
  async getAll(search?: string, limit?: number, offset?: number): Promise<Sparepart[]> {
    const db = await getDatabase();
    let sql = 'SELECT * FROM spareparts';
    const params: any[] = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' WHERE name LIKE ? OR category LIKE ? OR brand LIKE ?';
      params.push(q, q, q);
    }
    
    sql += ' ORDER BY name ASC';
    
    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
      
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }
    
    return await db.getAllAsync<Sparepart>(sql, ...params);
  },

  async getById(id: string): Promise<Sparepart | null> {
    const db = await getDatabase();
    return (
      (await db.getFirstAsync<Sparepart>('SELECT * FROM spareparts WHERE id = ?', id)) ?? null
    );
  },

  async getByName(name: string): Promise<Sparepart | null> {
    const db = await getDatabase();
    return (
      (await db.getFirstAsync<Sparepart>(
        'SELECT * FROM spareparts WHERE LOWER(name) = LOWER(?) LIMIT 1',
        name.trim()
      )) ?? null
    );
  },

  async getLowStock(): Promise<Sparepart[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Sparepart>(
      'SELECT * FROM spareparts WHERE stock <= min_stock ORDER BY stock ASC'
    );
  },

  async getUniqueCategories(): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ category: string }>(
      'SELECT DISTINCT category FROM spareparts WHERE category IS NOT NULL ORDER BY category ASC'
    );
    return rows.map(r => r.category);
  },

  async create(input: SparepartInput): Promise<Sparepart> {
    const db = await getDatabase();
    const now = Date.now();
    const id = generateId();
    const sp: Sparepart = {
      id,
      name: input.name,
      category: input.category ?? 'Lainnya',
      stock: input.stock ?? 0,
      min_stock: input.min_stock ?? 5,
      buy_price: input.buy_price ?? 0,
      sell_price: input.sell_price ?? 0,
      supplier: input.supplier ?? '',
      barcode: input.barcode ?? '',
      brand: input.brand ?? '',
      rack_name: input.rack_name ?? '',
      rack_row: input.rack_row ?? '',
      created_at: now,
      updated_at: now,
    };
    await db.runAsync(
      `INSERT INTO spareparts (id, name, category, stock, min_stock, buy_price, sell_price, supplier, barcode, brand, rack_name, rack_row, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sp.id, sp.name, sp.category, sp.stock, sp.min_stock, sp.buy_price, sp.sell_price,
      sp.supplier ?? '', sp.barcode ?? '', sp.brand ?? '', sp.rack_name ?? '', sp.rack_row ?? '',
      sp.created_at, sp.updated_at
    );
    return sp;
  },

  async update(id: string, input: SparepartInput): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    await db.runAsync(
      `UPDATE spareparts SET name = ?, category = ?, stock = ?, min_stock = ?, buy_price = ?, sell_price = ?, supplier = ?, barcode = ?, brand = ?, rack_name = ?, rack_row = ?, updated_at = ?
       WHERE id = ?`,
      input.name,
      input.category ?? 'Lainnya',
      input.stock ?? 0,
      input.min_stock ?? 5,
      input.buy_price ?? 0,
      input.sell_price ?? 0,
      input.supplier ?? '',
      input.barcode ?? '',
      input.brand ?? '',
      input.rack_name ?? '',
      input.rack_row ?? '',
      now,
      id
    );
  },

  async updatePrices(id: string, buy_price: number, sell_price: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE spareparts SET buy_price = ?, sell_price = ?, updated_at = ? WHERE id = ?',
      buy_price,
      sell_price,
      Date.now(),
      id
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM spareparts WHERE id = ?', id);
  },

  async adjustStock(id: string, delta: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE spareparts SET stock = MAX(0, stock + ?), updated_at = ? WHERE id = ?',
      delta,
      Date.now(),
      id
    );
  },

  async count(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM spareparts'
    );
    return row?.count ?? 0;
  },
};
