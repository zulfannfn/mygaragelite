import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AddServiceSheet } from '../src/components/ui/AddServiceSheet';
import { AddSparepartSheet } from '../src/components/ui/AddSparepartSheet';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { WhatsAppTemplateModal } from '../src/components/ui/WhatsAppTemplateModal';
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
  const { updateStatus, remove, load: reloadList } = useTransactionStore();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionBusy, setActionBusy] = useState<'print' | 'wa' | null>(null);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addSparepartOpen, setAddSparepartOpen] = useState(false);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<
    { kind: 'service' | 'sparepart'; itemId: string; name: string } | null
  >(null);
  const [editMechanicNotes, setEditMechanicNotes] = useState(false);
  const [editRecommendation, setEditRecommendation] = useState(false);
  const [tempMechanicNotes, setTempMechanicNotes] = useState('');
  const [tempRecommendation, setTempRecommendation] = useState('');
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);

  const reloadTx = useCallback(async () => {
    if (!id) return;
    const fresh = await transactionService.getById(id);
    setTx(fresh);
  }, [id]);

  useEffect(() => {
    reloadTx();
  }, [reloadTx]);

  const markPaid = async (method: string) => {
    if (!id) return;
    await updateStatus(id, 'paid', method as any);
    setTx((p) => (p ? { ...p, status: 'paid', payment_method: method as any } : p));
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

  const openWaTemplate = () => {
    if (!tx) return;
    if (!tx.customer_phone) {
      showToast('Pelanggan belum punya nomor HP', 'error');
      return;
    }
    setWaModalOpen(true);
  };

  const handleAddService = async (svc: { service_name: string; price: number }) => {
    if (!tx) return;
    try {
      await transactionService.addServiceItem(tx.id, svc.service_name, svc.price);
      await reloadTx();
      await reloadList();
      showToast('Jasa ditambahkan', 'success');
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message ?? ''), 'error');
    }
  };

  const handleAddSparepart = async (
    sp: { id: string; name: string; sell_price: number },
    qty: number
  ) => {
    if (!tx) return;
    try {
      await transactionService.addSparepartLine(tx.id, {
        sparepart_id: sp.id,
        sparepart_name: sp.name,
        quantity: qty,
        sell_price: sp.sell_price,
      });
      await reloadTx();
      await reloadList();
      setAddSparepartOpen(false);
      showToast('Sparepart ditambahkan', 'success');
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message ?? ''), 'error');
    }
  };

  const performRemoveItem = async () => {
    if (!tx || !confirmRemoveItem) return;
    const target = confirmRemoveItem;
    setConfirmRemoveItem(null);
    try {
      if (target.kind === 'service') {
        await transactionService.removeServiceItem(target.itemId, tx.id);
      } else {
        await transactionService.removeSparepartLine(target.itemId, tx.id);
      }
      await reloadTx();
      await reloadList();
      showToast('Item dihapus', 'success');
    } catch (e: any) {
      showToast('Gagal hapus: ' + (e?.message ?? ''), 'error');
    }
  };

  const saveMechanicNotes = async () => {
    if (!tx) return;
    try {
      await transactionService.updateMeta(tx.id, { mechanic_notes: tempMechanicNotes });
      await reloadTx();
      setEditMechanicNotes(false);
      showToast('Catatan disimpan', 'success');
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message ?? ''), 'error');
    }
  };

  const saveRecommendation = async () => {
    if (!tx) return;
    try {
      await transactionService.updateMeta(tx.id, { recommendation: tempRecommendation });
      await reloadTx();
      setEditRecommendation(false);
      showToast('Rekomendasi disimpan', 'success');
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message ?? ''), 'error');
    }
  };

  const startEditMechanicNotes = () => {
    setTempMechanicNotes(tx?.mechanic_notes ?? '');
    setEditMechanicNotes(true);
  };

  const startEditRecommendation = () => {
    setTempRecommendation(tx?.recommendation ?? '');
    setEditRecommendation(true);
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
          {tx.mechanic_name && tx.type !== 'retail' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Ionicons name="construct" size={14} color={theme.colors.accent} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                Mekanik: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{tx.mechanic_name}</Text>
              </Text>
            </View>
          ) : null}
        </Card>

        {tx.complaint && tx.status !== 'pending' && tx.type !== 'retail' ? (
          <Card style={{ marginBottom: 12 }}>
            <Text style={sectionLabel}>KELUHAN PELANGGAN</Text>
            <Text style={{ color: theme.colors.text, marginTop: 4, lineHeight: 20 }}>
              {tx.complaint}
            </Text>
          </Card>
        ) : null}
        {tx.status === 'pending' && tx.type !== 'retail' && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={sectionLabel}>KELUHAN PELANGGAN</Text>
            <Input
              value={tx.complaint ?? ''}
              onChangeText={async (v) => {
                if (!tx) return;
                try {
                  await transactionService.updateMeta(tx.id, { complaint: v });
                  setTx((p) => (p ? { ...p, complaint: v } : p));
                } catch {}
              }}
              placeholder="Masukkan keluhan pelanggan..."
              multiline
              numberOfLines={3}
              style={{ minHeight: 70, textAlignVertical: 'top' }}
            />
          </Card>
        )}

        {/* Services */}
        {tx.type !== 'retail' && (tx.status === 'pending' ||
          (tx.service_items && tx.service_items.length > 0)) && (
          <Card style={{ marginBottom: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <Text style={sectionLabel}>JASA SERVIS</Text>
              {tx.status === 'pending' ? (
                <Pressable
                  onPress={() => setAddServiceOpen(true)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.colors.accent + '20',
                    opacity: pressed ? 0.7 : 1,
                  })}
                  hitSlop={6}
                >
                  <Ionicons name="add" size={14} color={theme.colors.accent} />
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    Tambah
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {tx.service_items && tx.service_items.length > 0 ? (
              tx.service_items.map((s, i) => (
                <View
                  key={s.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingBottom: i === tx.service_items!.length - 1 ? 0 : 12,
                    borderBottomWidth: i === tx.service_items!.length - 1 ? 0 : 1,
                    borderBottomColor: theme.colors.divider,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: theme.colors.accent + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="build" size={16} color={theme.colors.accent} />
                  </View>
                  <Text
                    style={{ color: theme.colors.text, flex: 1, fontSize: 14, fontWeight: '500' }}
                    numberOfLines={2}
                  >
                    {s.service_name}
                  </Text>
                  <Text
                    style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 15 }}
                  >
                    {formatCurrency(s.price)}
                  </Text>
                  {tx.status === 'pending' ? (
                    <Pressable
                      onPress={() =>
                        setConfirmRemoveItem({
                          kind: 'service',
                          itemId: s.id,
                          name: s.service_name,
                        })
                      }
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 36,
                        height: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        backgroundColor: pressed
                          ? theme.colors.danger + '20'
                          : 'transparent',
                      })}
                    >
                      <Ionicons
                        name="trash"
                        size={16}
                        color={theme.colors.danger}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ))
            ) : (
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 12,
                  textAlign: 'center',
                  paddingVertical: 12,
                }}
              >
                Belum ada jasa
              </Text>
            )}
            {tx.service_items && tx.service_items.length > 0 ? (
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
            ) : null}
          </Card>
        )}

        {/* Spareparts */}
        {(tx.status === 'pending' ||
          (tx.spareparts && tx.spareparts.length > 0)) && (
          <Card style={{ marginBottom: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <Text style={sectionLabel}>SPAREPART</Text>
              {tx.status === 'pending' ? (
                <Pressable
                  onPress={() => setAddSparepartOpen(true)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.colors.accent + '20',
                    opacity: pressed ? 0.7 : 1,
                  })}
                  hitSlop={6}
                >
                  <Ionicons name="add" size={14} color={theme.colors.accent} />
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    Tambah
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {tx.spareparts && tx.spareparts.length > 0 ? (
              tx.spareparts.map((p, i) => (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingBottom: i === tx.spareparts!.length - 1 ? 0 : 12,
                    borderBottomWidth: i === tx.spareparts!.length - 1 ? 0 : 1,
                    borderBottomColor: theme.colors.divider,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: theme.colors.warning + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="cube" size={16} color={theme.colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={2}>
                      {p.sparepart_name}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {formatCurrency(p.sell_price)} × {p.quantity}
                    </Text>
                  </View>
                  <Text
                    style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 15 }}
                  >
                    {formatCurrency(p.sell_price * p.quantity)}
                  </Text>
                  {tx.status === 'pending' ? (
                    <Pressable
                      onPress={() =>
                        setConfirmRemoveItem({
                          kind: 'sparepart',
                          itemId: p.id,
                          name: p.sparepart_name ?? '-',
                        })
                      }
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 36,
                        height: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        backgroundColor: pressed
                          ? theme.colors.danger + '20'
                          : 'transparent',
                      })}
                    >
                      <Ionicons
                        name="trash"
                        size={16}
                        color={theme.colors.danger}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ))
            ) : (
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 12,
                  textAlign: 'center',
                  paddingVertical: 12,
                }}
              >
                Belum ada sparepart
              </Text>
            )}
            {tx.spareparts && tx.spareparts.length > 0 ? (
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
            ) : null}
          </Card>
        )}

        {tx.type !== 'retail' && (
          <>
            {tx.recommendation ? (
              editRecommendation ? (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={sectionLabel}>REKOMENDASI SERVIS BERIKUTNYA</Text>
                    <Pressable onPress={() => setEditRecommendation(false)} hitSlop={8}>
                      <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                    </Pressable>
                  </View>
                  <Input
                    value={tempRecommendation}
                    onChangeText={setTempRecommendation}
                    placeholder="Rekomendasi servis berikutnya..."
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Button
                      title="Simpan"
                      size="sm"
                      onPress={saveRecommendation}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Batal"
                      variant="ghost"
                      size="sm"
                      onPress={() => setEditRecommendation(false)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              ) : (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={sectionLabel}>REKOMENDASI SERVIS BERIKUTNYA</Text>
                    <Pressable onPress={startEditRecommendation} hitSlop={8}>
                      <Ionicons name="create" size={16} color={theme.colors.accent} />
                    </Pressable>
                  </View>
                  <Text style={{ color: theme.colors.text, marginTop: 4, lineHeight: 20 }}>
                    {tx.recommendation}
                  </Text>
                </Card>
              )
            ) : (
              tx.status === 'pending' && (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={sectionLabel}>REKOMENDASI SERVIS BERIKUTNYA</Text>
                  </View>
                  <Input
                    value={tempRecommendation}
                    onChangeText={setTempRecommendation}
                    placeholder="Tambahkan rekomendasi..."
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <Button
                    title="Simpan Rekomendasi"
                    size="sm"
                    onPress={saveRecommendation}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              )
            )}

            {tx.mechanic_notes ? (
              editMechanicNotes ? (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={sectionLabel}>CATATAN INTERNAL MEKANIK</Text>
                    <Pressable onPress={() => setEditMechanicNotes(false)} hitSlop={8}>
                      <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                    </Pressable>
                  </View>
                  <Input
                    value={tempMechanicNotes}
                    onChangeText={setTempMechanicNotes}
                    placeholder="Catatan internal mekanik..."
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Button
                      title="Simpan"
                      size="sm"
                      onPress={saveMechanicNotes}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Batal"
                      variant="ghost"
                      size="sm"
                      onPress={() => setEditMechanicNotes(false)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              ) : (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={sectionLabel}>CATATAN INTERNAL MEKANIK</Text>
                    <Pressable onPress={startEditMechanicNotes} hitSlop={8}>
                      <Ionicons name="create" size={16} color={theme.colors.accent} />
                    </Pressable>
                  </View>
                  <Text style={{ color: theme.colors.text, marginTop: 4 }}>{tx.mechanic_notes}</Text>
                </Card>
              )
            ) : (
              tx.status === 'pending' && (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={sectionLabel}>CATATAN INTERNAL MEKANIK</Text>
                  </View>
                  <Input
                    value={tempMechanicNotes}
                    onChangeText={setTempMechanicNotes}
                    placeholder="Tambahkan catatan..."
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <Button
                    title="Simpan Catatan"
                    size="sm"
                    onPress={saveMechanicNotes}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              )
            )}
          </>
        )}

        {/* Retail: Bayar & Kembalian (only for Tunai) */}
        {tx.type === 'retail' && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={sectionLabel}>RINCIAN PEMBAYARAN</Text>
            <View style={{ marginTop: 6, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.text, fontSize: 14 }}>Total</Text>
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                  {formatCurrency(tx.total_amount)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.text, fontSize: 14 }}>Metode</Text>
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                  {tx.payment_method ?? '-'}
                </Text>
              </View>
              {tx.payment_method === 'Tunai' && (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14 }}>Bayar</Text>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                      {formatCurrency(tx.paid_amount)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14 }}>Kembalian</Text>
                    <Text style={{ color: theme.colors.success, fontSize: 14, fontWeight: '700' }}>
                      {formatCurrency(tx.change_amount)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </Card>
        )}

        {/* Receipt actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 8 }}>
          <Button
            title="Kirim WA"
            variant="success"
            size="lg"
            onPress={openWaTemplate}
            disabled={!tx.customer_phone}
            icon={<Ionicons name="logo-whatsapp" size={18} color="#fff" />}
            style={{ flex: 1 }}
          />
          <Button
            title="Cetak PDF"
            variant="secondary"
            size="lg"
            onPress={() => router.push(`/receipt?id=${tx.id}` as any)}
            icon={<Ionicons name="print" size={18} color="#fff" />}
            style={{ flex: 1 }}
          />
        </View>

        {/* Actions */}
        <View style={{ gap: 10, marginTop: 8 }}>
          {tx.status === 'pending' && tx.type !== 'retail' && (
            <Button
              title="Tandai Lunas"
              onPress={() => setPaymentPickerOpen(true)}
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

      <ConfirmDialog
        visible={!!confirmRemoveItem}
        title="Hapus Item?"
        message={`Hapus \"${confirmRemoveItem?.name}\" dari transaksi ini?${confirmRemoveItem?.kind === 'sparepart' ? ' Stok akan dikembalikan.' : ''}`}
        confirmText="Hapus"
        destructive
        onConfirm={performRemoveItem}
        onCancel={() => setConfirmRemoveItem(null)}
      />

      <AddServiceSheet
        visible={addServiceOpen}
        onClose={() => setAddServiceOpen(false)}
        onAdd={(svc) => {
          handleAddService(svc);
          setAddServiceOpen(false);
        }}
      />

      <AddSparepartSheet
        visible={addSparepartOpen}
        onClose={() => setAddSparepartOpen(false)}
        onPick={(sp, qty) => handleAddSparepart(sp, qty)}
      />

      <WhatsAppTemplateModal
        visible={waModalOpen}
        tx={tx}
        onClose={() => setWaModalOpen(false)}
        onError={(msg) => showToast(msg, 'error')}
      />

      {/* Payment Method Picker */}
      <Modal
        visible={paymentPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentPickerOpen(false)}
      >
        <Pressable
          onPress={() => setPaymentPickerOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingTop: 8,
              paddingBottom: 28,
              maxHeight: '60%',
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.borderLight,
                alignSelf: 'center',
                marginBottom: 12,
              }}
            />
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
                Pilih Metode Pembayaran
              </Text>
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Pilih cara pembayaran untuk transaksi ini
              </Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {[
                { key: 'Tunai', icon: 'cash-outline' as const, color: theme.colors.success },
                { key: 'Transfer', icon: 'swap-horizontal' as const, color: theme.colors.info },
                { key: 'QRIS', icon: 'qr-code' as const, color: theme.colors.accent },
                { key: 'Debit', icon: 'card' as const, color: theme.colors.primary },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    markPaid(opt.key);
                    setPaymentPickerOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 14,
                    marginBottom: 10,
                    borderRadius: theme.radius.lg,
                    backgroundColor: theme.colors.card,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: opt.color + '18',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={opt.icon} size={20} color={opt.color} />
                  </View>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: 15,
                      fontWeight: '600',
                      flex: 1,
                    }}
                  >
                    {opt.key}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
              <Button
                title="Batal"
                variant="ghost"
                fullWidth
                onPress={() => setPaymentPickerOpen(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const sectionLabel = {
  color: theme.colors.textSecondary,
  fontSize: 11,
  fontWeight: '700' as const,
  letterSpacing: 0.5,
};
