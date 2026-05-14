import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { InterstitialAd } from '../src/components/ui/AdBanner';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { Input } from '../src/components/ui/Input';
import { Picker } from '../src/components/ui/Picker';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { SearchBar } from '../src/components/ui/SearchBar';
import { WhatsAppTemplateModal } from '../src/components/ui/WhatsAppTemplateModal';
import { PAYMENT_METHODS, TRANSACTION_STATUS } from '../src/constants/config';
import { theme } from '../src/constants/theme';
import { customerService } from '../src/services/customerService';
import { employeeService } from '../src/services/employeeService';
import { receiptService } from '../src/services/receiptService';
import { serviceService } from '../src/services/serviceService';
import { sparepartService } from '../src/services/sparepartService';
import { transactionService } from '../src/services/transactionService';
import { useAppStore } from '../src/store/useAppStore';
import { useTransactionStore } from '../src/store/useTransactionStore';
import {
    Customer,
    Employee,
    PaymentMethod,
    Sparepart,
    Transaction,
    TransactionStatus,
    TransactionType,
} from '../src/types';
import { formatCurrency, parseCurrency } from '../src/utils/currency';

interface ServiceLine {
  service_name: string;
  price: number;
}
interface SparepartLine {
  sparepart_id: string | null;
  sparepart_name: string;
  quantity: number;
  sell_price: number;
  max_stock?: number;
}

