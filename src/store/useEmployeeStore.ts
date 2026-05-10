import { create } from 'zustand';
import { EmployeeInput, employeeService } from '../services/employeeService';
import { Employee } from '../types';

interface EmployeeState {
  employees: Employee[];
  loading: boolean;
  load: () => Promise<void>;
  add: (input: EmployeeInput) => Promise<Employee>;
  update: (id: string, input: EmployeeInput) => Promise<void>;
  remove: (id: string) => Promise<{ deleted: boolean; deactivated: boolean }>;
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees: [],
  loading: false,
  load: async () => {
    set({ loading: true });
    const data = await employeeService.getAll(false);
    set({ employees: data, loading: false });
  },
  add: async (input) => {
    const e = await employeeService.create(input);
    await get().load();
    return e;
  },
  update: async (id, input) => {
    await employeeService.update(id, input);
    await get().load();
  },
  remove: async (id) => {
    const res = await employeeService.delete(id);
    await get().load();
    return res;
  },
}));
