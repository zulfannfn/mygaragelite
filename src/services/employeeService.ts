import { getDatabase } from '../database/db';
import { Employee, EmployeeRole } from '../types';
import { generateId } from '../utils/id';

export interface EmployeeInput {
  name: string;
  role?: EmployeeRole;
  phone?: string;
  is_active?: boolean;
}

export const employeeService = {
  async getAll(activeOnly = false): Promise<Employee[]> {
    const db = await getDatabase();
    const sql = activeOnly
      ? 'SELECT * FROM employees WHERE is_active = 1 ORDER BY name ASC'
      : 'SELECT * FROM employees ORDER BY is_active DESC, name ASC';
    return await db.getAllAsync<Employee>(sql);
  },

  async getMechanics(): Promise<Employee[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Employee>(
      `SELECT * FROM employees WHERE is_active = 1 AND role = 'Mekanik' ORDER BY name ASC`
    );
  },

  async getCashiers(): Promise<Employee[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Employee>(
      `SELECT * FROM employees WHERE is_active = 1 AND role = 'Kasir' ORDER BY name ASC`
    );
  },

  async getById(id: string): Promise<Employee | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Employee>(
      'SELECT * FROM employees WHERE id = ?',
      id
    );
    return row ?? null;
  },

  async create(input: EmployeeInput): Promise<Employee> {
    const db = await getDatabase();
    const now = Date.now();
    const id = generateId();
    const employee: Employee = {
      id,
      name: input.name.trim(),
      role: input.role ?? 'Mekanik',
      phone: input.phone ?? '',
      is_active: input.is_active === false ? 0 : 1,
      created_at: now,
      updated_at: now,
    };
    await db.runAsync(
      `INSERT INTO employees (id, name, role, phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      employee.id,
      employee.name,
      employee.role,
      employee.phone,
      employee.is_active,
      employee.created_at,
      employee.updated_at
    );
    return employee;
  },

  async update(id: string, input: EmployeeInput): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE employees SET name = ?, role = ?, phone = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      input.name.trim(),
      input.role ?? 'Mekanik',
      input.phone ?? '',
      input.is_active === false ? 0 : 1,
      Date.now(),
      id
    );
  },

  async delete(id: string): Promise<{ deleted: boolean; deactivated: boolean }> {
    const db = await getDatabase();
    const ref = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE mechanic_id = ?',
      id
    );
    if ((ref?.count ?? 0) > 0) {
      // soft delete
      await db.runAsync(
        'UPDATE employees SET is_active = 0, updated_at = ? WHERE id = ?',
        Date.now(),
        id
      );
      return { deleted: false, deactivated: true };
    }
    await db.runAsync('DELETE FROM employees WHERE id = ?', id);
    return { deleted: true, deactivated: false };
  },

  async count(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM employees WHERE is_active = 1'
    );
    return row?.count ?? 0;
  },
};
