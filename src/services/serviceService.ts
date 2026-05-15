import { getDatabase } from '../database/db';
import { Service } from '../types';
import { generateId } from '../utils/id';

export interface ServiceInput {
  name: string;
  price: number;
}

export const serviceService = {
  async getAll(search?: string, limit?: number, offset?: number): Promise<Service[]> {
    const db = await getDatabase();
    let sql = 'SELECT * FROM services';
    const params: any[] = [];
    
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' WHERE name LIKE ?';
      params.push(q);
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
    
    return await db.getAllAsync<Service>(sql, ...params);
  },

  async getById(id: string): Promise<Service | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<Service>('SELECT * FROM services WHERE id = ?', id);
  },

  async create(input: ServiceInput): Promise<Service> {
    const db = await getDatabase();
    const now = Date.now();
    const id = generateId();
    await db.runAsync(
      'INSERT INTO services (id, name, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      id,
      input.name.trim(),
      input.price,
      now,
      now
    );
    return { id, name: input.name.trim(), price: input.price, created_at: now, updated_at: now };
  },

  async update(id: string, input: ServiceInput): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE services SET name = ?, price = ?, updated_at = ? WHERE id = ?',
      input.name.trim(),
      input.price,
      Date.now(),
      id
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM services WHERE id = ?', id);
  },
};
