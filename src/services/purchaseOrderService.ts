import { getDatabase } from '../database/db';
import { PendingPOItemForSparepart, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../types';
import { generateId } from '../utils/id';

export interface PurchaseOrderItemInput {
  sparepart_id: string;
  sparepart_name: string;
  qty_ordered: number;
  buy_price: number;
}

export interface PurchaseOrderInput {
  po_number?: string;
  supplier?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

export const purchaseOrderService = {
  async create(input: PurchaseOrderInput): Promise<PurchaseOrder> {
    const db = await getDatabase();
    const now = Date.now();
    const id = generateId();
    const po: PurchaseOrder = {
      id,
      po_number: input.po_number?.trim() ?? '',
      supplier: input.supplier?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
      status: 'pre_order',
      created_at: now,
      updated_at: now,
    };
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO purchase_orders (id, po_number, supplier, notes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        po.id, po.po_number, po.supplier, po.notes, po.status, po.created_at, po.updated_at
      );
      for (const item of input.items) {
        await db.runAsync(
          `INSERT INTO purchase_order_items (id, po_id, sparepart_id, sparepart_name, qty_ordered, qty_received, qty_stocked, buy_price)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
          generateId(), po.id, item.sparepart_id, item.sparepart_name, item.qty_ordered, item.buy_price
        );
      }
    });
    return po;
  },

  async getAll(status?: PurchaseOrderStatus): Promise<PurchaseOrder[]> {
    const db = await getDatabase();
    if (status) {
      return db.getAllAsync<PurchaseOrder>(
        'SELECT * FROM purchase_orders WHERE status = ? ORDER BY created_at DESC',
        status
      );
    }
    return db.getAllAsync<PurchaseOrder>('SELECT * FROM purchase_orders ORDER BY created_at DESC');
  },

  async getById(id: string): Promise<PurchaseOrder | null> {
    const db = await getDatabase();
    const po = await db.getFirstAsync<PurchaseOrder>('SELECT * FROM purchase_orders WHERE id = ?', id);
    if (!po) return null;
    po.items = await db.getAllAsync<PurchaseOrderItem>(
      'SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY sparepart_name ASC',
      id
    );
    return po;
  },

  async markReceived(id: string, items: { itemId: string; qty_received: number }[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const item of items) {
        await db.runAsync(
          'UPDATE purchase_order_items SET qty_received = ? WHERE id = ?',
          Math.max(0, item.qty_received),
          item.itemId
        );
      }
      await db.runAsync(
        "UPDATE purchase_orders SET status = 'belum_input', updated_at = ? WHERE id = ?",
        Date.now(),
        id
      );
    });
  },

  async getPendingForSparepart(sparepartId: string): Promise<PendingPOItemForSparepart[]> {
    const db = await getDatabase();
    return db.getAllAsync<PendingPOItemForSparepart>(
      `SELECT poi.id as po_item_id, poi.po_id, po.po_number, poi.sparepart_id,
              (poi.qty_received - poi.qty_stocked) as qty_pending, poi.buy_price
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.po_id
       WHERE poi.sparepart_id = ? AND poi.qty_received > poi.qty_stocked
       ORDER BY po.created_at ASC`,
      sparepartId
    );
  },

  async applyStock(poItemId: string, qty: number): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      const item = await db.getFirstAsync<PurchaseOrderItem>(
        'SELECT * FROM purchase_order_items WHERE id = ?',
        poItemId
      );
      if (!item) return;
      const pending = item.qty_received - item.qty_stocked;
      const applyQty = Math.max(0, Math.min(qty, pending));
      if (applyQty <= 0) return;

      await db.runAsync(
        'UPDATE purchase_order_items SET qty_stocked = qty_stocked + ? WHERE id = ?',
        applyQty,
        poItemId
      );

      const totals = await db.getFirstAsync<{ r: number; s: number }>(
        'SELECT SUM(qty_received) as r, SUM(qty_stocked) as s FROM purchase_order_items WHERE po_id = ?',
        item.po_id
      );
      if (totals && totals.r > 0 && totals.r === totals.s) {
        await db.runAsync(
          "UPDATE purchase_orders SET status = 'selesai', updated_at = ? WHERE id = ?",
          Date.now(),
          item.po_id
        );
      }
    });
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM purchase_orders WHERE id = ?', id);
  },
};
