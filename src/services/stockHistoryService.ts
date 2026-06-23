import { getDatabase } from '../database/db';
import { StockHistory } from '../types';
import { generateId } from '../utils/id';

export const stockHistoryService = {
  async record(
    sparepartId: string,
    sparepartName: string,
    delta: number,
    stockAfter: number,
    reason = '',
    source: StockHistory['source'] = 'manual',
    buyPriceAfter?: number | null,
    sellPriceAfter?: number | null,
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO stock_history (id, sparepart_id, sparepart_name, delta, stock_after, reason, source, buy_price_after, sell_price_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      generateId(), sparepartId, sparepartName, delta, stockAfter, reason, source,
      buyPriceAfter ?? null, sellPriceAfter ?? null, Date.now(),
    );
  },

  async getBySparepart(sparepartId: string): Promise<StockHistory[]> {
    const db = await getDatabase();
    return db.getAllAsync<StockHistory>(
      'SELECT * FROM stock_history WHERE sparepart_id = ? ORDER BY created_at DESC',
      sparepartId,
    );
  },
};
