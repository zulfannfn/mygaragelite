import { getDatabase } from '../database/db';
import { DashboardStats, ReportData, TopSparepart } from '../types';
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from '../utils/date';

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

    const pending = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'`
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

    return {
      todayRevenue: todayRevenue?.total ?? 0,
      todayServiceCount: todayTx?.count ?? 0,
      todaySparepartSold: todaySp?.total ?? 0,
      todayTransactionCount: todayTx?.count ?? 0,
      monthRevenue: monthRev?.total ?? 0,
      pendingTransactions: pending?.count ?? 0,
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
      const row = await db.getFirstAsync<{ revenue: number; cnt: number }>(
        `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as cnt
         FROM transactions
         WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
        start, end
      );
      result.push({
        date: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        revenue: row?.revenue ?? 0,
        transactionCount: row?.cnt ?? 0,
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
      const row = await db.getFirstAsync<{ revenue: number; cnt: number }>(
        `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as cnt
         FROM transactions
         WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
        start, end
      );
      result.push({
        date: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        revenue: row?.revenue ?? 0,
        transactionCount: row?.cnt ?? 0,
      });
    }
    return result;
  },

  async getTopSpareparts(limit: number = 5): Promise<TopSparepart[]> {
    const db = await getDatabase();
    return await db.getAllAsync<TopSparepart>(
      `SELECT
         tsp.sparepart_id as id,
         COALESCE(s.name, tsp.sparepart_name) as name,
         SUM(tsp.quantity) as totalSold,
         SUM(tsp.quantity * tsp.sell_price) as revenue
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid'
       GROUP BY tsp.sparepart_id, tsp.sparepart_name
       ORDER BY totalSold DESC
       LIMIT ?`,
      limit
    );
  },
};
