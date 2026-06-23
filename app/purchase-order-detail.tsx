import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { purchaseOrderPdfService } from '../src/services/purchaseOrderPdfService';
import { purchaseOrderService } from '../src/services/purchaseOrderService';
import { sparepartService } from '../src/services/sparepartService';
import { stockHistoryService } from '../src/services/stockHistoryService';
import { useAppStore } from '../src/store/useAppStore';
import { PurchaseOrder, PurchaseOrderStatus } from '../src/types';
import { formatCurrency } from '../src/utils/currency';
import { formatDate } from '../src/utils/date';

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  pre_order: 'Sedang Pre Order',
  belum_input: 'Belum Input',
  selesai: 'Selesai',
};

const STATUS_VARIANT: Record<PurchaseOrderStatus, 'warning' | 'info' | 'success'> = {
  pre_order: 'warning',
  belum_input: 'info',
  selesai: 'success',
};

export default function PurchaseOrderDetailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useAppStore((s) => s.showToast);

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [printingPO, setPrintingPO] = useState(false);
  const [printingTerima, setPrintingTerima] = useState(false);
  const [applyingStock, setApplyingStock] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await purchaseOrderService.getById(id);
    setPo(data);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (!id) return;
    await purchaseOrderService.delete(id);
    showToast('PO dihapus', 'success');
    router.back();
  };

  const printPO = async () => {
    if (!po) return;
    setPrintingPO(true);
    try {
      await purchaseOrderPdfService.printBeritaAcaraPO(po);
    } catch (e: any) {
      showToast('Gagal cetak: ' + (e?.message ?? ''), 'error');
    } finally {
      setPrintingPO(false);
    }
  };

  const printTerima = async () => {
    if (!po) return;
    setPrintingTerima(true);
    try {
      await purchaseOrderPdfService.printBeritaAcaraTerima(po);
    } catch (e: any) {
      showToast('Gagal cetak: ' + (e?.message ?? ''), 'error');
    } finally {
      setPrintingTerima(false);
    }
  };

  const inputStockNow = async () => {
    if (!po?.items) return;
    setApplyingStock(true);
    try {
      let appliedAny = false;
      for (const item of po.items) {
        const pending = item.qty_received - item.qty_stocked;
        if (pending <= 0) continue;
        const sp = await sparepartService.getById(item.sparepart_id);
        if (!sp) continue;
        const stockAfter = sp.stock + pending;
        await sparepartService.adjustStock(sp.id, pending);
        await stockHistoryService.record(
          sp.id,
          sp.name,
          pending,
          stockAfter,
          `Restock dari PO-${po.po_number || po.id.slice(0, 6).toUpperCase()}`,
          'manual'
        );
        await purchaseOrderService.applyStock(item.id, pending);
        appliedAny = true;
      }
      if (appliedAny) {
        showToast('Stok berhasil diinput', 'success');
        await load();
      }
    } catch (e: any) {
      showToast('Gagal input stok: ' + (e?.message ?? ''), 'error');
    } finally {
      setApplyingStock(false);
    }
  };

  if (!po) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScreenHeader title="Detail PO" showBack />
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }}>Memuat...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={po.po_number || `PO-${po.id.slice(0, 6).toUpperCase()}`} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                {po.supplier || 'Tanpa supplier'}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                Dibuat: {formatDate(po.created_at)}
              </Text>
              {po.notes ? (
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 6 }}>{po.notes}</Text>
              ) : null}
            </View>
            <Badge label={STATUS_LABEL[po.status]} variant={STATUS_VARIANT[po.status]} />
          </View>
        </Card>

        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
          ITEM
        </Text>
        {(po.items ?? []).map((item) => (
          <Card key={item.id} style={{ marginBottom: 10 }}>
            <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14 }}>{item.sparepart_name}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Qty Pesan</Text>
              <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>{item.qty_ordered}</Text>
            </View>
            {po.status !== 'pre_order' && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Qty Diterima</Text>
                  <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>{item.qty_received}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Sudah Distok</Text>
                  <Text
                    style={{
                      color: item.qty_stocked >= item.qty_received ? theme.colors.success : theme.colors.warning,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {item.qty_stocked}/{item.qty_received}
                  </Text>
                </View>
              </>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Harga Beli</Text>
              <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>{formatCurrency(item.buy_price)}</Text>
            </View>
          </Card>
        ))}

        {po.status === 'belum_input' && (
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 12, lineHeight: 18 }}>
            Tekan "Input Stock Sekarang" untuk langsung memasukkan seluruh qty yang diterima ke stok, atau input sebagian dari halaman Riwayat Stok sparepart terkait.
          </Text>
        )}

        <View style={{ gap: 10, marginTop: 8 }}>
          {po.status === 'pre_order' && (
            <>
              <Button
                title="Tandai Diterima"
                size="lg"
                fullWidth
                onPress={() => router.push({ pathname: '/purchase-order-receive', params: { id: po.id } })}
                icon={<Ionicons name="checkmark-done-circle" size={18} color="#fff" />}
              />
              <Button
                title="Cetak Berita Acara PO"
                variant="secondary"
                fullWidth
                loading={printingPO}
                onPress={printPO}
                icon={<Ionicons name="document-text" size={18} color="#fff" />}
              />
            </>
          )}
          {po.status === 'belum_input' && (
            <>
              <Button
                title="Input Stock Sekarang"
                size="lg"
                fullWidth
                loading={applyingStock}
                onPress={inputStockNow}
                icon={<Ionicons name="cube" size={18} color="#fff" />}
              />
              <Button
                title="Cetak Berita Acara Terima"
                variant="secondary"
                fullWidth
                loading={printingTerima}
                onPress={printTerima}
                icon={<Ionicons name="document-text" size={18} color="#fff" />}
              />
            </>
          )}
          <Button title="Hapus PO" variant="outline-danger" fullWidth onPress={() => setConfirmDelete(true)} />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title="Hapus Purchase Order?"
        message="PO dan seluruh itemnya akan dihapus permanen."
        confirmText="Hapus"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
