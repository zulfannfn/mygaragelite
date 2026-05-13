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
import {
    PAYMENT_METHODS,
    SERVICE_PRESETS,
    TRANSACTION_STATUS,
} from '../src/constants/config';
import { theme } from '../src/constants/theme';
import { customerService } from '../src/services/customerService';
import { employeeService } from '../src/services/employeeService';
import { receiptService } from '../src/services/receiptService';
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
  const [notes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [status, setStatus] = useState<TransactionStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [loading, setLoading] = useState(false);
  const [savedTx, setSavedTx] = useState<Transaction | null>(null);
  const [actionBusy, setActionBusy] = useState<'print' | 'wa' | null>(null);
  const [waModalOpen, setWaModalOpen] = useState(false);

  // Items mode: 'now' fills jasa+sparepart now, 'later' just creates the order (pending) and items added later from detail.
  const [itemsMode, setItemsMode] = useState<'now' | 'later'>('now');

  // Picker modals
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [sparepartPickerOpen, setSparepartPickerOpen] = useState(false);
  const [sparepartSearch, setSparepartSearch] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');

  useEffect(() => {
    customerService.getAll().then(setCustomers);
    sparepartService.getAll().then(setSpareparts);
    employeeService.getMechanics().then(setMechanics);
  }, []);

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

  const addCustomService = () => {
    if (!customServiceName.trim()) return;
    setServices((prev) => [
      ...prev,
      { service_name: customServiceName.trim(), price: parseCurrency(customServicePrice) },
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

  const save = async () => {
    if (!selectedCustomer) {
      showToast('Pilih pelanggan dulu', 'error');
      return;
    }
    if (itemsMode === 'now' && services.length === 0 && parts.length === 0) {
      showToast('Tambahkan minimal 1 jasa atau sparepart', 'error');
      return;
    }
    // 'later' mode: force pending status, no items required
    const finalStatus: TransactionStatus = itemsMode === 'later' ? 'pending' : status;
    const finalServices = itemsMode === 'later' ? [] : services;
    const finalParts = itemsMode === 'later' ? [] : parts;
    setLoading(true);
    try {
      const created = await add({
        customer_id: selectedCustomer.id,
        mechanic_id: selectedMechanicId,
        mechanic_notes: notes.trim(),
        complaint: complaint.trim(),
        recommendation: recommendation.trim(),
        status: finalStatus,
        payment_method: finalStatus === 'paid' ? paymentMethod : null,
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
    setSavedTx(null);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Transaksi Servis" showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }}>
          {/* Items mode toggle */}
          <Text style={sectionTitle}>Mode Pengisian</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <Pressable
              onPress={() => setItemsMode('now')}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 80,
                padding: 12,
                borderRadius: theme.radius.lg,
                backgroundColor:
                  itemsMode === 'now' ? theme.colors.accent + '18' : theme.colors.card,
                borderWidth: 2,
                borderColor:
                  itemsMode === 'now' ? theme.colors.accent : theme.colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name="create"
                  size={18}
                  color={
                    itemsMode === 'now' ? theme.colors.accent : theme.colors.textSecondary
                  }
                />
                <Text
                  style={{
                    color:
                      itemsMode === 'now' ? theme.colors.text : theme.colors.textSecondary,
                    fontWeight: '700',
                    fontSize: 14,
                  }}
                >
                  Isi Sekarang
                </Text>
              </View>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 11,
                  marginTop: 4,
                  lineHeight: 14,
                }}
              >
                Isi jasa & sparepart sekarang
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setItemsMode('later')}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 80,
                padding: 12,
                borderRadius: theme.radius.lg,
                backgroundColor:
                  itemsMode === 'later' ? theme.colors.warning + '18' : theme.colors.card,
                borderWidth: 2,
                borderColor:
                  itemsMode === 'later' ? theme.colors.warning : theme.colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name="time"
                  size={18}
                  color={
                    itemsMode === 'later'
                      ? theme.colors.warning
                      : theme.colors.textSecondary
                  }
                />
                <Text
                  style={{
                    color:
                      itemsMode === 'later'
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                    fontWeight: '700',
                    fontSize: 14,
                  }}
                >
                  Isi Nanti
                </Text>
              </View>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 11,
                  marginTop: 4,
                  lineHeight: 14,
                }}
              >
                Buat order dulu, isi item nanti
              </Text>
            </Pressable>
          </View>

          {/* Customer */}
          <Text style={sectionTitle}>Pelanggan</Text>
          <Card style={{ marginBottom: 16 }} onPress={() => setCustomerPickerOpen(true)}>
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
                <Text style={{ color: theme.colors.textSecondary }}>Pilih pelanggan...</Text>
              </View>
            )}
          </Card>

          {/* Mekanik (opsional) */}
          <Text style={sectionTitle}>Mekanik (opsional)</Text>
          <Card style={{ marginBottom: 16 }} padding="sm">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable
                onPress={() => setSelectedMechanicId(null)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: theme.radius.full,
                  backgroundColor:
                    selectedMechanicId === null ? theme.colors.accent : theme.colors.cardLight,
                  borderWidth: 1,
                  borderColor:
                    selectedMechanicId === null ? theme.colors.accent : theme.colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: selectedMechanicId === null ? '#fff' : theme.colors.textSecondary,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  Tidak ditentukan
                </Text>
              </Pressable>
              {mechanics.map((m) => {
                const sel = m.id === selectedMechanicId;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setSelectedMechanicId(m.id)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: theme.radius.full,
                      backgroundColor: sel ? theme.colors.accent : theme.colors.cardLight,
                      borderWidth: 1,
                      borderColor: sel ? theme.colors.accent : theme.colors.border,
                      opacity: pressed ? 0.7 : 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    })}
                  >
                    <Ionicons name="construct" size={12} color={sel ? '#fff' : theme.colors.textMuted} />
                    <Text
                      style={{
                        color: sel ? '#fff' : theme.colors.text,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {m.name}
                    </Text>
                  </Pressable>
                );
              })}
              {mechanics.length === 0 && (
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, padding: 4 }}>
                  Belum ada mekanik. Tambah di Settings → Kelola Karyawan.
                </Text>
              )}
            </View>
          </Card>

          {/* Keluhan Pelanggan */}
          <Text style={sectionTitle}>Keluhan Pelanggan</Text>
          <Input
            value={complaint}
            onChangeText={setComplaint}
            placeholder="Mis. Mesin terasa kasar, rem kurang pakem..."
            multiline
            numberOfLines={3}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          {itemsMode === 'later' && (
            <Card
              style={{ marginBottom: 16, backgroundColor: theme.colors.warning + '15' }}
              padding="sm"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name="information-circle"
                  size={18}
                  color={theme.colors.warning}
                />
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 12,
                    flex: 1,
                    lineHeight: 16,
                  }}
                >
                  Mode <Text style={{ fontWeight: '800' }}>Isi Nanti</Text> — order akan
                  disimpan dengan status <Text style={{ fontWeight: '800' }}>Pending</Text>.
                  Tambahkan jasa & sparepart dari halaman detail transaksi.
                </Text>
              </View>
            </Card>
          )}

          {/* Services */}
          {itemsMode === 'now' && (
          <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 }}>
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
          {services.length === 0 ? (
            <Card style={{ marginBottom: 12 }}>
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                Belum ada jasa
              </Text>
            </Card>
          ) : (
            services.map((s, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingBottom: i === services.length - 1 ? 0 : 12,
                  borderBottomWidth: i === services.length - 1 ? 0 : 1,
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
                <Pressable
                  onPress={() => removeService(i)}
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
              </View>
            ))
          )}

          {/* Spareparts */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              marginBottom: 8,
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
          {parts.length === 0 ? (
            <Card style={{ marginBottom: 12 }}>
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                Belum ada sparepart
              </Text>
            </Card>
          ) : (
            parts.map((p, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingBottom: i === parts.length - 1 ? 0 : 12,
                  borderBottomWidth: i === parts.length - 1 ? 0 : 1,
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={() => updatePartQty(i, -1)}
                    style={qtyBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="remove" size={18} color="#fff" />
                  </Pressable>
                  <Text
                    style={{
                      color: theme.colors.text,
                      minWidth: 24,
                      textAlign: 'center',
                      fontWeight: '700',
                      fontSize: 15,
                    }}
                  >
                    {p.quantity}
                  </Text>
                  <Pressable
                    onPress={() => updatePartQty(i, 1)}
                    style={qtyBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => removePart(i)}
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
                  <Ionicons name="trash" size={16} color={theme.colors.danger} />
                </Pressable>
              </View>
            ))
          )}
          </>
          )}

          {/* Notes */}
          <Text style={[sectionTitle, { marginTop: 16 }]}>Catatan Internal Mekanik</Text>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Mis. Cek rem juga, ada bunyi aneh... (tidak dicetak ke struk)"
            multiline
            numberOfLines={3}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          {/* Recommendation */}
          <Text style={[sectionTitle, { marginTop: 8 }]}>Rekomendasi Servis Berikutnya</Text>
          <Input
            value={recommendation}
            onChangeText={setRecommendation}
            placeholder="Mis. Cek kampas rem 1 bulan lagi, ganti oli pada 2.000 km berikutnya..."
            multiline
            numberOfLines={3}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          {/* Status (only when filling now; later mode is auto-pending) */}
          {itemsMode === 'now' && (
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
        </ScrollView>

        {/* Footer Total + Save */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.surface,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            padding: 16,
            paddingBottom: 24,
            gap: 8,
          }}
        >
          {itemsMode === 'now' ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Jasa</Text>
                <Text style={{ color: theme.colors.text }}>{formatCurrency(totalService)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Sparepart</Text>
                <Text style={{ color: theme.colors.text }}>{formatCurrency(totalSparepart)}</Text>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="time" size={14} color={theme.colors.warning} />
              <Text style={{ color: theme.colors.warning, fontSize: 12, fontWeight: '700' }}>
                Mode Isi Nanti — item akan ditambahkan dari detail
              </Text>
            </View>
          )}
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
            title={itemsMode === 'later' ? 'Buat Order Servis' : 'Simpan Transaksi'}
            onPress={save}
            loading={loading}
            size="lg"
            fullWidth
            style={{ marginTop: 4 }}
            icon={
              <Ionicons
                name={itemsMode === 'later' ? 'add-circle' : 'save'}
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
              <Card
                onPress={() => {
                  setSelectedCustomer(item);
                  setCustomerPickerOpen(false);
                }}
                style={{ marginBottom: 8 }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {item.plate_number} • {item.vehicle_brand}
                </Text>
              </Card>
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
            <Text style={sectionTitle}>Preset</Text>
            {SERVICE_PRESETS.map((s, i) => (
              <Pressable
                key={i}
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
            ))}

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
                Total {savedTx ? formatCurrency(savedTx.total_amount) : ''} • Kirim struk ke pelanggan?
              </Text>
            </View>

            <View style={{ gap: 10 }}>
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
              <Button
                title="Selesai"
                variant="ghost"
                fullWidth
                onPress={finishAndBack}
              />
            </View>
            {!savedTx?.customer_phone && (
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
  marginBottom: 8,
};

const qtyBtn = {
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: theme.colors.primary,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
