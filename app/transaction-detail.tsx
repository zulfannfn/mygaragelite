import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InterstitialAd, RewardAd } from '../src/components/ui/AdBanner';
import { AddServiceSheet } from '../src/components/ui/AddServiceSheet';
import { AddSparepartSheet } from '../src/components/ui/AddSparepartSheet';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { WhatsAppTemplateModal } from '../src/components/ui/WhatsAppTemplateModal';
import { useTheme } from '../src/contexts/ThemeContext';
import { receiptService } from '../src/services/receiptService';
import { transactionService } from '../src/services/transactionService';
import { useTranslation } from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { useTransactionStore } from '../src/store/useTransactionStore';
import { Transaction } from '../src/types';
import { formatCurrency, parseCurrency } from '../src/utils/currency';
import { formatDateTime } from '../src/utils/date';
import { handleReceiptPrintError } from '../src/utils/printerAlert';

export default function TransactionDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const { theme } = useTheme();
  const t = useTranslation();
  const { updateStatus, remove, load: reloadList } = useTransactionStore();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [actionBusy, setActionBusy] = useState<'print' | 'wa' | null>(null);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addSparepartOpen, setAddSparepartOpen] = useState(false);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<
    { kind: 'service' | 'sparepart'; itemId: string; name: string } | null
  >(null);
  const [editMechanicNotes, setEditMechanicNotes] = useState(false);
  const [editRecommendation, setEditRecommendation] = useState(false);
  const [editComplaint, setEditComplaint] = useState(false);
  const [tempMechanicNotes, setTempMechanicNotes] = useState('');
  const [tempRecommendation, setTempRecommendation] = useState('');
  const [tempComplaint, setTempComplaint] = useState('');
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [confirmPaidModal, setConfirmPaidModal] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [receiptPickerOpen, setReceiptPickerOpen] = useState(false);
  const [selectedReceiptType, setSelectedReceiptType] = useState<'diterima' | 'tagihan'>('tagihan');

  const sectionLabel = {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  };

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
    setSelectedPaymentMethod(method);
    setPaidAmount('');
    setConfirmPaidModal(true);
  };

  const confirmMarkPaid = async () => {
    if (!id || !selectedPaymentMethod || !tx) return;
    setConfirmPaidModal(false);

    let paid = 0;
    let change = 0;

    if (selectedPaymentMethod === 'Tunai') {
      paid = parseCurrency(paidAmount);
      change = Math.max(0, paid - tx.total_amount);
    } else {
      paid = tx.total_amount;
    }

    await updateStatus(id, 'paid', selectedPaymentMethod as any, paid, change);
    setTx((p) => (p ? { ...p, status: 'paid', payment_method: selectedPaymentMethod as any, paid_amount: paid, change_amount: change } : p));
    setSelectedPaymentMethod(null);
    setPaidAmount('');
    showToast(t.common.success, 'success');
    await InterstitialAd.show();
  };

  const cancel = async () => {
    setConfirmCancel(true);
  };

  const handleConfirmCancel = async () => {
    setConfirmCancel(false);
    if (!id) return;
    await updateStatus(id, 'cancelled', null);
    setTx((p) => (p ? { ...p, status: 'cancelled' } : p));
    showToast(t.common.cancelled, 'info');
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (!id) return;
    await remove(id);
    showToast(t.transactions.deletedSuccess, 'success');
    RewardAd.show();
    router.back();
  };

  const handlePrint = async () => {
    if (!tx) return;
    setActionBusy('print');
    try {
      const method = await receiptService.printPdf(tx);
      if (method === 'bluetooth') {
        showToast(t.transactions.receiptSent, 'success');
      }
      await InterstitialAd.show();
    } catch (e: unknown) {
      handleReceiptPrintError(e, router, showToast);
    } finally {
      setActionBusy(null);
    }
  };

  const openWaTemplate = () => {
    if (!tx) return;
    if (!tx.customer_phone) {
      showToast(t.transactions.noPhoneError, 'error');
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
      showToast(t.transactions.addedService, 'success');
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
      showToast(t.transactions.addedSparepart, 'success');
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
      showToast(t.transactions.itemDeleted, 'success');
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
      showToast(t.transactions.notesSaved, 'success');
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
      showToast(t.transactions.recommendationSaved, 'success');
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message ?? ''), 'error');
    }
  };

  const saveComplaint = async () => {
    if (!tx) return;
    try {
      await transactionService.updateMeta(tx.id, { complaint: tempComplaint });
      await reloadTx();
      setEditComplaint(false);
      showToast(t.transactions.complaintSaved, 'success');
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

  const startEditComplaint = () => {
    setTempComplaint(tx?.complaint ?? '');
    setEditComplaint(true);
  };

  if (!tx) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScreenHeader title={t.transactions.detailTitle} showBack />
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }}>
          {t.common.loading}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={t.transactions.detailTitle} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + (Platform.OS === 'android' ? 48 : 34) }}>
        {/* Header card */}
        <Card style={{ marginBottom: 12, backgroundColor: theme.colors.primary }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>TOTAL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Badge
                label={tx.type === 'retail' ? t.transactions.cashier : t.dashboard.service}
                variant={tx.type === 'retail' ? 'info' : 'accent'}
              />
              <Badge
                label={tx.status === 'paid' ? t.common.paid : tx.status === 'pending' ? t.common.pending : t.common.cancelled}
                variant={tx.status === 'paid' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'}
              />
            </View>
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
          <Text style={sectionLabel}>{t.transactions.sectionCustomer}</Text>
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
                {t.transactions.mechanic}: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{tx.mechanic_name}</Text>
              </Text>
            </View>
          ) : null}
          {tx.cashier_name ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Ionicons name="person" size={14} color={theme.colors.success} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                {t.transactions.cashier}: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{tx.cashier_name}</Text>
              </Text>
            </View>
          ) : null}
        </Card>

        {tx.type !== 'retail' && (
          <>
            {tx.complaint ? (
              editComplaint ? (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={sectionLabel}>{t.transactions.sectionComplaint}</Text>
                    <Pressable onPress={() => setEditComplaint(false)} hitSlop={8}>
                      <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                    </Pressable>
                  </View>
                  <Input
                    value={tempComplaint}
                    onChangeText={setTempComplaint}
                    placeholder={t.transactions.complaint}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Button
                      title={t.common.save}
                      size="sm"
                      onPress={saveComplaint}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title={t.common.cancel}
                      variant="ghost"
                      size="sm"
                      onPress={() => setEditComplaint(false)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              ) : (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={sectionLabel}>{t.transactions.sectionComplaint}</Text>
                    {tx.status === 'pending' && (
                      <Pressable onPress={startEditComplaint} hitSlop={8}>
                        <Ionicons name="create" size={16} color={theme.colors.accent} />
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: theme.colors.text, marginTop: 4, lineHeight: 20 }}>
                    {tx.complaint}
                  </Text>
                </Card>
              )
            ) : (
              tx.status === 'pending' && (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={sectionLabel}>{t.transactions.sectionComplaint}</Text>
                  </View>
                  <Input
                    value={tempComplaint}
                    onChangeText={setTempComplaint}
                    placeholder={t.transactions.complaint}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <Button
                    title={t.common.save}
                    size="sm"
                    onPress={saveComplaint}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              )
            )}
          </>
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
              <Text style={sectionLabel}>{t.transactions.sectionServices}</Text>
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
                    {t.common.add}
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
                {t.transactions.noServices}
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
                <Text style={{ color: theme.colors.textSecondary }}>{t.transactions.total}</Text>
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
                    {t.common.add}
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
                {t.transactions.noSpareparts}
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
                <Text style={{ color: theme.colors.textSecondary }}>{t.transactions.total}</Text>
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
                    <Text style={sectionLabel}>{t.transactions.sectionRecommendation}</Text>
                    <Pressable onPress={() => setEditRecommendation(false)} hitSlop={8}>
                      <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                    </Pressable>
                  </View>
                  <Input
                    value={tempRecommendation}
                    onChangeText={setTempRecommendation}
                    placeholder={t.transactions.sectionRecommendation}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Button
                      title={t.common.save}
                      size="sm"
                      onPress={saveRecommendation}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title={t.common.cancel}
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
                    <Text style={sectionLabel}>{t.transactions.sectionRecommendation}</Text>
                    {tx.status !== 'paid' && (
                      <Pressable onPress={startEditRecommendation} hitSlop={8}>
                        <Ionicons name="create" size={16} color={theme.colors.accent} />
                      </Pressable>
                    )}
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
                    <Text style={sectionLabel}>{t.transactions.sectionRecommendation}</Text>
                  </View>
                  <Input
                    value={tempRecommendation}
                    onChangeText={setTempRecommendation}
                    placeholder={t.transactions.sectionRecommendation}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <Button
                    title={t.common.save}
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
                    <Text style={sectionLabel}>{t.transactions.sectionMechanicNotes}</Text>
                    <Pressable onPress={() => setEditMechanicNotes(false)} hitSlop={8}>
                      <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                    </Pressable>
                  </View>
                  <Input
                    value={tempMechanicNotes}
                    onChangeText={setTempMechanicNotes}
                    placeholder={t.transactions.sectionMechanicNotes}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Button
                      title={t.common.save}
                      size="sm"
                      onPress={saveMechanicNotes}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title={t.common.cancel}
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
                    <Text style={sectionLabel}>{t.transactions.sectionMechanicNotes}</Text>
                    {tx.status !== 'paid' && (
                      <Pressable onPress={startEditMechanicNotes} hitSlop={8}>
                        <Ionicons name="create" size={16} color={theme.colors.accent} />
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: theme.colors.text, marginTop: 4 }}>{tx.mechanic_notes}</Text>
                </Card>
              )
            ) : (
              tx.status === 'pending' && (
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={sectionLabel}>{t.transactions.sectionMechanicNotes}</Text>
                  </View>
                  <Input
                    value={tempMechanicNotes}
                    onChangeText={setTempMechanicNotes}
                    placeholder={t.transactions.sectionMechanicNotes}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                  />
                  <Button
                    title={t.common.save}
                    size="sm"
                    onPress={saveMechanicNotes}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              )
            )}
          </>
        )}

        {/* Rincian pembayaran (tampil saat lunas — servis & kasir) */}
        {tx.status === 'paid' && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={sectionLabel}>{t.transactions.sectionPayment}</Text>
            <View style={{ marginTop: 6, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.text, fontSize: 14 }}>{t.transactions.total}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                  {formatCurrency(tx.total_amount)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.text, fontSize: 14 }}>{t.transactions.method}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                  {tx.payment_method ?? '-'}
                </Text>
              </View>
              {tx.payment_method === 'Tunai' && (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14 }}>{t.transactions.payAmount}</Text>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                      {formatCurrency(tx.paid_amount)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14 }}>{t.transactions.change}</Text>
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
            title={t.transactions.sendWA}
            variant="success"
            size="lg"
            onPress={openWaTemplate}
            disabled={!tx.customer_phone}
            icon={<Ionicons name="logo-whatsapp" size={18} color="#fff" />}
            style={{ flex: 1 }}
          />
          <Button
            title={t.common.print}
            variant="secondary"
            size="lg"
            onPress={() => setReceiptPickerOpen(true)}
            icon={<Ionicons name="print" size={18} color="#fff" />}
            style={{ flex: 1 }}
          />
        </View>

        {/* Actions */}
        <View style={{ gap: 10, marginTop: 8 }}>
          {tx.status === 'pending' && tx.type !== 'retail' && (
            <Button
              title={t.transactions.markPaid}
              onPress={() => {
                const isComplete =
                  tx.complaint?.trim() &&
                  tx.service_items && tx.service_items.length > 0 &&
                  tx.spareparts && tx.spareparts.length > 0 &&
                  tx.recommendation?.trim() &&
                  tx.mechanic_notes?.trim();

                if (!isComplete) {
                  Alert.alert(t.common.attention, t.transactions.completeFormFirst);
                  return;
                }
                setPaymentPickerOpen(true);
              }}
              size="lg"
              fullWidth
              style={{
                opacity: (tx.complaint?.trim() && tx.service_items?.length && tx.spareparts?.length && tx.recommendation?.trim() && tx.mechanic_notes?.trim()) ? 1 : 0.5
              }}
              icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
            />
          )}
          {tx.status !== 'cancelled' && (
            <Button
              title={t.common.delete}
              variant="outline-danger"
              onPress={() => setConfirmDelete(true)}
              fullWidth
            />
          )}
          {tx.status === 'cancelled' && (
            <Button
              title={t.transactions.deleteTransaction}
              variant="outline-danger"
              onPress={() => setConfirmDelete(true)}
              fullWidth
            />
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title={t.transactions.deleteTitle}
        message={t.transactions.deleteMessage}
        confirmText={t.common.delete}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        visible={confirmCancel}
        title={t.transactions.cancelTitle}
        message={t.transactions.cancelMessage}
        confirmText={t.common.cancel}
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        visible={!!confirmRemoveItem}
        title={t.transactions.deleteItemTitle}
        message={`${t.common.delete} "${confirmRemoveItem?.name}"?${confirmRemoveItem?.kind === 'sparepart' ? ` ${t.transactions.deleteMessage}` : ''}`}
        confirmText={t.common.delete}
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

      {/* Receipt Type Picker Modal */}
      <Modal
        visible={receiptPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReceiptPickerOpen(false)}
      >
        <Pressable
          onPress={() => setReceiptPickerOpen(false)}
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
              paddingBottom: Math.max(24, insets.bottom + 16),
              maxHeight: '80%',
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
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 18,
                  fontWeight: '800',
                }}
              >
                {t.transactions.selectReceiptType}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 4, gap: 8 }}>
              {tx.status === 'pending' ? (
                <>
                  <Card
                    onPress={() => {
                      setSelectedReceiptType('diterima');
                      setReceiptPickerOpen(false);
                      router.push(`/receipt?id=${tx.id}&type=diterima` as any);
                    }}
                    style={{
                      borderColor: selectedReceiptType === 'diterima' ? theme.colors.accent + '40' : theme.colors.border,
                      borderWidth: selectedReceiptType === 'diterima' ? 1.5 : 1,
                    }}
                    padding="sm"
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          backgroundColor: theme.colors.accent + '18',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Ionicons name="receipt" size={18} color={theme.colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontSize: 15,
                            fontWeight: selectedReceiptType === 'diterima' ? '700' : '500',
                          }}
                        >
                          {t.transactions.receiptServiceReceived}
                        </Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                          {t.transactions.receiptServiceReceivedDesc}
                        </Text>
                      </View>
                    </View>
                  </Card>
                  <Card
                    onPress={() => {
                      setSelectedReceiptType('tagihan');
                      setReceiptPickerOpen(false);
                      router.push(`/receipt?id=${tx.id}&type=tagihan` as any);
                    }}
                    style={{
                      borderColor: selectedReceiptType === 'tagihan' ? theme.colors.accent + '40' : theme.colors.border,
                      borderWidth: selectedReceiptType === 'tagihan' ? 1.5 : 1,
                    }}
                    padding="sm"
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          backgroundColor: theme.colors.success + '18',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Ionicons name="cash" size={18} color={theme.colors.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontSize: 15,
                            fontWeight: selectedReceiptType === 'tagihan' ? '700' : '500',
                          }}
                        >
                          {t.transactions.receiptInvoice}
                        </Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                          {t.transactions.receiptInvoiceDesc}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </>
              ) : (
                <Card
                  onPress={() => {
                    setReceiptPickerOpen(false);
                    router.push(`/receipt?id=${tx.id}&type=tagihan` as any);
                  }}
                  padding="sm"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: theme.colors.success + '18',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontSize: 15,
                          fontWeight: '700',
                        }}
                      >
                        {t.transactions.receiptPaid}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        {t.transactions.receiptPaidDesc}
                      </Text>
                    </View>
                  </View>
                </Card>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
              paddingBottom: Math.max(28, insets.bottom + 16),
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
                {t.transactions.selectPaymentMethod}
              </Text>
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                {t.transactions.selectPaymentMethodDesc}
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
                title={t.common.cancel}
                variant="ghost"
                fullWidth
                onPress={() => setPaymentPickerOpen(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm Mark Paid Modal */}
      <Modal
        visible={confirmPaidModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmPaidModal(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.7)',
              justifyContent: 'center',
              padding: 24,
            }}
            onPress={() => setConfirmPaidModal(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: theme.radius.xl,
                padding: 20,
                borderWidth: 1,
                borderColor: theme.colors.border,
                maxHeight: '85%',
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: 12,
                  textAlign: 'center',
                }}
              >
                {t.transactions.sectionPayment}
              </Text>

              <ScrollView
                style={{ maxHeight: 320 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    fontWeight: '600',
                    marginBottom: 6,
                  }}
                >
                  {t.transactions.paymentDetails}
                </Text>
                <View style={{ gap: 0, marginBottom: 12 }}>
                  {tx.service_items?.map((s, i) => (
                    <View
                      key={s.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: i === tx.service_items!.length - 1 ? 0 : 1,
                        borderBottomColor: theme.colors.divider,
                      }}
                    >
                      <Text
                        style={{ color: theme.colors.text, fontSize: 13, fontWeight: '500', flex: 1 }}
                        numberOfLines={1}
                      >
                        {s.service_name}
                      </Text>
                      <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>
                        {formatCurrency(s.price)}
                      </Text>
                    </View>
                  ))}
                  {tx.spareparts?.map((p, i) => (
                    <View
                      key={p.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: i === tx.spareparts!.length - 1 ? 0 : 1,
                        borderBottomColor: theme.colors.divider,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: theme.colors.text, fontSize: 13, fontWeight: '500' }}
                          numberOfLines={1}
                        >
                          {p.sparepart_name}
                        </Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                          {formatCurrency(p.sell_price)} × {p.quantity}
                        </Text>
                      </View>
                      <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>
                        {formatCurrency(p.sell_price * p.quantity)}
                      </Text>
                    </View>
                  ))}
                </View>

                <View
                  style={{
                    backgroundColor: theme.colors.cardLight,
                    borderRadius: theme.radius.lg,
                    padding: 14,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t.transactions.total}</Text>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                      {formatCurrency(tx.total_amount)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t.transactions.method}</Text>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                      {selectedPaymentMethod}
                    </Text>
                  </View>

                  {selectedPaymentMethod === 'Tunai' && (
                    <>
                      <View style={{ marginTop: 8 }}>
                        <Text
                          style={{
                            color: theme.colors.textSecondary,
                            fontSize: 13,
                            marginBottom: 4,
                          }}
                        >
                          {t.transactions.payAmount}
                        </Text>
                        <Input
                          value={paidAmount}
                          onChangeText={setPaidAmount}
                          placeholder={t.transactions.payPlaceholder}
                          keyboardType="numeric"
                        />
                      </View>

                      {paidAmount ? (
                        <View
                          style={{
                            marginTop: 8,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                          }}
                        >
                          {parseCurrency(paidAmount) < tx.total_amount ? (
                            <>
                              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                                {t.transactions.shortfall}
                              </Text>
                              <Text
                                style={{ color: theme.colors.danger, fontSize: 14, fontWeight: '700' }}
                              >
                                {formatCurrency(tx.total_amount - parseCurrency(paidAmount))}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                                {t.transactions.change}
                              </Text>
                              <Text
                                style={{ color: theme.colors.success, fontSize: 14, fontWeight: '700' }}
                              >
                                {formatCurrency(parseCurrency(paidAmount) - tx.total_amount)}
                              </Text>
                            </>
                          )}
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Button
                  title={t.common.cancel}
                  variant="secondary"
                  fullWidth
                  onPress={() => setConfirmPaidModal(false)}
                />
                <Button
                  title={t.common.continue_}
                  fullWidth
                  onPress={confirmMarkPaid}
                  disabled={
                    selectedPaymentMethod === 'Tunai' &&
                    (!paidAmount || parseCurrency(paidAmount) < tx.total_amount)
                  }
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
