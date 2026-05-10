import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { theme } from '../src/constants/theme';
import { receiptService } from '../src/services/receiptService';
import { transactionService } from '../src/services/transactionService';
import { useAppStore } from '../src/store/useAppStore';
import { useTransactionStore } from '../src/store/useTransactionStore';
import { Transaction } from '../src/types';
import { formatCurrency } from '../src/utils/currency';
import { formatDateTime } from '../src/utils/date';

export default function TransactionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const { updateStatus, remove } = useTransactionStore();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionBusy, setActionBusy] = useState<'print' | 'wa' | null>(null);

  useEffect(() => {
    if (id) {
      transactionService.getById(id).then(setTx);
    }
  }, [id]);

  const markPaid = async () => {
    if (!id) return;
    await updateStatus(id, 'paid', 'Tunai');
    setTx((p) => (p ? { ...p, status: 'paid', payment_method: 'Tunai' } : p));
    showToast('Status diperbarui', 'success');
  };

  const cancel = async () => {
    if (!id) return;
    await updateStatus(id, 'cancelled', null);
    setTx((p) => (p ? { ...p, status: 'cancelled' } : p));
    showToast('Transaksi dibatalkan', 'info');
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (!id) return;
    await remove(id);
    showToast('Transaksi dihapus', 'success');
    router.back();
  };

  const handlePrint = async () => {
    if (!tx) return;
    setActionBusy('print');
    try {
      await receiptService.printPdf(tx);
    } catch (e: any) {
      showToast('Gagal cetak: ' + (e?.message ?? ''), 'error');
    } finally {
      setActionBusy(null);
    }
  };

  const handleWhatsApp = async () => {
    if (!tx) return;
    setActionBusy('wa');
    const r = await receiptService.sendWhatsApp(tx);
    if (!r.ok) showToast(r.reason ?? 'Gagal kirim WA', 'error');
    setActionBusy(null);
  };

  if (!tx) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScreenHeader title="Detail Transaksi" showBack />
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }}>
          Memuat...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Detail Transaksi" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header card */}
        <Card style={{ marginBottom: 12, backgroundColor: theme.colors.primary }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>TOTAL</Text>
            <Badge
              label={tx.status === 'paid' ? 'Lunas' : tx.status === 'pending' ? 'Pending' : 'Batal'}
              variant={tx.status === 'paid' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'}
            />
          </View>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>
            {formatCurrency(tx.total_amount)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 }}>
            {formatDateTime(tx.created_at)} {tx.payment_method ? `• ${tx.payment_method}` : ''}
          </Text>
        </Card>

        {/* Customer */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={sectionLabel}>PELANGGAN</Text>
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
            {tx.customer_name ?? '-'}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 }}>
            {tx.customer_plate ?? '-'}
            {tx.customer_phone ? ` • ${tx.customer_phone}` : ''}
          </Text>
          {tx.mechanic_name ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Ionicons name="construct" size={14} color={theme.colors.accent} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                Mekanik: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{tx.mechanic_name}</Text>
              </Text>
            </View>
          ) : null}
        </Card>

        {tx.complaint ? (
          <Card style={{ marginBottom: 12 }} accent>
            <Text style={sectionLabel}>KELUHAN PELANGGAN</Text>
            <Text style={{ color: theme.colors.text, marginTop: 4, lineHeight: 20 }}>
              {tx.complaint}
            </Text>
          </Card>
        ) : null}

        {/* Services */}
        {tx.service_items && tx.service_items.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={sectionLabel}>JASA SERVIS</Text>
            {tx.service_items.map((s) => (
              <View
                key={s.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.divider,
                }}
              >
                <Text style={{ color: theme.colors.text, flex: 1 }}>{s.service_name}</Text>
                <Text style={{ color: theme.colors.accent, fontWeight: '700' }}>
                  {formatCurrency(s.price)}
                </Text>
              </View>
            ))}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: 8,
              }}
            >
              <Text style={{ color: theme.colors.textSecondary }}>Subtotal</Text>
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                {formatCurrency(tx.total_service)}
              </Text>
            </View>
          </Card>
        )}

        {/* Spareparts */}
        {tx.spareparts && tx.spareparts.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={sectionLabel}>SPAREPART</Text>
            {tx.spareparts.map((p) => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.divider,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text }}>{p.sparepart_name}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                    {formatCurrency(p.sell_price)} × {p.quantity}
                  </Text>
                </View>
                <Text style={{ color: theme.colors.accent, fontWeight: '700' }}>
                  {formatCurrency(p.sell_price * p.quantity)}
                </Text>
              </View>
            ))}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: 8,
              }}
            >
              <Text style={{ color: theme.colors.textSecondary }}>Subtotal</Text>
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                {formatCurrency(tx.total_sparepart)}
              </Text>
            </View>
          </Card>
        )}

        {tx.recommendation ? (
          <Card style={{ marginBottom: 12 }} accent>
            <Text style={sectionLabel}>REKOMENDASI SERVIS BERIKUTNYA</Text>
            <Text style={{ color: theme.colors.text, marginTop: 4, lineHeight: 20 }}>
              {tx.recommendation}
            </Text>
          </Card>
        ) : null}

        {tx.mechanic_notes ? (
          <Card style={{ marginBottom: 12 }}>
            <Text style={sectionLabel}>CATATAN INTERNAL MEKANIK</Text>
            <Text style={{ color: theme.colors.text, marginTop: 4 }}>{tx.mechanic_notes}</Text>
          </Card>
        ) : null}

        {/* Receipt actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 8 }}>
          <Button
            title="Kirim WA"
            variant="success"
            onPress={handleWhatsApp}
            loading={actionBusy === 'wa'}
            disabled={!tx.customer_phone}
            icon={<Ionicons name="logo-whatsapp" size={18} color="#fff" />}
            style={{ flex: 1 }}
          />
          <Button
            title="Cetak PDF"
            variant="secondary"
            onPress={handlePrint}
            loading={actionBusy === 'print'}
            icon={<Ionicons name="print" size={18} color="#fff" />}
            style={{ flex: 1 }}
          />
        </View>

        {/* Actions */}
        <View style={{ gap: 10, marginTop: 8 }}>
          {tx.status === 'pending' && (
            <Button
              title="Tandai Lunas"
              onPress={markPaid}
              size="lg"
              fullWidth
              icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
            />
          )}
          {tx.status !== 'cancelled' && (
            <Button title="Batalkan" variant="outline" onPress={cancel} fullWidth />
          )}
          <Button
            title="Hapus Transaksi"
            variant="danger"
            onPress={() => setConfirmDelete(true)}
            fullWidth
          />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title="Hapus Transaksi?"
        message="Stok sparepart akan dikembalikan secara otomatis."
        confirmText="Hapus"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}

const sectionLabel = {
  color: theme.colors.textSecondary,
  fontSize: 11,
  fontWeight: '700' as const,
  letterSpacing: 0.5,
};
