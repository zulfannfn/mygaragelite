export type VehicleType = 'Motor' | 'Mobil';
export type TransactionStatus = 'pending' | 'paid' | 'cancelled';
export type PaymentMethod = 'Tunai' | 'Transfer' | 'QRIS' | 'Debit';
export type ReminderType = 'oil_change' | 'periodic_service' | 'tune_up';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  plate_number: string;
  vehicle_type: VehicleType;
  vehicle_brand: string;
  notes: string;
  created_at: number;
  updated_at: number;
}

export interface Sparepart {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  buy_price: number;
  sell_price: number;
  created_at: number;
  updated_at: number;
}

export interface ServiceItem {
  id: string;
  transaction_id: string;
  service_name: string;
  price: number;
}

export interface TransactionSparepart {
  id: string;
  transaction_id: string;
  sparepart_id: string;
  sparepart_name?: string;
  quantity: number;
  sell_price: number;
}

export interface Transaction {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_plate?: string;
  customer_phone?: string;
  mechanic_id?: string | null;
  mechanic_name?: string | null;
  complaint: string;
  recommendation: string;
  mechanic_notes: string;
  status: TransactionStatus;
  payment_method: PaymentMethod | null;
  total_service: number;
  total_sparepart: number;
  total_amount: number;
  created_at: number;
  updated_at: number;
  service_items?: ServiceItem[];
  spareparts?: TransactionSparepart[];
}

export type EmployeeRole = 'Mekanik' | 'Kasir' | 'Admin';

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  phone: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface Reminder {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_plate?: string;
  type: ReminderType;
  due_date: number;
  is_sent: number;
  notes: string;
}

export interface DashboardStats {
  todayRevenue: number;
  todayServiceCount: number;
  todaySparepartSold: number;
  todayTransactionCount: number;
  monthRevenue: number;
  pendingTransactions: number;
  lowStockCount: number;
}

export interface ReportData {
  date: string;
  revenue: number;
  transactionCount: number;
}

export interface TopSparepart {
  id: string;
  name: string;
  totalSold: number;
  revenue: number;
}
