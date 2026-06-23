import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Speech from 'expo-speech';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdBanner, InterstitialAd, RewardAd } from '../src/components/ui/AdBanner';
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
import { employeeService } from '../src/services/employeeService';
import { transactionService } from '../src/services/transactionService';
import { useTranslation } from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { useTransactionStore } from '../src/store/useTransactionStore';
import { Employee, Transaction } from '../src/types';
import { formatCurrency, parseCurrency } from '../src/utils/currency';
import { formatDate, formatDateTime, formatDuration } from '../src/utils/date';
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
  const [confirmStartWork, setConfirmStartWork] = useState(false);
  const [confirmFinishWork, setConfirmFinishWork] = useState(false);
  const [actionBusy, setActionBusy] = useState<'print' | 'wa' | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addSparepartOpen, setAddSparepartOpen] = useState(false);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<
    { kind: 'service' | 'sparepart'; itemId: string; name: string } | null
  >(null);
  const [editMechanicNotes, setEditMechanicNotes] = useState(false);
  const [editRecommendation, setEditRecommendation] = useState(false);
  const [editComplaint, setEditComplaint] = useState(false);
  const [editKilometer, setEditKilometer] = useState(false);
  const [editCustomDiscount, setEditCustomDiscount] = useState(false);
  const [tempCustomDiscount, setTempCustomDiscount] = useState('');
  const [tempMechanicNotes, setTempMechanicNotes] = useState('');
  const [tempRecommendation, setTempRecommendation] = useState('');
  const [tempNextServiceDate, setTempNextServiceDate] = useState<number | null>(null);
  const [showNextServiceDatePicker, setShowNextServiceDatePicker] = useState(false);
  const [tempComplaint, setTempComplaint] = useState('');
  const [tempKilometer, setTempKilometer] = useState('');
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [confirmPaidModal, setConfirmPaidModal] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [receiptPickerOpen, setReceiptPickerOpen] = useState(false);
  const [selectedReceiptType, setSelectedReceiptType] = useState<'diterima' | 'tagihan'>('tagihan');
  const [nowTick, setNowTick] = useState(Date.now());
  const [editStaffOpen, setEditStaffOpen] = useState(false);
  const [mechanics, setMechanics] = useState<Employee[]>([]);
  const [cashiers, setCashiers] = useState<Employee[]>([]);
  const [tempMechanicId, setTempMechanicId] = useState<string | null>(null);
  const [tempMechanicName, setTempMechanicName] = useState<string | null>(null);
  const [tempCashierId, setTempCashierId] = useState<string | null>(null);
  const [tempCashierName, setTempCashierName] = useState<string | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);

  // Durasi pengerjaan terus berjalan selama service sedang dikerjakan
  const isRunningService = tx?.type === 'service' && tx?.status === 'in_progress';
  useEffect(() => {
    if (!isRunningService) return;
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [isRunningService]);

  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  useEffect(() => {
    if (!confirmPaidModal) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setConfirmPaidModal(false);
      return true;
    });
    return () => sub.remove();
  }, [confirmPaidModal]);

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

  const markInProgress = async () => {
    if (!id) return;
    await updateStatus(id, 'in_progress', null);
    setTx((p) => (p ? { ...p, status: 'in_progress' } : p));
    showToast(t.common.success, 'success');
  };

  const markWaitingPayment = async () => {
    if (!id) return;
    await updateStatus(id, 'waiting_payment', null);
    setTx((p) => (p ? { ...p, status: 'waiting_payment' } : p));
    showToast(t.common.success, 'success');
  };

  const announcePayment = () => {
    if (!tx) return;
    const name = tx.customer_name ?? 'pelanggan';
    const plate = tx.customer_plate ?? '-';
    const text = `Perhatian, atas nama ${name} dengan nomor polisi ${plate} sudah selesai pengerjaan, silahkan ke kasir untuk melakukan pembayaran`;
    setSpeaking(true);
    Speech.speak(text, {
      language: 'id-ID',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const openEditStaff = async () => {
    const [mechs, cash] = await Promise.all([
      employeeService.getMechanics(),
      employeeService.getCashiers(),
    ]);
    setMechanics(mechs);
    setCashiers(cash);
    setTempMechanicId(tx?.mechanic_id ?? null);
    setTempMechanicName(tx?.mechanic_name ?? null);
    setTempCashierId(tx?.cashier_id ?? null);
    setTempCashierName(tx?.cashier_name ?? null);
    setEditStaffOpen(true);
  };

  const saveStaff = async () => {
    if (!tx) return;
    setSavingStaff(true);
    try {
      await transactionService.updateMeta(tx.id, {
        mechanic_id: tempMechanicId,
        cashier_id: tempCashierId,
        cashier_name: tempCashierName ?? '',
      });
      await reloadTx();
      await reloadList();
      setEditStaffOpen(false);
      showToast(t.common.success, 'success');
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message ?? ''), 'error');
    } finally {
      setSavingStaff(false);
    }
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
    qty: number,
    discount: number = 0
  ) => {
    if (!tx) return;
    try {
      await transactionService.addSparepartLine(tx.id, {
        sparepart_id: sp.id,
        sparepart_name: sp.name,
        quantity: qty,
        sell_price: sp.sell_price,
        discount_per_item: discount,
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
      await transactionService.updateMeta(tx.id, {
        recommendation: tempRecommendation,
        next_service_date: tempNextServiceDate,
      });
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

  const saveKilometer = async () => {
    if (!tx) return;
    const km = parseInt(tempKilometer.replace(/\D/g, ''), 10);
    try {
      await transactionService.updateMeta(tx.id, { kilometer: isNaN(km) ? null : km });
      await reloadTx();
      setEditKilometer(false);
      showToast(t.transactions.kilometerSaved, 'success');
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message ?? ''), 'error');
    }
  };

  const saveCustomDiscount = async () => {
    if (!tx) return;
    const raw = parseInt(tempCustomDiscount.replace(/[^0-9]/g, ''), 10);
    const availableMargin = (tx.spareparts ?? []).reduce(
      (s, p) => s + (p.sell_price - (p.buy_price ?? 0) - (p.discount_per_item ?? 0)) * p.quantity,
      0
    );
    const val = isNaN(raw) ? 0 : Math.min(raw, Math.max(0, availableMargin));
    try {
      await transactionService.updateMeta(tx.id, { custom_discount: val });
      await reloadTx();
      setEditCustomDiscount(false);
      showToast('Diskon custom disimpan', 'success');
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
    setTempNextServiceDate(tx?.next_service_date ?? null);
    setEditRecommendation(true);
  };

  const renderNextServiceDateField = () => (
    <>
      <Pressable
        onPress={() => setShowNextServiceDatePicker(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
          padding: 10,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.cardLight,
        }}
      >
        <Ionicons name="calendar-outline" size={16} color={theme.colors.accent} />
        <Text style={{ color: tempNextServiceDate ? theme.colors.text : theme.colors.textMuted, fontSize: 13 }}>
          {tempNextServiceDate ? formatDate(tempNextServiceDate) : t.transactions.nextServiceDatePlaceholder}
        </Text>
      </Pressable>
      {showNextServiceDatePicker && Platform.OS === 'ios' ? (
        <View style={{ marginTop: 4 }}>
          <DateTimePicker
            value={new Date(tempNextServiceDate ?? Date.now())}
            mode="date"
            display="spinner"
            onChange={(_, date) => {
              if (date) {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                setTempNextServiceDate(d.getTime());
              }
            }}
            style={{ height: 130 }}
          />
          <Pressable onPress={() => setShowNextServiceDatePicker(false)} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 14 }}>{t.common.done}</Text>
          </Pressable>
        </View>
      ) : null}
      {showNextServiceDatePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={new Date(tempNextServiceDate ?? Date.now())}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowNextServiceDatePicker(false);
            if (event.type === 'set' && date) {
              const d = new Date(date);
              d.setHours(0, 0, 0, 0);
              setTempNextServiceDate(d.getTime());
            }
          }}
        />
      ) : null}
    </>
  );

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
                label={
                  tx.status === 'paid'
                    ? t.common.paid
                    : tx.status === 'in_progress'
                      ? t.common.inProgress
                      : tx.status === 'waiting_payment'
                        ? t.common.waitingPayment
                        : tx.status === 'pending'
                          ? t.common.pending
                          : t.common.cancelled
                }
                variant={
                  tx.status === 'paid'
                    ? 'success'
                    : tx.status === 'in_progress'
                      ? 'info'
                      : tx.status === 'waiting_payment'
                        ? 'accent'
                        : tx.status === 'pending'
                          ? 'warning'
                          : 'danger'
                }
              />
            </View>
          </View>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>
            {formatCurrency(tx.total_amount)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 }}>
            {tx.type === 'service' ? formatDateTime(tx.created_at) : formatDate(tx.created_at)}
            {tx.payment_method ? ` • ${tx.payment_method}` : ''}
          </Text>
          {tx.type === 'service' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <Ionicons
                name={isRunningService ? 'time' : 'timer-outline'}
                size={13}
                color="#fff"
              />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                {isRunningService ? t.transactions.workDurationRunning : t.transactions.workDuration}: {formatDuration(tx.created_at, tx.status === 'paid' ? tx.updated_at : nowTick)}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Customer */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={sectionLabel}>{t.transactions.sectionCustomer}</Text>
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 }}>
            {tx.customer_name ?? '-'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Ionicons name="card-outline" size={14} color={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
              {tx.customer_plate ?? '-'}
            </Text>
          </View>
          {tx.customer_phone ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Ionicons name="call-outline" size={14} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                {tx.customer_phone}
              </Text>
            </View>
          ) : null}
          {(tx.customer_vehicle_brand || tx.customer_vehicle_type) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Ionicons
                name={tx.customer_vehicle_type === 'Mobil' ? 'car-outline' : 'bicycle-outline'}
                size={14}
                color={theme.colors.textMuted}
              />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                {[tx.customer_vehicle_type, tx.customer_vehicle_brand].filter(Boolean).join(' • ')}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Petugas: Mekanik & Kasir */}
        {((tx.mechanic_name && tx.type !== 'retail') || tx.cashier_name) ? (
          <Card style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={sectionLabel}>{t.transactions.sectionStaff}</Text>
              {tx.status === 'pending' && (
                <Pressable onPress={openEditStaff} hitSlop={8}>
                  <Ionicons name="create" size={16} color={theme.colors.accent} />
                </Pressable>
              )}
            </View>
            {tx.mechanic_name && tx.type !== 'retail' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: theme.colors.accent + '1F',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="construct" size={16} color={theme.colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                    {t.transactions.mechanic}
                  </Text>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                    {tx.mechanic_name}
                  </Text>
                </View>
              </View>
            ) : null}
            {tx.cashier_name ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: theme.colors.success + '1F',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="person" size={16} color={theme.colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                    {t.transactions.cashier}
                  </Text>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                    {tx.cashier_name}
                  </Text>
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

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
                    {(tx.status === 'pending' || tx.status === 'in_progress') && (
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
              (tx.status === 'pending' || tx.status === 'in_progress') && (
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

        {tx.type === 'service' && (tx.status === 'in_progress' || tx.status === 'waiting_payment' || tx.status === 'paid') && (
          tx.kilometer != null ? (
            editKilometer ? (
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={sectionLabel}>{t.transactions.sectionKilometer}</Text>
                  <Pressable onPress={() => setEditKilometer(false)} hitSlop={8}>
                    <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                  </Pressable>
                </View>
                <Input
                  value={tempKilometer}
                  onChangeText={setTempKilometer}
                  placeholder={t.transactions.kilometerPlaceholder}
                  keyboardType="numeric"
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button title={t.common.save} size="sm" onPress={saveKilometer} style={{ flex: 1 }} />
                  <Button title={t.common.cancel} variant="ghost" size="sm" onPress={() => setEditKilometer(false)} style={{ flex: 1 }} />
                </View>
              </Card>
            ) : (
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={sectionLabel}>{t.transactions.sectionKilometer}</Text>
                  {tx.status !== 'paid' && (
                    <Pressable onPress={() => { setTempKilometer(String(tx.kilometer ?? '')); setEditKilometer(true); }} hitSlop={8}>
                      <Ionicons name="create" size={16} color={theme.colors.accent} />
                    </Pressable>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Ionicons name="speedometer-outline" size={16} color={theme.colors.textMuted} />
                  <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
                    {tx.kilometer?.toLocaleString()} km
                  </Text>
                </View>
              </Card>
            )
          ) : tx.status !== 'paid' ? (
            <Card style={{ marginBottom: 12 }}>
              <Text style={[sectionLabel, { marginBottom: 8 }]}>{t.transactions.sectionKilometer}</Text>
              <Input
                value={tempKilometer}
                onChangeText={setTempKilometer}
                placeholder={t.transactions.kilometerPlaceholder}
                keyboardType="numeric"
              />
              <Button title={t.common.save} size="sm" onPress={saveKilometer} style={{ marginTop: 8 }} />
            </Card>
          ) : null
        )}

        {/* Services */}
        {tx.type !== 'retail' && (tx.status === 'in_progress' || tx.status === 'waiting_payment' ||
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
              {tx.status === 'in_progress' ? (
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
                  {tx.status === 'in_progress' ? (
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
        {(tx.status === 'in_progress' || tx.status === 'waiting_payment' ||
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
              {tx.status === 'in_progress' ? (
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
                    {(p.buy_price ?? 0) > 0 && (
                      <Text style={{ color: theme.colors.warning, fontSize: 11, marginTop: 1 }}>
                        Beli: {formatCurrency(p.buy_price ?? 0)}
                      </Text>
                    )}
                    {(p.discount_per_item ?? 0) > 0 && (
                      <Text style={{ color: theme.colors.danger, fontSize: 11, marginTop: 1 }}>
                        Diskon -{formatCurrency(p.discount_per_item!)} /item = -{formatCurrency(p.discount_per_item! * p.quantity)}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {(p.discount_per_item ?? 0) > 0 && (
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11, textDecorationLine: 'line-through' }}>
                        {formatCurrency(p.sell_price * p.quantity)}
                      </Text>
                    )}
                    <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 15 }}>
                      {formatCurrency((p.sell_price - (p.discount_per_item ?? 0)) * p.quantity)}
                    </Text>
                  </View>
                  {tx.status === 'in_progress' ? (
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
              <>
                {/* Discount summary + custom discount + total */}
                <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.divider, marginTop: 8, paddingTop: 8, gap: 6 }}>
                  {(() => {
                    const totalItemDiscount = (tx.spareparts ?? []).reduce(
                      (s, p) => s + (p.discount_per_item ?? 0) * p.quantity, 0
                    );
                    if (totalItemDiscount <= 0) return null;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Total Diskon Item</Text>
                        <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                          -{formatCurrency(totalItemDiscount)}
                        </Text>
                      </View>
                    );
                  })()}
                  {(() => {
                    const availableMargin = (tx.spareparts ?? []).reduce(
                      (s, p) => s + (p.sell_price - (p.buy_price ?? 0) - (p.discount_per_item ?? 0)) * p.quantity, 0
                    );
                    const inputVal = parseInt(tempCustomDiscount.replace(/[^0-9]/g, ''), 10) || 0;
                    const remainingMargin = availableMargin - (editCustomDiscount ? inputVal : (tx.custom_discount ?? 0));
                    return (
                      <>
                        {editCustomDiscount ? (
                          <View style={{ gap: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Diskon Custom (Rp)</Text>
                                {availableMargin > 0 && (
                                  <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>
                                    maks. {formatCurrency(availableMargin)}
                                  </Text>
                                )}
                              </View>
                              <TextInput
                                value={tempCustomDiscount}
                                onChangeText={(v) => {
                                  const clean = v.replace(/[^0-9]/g, '');
                                  const n = parseInt(clean, 10) || 0;
                                  const capped = Math.min(n, Math.max(0, availableMargin));
                                  setTempCustomDiscount(capped === n ? clean : String(capped));
                                }}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={theme.colors.textMuted}
                                autoFocus
                                style={{
                                  color: theme.colors.text,
                                  fontSize: 13,
                                  borderWidth: 1,
                                  borderColor: theme.colors.danger,
                                  borderRadius: theme.radius.sm,
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  backgroundColor: theme.colors.surface,
                                  minWidth: 110,
                                  textAlign: 'right',
                                }}
                              />
                              <Pressable onPress={saveCustomDiscount} hitSlop={8}>
                                <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
                              </Pressable>
                              <Pressable onPress={() => setEditCustomDiscount(false)} hitSlop={8}>
                                <Ionicons name="close-circle" size={22} color={theme.colors.textMuted} />
                              </Pressable>
                            </View>
                            {availableMargin > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="trending-up" size={11} color={theme.colors.success} />
                                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Sisa margin</Text>
                                </View>
                                <Text style={{ color: theme.colors.success, fontSize: 12, fontWeight: '700' }}>
                                  {formatCurrency(Math.max(0, remainingMargin))}
                                </Text>
                              </View>
                            )}
                          </View>
                        ) : (
                          <View style={{ gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Diskon Custom</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {(tx.custom_discount ?? 0) > 0 ? (
                                  <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                                    -{formatCurrency(tx.custom_discount ?? 0)}
                                  </Text>
                                ) : (
                                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Belum ada</Text>
                                )}
                                {tx.status === 'in_progress' && (
                                  <Pressable
                                    onPress={() => { setTempCustomDiscount(String(tx.custom_discount && tx.custom_discount > 0 ? tx.custom_discount : '')); setEditCustomDiscount(true); }}
                                    hitSlop={8}
                                  >
                                    <Ionicons name="create-outline" size={16} color={theme.colors.accent} />
                                  </Pressable>
                                )}
                              </View>
                            </View>
                            {availableMargin > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="trending-up" size={11} color={theme.colors.success} />
                                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Sisa margin</Text>
                                </View>
                                <Text style={{ color: theme.colors.success, fontSize: 12, fontWeight: '700' }}>
                                  {formatCurrency(Math.max(0, remainingMargin))}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </>
                    );
                  })()}
                  {(() => {
                    const grossSp = (tx.spareparts ?? []).reduce((s, p) => s + p.sell_price * p.quantity, 0);
                    const itemDisc = (tx.spareparts ?? []).reduce((s, p) => s + (p.discount_per_item ?? 0) * p.quantity, 0);
                    const custDisc = tx.custom_discount ?? 0;
                    const totalDisc = itemDisc + custDisc;
                    const hasDisc = totalDisc > 0;
                    const final = tx.total_sparepart - custDisc;
                    return (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.divider, marginTop: 4 }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                            {t.transactions.total}
                          </Text>
                          {hasDisc && (
                            <Text style={{ fontSize: 10, marginTop: 2, lineHeight: 14 }}>
                              <Text style={{ color: '#fff' }}>{formatCurrency(grossSp)}</Text>
                              <Text style={{ color: theme.colors.textMuted }}>{' - '}</Text>
                              <Text style={{ color: theme.colors.danger }}>{formatCurrency(totalDisc)}</Text>
                              <Text style={{ color: theme.colors.textMuted }}>{' ='}</Text>
                            </Text>
                          )}
                        </View>
                        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14 }}>
                          {formatCurrency(final)}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </>
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
                  {renderNextServiceDateField()}
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
                    {tx.status === 'in_progress' && (
                      <Pressable onPress={startEditRecommendation} hitSlop={8}>
                        <Ionicons name="create" size={16} color={theme.colors.accent} />
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: theme.colors.text, marginTop: 4, lineHeight: 20 }}>
                    {tx.recommendation}
                  </Text>
                  {tx.next_service_date ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <Ionicons name="calendar-outline" size={13} color={theme.colors.accent} />
                      <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>
                        {t.transactions.nextServiceDate}: {formatDate(tx.next_service_date)}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              )
            ) : (
              tx.status === 'in_progress' && (
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
                  {renderNextServiceDateField()}
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
                    {tx.status === 'in_progress' && (
                      <Pressable onPress={startEditMechanicNotes} hitSlop={8}>
                        <Ionicons name="create" size={16} color={theme.colors.accent} />
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: theme.colors.text, marginTop: 4 }}>{tx.mechanic_notes}</Text>
                </Card>
              )
            ) : (
              tx.status === 'in_progress' && (
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

        {/* Voice announcement — only for waiting_payment */}
        {tx.status === 'waiting_payment' && (
          <Pressable
            onPress={speaking ? () => { Speech.stop(); setSpeaking(false); } : announcePayment}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginTop: 8,
              marginBottom: 4,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: speaking ? '#A855F7' : '#A855F720',
              borderWidth: 1.5,
              borderColor: '#A855F7',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons
              name={speaking ? 'stop-circle' : 'volume-high'}
              size={22}
              color={speaking ? '#fff' : '#A855F7'}
            />
            <Text style={{
              color: speaking ? '#fff' : '#A855F7',
              fontSize: 15,
              fontWeight: '700',
            }}>
              {speaking ? 'Hentikan Panggilan' : t.transactions.callToPayment}
            </Text>
          </Pressable>
        )}

        {/* Receipt actions — WA & Print (hidden while in_progress) */}
        {tx.status !== 'cancelled' && tx.status !== 'in_progress' && (
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
        )}

        {/* Actions */}
        <View style={{ gap: 10, marginTop: 8 }}>
          {/* PENDING: Mulai Kerjakan */}
          {tx.status === 'pending' && tx.type !== 'retail' && (
            <Button
              title={t.transactions.startWork}
              onPress={() => setConfirmStartWork(true)}
              size="lg"
              fullWidth
              icon={<Ionicons name="play-circle" size={18} color="#fff" />}
            />
          )}

          {/* IN_PROGRESS: Selesai Dikerjakan → pindah ke waiting_payment */}
          {tx.status === 'in_progress' && tx.type !== 'retail' && (
            <Button
              title={t.transactions.finishWork}
              onPress={() => setConfirmFinishWork(true)}
              size="lg"
              fullWidth
              icon={<Ionicons name="checkmark-done-circle" size={18} color="#fff" />}
            />
          )}

          {/* WAITING_PAYMENT: Bayar */}
          {tx.status === 'waiting_payment' && (
            <Button
              title={t.transactions.savePay}
              onPress={() => setPaymentPickerOpen(true)}
              size="lg"
              fullWidth
              icon={<Ionicons name="cash" size={18} color="#fff" />}
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
          <AdBanner />
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
        visible={confirmStartWork}
        title="Mulai Pekerjaan?"
        message={`Pekerjaan akan dikerjakan oleh mekanik: ${tx?.mechanic_name ?? 'Tidak ditentukan'}`}
        confirmText="Mulai Kerjakan"
        onConfirm={() => { setConfirmStartWork(false); markInProgress(); }}
        onCancel={() => setConfirmStartWork(false)}
      />

      <ConfirmDialog
        visible={confirmFinishWork}
        title="Selesai Dikerjakan?"
        message="Sudah yakin akan menyelesaikan pekerjaan?"
        confirmText="Ya, Selesai"
        onConfirm={() => { setConfirmFinishWork(false); markWaitingPayment(); }}
        onCancel={() => setConfirmFinishWork(false)}
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
        onPick={(sp, qty, discount) => handleAddSparepart(sp, qty, discount)}
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
                /* Pending: hanya Service Diterima */
                <Card
                  onPress={() => {
                    setSelectedReceiptType('diterima');
                    setReceiptPickerOpen(false);
                    router.push(`/receipt?id=${tx.id}&type=diterima` as any);
                  }}
                  style={{ borderColor: theme.colors.accent + '40', borderWidth: 1.5 }}
                  padding="sm"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.accent + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name="receipt" size={18} color={theme.colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
                        {t.transactions.receiptServiceReceived}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        {t.transactions.receiptServiceReceivedDesc}
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : tx.status === 'in_progress' || tx.status === 'waiting_payment' ? (
                /* In Progress / Waiting Payment: hanya Tagihan */
                <Card
                  onPress={() => {
                    setSelectedReceiptType('tagihan');
                    setReceiptPickerOpen(false);
                    router.push(`/receipt?id=${tx.id}&type=tagihan` as any);
                  }}
                  style={{ borderColor: theme.colors.success + '40', borderWidth: 1.5 }}
                  padding="sm"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.success + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name="cash" size={18} color={theme.colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
                        {t.transactions.receiptInvoice}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        {t.transactions.receiptInvoiceDesc}
                      </Text>
                    </View>
                  </View>
                </Card>
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
      {confirmPaidModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                overflow: 'hidden',
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
                style={{ flexGrow: 0, flexShrink: 1 }}
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
                        alignItems: 'flex-start',
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
                        {(p.discount_per_item ?? 0) > 0 && (
                          <Text style={{ color: theme.colors.danger, fontSize: 11 }}>
                            Diskon -{formatCurrency(p.discount_per_item!)} /item = -{formatCurrency(p.discount_per_item! * p.quantity)}
                          </Text>
                        )}
                      </View>
                      <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700', marginLeft: 8 }}>
                        {formatCurrency((p.sell_price - (p.discount_per_item ?? 0)) * p.quantity)}
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
                  {(() => {
                    const sps = tx.spareparts ?? [];
                    const grossSp = sps.reduce((s, p) => s + p.sell_price * p.quantity, 0);
                    const itemDisc = sps.reduce((s, p) => s + (p.discount_per_item ?? 0) * p.quantity, 0);
                    const custDisc = tx.custom_discount ?? 0;
                    const hasDisc = itemDisc > 0 || custDisc > 0;
                    return (
                      <>
                        {tx.total_service > 0 && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Total Jasa</Text>
                            <Text style={{ color: theme.colors.text, fontSize: 13 }}>
                              {formatCurrency(tx.total_service)}
                            </Text>
                          </View>
                        )}
                        {sps.length > 0 && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Total Sparepart</Text>
                            <Text style={{ color: theme.colors.text, fontSize: 13 }}>
                              {formatCurrency(hasDisc ? grossSp : tx.total_sparepart)}
                            </Text>
                          </View>
                        )}
                        {itemDisc > 0 && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: theme.colors.danger, fontSize: 13 }}>Diskon Item</Text>
                            <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                              -{formatCurrency(itemDisc)}
                            </Text>
                          </View>
                        )}
                        {custDisc > 0 && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: theme.colors.danger, fontSize: 13 }}>Diskon Custom</Text>
                            <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                              -{formatCurrency(custDisc)}
                            </Text>
                          </View>
                        )}
                      </>
                    );
                  })()}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.divider, paddingTop: 8 }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700' }}>{t.transactions.total}</Text>
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
        </View>
      )}

      {/* Edit Staff Modal */}
      <Modal
        visible={editStaffOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditStaffOpen(false)}
      >
        <Pressable
          onPress={() => setEditStaffOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
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
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderLight, alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
                {t.transactions.sectionStaff}
              </Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {/* Mekanik */}
              {tx.type !== 'retail' && (
                <>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
                    {t.transactions.mechanic.toUpperCase()}
                  </Text>
                  {mechanics.length === 0 ? (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 12 }}>
                      Belum ada mekanik aktif
                    </Text>
                  ) : (
                    mechanics.map((m) => (
                      <Pressable
                        key={m.id}
                        onPress={() => { setTempMechanicId(m.id); setTempMechanicName(m.name); }}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          marginBottom: 8,
                          borderRadius: theme.radius.lg,
                          backgroundColor: tempMechanicId === m.id ? theme.colors.accent + '18' : theme.colors.card,
                          borderWidth: 1.5,
                          borderColor: tempMechanicId === m.id ? theme.colors.accent : theme.colors.border,
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.accent + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          <Ionicons name="construct" size={16} color={theme.colors.accent} />
                        </View>
                        <Text style={{ flex: 1, color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>{m.name}</Text>
                        {tempMechanicId === m.id && (
                          <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
                        )}
                      </Pressable>
                    ))
                  )}
                  <View style={{ height: 12 }} />
                </>
              )}

              {/* Kasir */}
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
                {t.transactions.cashier.toUpperCase()}
              </Text>
              {cashiers.length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 12 }}>
                  Belum ada kasir aktif
                </Text>
              ) : (
                cashiers.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => { setTempCashierId(c.id); setTempCashierName(c.name); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      marginBottom: 8,
                      borderRadius: theme.radius.lg,
                      backgroundColor: tempCashierId === c.id ? theme.colors.success + '18' : theme.colors.card,
                      borderWidth: 1.5,
                      borderColor: tempCashierId === c.id ? theme.colors.success : theme.colors.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.success + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name="person" size={16} color={theme.colors.success} />
                    </View>
                    <Text style={{ flex: 1, color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>{c.name}</Text>
                    {tempCashierId === c.id && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <Button
                title={t.common.save}
                onPress={saveStaff}
                loading={savingStaff}
                fullWidth
                size="lg"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