export default function TransactionForm() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const { add } = useTransactionStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [spareparts, setSpareparts] = useState<Sparepart[]>([]);
  const [mechanics, setMechanics] = useState<Employee[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [parts, setParts] = useState<SparepartLine[]>([]);
  const [complaint, setComplaint] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('service');
  const [status, setStatus] = useState<TransactionStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [paidAmount, setPaidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedTx, setSavedTx] = useState<Transaction | null>(null);
  const [actionBusy, setActionBusy] = useState<'print' | 'wa' | null>(null);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const isRetail = transactionType === 'retail';

  // Picker modals
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [sparepartPickerOpen, setSparepartPickerOpen] = useState(false);
  const [sparepartSearch, setSparepartSearch] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');
  const [dbServices, setDbServices] = useState<{ name: string; price: number }[]>([]);

  useEffect(() => {
    customerService.getAll().then(setCustomers);
    sparepartService.getAll().then(setSpareparts);
    employeeService.getMechanics().then(setMechanics);
  }, []);

  useEffect(() => {
    if (servicePickerOpen) {
      serviceService.getAll().then((data) => {
        setDbServices(data.map((s) => ({ name: s.name, price: s.price })));
      });
    }
  }, [servicePickerOpen]);

  const selectedMechanic = mechanics.find((m) => m.id === selectedMechanicId) ?? null;

  const totalService = services.reduce((s, x) => s + x.price, 0);
  const totalSparepart = parts.reduce((s, x) => s + x.sell_price * x.quantity, 0);
  const grandTotal = totalService + totalSparepart;

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.plate_number.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  const filteredSpareparts = spareparts.filter((s) =>
    s.name.toLowerCase().includes(sparepartSearch.toLowerCase())
  );

  const addPresetService = (s: { name: string; price: number }) => {
    setServices((prev) => [...prev, { service_name: s.name, price: s.price }]);
    setServicePickerOpen(false);
  };

  const addCustomService = async () => {
    if (!customServiceName.trim()) return;
    const price = parseCurrency(customServicePrice);
    try {
      await serviceService.create({ name: customServiceName.trim(), price });
    } catch {
      // ignore duplicate
    }
    setServices((prev) => [
      ...prev,
      { service_name: customServiceName.trim(), price },
    ]);
    setCustomServiceName('');
    setCustomServicePrice('');
    setServicePickerOpen(false);
  };

  const removeService = (i: number) => setServices((p) => p.filter((_, idx) => idx !== i));

  const addSparepart = (sp: Sparepart) => {
    const exists = parts.find((p) => p.sparepart_id === sp.id);
    if (exists) {
      setParts((prev) =>
        prev.map((p) =>
          p.sparepart_id === sp.id ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
    } else {
      setParts((prev) => [
        ...prev,
        {
          sparepart_id: sp.id,
          sparepart_name: sp.name,
          quantity: 1,
          sell_price: sp.sell_price,
          max_stock: sp.stock,
        },
      ]);
    }
    setSparepartPickerOpen(false);
  };

  const updatePartQty = (i: number, delta: number) => {
    setParts((prev) =>
      prev.map((p, idx) => {
        if (idx !== i) return p;
        const next = Math.max(1, p.quantity + delta);
        return { ...p, quantity: next };
      })
    );
  };

  const removePart = (i: number) => setParts((p) => p.filter((_, idx) => idx !== i));

  const save = () => {
    if (!isRetail && !selectedCustomer) {
      showToast('Pilih pelanggan dulu', 'error');
      return;
    }
    if (!isRetail && services.length === 0 && parts.length === 0) {
      showToast('Tambahkan minimal 1 jasa atau sparepart', 'error');
      return;
    }
    if (isRetail && parts.length === 0) {
      showToast('Tambahkan minimal 1 sparepart', 'error');
      return;
    }
    if (isRetail && paymentMethod === 'Tunai') {
      const paid = parseCurrency(paidAmount);
      if (paid < grandTotal) {
        showToast('Jumlah bayar kurang dari total', 'error');
        return;
      }
    }
    if (isRetail) {
      setConfirmModalOpen(true);
      return;
    }
    doSave();
  };

  const doSave = async () => {
    setConfirmModalOpen(false);
    const finalStatus: TransactionStatus = isRetail ? 'paid' : status;
    const finalServices = isRetail ? [] : services;
    const finalParts = parts;
    const total = totalService + totalSparepart;
    const isCash = paymentMethod === 'Tunai';
    const paid = isRetail ? (isCash ? parseCurrency(paidAmount) : total) : total;
    const change = isRetail && isCash ? Math.max(0, paid - total) : 0;
    setLoading(true);
    try {
      const created = await add({
        customer_id: selectedCustomer?.id ?? null,
        mechanic_id: isRetail ? null : selectedMechanicId,
        mechanic_notes: '',
        complaint: isRetail ? '' : complaint.trim(),
        recommendation: '',
        type: transactionType,
        status: finalStatus,
        payment_method: finalStatus === 'paid' ? paymentMethod : null,
        paid_amount: paid,
        change_amount: change,
        service_items: finalServices,
        spareparts: finalParts.map((p) => ({
          sparepart_id: p.sparepart_id,
          sparepart_name: p.sparepart_name,
          quantity: p.quantity,
          sell_price: p.sell_price,
        })),
      });
      // Re-fetch with joins (mechanic_name, customer_phone) for receipt
      const full = await transactionService.getById(created.id);
      setSavedTx(full ?? created);
      showToast('Transaksi disimpan', 'success');
      InterstitialAd.show();
    } catch (e: any) {
      showToast('Gagal menyimpan: ' + (e?.message ?? ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!savedTx) return;
    setActionBusy('print');
    try {
      await receiptService.printPdf(savedTx);
    } catch (e: any) {
      showToast('Gagal cetak: ' + (e?.message ?? ''), 'error');
    } finally {
      setActionBusy(null);
    }
  };

  const openWaTemplate = () => {
    if (!savedTx) return;
    setWaModalOpen(true);
  };

  const finishAndBack = () => {
    const txId = savedTx?.id;
    const isRetailTx = savedTx?.type === 'retail';
    setSavedTx(null);
    if (isRetailTx && txId) {
      router.replace(`/transaction-detail?id=${txId}`);
    } else {
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={isRetail ? 'Transaksi Kasir' : 'Transaksi Servis'} showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {/* Transaction type toggle */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <Pressable
              onPress={() => setTransactionType('service')}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 48,
                padding: 10,
                borderRadius: theme.radius.lg,
                backgroundColor:
                  transactionType === 'service' ? theme.colors.accent + '18' : theme.colors.card,
                borderWidth: 2,
                borderColor:
                  transactionType === 'service' ? theme.colors.accent : theme.colors.border,
                opacity: pressed ? 0.85 : 1,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Ionicons
                name="construct"
                size={18}
                color={transactionType === 'service' ? theme.colors.accent : theme.colors.textSecondary}
              />
              <Text
                style={{
                  color: transactionType === 'service' ? theme.colors.text : theme.colors.textSecondary,
                  fontWeight: '700',
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Servis
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTransactionType('retail')}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 48,
                padding: 10,
                borderRadius: theme.radius.lg,
                backgroundColor:
                  transactionType === 'retail' ? theme.colors.success + '18' : theme.colors.card,
                borderWidth: 2,
                borderColor:
                  transactionType === 'retail' ? theme.colors.success : theme.colors.border,
                opacity: pressed ? 0.85 : 1,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Ionicons
                name="cart"
                size={18}
                color={transactionType === 'retail' ? theme.colors.success : theme.colors.textSecondary}
              />
              <Text
                style={{
                  color: transactionType === 'retail' ? theme.colors.text : theme.colors.textSecondary,
                  fontWeight: '700',
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Kasir
              </Text>
            </Pressable>
          </View>

          {/* Customer */}
          <View style={{ marginBottom: 6 }}>
            <Text style={sectionTitle}>
              Pelanggan{isRetail ? ' (opsional)' : ''}
            </Text>
            <Card onPress={() => setCustomerPickerOpen(true)}>
            {selectedCustomer ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                    {selectedCustomer.name}
                  </Text>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                    {selectedCustomer.plate_number} • {selectedCustomer.vehicle_brand}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="person-add-outline" size={20} color={theme.colors.accent} />
                <Text style={{ color: theme.colors.textSecondary }}>
                  {isRetail ? 'Pelanggan umum (tap untuk pilih)' : 'Pilih pelanggan...'}
                </Text>
              </View>
            )}
          </Card>
          </View>

          {/* Mekanik (opsional) */}
          {!isRetail && (
            <View style={{ marginBottom: 4 }}>
              <Picker
                label="Mekanik (opsional)"
                value={selectedMechanicId ?? ''}
                options={['', ...mechanics.map((m) => m.id)]}
                optionLabels={{
                  '': 'Tidak ditentukan',
                  ...Object.fromEntries(mechanics.map((m) => [m.id, m.name])),
                }}
                optionIcons={{
                  '': 'construct-outline',
                  ...Object.fromEntries(mechanics.map((m) => [m.id, 'construct'])),
                }}
                onChange={(v) => setSelectedMechanicId(v === '' ? null : v)}
                placeholder="Pilih mekanik..."
              />
            </View>
          )}

          {/* Keluhan Pelanggan */}
          {!isRetail && (
            <View style={{ marginBottom: 6 }}>
              <Text style={sectionTitle}>Keluhan Pelanggan</Text>
              <Input
                value={complaint}
                onChangeText={setComplaint}
                placeholder="Mis. Mesin terasa kasar, rem kurang pakem..."
                multiline
                numberOfLines={3}
                style={{ minHeight: 70, textAlignVertical: 'top' }}
              />
            </View>
          )}

          {/* Services */}
          {!isRetail && (
            <View style={{ marginBottom: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <Text style={sectionTitle}>Jasa Servis</Text>
                <Pressable
                  onPress={() => setServicePickerOpen(true)}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.colors.accent + '20',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="add" size={14} color={theme.colors.accent} />
                  <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 12 }}>
                    Tambah
                  </Text>
                </Pressable>
              </View>
              <Card padding="sm">
                {services.length === 0 ? (
                  <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 8 }}>
                    Belum ada jasa
                  </Text>
                ) : (
                  <View style={{ gap: 0 }}>
                    {services.map((s, i) => (
                      <View
                        key={i}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          borderBottomWidth: i === services.length - 1 ? 0 : 1,
                          borderBottomColor: theme.colors.divider,
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: theme.colors.accent + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="build" size={14} color={theme.colors.accent} />
                        </View>
                        <Text
                          style={{ color: theme.colors.text, flex: 1, fontSize: 14, fontWeight: '500' }}
                          numberOfLines={2}
                        >
                          {s.service_name}
                        </Text>
                        <Text
                          style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 14 }}
                        >
                          {formatCurrency(s.price)}
                        </Text>
                        <Pressable
                          onPress={() => removeService(i)}
                          hitSlop={8}
                          style={({ pressed }) => ({
                            width: 32,
                            height: 32,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                            backgroundColor: pressed
                              ? theme.colors.danger + '20'
                              : 'transparent',
                          })}
                        >
                          <Ionicons name="trash" size={16} color={theme.colors.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </View>
          )}

          {/* Spareparts */}
          <View style={{ marginBottom: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <Text style={sectionTitle}>Sparepart</Text>
                <Pressable
                  onPress={() => setSparepartPickerOpen(true)}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.colors.accent + '20',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="add" size={14} color={theme.colors.accent} />
                  <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 12 }}>
                    Tambah
                  </Text>
                </Pressable>
              </View>
              <Card padding="sm">
                {parts.length === 0 ? (
                  <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 8 }}>
                    Belum ada sparepart
                  </Text>
                ) : (
                  <View style={{ gap: 0 }}>
                    {parts.map((p, i) => (
                      <View
                        key={i}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          borderBottomWidth: i === parts.length - 1 ? 0 : 1,
                          borderBottomColor: theme.colors.divider,
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: theme.colors.warning + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="cube" size={14} color={theme.colors.warning} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={2}>
                            {p.sparepart_name}
                          </Text>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                            {formatCurrency(p.sell_price)} × {p.quantity}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Pressable
                            onPress={() => updatePartQty(i, -1)}
                            style={qtyBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="remove" size={16} color="#fff" />
                          </Pressable>
                          <Text
                            style={{
                              color: theme.colors.text,
                              minWidth: 22,
                              textAlign: 'center',
                              fontWeight: '700',
                              fontSize: 14,
                            }}
                          >
                            {p.quantity}
                          </Text>
                          <Pressable
                            onPress={() => updatePartQty(i, 1)}
                            style={qtyBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="add" size={16} color="#fff" />
                          </Pressable>
                        </View>
                        <Pressable
                          onPress={() => removePart(i)}
                          hitSlop={8}
                          style={({ pressed }) => ({
                            width: 32,
                            height: 32,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                            backgroundColor: pressed
                              ? theme.colors.danger + '20'
                              : 'transparent',
                          })}
                        >
                          <Ionicons name="trash" size={16} color={theme.colors.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </View>

          {/* Status (service only; retail auto-paid) */}
          {!isRetail && (
            <>
              <Picker
                label="Status Pembayaran"
                value={status}
                options={TRANSACTION_STATUS as unknown as string[]}
                onChange={(v) => setStatus(v as TransactionStatus)}
                optionLabels={{
                  pending: 'Pending',
                  paid: 'Lunas',
                  cancelled: 'Batal',
                }}
                optionIcons={{
                  pending: 'time',
                  paid: 'checkmark-circle',
                  cancelled: 'close-circle',
                }}
                optionColors={{
                  pending: theme.colors.warning,
                  paid: theme.colors.success,
                  cancelled: theme.colors.danger,
                }}
              />
              {status === 'paid' && (
                <Picker
                  label="Metode Pembayaran"
                  value={paymentMethod}
                  options={PAYMENT_METHODS}
                  onChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  optionIcons={{
                    Tunai: 'cash',
                    Transfer: 'swap-horizontal',
                    QRIS: 'qr-code',
                    Debit: 'card',
                  }}
                />
              )}
            </>
          )}

          {/* Retail: always show payment method; Bayar only for Tunai */}
          {isRetail && (
            <>
              <Picker
                label="Metode Pembayaran"
                value={paymentMethod}
                options={PAYMENT_METHODS}
                onChange={(v) => setPaymentMethod(v as PaymentMethod)}
                optionIcons={{
                  Tunai: 'cash',
                  Transfer: 'swap-horizontal',
                  QRIS: 'qr-code',
                  Debit: 'card',
                }}
              />
              {paymentMethod === 'Tunai' && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={sectionTitle}>Bayar (Rp)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={paidAmount}
                        onChangeText={setPaidAmount}
                        placeholder="Masukkan jumlah uang..."
                        keyboardType="numeric"
                      />
                    </View>
                    {paidAmount ? (
                      <View style={{ minWidth: 110, alignItems: 'flex-end' }}>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Kembalian</Text>
                        <Text style={{ color: theme.colors.success, fontSize: 14, fontWeight: '800' }}>
                          {formatCurrency(Math.max(0, parseCurrency(paidAmount) - grandTotal))}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Footer Total + Save */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.surface,
            padding: 16,
            paddingBottom: 32,
            borderTopWidth: 1,
            borderTopColor: theme.colors.divider,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: theme.colors.divider,
            }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
              Total
            </Text>
            <Text style={{ color: theme.colors.accent, fontSize: 22, fontWeight: '800' }}>
              {formatCurrency(grandTotal)}
            </Text>
          </View>
          <Button
            title={isRetail ? 'Simpan & Cetak' : 'Simpan Transaksi'}
            onPress={save}
            loading={loading}
            size="lg"
            fullWidth
            style={{ marginTop: 4 }}
            icon={
              <Ionicons
                name={isRetail ? 'print' : 'save'}
                size={20}
                color="#fff"
              />
            }
          />
        </View>
      </KeyboardAvoidingView>

      {/* Customer Picker */}
      <Modal
        visible={customerPickerOpen}
        animationType="slide"
        onRequestClose={() => setCustomerPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <ScreenHeader
            title="Pilih Pelanggan"
            showBack
            rightElement={
              <Pressable
                onPress={() => {
                  setCustomerPickerOpen(false);
                  router.push('/customer-form');
                }}
              >
                <Ionicons name="add-circle" size={28} color={theme.colors.accent} />
              </Pressable>
            }
          />
          <SearchBar value={customerSearch} onChangeText={setCustomerSearch} />
          <FlatList
            data={filteredCustomers}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelectedCustomer(item);
                  setCustomerPickerOpen(false);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: theme.radius.lg,
                  backgroundColor: pressed ? theme.colors.cardLight : theme.colors.card,
                  marginBottom: 8,
                })}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: theme.colors.primary + '30',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="person" size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                    {item.name}
                  </Text>
                  <Text
                    style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}
                  >
                    {item.plate_number} • {item.vehicle_brand}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Service Picker */}
      <Modal
        visible={servicePickerOpen}
        animationType="slide"
        onRequestClose={() => setServicePickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <ScreenHeader title="Pilih Jasa" showBack />
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={sectionTitle}>Jasa</Text>
            {dbServices.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, padding: 12 }}>
                Belum ada jasa. Tambahkan di menu Jasa.
              </Text>
            ) : (
              dbServices.map((s, i) => (
                <Pressable
                  key={`${s.name}-${i}`}
                  onPress={() => addPresetService(s)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: pressed ? theme.colors.cardLight : theme.colors.card,
                    borderRadius: theme.radius.lg,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: theme.colors.accent + '15',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="build" size={18} color={theme.colors.accent} />
                    </View>
                    <Text
                      style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600' }}
                    >
                      {s.name}
                    </Text>
                  </View>
                  <Text
                    style={{ color: theme.colors.accent, fontSize: 15, fontWeight: '700' }}
                  >
                    {formatCurrency(s.price)}
                  </Text>
                </Pressable>
              ))
            )}

            <Text style={[sectionTitle, { marginTop: 16 }]}>Atau Custom</Text>
            <Input
              label="Nama Jasa"
              value={customServiceName}
              onChangeText={setCustomServiceName}
              placeholder="Mis. Bongkar mesin"
            />
            <Input
              label="Harga"
              value={customServicePrice}
              onChangeText={(v) => setCustomServicePrice(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="0"
            />
            <Button title="Tambahkan" onPress={addCustomService} fullWidth />
          </ScrollView>
        </View>
      </Modal>

      {/* Sparepart Picker */}
      <Modal
        visible={sparepartPickerOpen}
        animationType="slide"
        onRequestClose={() => setSparepartPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <ScreenHeader title="Pilih Sparepart" showBack />
          <SearchBar value={sparepartSearch} onChangeText={setSparepartSearch} />
          <FlatList
            data={filteredSpareparts}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => {
              const isOut = item.stock <= 0;
              return (
                <Pressable
                  onPress={() => !isOut && addSparepart(item)}
                  disabled={isOut}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: 14,
                    borderRadius: theme.radius.lg,
                    backgroundColor: pressed ? theme.colors.cardLight : theme.colors.card,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    opacity: isOut ? 0.5 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: isOut ? theme.colors.borderLight : theme.colors.warning + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Ionicons name="cube" size={20} color={isOut ? theme.colors.textMuted : theme.colors.warning} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: 15,
                        fontWeight: '600',
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        color: isOut ? theme.colors.danger : theme.colors.textSecondary,
                        fontSize: 12,
                      }}
                    >
                      {isOut ? 'STOK HABIS' : `Stok: ${item.stock}`} • {item.category}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontSize: 15,
                      fontWeight: '700',
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {formatCurrency(item.sell_price)}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>

      {/* Kasir confirm modal */}
      <Modal
        visible={confirmModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.xl,
              padding: 20,
              borderWidth: 1,
              borderColor: theme.colors.border,
              maxHeight: '85%',
            }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
              Validasi Transaksi Kasir
            </Text>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {/* Items */}
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Rincian Item</Text>
              <View style={{ gap: 0, marginBottom: 12 }}>
                {parts.map((p, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderBottomWidth: i === parts.length - 1 ? 0 : 1,
                      borderBottomColor: theme.colors.divider,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
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

              {/* Totals */}
              <View
                style={{
                  backgroundColor: theme.colors.cardLight,
                  borderRadius: theme.radius.lg,
                  padding: 14,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Total</Text>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                    {formatCurrency(grandTotal)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Metode</Text>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                    {paymentMethod}
                  </Text>
                </View>
                {paymentMethod === 'Tunai' && (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Bayar</Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '700' }}>
                        {formatCurrency(parseCurrency(paidAmount))}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Kembalian</Text>
                      <Text style={{ color: theme.colors.success, fontSize: 14, fontWeight: '700' }}>
                        {formatCurrency(Math.max(0, parseCurrency(paidAmount) - grandTotal))}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button
                title="Batal"
                variant="secondary"
                fullWidth
                onPress={() => setConfirmModalOpen(false)}
              />
              <Button
                title="Lanjut"
                fullWidth
                loading={loading}
                onPress={doSave}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Post-save action modal */}
      <Modal
        visible={!!savedTx}
        transparent
        animationType="fade"
        onRequestClose={finishAndBack}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.xl,
              padding: 22,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: theme.colors.success + '25',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Ionicons name="checkmark-circle" size={40} color={theme.colors.success} />
              </View>
              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
                Transaksi Disimpan
              </Text>
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 13,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                Total {savedTx ? formatCurrency(savedTx.total_amount) : ''}
                {savedTx?.type !== 'retail' ? ' • Kirim struk ke pelanggan?' : ''}
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {savedTx?.type !== 'retail' && (
                <>
                  <Button
                    title="Kirim via WhatsApp"
                    variant="success"
                    fullWidth
                    size="lg"
                    disabled={!savedTx?.customer_phone}
                    onPress={openWaTemplate}
                    icon={<Ionicons name="logo-whatsapp" size={18} color="#fff" />}
                  />
                  <Button
                    title="Cetak / Share PDF"
                    variant="secondary"
                    fullWidth
                    size="lg"
                    loading={actionBusy === 'print'}
                    onPress={handlePrint}
                    icon={<Ionicons name="print" size={18} color="#fff" />}
                  />
                </>
              )}
              <Button
                title="Selesai"
                variant="ghost"
                fullWidth
                onPress={finishAndBack}
              />
            </View>
            {savedTx?.type !== 'retail' && !savedTx?.customer_phone && (
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 11,
                  textAlign: 'center',
                  marginTop: 10,
                }}
              >
                * Pelanggan belum punya nomor HP, WA tidak tersedia
              </Text>
            )}
          </View>
        </View>
      </Modal>

      <WhatsAppTemplateModal
        visible={waModalOpen}
        tx={savedTx}
        onClose={() => setWaModalOpen(false)}
        onError={(msg) => showToast(msg, 'error')}
      />
    </View>
  );
}

const sectionTitle = {
  color: theme.colors.text,
  fontSize: 14,
  fontWeight: '700' as const,
  marginBottom: 6,
};

const qtyBtn = {
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: theme.colors.primary,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
