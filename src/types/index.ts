export type VehicleType = 'Motor' | 'Mobil';
export type TransactionStatus = 'pending' | 'in_progress' | 'waiting_payment' | 'paid' | 'cancelled';
export type TransactionType = 'service' | 'retail';
export type PaymentMethod = 'Tunai' | 'Transfer' | 'QRIS' | 'Debit';
export type ReminderType = 'oil_change' | 'periodic_service' | 'tune_up';
export type CustomerType = 'orang' | 'bengkel';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  plate_number: string;
  vehicle_type: VehicleType;
  vehicle_brand: string;
  customer_type: CustomerType;
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
  supplier?: string;
  barcode?: string;
  brand?: string;
  rack_name?: string;
  rack_row?: string;
  created_at: number;
  updated_at: number;
}

export interface StockHistory {
  id: string;
  sparepart_id: string;
  sparepart_name: string;
  delta: number;
  stock_after: number;
  reason: string;
  source: 'manual' | 'transaction' | 'adjustment';
  buy_price_after?: number | null;
  sell_price_after?: number | null;
  created_at: number;
}

export interface Service {
  id: string;
  name: string;
  price: number;
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
  buy_price?: number;
  discount_per_item?: number;
}

export interface Transaction {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_plate?: string;
  customer_phone?: string;
  customer_vehicle_type?: VehicleType;
  customer_vehicle_brand?: string;
  mechanic_id?: string | null;
  mechanic_name?: string | null;
  cashier_id?: string | null;
  cashier_name?: string | null;
  complaint: string;
  recommendation: string;
  mechanic_notes: string;
  kilometer?: number | null;
  custom_discount?: number | null;
  next_service_date?: number | null;
  type: TransactionType;
  status: TransactionStatus;
  payment_method: PaymentMethod | null;
  paid_amount: number;
  change_amount: number;
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
  yesterdayRevenue: number;
  todayGrossProfit: number;
  yesterdayGrossProfit: number;
  monthGrossProfit: number;
  yearGrossProfit: number;
  todayServiceCount: number;
  todaySparepartSold: number;
  todayTransactionCount: number;
  monthRevenue: number;
  yearRevenue: number;
  pendingTransactions: number;
  inProgressTransactions: number;
  waitingPaymentTransactions: number;
  completedTransactions: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalTransactions: number;
  totalSpareparts: number;
  totalServices: number;
}

export interface ReportData {
  date: string;
  revenue: number;
  transactionCount: number;
  serviceRevenue: number;
  retailRevenue: number;
  serviceCount: number;
  retailCount: number;
}

export interface TopSparepart {
  id: string;
  name: string;
  totalSold: number;
  revenue: number;
  margin: number;
}

export interface TopService {
  name: string;
  totalSold: number;
  revenue: number;
}

export interface CategoryStats {
  category: string;
  totalRevenue: number;
  itemsSold: number;
  margin: number;
}

export interface TopMechanic {
  id: string;
  name: string;
  transactionCount: number;
  revenue: number;
  serviceRevenue: number;
  sparepartMargin: number;
}

export interface PaymentMethodTotal {
  method: string;
  total: number;
  count: number;
}

export interface OperationalCost {
  id: string;
  name: string;
  category: string;
  amount: number;
  cost_date: number;
  notes: string;
  created_at: number;
}

export interface MechanicShareItem {
  id: string;
  name: string;
  revenue: number;
  serviceRevenue: number;
  sparepartMargin: number;
  shareSource: 'all' | 'service' | 'margin';
  sharePct: number;
  shareAmount: number;
}

export interface FinancialReportData {
  omzet: number;
  serviceRevenue: number;
  sparepartRevenue: number;
  sparepartCost: number;
  sparepartMargin: number;
  grossIncome: number;
  totalDiscount: number;
  mechanics: MechanicShareItem[];
  totalMechanicShare: number;
  operationalCosts: OperationalCost[];
  totalOperationalCost: number;
  totalExpense: number;
  netProfit: number;
  profitMargin: number;
}

export interface RevenueStats {
  totalRevenue: number;
  serviceRevenue: number;
  sparepartRevenue: number;
  sparepartCost: number;
  sparepartMargin: number;
  grossProfit: number;
  totalDiscount: number;
  itemDiscount: number;
  customDiscount: number;
}

export interface VehicleTypeStats {
  motor: number;
  mobil: number;
}

export interface CustomerLoyaltyItem {
  customer_id: string | null;
  customer_name: string;
  transaction_count: number;
}

export interface CashierStats {
  cashier_id: string | null;
  cashier_name: string;
  transaction_count: number;
  total_revenue: number;
  payment_methods: { method: string; total: number; count: number }[];
}

export interface ServiceReminderSend {
  id: string;
  customer_id: string;
  transaction_id: string;
  sent_at: number;
}

export interface ServiceReminderDue {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_plate: string;
  customer_vehicle_brand: string;
  customer_type: CustomerType;
  transaction_id: string;
  next_service_date: number;
  last_service_date: number;
  recommendation: string;
  sent_count: number;
}

export type PurchaseOrderStatus = 'pre_order' | 'belum_input' | 'selesai';

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  sparepart_id: string;
  sparepart_name: string;
  qty_ordered: number;
  qty_received: number;
  qty_stocked: number;
  buy_price: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier: string;
  notes: string;
  status: PurchaseOrderStatus;
  created_at: number;
  updated_at: number;
  items?: PurchaseOrderItem[];
}

export interface PendingPOItemForSparepart {
  po_item_id: string;
  po_id: string;
  po_number: string;
  sparepart_id: string;
  qty_pending: number;
  buy_price: number;
}
