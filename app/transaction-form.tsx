import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { Input } from '../src/components/ui/Input';
import { Picker } from '../src/components/ui/Picker';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { SearchBar } from '../src/components/ui/SearchBar';
import { WhatsAppTemplateModal } from '../src/components/ui/WhatsAppTemplateModal';
import { PAYMENT_METHODS } from '../src/constants/config';
import { useTheme } from '../src/contexts/ThemeContext';
import { customerService } from '../src/services/customerService';
import { employeeService } from '../src/services/employeeService';
import { receiptService } from '../src/services/receiptService';
import { serviceService } from '../src/services/serviceService';
import { sparepartService } from '../src/services/sparepartService';
import { useTranslation } from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { useTransactionStore } from '../src/store/useTransactionStore';
import {
    Customer,
    Employee,
    PaymentMethod,
    Sparepart,
    Transaction,
    TransactionType,
} from '../src/types';
import { formatCurrency, parseCurrency } from '../src/utils/currency';
import { handleReceiptPrintError } from '../src/utils/printerAlert';

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
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: 'service' | 'retail' }>();
  const { theme } = useTheme();
  const t = useTranslation();
  const showToast = useAppStore((s) => s.showToast);
  const { add } = useTransactionStore();

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

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [spareparts, setSpareparts] = useState<Sparepart[]>([]);
  const [mechanics, setMechanics] = useState<Employee[]>([]);
  const [cashiers, setCashiers] = useState<Employee[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [selectedCashierId, setSelectedCashierId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [parts, setParts] = useState<SparepartLine[]>([]);
  const [complaint, setComplaint] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>(params.type === 'retail' ? 'retail' : 'service');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [paidAmount, setPaidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedTx, setSavedTx] = useState<Transaction | null>(null);
  const [actionBusy, setActionBusy] = useState<'print' | 'wa' | null>(null);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const isRetail = transactionType === 'retail';

  const canSaveService =
    !!selectedCustomer &&
    !!selectedMechanicId &&
    !!selectedCashierId &&
    complaint.trim().length > 0;

  // Picker modals
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [sparepartPickerOpen, setSparepartPickerOpen] = useState(false);
  const [sparepartSearch, setSparepartSearch] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');
  const [dbServices, setDbServices] = useState<{ name: string; price: number }[]>([]);

  // Custom sparepart form states
  const [showCustomSparepartForm, setShowCustomSparepartForm] = useState(false);
  const [customSpName, setCustomSpName] = useState('');
  const [customSpBuyPrice, setCustomSpBuyPrice] = useState('');
  const [customSpSellPrice, setCustomSpSellPrice] = useState('');
  const [customSpStock, setCustomSpStock] = useState('1');
  const [customSpMinStock, setCustomSpMinStock] = useState('0');
  const [customSpCategory, setCustomSpCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useFocusEffect(
    useCallback(() => {
      customerService.getAll().then((data) => {
        setCustomers(data);
        const { lastAddedCustomerId, setLastAddedCustomerId } = useAppStore.getState();
        if (lastAddedCustomerId) {
          const newCust = data.find((c) => c.id === lastAddedCustomerId);
          if (newCust) setSelectedCustomer(newCust);
          setLastAddedCustomerId(null);
        }
      });
      sparepartService.getAll().then(setSpareparts);
      employeeService.getMechanics().then(setMechanics);
      employeeService.getCashiers().then(setCashiers);
    }, [])
  );

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

  const categories = React.useMemo(() => {
    const uniqueCategories = [...new Set(spareparts.map((s) => s.category))];
    return uniqueCategories.sort();
  }, [spareparts]);

  const submitCustomSparepart = async () => {
    if (!customSpName.trim() || !customSpBuyPrice.trim() || !customSpSellPrice.trim() || !customSpStock.trim()) {
      Alert.alert('Peringatan', 'Mohon lengkapi semua data');
      return;
    }
    try {
      const stockVal = Math.max(0, parseInt(customSpStock) || 0);
      const minStockVal = Math.max(0, parseInt(customSpMinStock) || 0);
      const newSp = await sparepartService.create({
        name: customSpName.trim(),
        category: customSpCategory.trim() || 'Umum',
        buy_price: Number(customSpBuyPrice.replace(/[^0-9]/g, '')) || 0,
        sell_price: Number(customSpSellPrice.replace(/[^0-9]/g, '')) || 0,
        stock: stockVal,
        min_stock: minStockVal,
      });
      // Add to transaction
      addSparepart(newSp);
      // Refresh spareparts list
      sparepartService.getAll().then(setSpareparts);
      // Reset form
      setShowCustomSparepartForm(false);
      setCustomSpName('');
      setCustomSpBuyPrice('');
      setCustomSpSellPrice('');
      setCustomSpStock('1');
      setCustomSpMinStock('0');
      setCustomSpCategory('');
      setSparepartPickerOpen(false);
    } catch (e) {
      console.error('Error create custom sparepart', e);
    }
  };

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
      const newQty = exists.quantity + 1;
      if (newQty > sp.stock) {
        showToast('Stok tidak mencukupi', 'error');
        return;
      }
      setParts((prev) =>
        prev.map((p) =>
          p.sparepart_id === sp.id ? { ...p, quantity: newQty } : p
        )
      );
    } else {
      if (sp.stock < 1) {
        showToast('Stok tidak mencukupi', 'error');
        return;
      }
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
    const part = parts[i];
    if (!part) return;
    const next = Math.max(1, part.quantity + delta);
    if (next > (part.max_stock || 0)) {
      showToast('Stok tidak mencukupi', 'error');
      return;
    }
    setParts((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, quantity: next } : p))
    );
  };

  const removePart = (i: number) => setParts((p) => p.filter((_, idx) => idx !== i));

  const save = () => {
    if (!isRetail && !selectedCustomer) {
      showToast(t.transactions.selectCustomerFirst, 'error');
      return;
    }
    if (!isRetail && !selectedMechanicId) {
      showToast(t.transactions.selectMechanicFirst, 'error');
      return;
    }
    if (!isRetail && !complaint.trim()) {
      showToast(t.transactions.fillComplaintFirst, 'error');
      return;
    }
    if (!isRetail && !selectedCashierId) {
      showToast(t.transactions.selectCashierFirst, 'error');
      return;
    }
    if (isRetail && parts.length === 0) {
      showToast(t.transactions.addMinSparepart, 'error');
      return;
    }
    if (isRetail && paymentMethod === 'Tunai') {
      const paid = parseCurrency(paidAmount);
      if (paid < grandTotal) {
        Alert.alert(t.transactions.insufficientPayTitle, t.transactions.insufficientPayMessage);
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
    const finalStatus = isRetail ? 'paid' : 'pending';
    const finalServices = isRetail ? [] : services;
    const finalParts = parts;
    const total = totalService + totalSparepart;
    const isCash = paymentMethod === 'Tunai';
    const paid = isRetail ? (isCash ? parseCurrency(paidAmount) : total) : total;
    const change = isRetail && isCash ? Math.max(0, paid - total) : 0;
    
    // Get cashier info
    const selectedCashier = cashiers.find((c) => c.id === selectedCashierId);
    const cashierId = selectedCashierId;
    const finalCashierName = selectedCashier?.name ?? '';
    
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
        cashier_id: cashierId,
        cashier_name: finalCashierName || null,
        service_items: finalServices,
        spareparts: finalParts.map((p) => ({
          sparepart_id: p.sparepart_id,
          sparepart_name: p.sparepart_name,
          quantity: p.quantity,
          sell_price: p.sell_price,
        })),
      });
      showToast(t.transactions.saved, 'success');
      router.replace(`/transaction-detail?id=${created.id}`);
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
      const method = await receiptService.printPdf(savedTx);
      if (method === 'bluetooth') {
        showToast(t.transactions.receiptSent, 'success');
      }
    } catch (e: unknown) {
      handleReceiptPrintError(e, router, showToast);
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
      <ScreenHeader title={isRetail ? t.transactions.formRetail : t.transactions.formService} showBack />
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 180 + (Platform.OS === 'android' ? 48 : 34), gap: 20 }}>
          {/* Transaction type toggle */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
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
                {t.dashboard.service}
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
                {t.transactions.cashier}
              </Text>
            </Pressable>
          </View>

          {/* Customer */}
          <View>
            <Text style={sectionTitle}>
              {t.transactions.customer}{isRetail ? ` (${t.common.optional})` : ''}
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
                  {isRetail ? t.transactions.generalCustomer : t.reminders.selectCustomer}
                </Text>
              </View>
            )}
          </Card>
          </View>

          {/* Mekanik (opsional) */}
          {!isRetail && (
            <View>
              <Picker
                label={t.transactions.mechanic}
                value={selectedMechanicId ?? ''}
                options={mechanics.map((m) => m.id)}
                optionLabels={Object.fromEntries(mechanics.map((m) => [m.id, m.name]))}
                optionIcons={Object.fromEntries(mechanics.map((m) => [m.id, 'construct']))}
                onChange={(v) => setSelectedMechanicId(v)}
                placeholder={t.transactions.selectMechanic}
              />
            </View>
          )}

          {/* Kasir (service mode) */}
          {!isRetail && (
            <View>
              <Picker
                label={t.transactions.cashier}
                value={selectedCashierId ?? ''}
                options={cashiers.map((c) => c.id)}
                optionLabels={Object.fromEntries(cashiers.map((c) => [c.id, c.name]))}
                optionIcons={Object.fromEntries(cashiers.map((c) => [c.id, 'person']))}
                onChange={(v) => setSelectedCashierId(v)}
                placeholder={t.transactions.selectCashier}
              />
            </View>
          )}

          {/* Kasir (retail mode) */}
          {isRetail && (
            <View>
              <Picker
                label={t.transactions.cashier}
                value={selectedCashierId ?? ''}
                options={cashiers.map((c) => c.id)}
                optionLabels={Object.fromEntries(cashiers.map((c) => [c.id, c.name]))}
                optionIcons={Object.fromEntries(cashiers.map((c) => [c.id, 'person']))}
                onChange={(v) => setSelectedCashierId(v)}
                placeholder={t.transactions.selectCashier}
              />
            </View>
          )}

          {/* Keluhan Pelanggan */}
          {!isRetail && (
            <View>
              <Text style={sectionTitle}>{t.transactions.complaint}</Text>
              <Input
                value={complaint}
                onChangeText={setComplaint}
                placeholder={t.transactions.complaintPlaceholder}
                multiline
                numberOfLines={3}
                style={{ minHeight: 70, textAlignVertical: 'top' }}
              />
            </View>
          )}

          {/* Services - hidden, will be added in detail page */}
          {false && !isRetail && (
            <View style={{ marginBottom: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8
                }}
              >
                <Text style={sectionTitle}>Jasa Servis</Text>
                <Pressable
                  onPress={() => setServicePickerOpen(true)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.accent + '15',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="add-circle" size={16} color={theme.colors.accent} />
                  <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>
                    Tambah Jasa
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

          {/* Spareparts - hidden for service, shown for retail */}
          {isRetail && (
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Text style={sectionTitle}>{t.transactions.spareparts}</Text>
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
                    {t.transactions.addSparepart}
                  </Text>
                </Pressable>
              </View>
              <Card padding="sm">
                {parts.length === 0 ? (
                  <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 8 }}>
                    {t.transactions.noSpareparts}
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
          )}

          {/* Retail: always show payment method; Bayar only for Tunai */}
          {isRetail && (
            <>
              <Picker
                label={t.transactions.paymentMethod}
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
                  <Text style={sectionTitle}>{t.transactions.payAmount}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        flex: 1,
                        borderWidth: 2,
                        borderColor: theme.colors.warning,
                        borderRadius: theme.radius.md,
                        padding: 2,
                      }}
                    >
                      <Input
                        value={paidAmount}
                        onChangeText={setPaidAmount}
                        placeholder={t.transactions.payPlaceholder}
                        keyboardType="numeric"
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                    {paidAmount ? (
                      <View style={{ minWidth: 110, alignItems: 'flex-end' }}>
                        {parseCurrency(paidAmount) < grandTotal ? (
                          <>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>{t.transactions.shortfall}</Text>
                            <Text style={{ color: theme.colors.danger, fontSize: 14, fontWeight: '800' }}>
                              {formatCurrency(grandTotal - parseCurrency(paidAmount))}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>{t.transactions.change}</Text>
                            <Text style={{ color: theme.colors.success, fontSize: 14, fontWeight: '800' }}>
                              {formatCurrency(parseCurrency(paidAmount) - grandTotal)}
                            </Text>
                          </>
                        )}
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
            paddingBottom: Math.max(16, insets.bottom + 16),
            borderTopWidth: 1,
            borderTopColor: theme.colors.divider,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 16,
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
            title={isRetail ? t.transactions.savePrint : t.transactions.saveContinue}
            onPress={save}
            loading={loading}
            size="lg"
            fullWidth
            style={{ marginTop: 16 }}
            disabled={
              (!isRetail && !canSaveService) ||
              (isRetail && parts.length === 0) ||
              (isRetail && !selectedCashierId) ||
              (isRetail && paymentMethod === 'Tunai' && (!paidAmount || parseCurrency(paidAmount) < grandTotal))
            }
            icon={
              <Ionicons
                name={isRetail ? 'print' : 'save'}
                size={20}
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
            title={t.reminders.pickCustomer}
            showBack
            rightElement={
              <Pressable
                onPress={() => {
                  setCustomerPickerOpen(false);
                  setTimeout(() => {
                    router.push('/customer-form');
                  }, 150);
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
            contentContainerStyle={{ padding: 16, paddingBottom: 16 + insets.bottom }}
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
          <ScreenHeader title={t.services.pickService} showBack />
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 16 + insets.bottom }}>
            <Text style={sectionTitle}>Jasa</Text>
            {dbServices.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, padding: 12 }}>
                {t.services.empty}
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

            <Text style={[sectionTitle, { marginTop: 16 }]}>{t.common.add}</Text>
            <Input
              label={t.services.name}
              value={customServiceName}
              onChangeText={setCustomServiceName}
              placeholder={t.services.namePlaceholder}
            />
            <Input
              label={t.services.price}
              value={customServicePrice}
              onChangeText={(v) => setCustomServicePrice(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="0"
            />
            <Button title={t.common.add} onPress={addCustomService} fullWidth variant="primary" />
          </ScrollView>
        </View>
      </Modal>

      {/* Sparepart Picker */}
      <Modal visible={sparepartPickerOpen} transparent animationType="slide" onRequestClose={() => setSparepartPickerOpen(false)}>
        <Pressable
          onPress={() => setSparepartPickerOpen(false)}
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
              height: '90%',
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
                {t.spareparts.pickSparepart}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <SearchBar
                  value={sparepartSearch}
                  onChangeText={setSparepartSearch}
                  placeholder={t.spareparts.searchPlaceholder}
                  containerStyle={{ marginHorizontal: 0, marginBottom: 0 }}
                />
              </View>
              <Pressable
                onPress={() => setShowCustomSparepartForm(!showCustomSparepartForm)}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  borderRadius: theme.radius.md,
                  backgroundColor: showCustomSparepartForm ? theme.colors.accent : theme.colors.card,
                  borderWidth: 1,
                  borderColor: showCustomSparepartForm ? theme.colors.accent : theme.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={showCustomSparepartForm ? '#fff' : theme.colors.textSecondary}
                />
              </Pressable>
            </View>

            {showCustomSparepartForm && (
              <View
                style={{
                  padding: 14,
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  marginHorizontal: 16,
                  marginBottom: 12,
                }}
              >
                <Input
                  value={customSpName}
                  onChangeText={setCustomSpName}
                  placeholder={t.spareparts.name}
                />
                <Pressable
                  onPress={() => setShowCategoryPicker(true)}
                  style={{
                    backgroundColor: theme.colors.background,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: customSpCategory ? theme.colors.text : theme.colors.textSecondary }}>
                    {customSpCategory || t.spareparts.selectCategory}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={customSpBuyPrice}
                      onChangeText={setCustomSpBuyPrice}
                      placeholder={t.spareparts.buyPrice}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={customSpSellPrice}
                      onChangeText={setCustomSpSellPrice}
                      placeholder={t.spareparts.sellPrice}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={customSpStock}
                      onChangeText={setCustomSpStock}
                      placeholder={t.spareparts.stock}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={customSpMinStock}
                      onChangeText={setCustomSpMinStock}
                      placeholder={t.spareparts.minStock}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <Button
                  title={t.spareparts.addCustomSparepart}
                  fullWidth
                  onPress={submitCustomSparepart}
                  disabled={!customSpName.trim() || !customSpBuyPrice.trim() || !customSpSellPrice.trim() || !customSpStock.trim()}
                  icon={<Ionicons name="add-circle" size={18} color="#fff" />}
                />
              </View>
            )}

            <FlatList
              data={filteredSpareparts}
              keyExtractor={(s) => s.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
              renderItem={({ item }) => {
                const isOut = item.stock <= 0;
                return (
                  <Pressable
                    onPress={() => !isOut && addSparepart(item)}
                    disabled={isOut}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      padding: 14,
                      borderRadius: theme.radius.lg,
                      backgroundColor: pressed ? theme.colors.cardLight : theme.colors.card,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      marginBottom: 8,
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
                        marginRight: 12,
                      }}
                    >
                      <Ionicons name="cube" size={20} color={isOut ? theme.colors.textMuted : theme.colors.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
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
                          marginTop: 4,
                        }}
                      >
                        {isOut ? t.spareparts.outOfStockLabel : `Stok: ${item.stock}`} • {item.category}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: theme.colors.accent,
                        fontSize: 15,
                        fontWeight: '700',
                        marginLeft: 8,
                      }}
                    >
                      {formatCurrency(item.sell_price)}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>

        {/* Category Picker Modal */}
        <Modal visible={showCategoryPicker} transparent animationType="slide">
          <Pressable
            onPress={() => setShowCategoryPicker(false)}
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
                height: '90%',
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
                  {t.spareparts.pickCategory}
                </Text>
              </View>

              {/* Add new category section at the top */}
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={newCategory}
                      onChangeText={setNewCategory}
                      placeholder={t.spareparts.newCategoryPlaceholder}
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                  <Pressable
                    onPress={() => {
                      if (newCategory.trim()) {
                        setCustomSpCategory(newCategory.trim());
                        setNewCategory('');
                        setShowCategoryPicker(false);
                      }
                    }}
                    disabled={!newCategory.trim()}
                    style={({ pressed }) => ({
                      width: 48,
                      height: 48,
                      borderRadius: theme.radius.md,
                      backgroundColor: newCategory.trim() ? theme.colors.accent : theme.colors.card,
                      borderWidth: 1,
                      borderColor: newCategory.trim() ? theme.colors.accent : theme.colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color={newCategory.trim() ? '#fff' : theme.colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              <FlatList
                data={categories}
                keyExtractor={(item) => item}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setCustomSpCategory(item);
                      setShowCategoryPicker(false);
                    }}
                    style={{
                      padding: 14,
                      backgroundColor: customSpCategory === item ? theme.colors.accent + '15' : theme.colors.card,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: customSpCategory === item ? theme.colors.accent : theme.colors.border,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: customSpCategory === item ? theme.colors.accent : theme.colors.text,
                        fontSize: 15,
                        fontWeight: '600',
                      }}
                    >
                      {item}
                    </Text>
                  </Pressable>
                )}
              />

              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <Button
                  title={t.common.close}
                  variant="ghost"
                  fullWidth
                  onPress={() => setShowCategoryPicker(false)}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
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
              {t.transactions.validationTitle}
            </Text>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {/* Items */}
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t.transactions.itemDetails}</Text>
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
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t.transactions.total}</Text>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                    {formatCurrency(grandTotal)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t.transactions.method}</Text>
                  <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                    {paymentMethod}
                  </Text>
                </View>
                {paymentMethod === 'Tunai' && (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t.transactions.payAmount}</Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '700' }}>
                        {formatCurrency(parseCurrency(paidAmount))}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t.transactions.change}</Text>
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
                title={t.common.cancel}
                variant="secondary"
                fullWidth
                onPress={() => setConfirmModalOpen(false)}
              />
              <Button
                title={t.common.continue_}
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
                {t.transactions.savedTitle}
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
                {savedTx?.type !== 'retail' ? ` • ${t.transactions.sendReceiptQuestion}` : ''}
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {savedTx?.type !== 'retail' && (
                <>
                  <Button
                    title={t.transactions.sendWA}
                    variant="success"
                    fullWidth
                    size="lg"
                    disabled={!savedTx?.customer_phone}
                    onPress={openWaTemplate}
                    icon={<Ionicons name="logo-whatsapp" size={18} color="#fff" />}
                  />
                  <Button
                    title={`${t.common.print} / Share PDF`}
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
                title={t.common.done}
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
                {t.transactions.noPhone}
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
