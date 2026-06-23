import { getDatabase } from '../database/db';
import { CashierStats, CategoryStats, CustomerLoyaltyItem, DashboardStats, PaymentMethodTotal, ReportData, RevenueStats, TopMechanic, TopService, TopSparepart, VehicleTypeStats } from '../types';
import { endOfDay, endOfMonth, endOfYear, startOfDay, startOfMonth, startOfYear } from '../utils/date';

export const reportService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const db = await getDatabase();
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const monthStart = startOfMonth();
    const monthEnd = endOfMonth();

    const todayRevenue = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM transactions
       WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
      todayStart, todayEnd
    );

    const todayTx = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE created_at BETWEEN ? AND ?`,
      todayStart, todayEnd
    );

    const todaySp = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(tsp.quantity), 0) as total
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       WHERE t.created_at BETWEEN ? AND ?`,
      todayStart, todayEnd
    );

    const monthRev = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM transactions
       WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
      monthStart, monthEnd
    );

    const yesterdayTs = Date.now() - 86400000;
    const yesterdayStart = startOfDay(yesterdayTs);
    const yesterdayEnd = endOfDay(yesterdayTs);
    const yesterdayRev = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
      yesterdayStart, yesterdayEnd
    );

    const todayBuyCost = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * COALESCE(s.buy_price, 0)), 0) as total
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid' AND t.created_at BETWEEN ? AND ?`,
      todayStart, todayEnd
    );
    const yesterdayBuyCost = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * COALESCE(s.buy_price, 0)), 0) as total
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid' AND t.created_at BETWEEN ? AND ?`,
      yesterdayStart, yesterdayEnd
    );

    const yearStart = startOfYear();
    const yearEnd = endOfYear();
    const yearRev = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM transactions
       WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
      yearStart, yearEnd
    );

    const monthBuyCost = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * COALESCE(s.buy_price, 0)), 0) as total
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid' AND t.created_at BETWEEN ? AND ?`,
      monthStart, monthEnd
    );
    const yearBuyCost = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * COALESCE(s.buy_price, 0)), 0) as total
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid' AND t.created_at BETWEEN ? AND ?`,
      yearStart, yearEnd
    );

    const pending = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'`
    );

    const inProgress = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE status = 'in_progress'`
    );

    const waitingPayment = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE status = 'waiting_payment'`
    );

    const completed = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE status = 'paid'`
    );

    const lowStock = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM spareparts WHERE stock > 0 AND stock <= min_stock`
    );

    const outOfStock = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM spareparts WHERE stock <= 0`
    );

    const totalTx = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions`
    );

    const totalSp = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM spareparts`
    );

    const totalSvc = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM service_items`
    );

    const todayRev = todayRevenue?.total ?? 0;
    const yestRev = yesterdayRev?.total ?? 0;

    return {
      todayRevenue: todayRev,
      yesterdayRevenue: yestRev,
      todayGrossProfit: todayRev - (todayBuyCost?.total ?? 0),
      yesterdayGrossProfit: yestRev - (yesterdayBuyCost?.total ?? 0),
      monthGrossProfit: (monthRev?.total ?? 0) - (monthBuyCost?.total ?? 0),
      yearGrossProfit: (yearRev?.total ?? 0) - (yearBuyCost?.total ?? 0),
      todayServiceCount: todayTx?.count ?? 0,
      todaySparepartSold: todaySp?.total ?? 0,
      todayTransactionCount: todayTx?.count ?? 0,
      monthRevenue: monthRev?.total ?? 0,
      yearRevenue: yearRev?.total ?? 0,
      pendingTransactions: pending?.count ?? 0,
      inProgressTransactions: inProgress?.count ?? 0,
      waitingPaymentTransactions: waitingPayment?.count ?? 0,
      completedTransactions: completed?.count ?? 0,
      lowStockCount: lowStock?.count ?? 0,
      outOfStockCount: outOfStock?.count ?? 0,
      totalTransactions: totalTx?.count ?? 0,
      totalSpareparts: totalSp?.count ?? 0,
      totalServices: totalSvc?.count ?? 0,
    };
  },

  async getDailyReport(days: number = 7): Promise<ReportData[]> {
    const db = await getDatabase();
    const result: ReportData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000 - 1;
      const row = await db.getFirstAsync<{
        revenue: number; cnt: number;
        serviceRevenue: number; retailRevenue: number;
        serviceCount: number; retailCount: number;
      }>(
        `SELECT
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(*) as cnt,
          COALESCE(SUM(CASE WHEN type = 'service' THEN total_amount ELSE 0 END), 0) as serviceRevenue,
          COALESCE(SUM(CASE WHEN type = 'retail' THEN total_amount ELSE 0 END), 0) as retailRevenue,
          SUM(CASE WHEN type = 'service' THEN 1 ELSE 0 END) as serviceCount,
          SUM(CASE WHEN type = 'retail' THEN 1 ELSE 0 END) as retailCount
         FROM transactions
         WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
        start, end
      );
      result.push({
        date: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        revenue: row?.revenue ?? 0,
        transactionCount: row?.cnt ?? 0,
        serviceRevenue: row?.serviceRevenue ?? 0,
        retailRevenue: row?.retailRevenue ?? 0,
        serviceCount: row?.serviceCount ?? 0,
        retailCount: row?.retailCount ?? 0,
      });
    }
    return result;
  },

  async getMonthlyReport(months: number = 6): Promise<ReportData[]> {
    const db = await getDatabase();
    const result: ReportData[] = [];
    const today = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const row = await db.getFirstAsync<{
        revenue: number; cnt: number;
        serviceRevenue: number; retailRevenue: number;
        serviceCount: number; retailCount: number;
      }>(
        `SELECT
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(*) as cnt,
          COALESCE(SUM(CASE WHEN type = 'service' THEN total_amount ELSE 0 END), 0) as serviceRevenue,
          COALESCE(SUM(CASE WHEN type = 'retail' THEN total_amount ELSE 0 END), 0) as retailRevenue,
          SUM(CASE WHEN type = 'service' THEN 1 ELSE 0 END) as serviceCount,
          SUM(CASE WHEN type = 'retail' THEN 1 ELSE 0 END) as retailCount
         FROM transactions
         WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
        start, end
      );
      result.push({
        date: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        revenue: row?.revenue ?? 0,
        transactionCount: row?.cnt ?? 0,
        serviceRevenue: row?.serviceRevenue ?? 0,
        retailRevenue: row?.retailRevenue ?? 0,
        serviceCount: row?.serviceCount ?? 0,
        retailCount: row?.retailCount ?? 0,
      });
    }
    return result;
  },

  async getTopSpareparts(
    limit: number = 5,
    start?: number,
    end?: number,
    type?: 'service' | 'retail' | 'all'
  ): Promise<TopSparepart[]> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    const typeClause = type && type !== 'all' ? 'AND t.type = ?' : '';
    const params: (number | string)[] = [];
    if (type && type !== 'all') params.push(type);
    if (hasRange) { params.push(start!); params.push(end!); }
    params.push(limit);
    return await db.getAllAsync<TopSparepart>(
      `SELECT
         tsp.sparepart_id as id,
         COALESCE(s.name, tsp.sparepart_name) as name,
         SUM(tsp.quantity) as totalSold,
         SUM(tsp.quantity * tsp.sell_price) as revenue,
         SUM(tsp.quantity * (tsp.sell_price - COALESCE(tsp.discount_per_item, 0) - COALESCE(s.buy_price, 0))
           - CASE WHEN COALESCE(t.total_sparepart, 0) > 0
                  THEN COALESCE(t.custom_discount, 0) * (tsp.quantity * tsp.sell_price) / t.total_sparepart
                  ELSE 0 END) as margin
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid' ${typeClause} ${hasRange ? 'AND t.created_at BETWEEN ? AND ?' : ''}
       GROUP BY tsp.sparepart_id, tsp.sparepart_name
       ORDER BY totalSold DESC
       LIMIT ?`,
      ...params
    );
  },

  async getTopServices(
    limit: number = 5,
    start?: number,
    end?: number
  ): Promise<TopService[]> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    return await db.getAllAsync<TopService>(
      `SELECT
         si.service_name as name,
         COUNT(*) as totalSold,
         SUM(si.price) as revenue
       FROM service_items si
       JOIN transactions t ON t.id = si.transaction_id
       WHERE t.status = 'paid' ${hasRange ? 'AND t.created_at BETWEEN ? AND ?' : ''}
       GROUP BY si.service_name
       ORDER BY totalSold DESC
       LIMIT ?`,
      ...(hasRange ? [start, end] : []),
      limit
    );
  },

  async getPaymentMethodTotals(
    start?: number,
    end?: number,
    type?: 'service' | 'retail' | 'all'
  ): Promise<PaymentMethodTotal[]> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    const typeClause = type && type !== 'all' ? 'AND type = ?' : '';
    const params: (number | string)[] = [];
    if (type && type !== 'all') params.push(type);
    if (hasRange) { params.push(start!); params.push(end!); }
    return await db.getAllAsync<PaymentMethodTotal>(
      `SELECT
        COALESCE(payment_method, 'Tunai') as method,
        SUM(total_amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE status = 'paid' ${typeClause} ${hasRange ? 'AND created_at BETWEEN ? AND ?' : ''}
      GROUP BY payment_method
      ORDER BY total DESC`,
      ...params
    );
  },

  async getTopMechanics(
    limit: number = 5,
    start?: number,
    end?: number
  ): Promise<TopMechanic[]> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    return await db.getAllAsync<TopMechanic>(
      `SELECT
         t.mechanic_id as id,
         COALESCE(e.name, 'Tanpa Mekanik') as name,
         COUNT(*) as transactionCount,
         SUM(t.total_amount) as revenue,
         SUM(t.total_service) as serviceRevenue,
         COALESCE(SUM(sp_margin.margin), 0) as sparepartMargin
       FROM transactions t
       LEFT JOIN employees e ON e.id = t.mechanic_id
       LEFT JOIN (
         SELECT tsp.transaction_id,
                SUM(tsp.quantity * (tsp.sell_price - COALESCE(tsp.discount_per_item, 0) - COALESCE(s.buy_price, 0)))
                  - MAX(COALESCE(tx.custom_discount, 0)) as margin
         FROM transaction_spareparts tsp
         JOIN transactions tx ON tx.id = tsp.transaction_id
         LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
         GROUP BY tsp.transaction_id
       ) sp_margin ON sp_margin.transaction_id = t.id
       WHERE t.status = 'paid' AND t.mechanic_id IS NOT NULL ${hasRange ? 'AND t.created_at BETWEEN ? AND ?' : ''}
       GROUP BY t.mechanic_id, e.name
       ORDER BY transactionCount DESC
       LIMIT ?`,
      ...(hasRange ? [start, end] : []),
      limit
    );
  },

  async getRevenueStats(start?: number, end?: number): Promise<RevenueStats> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    const rangeClause = hasRange ? 'AND created_at BETWEEN ? AND ?' : '';
    const rangeParams: number[] = hasRange ? [start!, end!] : [];

    const spJoinClause = hasRange ? 'AND t.created_at BETWEEN ? AND ?' : '';

    const svcRow = await db.getFirstAsync<{ serviceRevenue: number }>(
      `SELECT COALESCE(SUM(total_service), 0) as serviceRevenue
       FROM transactions WHERE status = 'paid' ${rangeClause}`,
      ...rangeParams
    );

    // Gross sparepart revenue = sum(qty * sell_price) before any discounts
    const grossSpRow = await db.getFirstAsync<{ sparepartRevenue: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * tsp.sell_price), 0) as sparepartRevenue
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       WHERE t.status = 'paid' ${spJoinClause}`,
      ...rangeParams
    );

    const spRow = await db.getFirstAsync<{ sparepartCost: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * COALESCE(s.buy_price, 0)), 0) as sparepartCost
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid' ${spJoinClause}`,
      ...rangeParams
    );

    const itemDiscRow = await db.getFirstAsync<{ itemDiscount: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * COALESCE(tsp.discount_per_item, 0)), 0) as itemDiscount
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       WHERE t.status = 'paid' ${spJoinClause}`,
      ...rangeParams
    );
    const customDiscRow = await db.getFirstAsync<{ customDiscount: number }>(
      `SELECT COALESCE(SUM(COALESCE(custom_discount, 0)), 0) as customDiscount
       FROM transactions WHERE status = 'paid' ${rangeClause}`,
      ...rangeParams
    );

    const serviceRevenue = svcRow?.serviceRevenue ?? 0;
    const sparepartRevenue = grossSpRow?.sparepartRevenue ?? 0;
    const totalRevenue = serviceRevenue + sparepartRevenue;
    const sparepartCost = spRow?.sparepartCost ?? 0;
    const itemDiscount = itemDiscRow?.itemDiscount ?? 0;
    const customDiscount = customDiscRow?.customDiscount ?? 0;
    const totalDiscount = itemDiscount + customDiscount;
    const sparepartMargin = sparepartRevenue - sparepartCost - itemDiscount - customDiscount;
    const grossProfit = serviceRevenue + sparepartMargin;

    return { totalRevenue, serviceRevenue, sparepartRevenue, sparepartCost, sparepartMargin, grossProfit, totalDiscount, itemDiscount, customDiscount };
  },

  async getVehicleTypeStats(start?: number, end?: number): Promise<VehicleTypeStats> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    const row = await db.getFirstAsync<{ motor: number; mobil: number }>(
      `SELECT
        COALESCE(SUM(CASE WHEN c.vehicle_type = 'Motor' THEN 1 ELSE 0 END), 0) as motor,
        COALESCE(SUM(CASE WHEN c.vehicle_type = 'Mobil' THEN 1 ELSE 0 END), 0) as mobil
       FROM transactions t
       LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.status = 'paid' ${hasRange ? 'AND t.created_at BETWEEN ? AND ?' : ''}`,
      ...(hasRange ? [start!, end!] : [])
    );
    return { motor: row?.motor ?? 0, mobil: row?.mobil ?? 0 };
  },

  async getCustomerLoyalty(
    type: 'service' | 'retail' | 'all',
    start?: number,
    end?: number,
    limit: number = 30,
    customerType?: 'orang' | 'bengkel'
  ): Promise<CustomerLoyaltyItem[]> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    const hasType = type !== 'all';
    const rows = await db.getAllAsync<{ customer_id: string | null; customer_name: string; transaction_count: number }>(
      `SELECT
        t.customer_id,
        CASE WHEN t.customer_id IS NULL THEN 'Tanpa Pelanggan' ELSE COALESCE(c.name, 'Tanpa Pelanggan') END as customer_name,
        COUNT(*) as transaction_count
       FROM transactions t
       LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.status = 'paid'
       ${hasType ? 'AND t.type = ?' : ''}
       ${hasRange ? 'AND t.created_at BETWEEN ? AND ?' : ''}
       ${customerType ? 'AND c.customer_type = ?' : ''}
       GROUP BY t.customer_id
       ORDER BY transaction_count DESC
       LIMIT ?`,
      ...(hasType ? [type] : []),
      ...(hasRange ? [start!, end!] : []),
      ...(customerType ? [customerType] : []),
      limit
    );
    return rows;
  },

  async getTopCashiers(limit: number = 20, start?: number, end?: number): Promise<CashierStats[]> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    const cashiers = await db.getAllAsync<{ cashier_id: string | null; cashier_name: string; transaction_count: number; total_revenue: number }>(
      `SELECT
        t.cashier_id,
        CASE WHEN t.cashier_name IS NULL OR t.cashier_name = '' THEN 'Tanpa Kasir' ELSE t.cashier_name END as cashier_name,
        COUNT(*) as transaction_count,
        SUM(t.total_amount) as total_revenue
       FROM transactions t
       WHERE t.status = 'paid'
       ${hasRange ? 'AND t.created_at BETWEEN ? AND ?' : ''}
       GROUP BY t.cashier_id, t.cashier_name
       ORDER BY total_revenue DESC
       LIMIT ?`,
      ...(hasRange ? [start!, end!] : []), limit
    );
    const result: CashierStats[] = [];
    for (const c of cashiers) {
      const methods = await db.getAllAsync<{ method: string; total: number; count: number }>(
        `SELECT
          COALESCE(payment_method, 'Tunai') as method,
          SUM(total_amount) as total,
          COUNT(*) as count
         FROM transactions
         WHERE status = 'paid' AND (cashier_id ${c.cashier_id ? '= ?' : 'IS NULL'})
         ${hasRange ? 'AND created_at BETWEEN ? AND ?' : ''}
         GROUP BY payment_method
         ORDER BY total DESC`,
        ...(c.cashier_id ? [c.cashier_id] : []),
        ...(hasRange ? [start!, end!] : [])
      );
      result.push({ ...c, payment_methods: methods });
    }
    return result;
  },

  async getCategoryStats(
    limit: number = 10,
    start?: number,
    end?: number
  ): Promise<CategoryStats[]> {
    const db = await getDatabase();
    const hasRange = start !== undefined && end !== undefined;
    return await db.getAllAsync<CategoryStats>(
      `SELECT
         COALESCE(s.category, 'Tanpa Kategori') as category,
         SUM(tsp.quantity * tsp.sell_price) as totalRevenue,
         SUM(tsp.quantity) as itemsSold,
         SUM(tsp.quantity * (tsp.sell_price - COALESCE(tsp.discount_per_item, 0) - COALESCE(s.buy_price, 0))
           - CASE WHEN COALESCE(t.total_sparepart, 0) > 0
                  THEN COALESCE(t.custom_discount, 0) * (tsp.quantity * tsp.sell_price) / t.total_sparepart
                  ELSE 0 END) as margin
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid' ${hasRange ? 'AND t.created_at BETWEEN ? AND ?' : ''}
       GROUP BY s.category
       ORDER BY totalRevenue DESC
       LIMIT ?`,
      ...(hasRange ? [start, end] : []),
      limit
    );
  },
};
