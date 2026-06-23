import { getDatabase } from '../database/db';
import { FinancialReportData, MechanicShareItem } from '../types';
import { operationalCostService } from './operationalCostService';
import { settingsService } from './settingsService';

type ShareSource = 'all' | 'service' | 'margin';
interface MechShareConfig { source: ShareSource; pct: string; }

export const financialReportService = {
  async getReport(start: number, end: number): Promise<FinancialReportData> {
    const db = await getDatabase();

    // Service revenue from transactions table
    const svcRow = await db.getFirstAsync<{ serviceRevenue: number }>(
      `SELECT COALESCE(SUM(total_service), 0) as serviceRevenue
       FROM transactions WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
      start, end
    );

    // Gross sparepart revenue = SUM(qty * sell_price) before any discounts
    const grossSpRow = await db.getFirstAsync<{ sparepartRevenue: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * tsp.sell_price), 0) as sparepartRevenue
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       WHERE t.status = 'paid' AND t.created_at BETWEEN ? AND ?`,
      start, end
    );

    // Total discount (per-item + custom)
    const itemDiscRow = await db.getFirstAsync<{ itemDiscount: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * COALESCE(tsp.discount_per_item, 0)), 0) as itemDiscount
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       WHERE t.status = 'paid' AND t.created_at BETWEEN ? AND ?`,
      start, end
    );
    const customDiscRow = await db.getFirstAsync<{ customDiscount: number }>(
      `SELECT COALESCE(SUM(COALESCE(custom_discount, 0)), 0) as customDiscount
       FROM transactions WHERE status = 'paid' AND created_at BETWEEN ? AND ?`,
      start, end
    );

    // Sparepart buy cost
    const costRow = await db.getFirstAsync<{ sparepartCost: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * COALESCE(s.buy_price, 0)), 0) as sparepartCost
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid' AND t.created_at BETWEEN ? AND ?`,
      start, end
    );

    // Sparepart margin (after per-item discounts; custom_discount subtracted below)
    const marginRow = await db.getFirstAsync<{ sparepartMargin: number }>(
      `SELECT COALESCE(SUM(tsp.quantity * (tsp.sell_price - COALESCE(tsp.discount_per_item, 0) - COALESCE(s.buy_price, 0))), 0) as sparepartMargin
       FROM transaction_spareparts tsp
       JOIN transactions t ON t.id = tsp.transaction_id
       LEFT JOIN spareparts s ON s.id = tsp.sparepart_id
       WHERE t.status = 'paid' AND t.created_at BETWEEN ? AND ?`,
      start, end
    );

    // Per-mechanic data for the period
    const mechanicRows = await db.getAllAsync<{
      id: string; name: string;
      revenue: number; serviceRevenue: number; sparepartMargin: number;
    }>(
      `SELECT
         t.mechanic_id as id,
         COALESCE(e.name, 'Tanpa Mekanik') as name,
         SUM(t.total_amount) as revenue,
         SUM(t.total_service) as serviceRevenue,
         COALESCE(SUM(sp_m.margin), 0) as sparepartMargin
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
       ) sp_m ON sp_m.transaction_id = t.id
       WHERE t.status = 'paid' AND t.mechanic_id IS NOT NULL AND t.created_at BETWEEN ? AND ?
       GROUP BY t.mechanic_id, e.name
       ORDER BY revenue DESC`,
      start, end
    );

    // Load saved mechanic share configs
    const cfgRaw = await settingsService.get('mech_share_configs');
    const mechConfigs: Record<string, MechShareConfig> = cfgRaw ? JSON.parse(cfgRaw) : {};

    const mechanics: MechanicShareItem[] = mechanicRows.map((m) => {
      const cfg: MechShareConfig = mechConfigs[m.id] ?? { source: 'all', pct: '10' };
      const pct = Math.min(100, Math.max(0, parseFloat(cfg.pct) || 0));
      const base = cfg.source === 'service' ? m.serviceRevenue
        : cfg.source === 'margin' ? m.sparepartMargin
        : m.revenue;
      return {
        id: m.id,
        name: m.name,
        revenue: m.revenue,
        serviceRevenue: m.serviceRevenue,
        sparepartMargin: m.sparepartMargin,
        shareSource: cfg.source,
        sharePct: pct,
        shareAmount: base * pct / 100,
      };
    });

    // Operational costs in period
    const operationalCosts = await operationalCostService.getAll(start, end);

    const serviceRevenue = svcRow?.serviceRevenue ?? 0;
    const sparepartRevenue = grossSpRow?.sparepartRevenue ?? 0;
    const omzet = serviceRevenue + sparepartRevenue;
    const sparepartCost = costRow?.sparepartCost ?? 0;
    const totalDiscount = (itemDiscRow?.itemDiscount ?? 0) + (customDiscRow?.customDiscount ?? 0);
    const sparepartMargin = (marginRow?.sparepartMargin ?? 0) - (customDiscRow?.customDiscount ?? 0);
    const grossIncome = serviceRevenue + sparepartMargin;
    const totalMechanicShare = mechanics.reduce((s, m) => s + m.shareAmount, 0);
    const totalOperationalCost = operationalCosts.reduce((s, c) => s + c.amount, 0);
    const totalExpense = totalMechanicShare + totalOperationalCost;
    const netProfit = grossIncome - totalExpense;
    const profitMargin = omzet > 0 ? (netProfit / omzet) * 100 : 0;

    return {
      omzet, serviceRevenue, sparepartRevenue, sparepartCost, sparepartMargin, grossIncome,
      totalDiscount,
      mechanics, totalMechanicShare,
      operationalCosts, totalOperationalCost,
      totalExpense, netProfit, profitMargin,
    };
  },
};
