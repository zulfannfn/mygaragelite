import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
import { useTranslation } from '../src/i18n';
import { customerService } from '../src/services/customerService';
import { employeeService } from '../src/services/employeeService';
import { receiptService } from '../src/services/receiptService';
import { serviceService } from '../src/services/serviceService';
import { sparepartService } from '../src/services/sparepartService';
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
  buy_price: number;
  discount_per_item: number;
  max_stock?: number;
}

export default function TransactionForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: 'service' | 'retail' }>();
  const { theme } = useTheme();
  const t = useTranslation();
  const showToast = useAppStore((s) => s.showToast);
  const lastMechanicId = useAppStore((s) => s.lastMechanicId);
  const lastCashierId = useAppStore((s) => s.lastCashierId);
  const setLastMechanicId = useAppStore((s) => s.setLastMechanicId);
  const setLastCashierId = useAppStore((s) => s.setLastCashierId);
  const { add } = useTransactionStore();

  const sectionTitle = {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 6,
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
  const [qtyDiscountModal, setQtyDiscountModal] = useState<Sparepart | null>(null);
  const [modalQtyStr, setModalQtyStr] = useState('1');
  const [modalDiscountStr, setModalDiscountStr] = useState('0');
  const [customDiscount, setCustomDiscount] = useState(0);
  const [customDiscountStr, setCustomDiscountStr] = useState('');
  const [customDiscountWarning, setCustomDiscountWarning] = useState(false);

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
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const customerSheetY = useRef(new Animated.Value(0)).current;
  const customerPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) customerSheetY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          customerSheetY.setValue(0);
          setCustomerPickerOpen(false);
        } else {
          Animated.spring(customerSheetY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

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
      employeeService.getMechanics().then((data) => {
        setMechanics(data);
        const { lastMechanicId: lastM } = useAppStore.getState();
        if (lastM && data.some((m) => m.id === lastM)) {
          setSelectedMechanicId((prev) => prev ?? lastM);
        }
      });
      employeeService.getCashiers().then((data) => {
        setCashiers(data);
        const { lastCashierId: lastC } = useAppStore.getState();
        if (lastC && data.some((c) => c.id === lastC)) {
          setSelectedCashierId((prev) => prev ?? lastC);
        }
      });
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
  const totalBeforeDiscount = parts.reduce((s, x) => s + x.sell_price * x.quantity, 0);
  const totalDiscount = parts.reduce((s, x) => s + x.discount_per_item * x.quantity, 0);
  const totalSparepart = totalBeforeDiscount - totalDiscount;
  const totalBuyCost = parts.reduce((s, x) => s + (x.buy_price ?? 0) * x.quantity, 0);
  const totalMargin = totalSparepart - totalBuyCost;
  const grandTotal = totalService + totalSparepart - customDiscount;

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

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase();
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  useEffect(() => {
    if (!showCategoryPicker) {
      setCategorySearch('');
      setShowCategoryInput(false);
    }
  }, [showCategoryPicker]);

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
      // Add to transaction via modal
      openQtyDiscountModal(newSp);
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

  const openQtyDiscountModal = (sp: Sparepart) => {
    if (sp.stock < 1) {
      showToast('Stok tidak mencukupi', 'error');
      return;
    }
    setQtyDiscountModal(sp);
    setModalQtyStr('1');
    setModalDiscountStr('0');
    setSparepartPickerOpen(false);
  };

  const confirmAddSparepart = () => {
    if (!qtyDiscountModal) return;
    const sp = qtyDiscountModal;
    const qty = Math.max(1, parseInt(modalQtyStr, 10) || 1);
    const disc = Math.max(0, parseInt(modalDiscountStr, 10) || 0);
    if (qty > sp.stock) {
      showToast('Stok tidak mencukupi', 'error');
      return;
    }
    const exists = parts.find((p) => p.sparepart_id === sp.id);
    if (exists) {
      setParts((prev) =>
        prev.map((p) =>
          p.sparepart_id === sp.id
            ? { ...p, quantity: p.quantity + qty, discount_per_item: disc }
            : p
        )
      );
    } else {
      setParts((prev) => [
        ...prev,
        {
          sparepart_id: sp.id,
          sparepart_name: sp.name,
          quantity: qty,
          sell_price: sp.sell_price,
          buy_price: sp.buy_price ?? 0,
          discount_per_item: disc,
          max_stock: sp.stock,
        },
      ]);
    }
    setQtyDiscountModal(null);
  };

  const removePart = (i: number) => {
    setParts((prev) => {
      const newParts = prev.filter((_, idx) => idx !== i);
      const newBuyCost = newParts.reduce((s, x) => s + (x.buy_price ?? 0) * x.quantity, 0);
      const newBeforeDisc = newParts.reduce((s, x) => s + x.sell_price * x.quantity, 0);
      const newItemDisc = newParts.reduce((s, x) => s + x.discount_per_item * x.quantity, 0);
      const newMargin = (newBeforeDisc - newItemDisc) - newBuyCost;
      const newMax = Math.max(0, newMargin);
      if (customDiscount > newMax) {
        setCustomDiscount(newMax);
        setCustomDiscountStr(newMax > 0 ? String(newMax) : '');
      }
      setCustomDiscountWarning(false);
      return newParts;
    });
  };

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
    const total = grandTotal;
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
        custom_discount: isRetail ? customDiscount : 0,
        service_items: finalServices,
        spareparts: finalParts.map((p) => ({
          sparepart_id: p.sparepart_id,
          sparepart_name: p.sparepart_name,
          quantity: p.quantity,
          sell_price: p.sell_price,
          discount_per_item: p.discount_per_item,
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
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title={isRetail ? t.transactions.formRetail : t.transactions.formService} showBack />
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1, backgroundColor: theme.colors.surface }}
          contentContainerStyle={{
            flexGrow: 1,
            padding: 16,
            paddingBottom: 20 + (kbHeight > 0 ? kbHeight : 0),
            gap: 20,
          }}
          keyboardShouldPersistTaps="handled"
        >
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
                onChange={(v) => { setSelectedMechanicId(v); setLastMechanicId(v); }}
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
                onChange={(v) => { setSelectedCashierId(v); setLastCashierId(v); }}
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
                onChange={(v) => { setSelectedCashierId(v); setLastCashierId(v); }}
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
                onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300)}
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
                  <>
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
                          {(p.buy_price ?? 0) > 0 && (
                            <Text style={{ color: theme.colors.warning, fontSize: 11, marginTop: 1 }}>
                              Beli: {formatCurrency(p.buy_price ?? 0)}
                            </Text>
                          )}
                          {p.discount_per_item > 0 && (
                            <>
                              <Text style={{ color: theme.colors.danger, fontSize: 11, marginTop: 1 }}>
                                Diskon {formatCurrency(p.discount_per_item)} /item
                              </Text>
                              <Text style={{ color: theme.colors.danger, fontSize: 11, marginTop: 1, fontWeight: '600' }}>
                                -{formatCurrency(p.discount_per_item * p.quantity)}
                              </Text>
                            </>
                          )}
                        </View>
                        <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 14, marginLeft: 8 }}>
                          {formatCurrency((p.sell_price - p.discount_per_item) * p.quantity)}
                        </Text>
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
                  {totalDiscount > 0 && (
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.divider,
                      marginTop: 8,
                      paddingTop: 8,
                    }}>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Total Diskon Item</Text>
                      <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                        -{formatCurrency(totalDiscount)}
                      </Text>
                    </View>
                  )}
                  </>
                )}
              </Card>
            </View>
          )}

          {/* Retail: custom discount above payment method */}
          {isRetail && parts.length > 0 && (
            <View style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: totalBuyCost > 0 && totalMargin <= 0
                ? theme.colors.textMuted + '40'
                : customDiscount > 0 ? theme.colors.danger + '60' : theme.colors.border,
              padding: 14,
              marginBottom: 4,
              gap: 6,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Ionicons
                  name="pricetag"
                  size={14}
                  color={totalBuyCost > 0 && totalMargin <= 0 ? theme.colors.textMuted : customDiscount > 0 ? theme.colors.danger : theme.colors.textMuted}
                />
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 }}>
                  Diskon Custom
                </Text>
                {totalMargin > 0 && (
                  <Text style={{ color: theme.colors.success, fontSize: 11, fontWeight: '600' }}>
                    Margin tersisa: {formatCurrency(totalMargin - customDiscount)}
                  </Text>
                )}
              </View>
              {totalBuyCost > 0 && totalMargin <= 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
                  <Ionicons name="warning" size={14} color={theme.colors.warning} />
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, flex: 1 }}>
                    Margin sparepart sudah habis, tidak bisa diinput
                  </Text>
                </View>
              ) : (
                <>
                  <TextInput
                    value={customDiscountStr}
                    onChangeText={(v) => {
                      const clean = v.replace(/[^0-9]/g, '');
                      const n = parseInt(clean, 10) || 0;
                      const max = Math.max(0, totalMargin);
                      const capped = Math.min(n, max);
                      setCustomDiscountStr(capped === n ? clean : String(capped));
                      setCustomDiscount(capped);
                      setCustomDiscountWarning(n > max && max > 0);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    style={{
                      color: customDiscount > 0 ? theme.colors.danger : theme.colors.text,
                      fontSize: 16,
                      fontWeight: '700',
                      borderWidth: 1,
                      borderColor: customDiscountWarning ? theme.colors.warning : customDiscount > 0 ? theme.colors.danger : theme.colors.border,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: theme.colors.surface,
                    }}
                  />
                  {customDiscountWarning && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="alert-circle" size={12} color={theme.colors.warning} />
                      <Text style={{ color: theme.colors.warning, fontSize: 11 }}>
                        Diskon tidak boleh melebihi total margin
                      </Text>
                    </View>
                  )}
                </>
              )}
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
                  {/* Preset cash denomination buttons */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}
                  >
                    {[10000, 20000, 50000, 100000].map((amount) => {
                      const isActive = parseCurrency(paidAmount) === amount;
                      return (
                        <Pressable
                          key={amount}
                          onPress={() => setPaidAmount(String(amount))}
                          style={({ pressed }) => ({
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: theme.radius.md,
                            backgroundColor: isActive ? theme.colors.accent + '20' : theme.colors.card,
                            borderWidth: 1.5,
                            borderColor: isActive ? theme.colors.accent : theme.colors.border,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Text style={{
                            color: isActive ? theme.colors.accent : theme.colors.text,
                            fontSize: 13,
                            fontWeight: '700',
                          }}>
                            {formatCurrency(amount)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
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
                        onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300)}
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

        {/* Footer Total + Save — fixed menempel di bawah layar */}
        <View
          style={{
            backgroundColor: theme.colors.surface,
            paddingTop: 12,
            paddingHorizontal: 16,
            paddingBottom: kbHeight > 0 ? 12 : Math.max(16, insets.bottom + 16),
            borderTopWidth: 1,
            borderTopColor: theme.colors.divider,
          }}
        >
          {isRetail && parts.length > 0 && (
            <View style={{ marginBottom: 12, gap: 4 }}>
              {/* Total Harga */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Total Harga</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                  {formatCurrency(totalBeforeDiscount)}
                </Text>
              </View>
              {/* Total Diskon */}
              {(totalDiscount + customDiscount) > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.danger, fontSize: 13 }}>Total Diskon</Text>
                  <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                    -{formatCurrency(totalDiscount + customDiscount)}
                  </Text>
                </View>
              )}
              {/* Margin yang Didapat */}
              {totalBuyCost > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="trending-up" size={12} color={theme.colors.success} />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Margin</Text>
                  </View>
                  <Text style={{ color: theme.colors.success, fontSize: 13, fontWeight: '700' }}>
                    {formatCurrency(totalMargin - customDiscount)}
                  </Text>
                </View>
              )}
              {/* Total Bayar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.divider, marginTop: 2 }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Total Bayar</Text>
                <Text style={{ color: theme.colors.accent, fontSize: 20, fontWeight: '800' }}>
                  {formatCurrency(grandTotal)}
                </Text>
              </View>
            </View>
          )}
          <Button
            title={isRetail ? t.transactions.savePrint : t.transactions.saveContinue}
            onPress={save}
            loading={loading}
            size="lg"
            fullWidth
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
      </View>

      {/* Qty + Diskon Modal (retail sparepart picker) */}
      <Modal
        visible={!!qtyDiscountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setQtyDiscountModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}
            onPress={() => setQtyDiscountModal(null)}
          >
          <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, padding: 20, borderWidth: 1, borderColor: theme.colors.border }}>
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
              {qtyDiscountModal?.name}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1, backgroundColor: theme.colors.cardLight, borderRadius: theme.radius.md, padding: 8 }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 10, marginBottom: 2 }}>HARGA JUAL</Text>
                <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '700' }}>
                  {formatCurrency(qtyDiscountModal?.sell_price ?? 0)}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: theme.colors.cardLight, borderRadius: theme.radius.md, padding: 8 }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 10, marginBottom: 2 }}>HARGA BELI</Text>
                <Text style={{ color: theme.colors.warning, fontSize: 14, fontWeight: '700' }}>
                  {formatCurrency(qtyDiscountModal?.buy_price ?? 0)}
                </Text>
              </View>
              <View style={{ backgroundColor: theme.colors.cardLight, borderRadius: theme.radius.md, padding: 8, alignItems: 'center', justifyContent: 'center', minWidth: 60 }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 10, marginBottom: 2 }}>STOK</Text>
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                  {qtyDiscountModal?.stock}
                </Text>
              </View>
            </View>

            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Jumlah</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Pressable
                onPress={() => {
                  const n = Math.max(1, (parseInt(modalQtyStr, 10) || 1) - 1);
                  setModalQtyStr(String(n));
                }}
                style={({ pressed }) => ({
                  width: 48, height: 48, borderRadius: 12,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="remove" size={22} color="#fff" />
              </Pressable>
              <TextInput
                value={modalQtyStr}
                onChangeText={(v) => setModalQtyStr(v.replace(/[^0-9]/g, '') || '1')}
                onBlur={() => {
                  const n = parseInt(modalQtyStr, 10);
                  setModalQtyStr(String(isNaN(n) || n < 1 ? 1 : n));
                }}
                keyboardType="numeric"
                style={{
                  flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '800',
                  color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border,
                  borderRadius: theme.radius.md, paddingVertical: 8,
                  backgroundColor: theme.colors.surface,
                }}
              />
              <Pressable
                onPress={() => {
                  const cur = parseInt(modalQtyStr, 10) || 1;
                  const max = qtyDiscountModal?.stock ?? 9999;
                  const n = Math.min(max, cur + 1);
                  setModalQtyStr(String(n));
                }}
                style={({ pressed }) => ({
                  width: 48, height: 48, borderRadius: 12,
                  backgroundColor: theme.colors.accent,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                Diskon per Item (Rp)
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                maks. margin {formatCurrency(Math.max(0, (qtyDiscountModal?.sell_price ?? 0) - (qtyDiscountModal?.buy_price ?? 0)))}
              </Text>
            </View>
            <TextInput
              value={modalDiscountStr}
              onChangeText={(v) => {
                const clean = v.replace(/[^0-9]/g, '');
                const n = parseInt(clean, 10) || 0;
                const maxDisc = Math.max(0, (qtyDiscountModal?.sell_price ?? 0) - (qtyDiscountModal?.buy_price ?? 0));
                const capped = Math.min(n, maxDisc);
                setModalDiscountStr(capped === n ? clean : String(capped));
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              style={{
                color: theme.colors.text, fontSize: 16,
                borderWidth: 1, borderColor: theme.colors.border,
                borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 10,
                backgroundColor: theme.colors.surface, marginBottom: 14,
              }}
            />

            {(() => {
              const qty = parseInt(modalQtyStr, 10) || 1;
              const disc = parseInt(modalDiscountStr, 10) || 0;
              const price = qtyDiscountModal?.sell_price ?? 0;
              const beforeDisc = price * qty;
              const totalDisc = disc * qty;
              const afterDisc = beforeDisc - totalDisc;
              return (
                <View style={{ backgroundColor: theme.colors.cardLight, borderRadius: theme.radius.lg, padding: 12, gap: 4, marginBottom: 16 }}>
                  {disc > 0 && (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Total Harga</Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{formatCurrency(beforeDisc)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: theme.colors.danger, fontSize: 12 }}>Total Diskon</Text>
                        <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '700' }}>-{formatCurrency(totalDisc)}</Text>
                      </View>
                    </>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>Total Bayar</Text>
                    <Text style={{ color: theme.colors.accent, fontSize: 16, fontWeight: '800' }}>{formatCurrency(afterDisc)}</Text>
                  </View>
                </View>
              );
            })()}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={t.common.cancel} variant="secondary" fullWidth onPress={() => setQtyDiscountModal(null)} />
              <Button title="Tambah" fullWidth onPress={confirmAddSparepart} />
            </View>
          </View>
          </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Customer Picker - Bottom Sheet */}
      <Modal
        visible={customerPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomerPickerOpen(false)}
      >
        <Pressable
          onPress={() => setCustomerPickerOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{ height: '90%' }}>
            <Animated.View
              style={{
                flex: 1,
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
                paddingBottom: Math.max(28, insets.bottom + 16),
                transform: [{ translateY: customerSheetY }],
              }}
            >
              {/* Drag handle + header — pan responder di sini */}
              <View {...customerPanResponder.panHandlers}>
                <View
                  style={{
                    width: 40, height: 4, borderRadius: 2,
                    backgroundColor: theme.colors.borderLight,
                    alignSelf: 'center', marginTop: 10, marginBottom: 4,
                  }}
                />
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, paddingVertical: 12,
                  justifyContent: 'space-between',
                }}>
                  <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
                    {t.reminders.pickCustomer}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setCustomerPickerOpen(false);
                      setTimeout(() => router.push('/customer-form'), 300);
                    }}
                  >
                    <Ionicons name="add-circle" size={28} color={theme.colors.accent} />
                  </Pressable>
                </View>
              </View>

              <SearchBar
                value={customerSearch}
                onChangeText={setCustomerSearch}
                containerStyle={{ marginHorizontal: 16, marginBottom: 8 }}
              />

              <FlatList
                data={filteredCustomers}
                keyExtractor={(c) => c.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
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
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: theme.colors.primary + '30',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="person" size={18} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {item.plate_number} • {item.vehicle_brand}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            </Animated.View>
          </Pressable>
        </Pressable>
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
                {/* Category — inline dropdown (menghindari double-Modal Android) */}
                <View style={{ marginBottom: 8 }}>
                  <Pressable
                    onPress={() => {
                      setShowCategoryPicker(!showCategoryPicker);
                      setCategorySearch('');
                      setShowCategoryInput(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: theme.colors.cardLight,
                      borderRadius: showCategoryPicker ? theme.radius.md : theme.radius.md,
                      borderBottomLeftRadius: showCategoryPicker ? 0 : theme.radius.md,
                      borderBottomRightRadius: showCategoryPicker ? 0 : theme.radius.md,
                      borderWidth: 1,
                      borderColor: showCategoryPicker ? theme.colors.accent : theme.colors.border,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ flex: 1, color: customSpCategory ? theme.colors.text : theme.colors.textMuted, fontSize: 15 }}>
                      {customSpCategory || t.spareparts.selectCategory}
                    </Text>
                    <Ionicons
                      name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={showCategoryPicker ? theme.colors.accent : theme.colors.textMuted}
                    />
                  </Pressable>

                  {showCategoryPicker && (
                    <View style={{
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderTopWidth: 0,
                      borderColor: theme.colors.accent,
                      borderBottomLeftRadius: theme.radius.md,
                      borderBottomRightRadius: theme.radius.md,
                    }}>
                      {/* Search */}
                      <View style={{ padding: 8 }}>
                        <View style={{
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: theme.colors.cardLight,
                          borderRadius: theme.radius.md,
                          borderWidth: 1, borderColor: theme.colors.border,
                          paddingHorizontal: 10, height: 38,
                        }}>
                          <Ionicons name="search" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
                          <TextInput
                            value={categorySearch}
                            onChangeText={setCategorySearch}
                            placeholder={t.spareparts.searchCategory}
                            placeholderTextColor={theme.colors.textMuted}
                            style={{ flex: 1, color: theme.colors.text, fontSize: 13 }}
                          />
                        </View>
                      </View>

                      {/* Input tambah kategori baru */}
                      {showCategoryInput && (
                        <View style={{ paddingHorizontal: 8, paddingBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <View style={{
                            flex: 1, flexDirection: 'row', alignItems: 'center',
                            backgroundColor: theme.colors.cardLight,
                            borderRadius: theme.radius.md,
                            borderWidth: 1, borderColor: theme.colors.accent,
                            paddingHorizontal: 10,
                          }}>
                            <TextInput
                              value={newCategory}
                              onChangeText={setNewCategory}
                              placeholder={t.spareparts.newCategoryPlaceholder}
                              placeholderTextColor={theme.colors.textMuted}
                              autoFocus
                              style={{ flex: 1, color: theme.colors.text, fontSize: 13, paddingVertical: 8 }}
                            />
                          </View>
                          <Pressable
                            onPress={() => {
                              if (newCategory.trim()) {
                                setCustomSpCategory(newCategory.trim());
                                setNewCategory('');
                                setShowCategoryInput(false);
                                setShowCategoryPicker(false);
                                setCategorySearch('');
                              }
                            }}
                            disabled={!newCategory.trim()}
                            style={({ pressed }) => ({
                              width: 36, height: 36, borderRadius: theme.radius.md,
                              backgroundColor: newCategory.trim() ? theme.colors.accent : theme.colors.border,
                              alignItems: 'center', justifyContent: 'center',
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Ionicons name="checkmark" size={18} color="#fff" />
                          </Pressable>
                        </View>
                      )}

                      {/* Daftar kategori */}
                      <ScrollView
                        nestedScrollEnabled
                        style={{ maxHeight: 160 }}
                        keyboardShouldPersistTaps="handled"
                      >
                        <Pressable
                          onPress={() => setShowCategoryInput(!showCategoryInput)}
                          style={({ pressed }) => ({
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                            paddingHorizontal: 12, paddingVertical: 10,
                            backgroundColor: pressed || showCategoryInput ? theme.colors.accent + '18' : 'transparent',
                            borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
                          })}
                        >
                          <Ionicons name={showCategoryInput ? 'close-circle' : 'add-circle'} size={16} color={theme.colors.accent} />
                          <Text style={{ color: theme.colors.accent, fontWeight: '600', fontSize: 13 }}>
                            {t.spareparts.addNewCategory}
                          </Text>
                        </Pressable>

                        {filteredCategories.length === 0 ? (
                          <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12, fontSize: 13 }}>
                            {categorySearch ? t.spareparts.notFound : t.spareparts.empty}
                          </Text>
                        ) : (
                          filteredCategories.map((cat) => (
                            <Pressable
                              key={cat}
                              onPress={() => {
                                setCustomSpCategory(cat);
                                setShowCategoryPicker(false);
                                setCategorySearch('');
                                setShowCategoryInput(false);
                              }}
                              style={({ pressed }) => ({
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                paddingHorizontal: 12, paddingVertical: 10,
                                borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
                                backgroundColor: pressed
                                  ? theme.colors.cardLight
                                  : customSpCategory === cat ? theme.colors.accent + '12' : 'transparent',
                              })}
                            >
                              <Text style={{
                                color: customSpCategory === cat ? theme.colors.accent : theme.colors.text,
                                fontSize: 14, fontWeight: customSpCategory === cat ? '700' : '500',
                              }}>
                                {cat}
                              </Text>
                              {customSpCategory === cat && (
                                <Ionicons name="checkmark" size={15} color={theme.colors.accent} />
                              )}
                            </Pressable>
                          ))
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
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
                    onPress={() => !isOut && openQtyDiscountModal(item)}
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
      </Modal>

      {/* Kasir confirm modal */}
      <Modal
        visible={confirmModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
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
              overflow: 'hidden',
            }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
              {t.transactions.validationTitle}
            </Text>

            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Services */}
              {services.length > 0 && (
                <>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Jasa</Text>
                  <View style={{ gap: 0, marginBottom: 12 }}>
                    {services.map((s, i) => (
                      <View
                        key={i}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingVertical: 8,
                          borderBottomWidth: i === services.length - 1 ? 0 : 1,
                          borderBottomColor: theme.colors.divider,
                        }}
                      >
                        <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                          {s.service_name}
                        </Text>
                        <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700', marginLeft: 8 }}>
                          {formatCurrency(s.price)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {/* Spareparts */}
              {parts.length > 0 && (
                <>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t.transactions.itemDetails}</Text>
                  <View style={{ gap: 0, marginBottom: 12 }}>
                    {parts.map((p, i) => (
                      <View
                        key={i}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
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
                          {p.discount_per_item > 0 && (
                            <Text style={{ color: theme.colors.danger, fontSize: 11 }}>
                              Diskon -{formatCurrency(p.discount_per_item)} /item = -{formatCurrency(p.discount_per_item * p.quantity)}
                            </Text>
                          )}
                        </View>
                        <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700', marginLeft: 8 }}>
                          {formatCurrency((p.sell_price - p.discount_per_item) * p.quantity)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Totals */}
              <View
                style={{
                  backgroundColor: theme.colors.cardLight,
                  borderRadius: theme.radius.lg,
                  padding: 14,
                  gap: 8,
                }}
              >
                {totalDiscount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.danger, fontSize: 13 }}>Total Diskon Item</Text>
                    <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                      -{formatCurrency(totalDiscount)}
                    </Text>
                  </View>
                )}
                {customDiscount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.danger, fontSize: 13 }}>Diskon Custom</Text>
                    <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                      -{formatCurrency(customDiscount)}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: (totalDiscount > 0 || customDiscount > 0) ? 1 : 0, borderTopColor: theme.colors.divider, paddingTop: (totalDiscount > 0 || customDiscount > 0) ? 8 : 0 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Total Bayar</Text>
                  <Text style={{ color: theme.colors.accent, fontSize: 15, fontWeight: '800' }}>
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
        </KeyboardAvoidingView>
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
