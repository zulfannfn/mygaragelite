import { getDatabase } from '../database/db';
import { Customer, CustomerType, VehicleType } from '../types';
import { generateId } from '../utils/id';

export interface CustomerInput {
  name: string;
  phone?: string;
  plate_number?: string;
  vehicle_type?: VehicleType;
  vehicle_brand?: string;
  customer_type?: CustomerType;
  notes?: string;
}

export const customerService = {
  async getAll(search?: string, limit?: number, offset?: number): Promise<Customer[]> {
    const db = await getDatabase();
    let sql = 'SELECT * FROM customers';
    const params: any[] = [];
    
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ' WHERE name LIKE ? OR plate_number LIKE ? OR phone LIKE ?';
      params.push(q, q, q);
    }
    
    sql += ' ORDER BY updated_at DESC';
    
    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
      
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }
    
    return await db.getAllAsync<Customer>(sql, ...params);
  },

  async getById(id: string): Promise<Customer | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Customer>(
      'SELECT * FROM customers WHERE id = ?',
      id
    );
    return row ?? null;
  },

  async create(input: CustomerInput): Promise<Customer> {
    const db = await getDatabase();
    const now = Date.now();
    const id = generateId();
    const customer: Customer = {
      id,
      name: input.name,
      phone: input.phone ?? '',
      plate_number: input.plate_number ?? '',
      vehicle_type: input.vehicle_type ?? 'Motor',
      vehicle_brand: input.vehicle_brand ?? '',
      customer_type: input.customer_type ?? 'orang',
      notes: input.notes ?? '',
      created_at: now,
      updated_at: now,
    };
    await db.runAsync(
      `INSERT INTO customers (id, name, phone, plate_number, vehicle_type, vehicle_brand, customer_type, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      customer.id, customer.name, customer.phone, customer.plate_number,
      customer.vehicle_type, customer.vehicle_brand, customer.customer_type, customer.notes,
      customer.created_at, customer.updated_at
    );
    return customer;
  },

  async update(id: string, input: CustomerInput): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    await db.runAsync(
      `UPDATE customers SET name = ?, phone = ?, plate_number = ?, vehicle_type = ?, vehicle_brand = ?, customer_type = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      input.name,
      input.phone ?? '',
      input.plate_number ?? '',
      input.vehicle_type ?? 'Motor',
      input.vehicle_brand ?? '',
      input.customer_type ?? 'orang',
      input.notes ?? '',
      now,
      id
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM customers WHERE id = ?', id);
  },

  async count(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM customers'
    );
    return row?.count ?? 0;
  },
};
