import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { AdBanner, RewardAd } from '../src/components/ui/AdBanner';
import { Card } from '../src/components/ui/Card';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { financialReportService } from '../src/services/financialReportService';
import { operationalCostService } from '../src/services/operationalCostService';
import { reportService } from '../src/services/reportService';
import { settingsService } from '../src/services/settingsService';
import { CashierStats, FinancialReportData, MechanicShareItem, OperationalCost } from '../src/types';
import { checkOnline } from '../src/utils/network';
import { formatCompactCurrency, formatCurrency, parseCurrency } from '../src/utils/currency';
import { endOfDay, endOfMonth, formatDate, startOfDay, startOfMonth } from '../src/utils/date';

// ── Types ─────────────────────────────────────────────────────────────────────
type Period = 'today' | 'week' | 'month' | 'last_month' | 'custom';
type ShareSource = 'all' | 'service' | 'margin';
interface MechShareConfig { source: ShareSource; pct: string; }

// ── Date helpers ──────────────────────────────────────────────────────────────
function startOfWeek(): number {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfLastMonth(): number {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function endOfLastMonth(): number {
  const d = new Date();
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
function getPeriodRange(period: Period, customStart: number, customEnd: number): [number, number] {
  const now = Date.now();
  switch (period) {
    case 'today':      return [startOfDay(now), endOfDay(now)];
    case 'week':       return [startOfWeek(), endOfDay(now)];
    case 'month':      return [startOfMonth(now), endOfMonth(now)];
    case 'last_month': return [startOfLastMonth(), endOfLastMonth()];
    case 'custom':     return [customStart, customEnd];
  }
}
function fmt(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today',      label: 'Hari Ini' },
  { key: 'week',       label: 'Minggu Ini' },
  { key: 'month',      label: 'Bulan Ini' },
  { key: 'last_month', label: 'Bulan Lalu' },
  { key: 'custom',     label: 'Custom' },
];
const OPEX_CATEGORIES = ['Listrik', 'Air', 'Sewa', 'Gaji Staf', 'BBM', 'Internet', 'Lainnya'];
const SOURCE_LABEL: Record<ShareSource, string> = { all: 'Semua', service: 'Jasa', margin: 'Margin SP' };

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionTitle({ icon, label, color, theme }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; color: string; theme: any;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <View style={{
        width: 32, height: 32, borderRadius: 9,
        backgroundColor: color + '22',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function Row({ label, value, color, bold, indent, theme }: {
  label: string; value: string; color?: string; bold?: boolean; indent?: boolean; theme: any;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{
        color: theme.colors.textSecondary, fontSize: 13,
        fontWeight: bold ? '700' : '500', flex: 1,
        paddingLeft: indent ? 12 : 0,
      }}>
        {label}
      </Text>
      <Text style={{ color: color ?? theme.colors.text, fontSize: bold ? 15 : 13, fontWeight: bold ? '800' : '600' }}>
        {value}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function FinancialReportScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Period
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState(startOfMonth());
  const [customEnd, setCustomEnd] = useState(endOfMonth());
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [tempStart, setTempStart] = useState(customStart);
  const [tempEnd, setTempEnd] = useState(customEnd);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);

  // Report data
  const [data, setData] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cashiers, setCashiers] = useState<CashierStats[]>([]);
  const [expandedCashier, setExpandedCashier] = useState<string | null>(null);

  // Mechanic share configs (editable inline, persisted to settings)
  const [mechConfigs, setMechConfigs] = useState<Record<string, MechShareConfig>>({});

  // Add operational cost modal
  const [addOpexOpen, setAddOpexOpen] = useState(false);
  const [opexName, setOpexName] = useState('');
  const [opexCategory, setOpexCategory] = useState('Lainnya');
  const [opexAmount, setOpexAmount] = useState('');
  const [opexDate, setOpexDate] = useState(Date.now());
  const [opexNotes, setOpexNotes] = useState('');
  const [savingOpex, setSavingOpex] = useState(false);
  const [opexDatePickerOpen, setOpexDatePickerOpen] = useState(false);

  // Check internet + show reward ad on page open
  useEffect(() => {
    checkOnline().then((online) => {
      if (!online) {
        Alert.alert(
          'Koneksi Internet Diperlukan',
          'Laporan Keuangan Lengkap membutuhkan koneksi internet. Silakan aktifkan koneksi dan coba lagi.',
          [{ text: 'OK', onPress: () => router.back() }],
          { cancelable: false }
        );
        return;
      }
      RewardAd.show();
    });
  }, []);

  // Load saved mechanic configs once on mount
  useEffect(() => {
    settingsService.get('mech_share_configs').then((raw) => {
      if (raw) setMechConfigs(JSON.parse(raw));
    });
  }, []);

  const updateMechConfig = useCallback(async (mechId: string, patch: Partial<MechShareConfig>) => {
    setMechConfigs((prev) => {
      const next = {
        ...prev,
        [mechId]: { ...(prev[mechId] ?? { source: 'all' as ShareSource, pct: '10' }), ...patch },
      };
      settingsService.set('mech_share_configs', JSON.stringify(next));
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [start, end] = getPeriodRange(period, customStart, customEnd);
    const [result, cashierData] = await Promise.all([
      financialReportService.getReport(start, end),
      reportService.getTopCashiers(20, start, end),
    ]);
    setData(result);
    setCashiers(cashierData);
    setLoading(false);
  }, [period, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  // Compute per-mechanic share from local configs (real-time, no need to reload)
  const getMechComputed = (m: MechanicShareItem) => {
    const cfg = mechConfigs[m.id] ?? { source: 'all' as ShareSource, pct: '10' };
    const pct = Math.min(100, Math.max(0, parseFloat(cfg.pct) || 0));
    const base = cfg.source === 'service' ? m.serviceRevenue
      : cfg.source === 'margin' ? m.sparepartMargin
      : m.serviceRevenue + m.sparepartMargin;
    return { cfg, pctNum: pct, base, shareAmount: base * pct / 100 };
  };

  const localTotalMechanicShare = data
    ? data.mechanics.reduce((s, m) => s + getMechComputed(m).shareAmount, 0)
    : 0;
  const totalExpenseLocal = localTotalMechanicShare + (data?.totalOperationalCost ?? 0);
  const netProfitLocal = (data?.grossIncome ?? 0) - totalExpenseLocal;
  const profitMarginLocal = (data?.omzet ?? 0) > 0 ? (netProfitLocal / data!.omzet) * 100 : 0;

  // Add opex handler
  const handleAddOpex = async () => {
    if (!opexName.trim()) { Alert.alert('Nama wajib diisi'); return; }
    const amount = parseCurrency(opexAmount);
    if (!amount) { Alert.alert('Jumlah wajib diisi'); return; }
    setSavingOpex(true);
    try {
      await operationalCostService.create({
        name: opexName.trim(), category: opexCategory,
        amount, cost_date: opexDate, notes: opexNotes.trim(),
      });
      setAddOpexOpen(false);
      setOpexName(''); setOpexCategory('Lainnya'); setOpexAmount('');
      setOpexNotes(''); setOpexDate(Date.now());
      await load();
    } finally { setSavingOpex(false); }
  };

  const handleDeleteOpex = (item: OperationalCost) => {
    Alert.alert('Hapus Biaya?', `Hapus "${item.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        await operationalCostService.delete(item.id);
        await load();
      }},
    ]);
  };

  const divider = <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 1 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Laporan Keuangan" subtitle="Lengkap" showBack />

      {/* ── Period filter tabs ─────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingTop: 10,
        paddingBottom: 10,
      }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
          }}
        >
          {PERIODS.map((p, i) => {
            const active = period === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => {
                  if (p.key === 'custom') {
                    setTempStart(customStart);
                    setTempEnd(customEnd);
                    setCustomModalOpen(true);
                  } else {
                    setPeriod(p.key);
                  }
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  marginRight: i < PERIODS.length - 1 ? 8 : 0,
                  backgroundColor: active ? theme.colors.accent : theme.colors.cardLight,
                  borderWidth: 1.5,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text style={{
                  color: active ? '#fff' : theme.colors.textSecondary,
                  fontSize: 13,
                  fontWeight: active ? '700' : '500',
                }}>
                  {p.key === 'custom' && period === 'custom'
                    ? `${fmt(customStart)} – ${fmt(customEnd)}`
                    : p.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40 + Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 34),
          gap: 12,
        }}
      >
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={{ color: theme.colors.textMuted, marginTop: 12 }}>Menghitung...</Text>
          </View>
        ) : !data ? null : (
          <>
            {/* ── OMZET ──────────────────────────────────────────────────── */}
            <View style={{
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.lg,
              padding: 18,
            }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                OMZET PERIODE INI
              </Text>
              <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 }}>
                {formatCurrency(data.omzet)}
              </Text>
              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 0 }}>
                  {[
                    { label: 'Sparepart', val: data.sparepartRevenue },
                    { label: 'HPP', val: data.sparepartCost },
                    { label: 'Diskon', val: data.totalDiscount },
                  ].map((item, idx, arr) => (
                    <View key={item.label} style={{
                      flex: 1,
                      paddingRight: idx < arr.length - 1 ? 12 : 0,
                      borderRightWidth: idx < arr.length - 1 ? 1 : 0,
                      borderRightColor: 'rgba(255,255,255,0.15)',
                      paddingLeft: idx > 0 ? 12 : 0,
                    }}>
                      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>{item.label}</Text>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                        {formatCompactCurrency(item.val)}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 0 }}>
                  {[
                    { label: 'Margin SP', val: data.sparepartMargin },
                    { label: 'Jasa', val: data.serviceRevenue },
                  ].map((item, idx, arr) => (
                    <View key={item.label} style={{
                      flex: 1,
                      paddingRight: idx < arr.length - 1 ? 12 : 0,
                      borderRightWidth: idx < arr.length - 1 ? 1 : 0,
                      borderRightColor: 'rgba(255,255,255,0.15)',
                      paddingLeft: idx > 0 ? 12 : 0,
                    }}>
                      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>{item.label}</Text>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                        {formatCompactCurrency(item.val)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* ── PENDAPATAN KOTOR ──────────────────────────────────────── */}
            <Card>
              <SectionTitle icon="trending-up" label="Pendapatan Kotor" color={theme.colors.success} theme={theme} />
              <Row label="Pendapatan Jasa"       value={formatCurrency(data.serviceRevenue)}  color={theme.colors.accent}  theme={theme} />
              {divider}
              <Row label="Margin Sparepart"       value={formatCurrency(data.sparepartMargin)} color={theme.colors.warning} theme={theme} />
              <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 6 }} />
              <Row label="Total Pendapatan Kotor" value={formatCurrency(data.grossIncome)}    color={theme.colors.success} bold theme={theme} />
            </Card>

            {/* ── GAJI MEKANIK ──────────────────────────────────────────── */}
            <Card>
              <SectionTitle icon="construct" label="Gaji Mekanik" color={theme.colors.accent} theme={theme} />

              {data.mechanics.length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 16, fontSize: 13 }}>
                  Tidak ada mekanik pada periode ini
                </Text>
              ) : (
                <>
                  {data.mechanics.map((m, i) => {
                    const { cfg, shareAmount } = getMechComputed(m);
                    return (
                      <View
                        key={m.id}
                        style={{
                          paddingVertical: 14,
                          borderBottomWidth: i < data.mechanics.length - 1 ? 1 : 0,
                          borderBottomColor: theme.colors.divider,
                          gap: 10,
                        }}
                      >
                        {/* Name */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{
                            width: 32, height: 32, borderRadius: 16,
                            backgroundColor: theme.colors.accent + '22',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Ionicons name="person" size={15} color={theme.colors.accent} />
                          </View>
                          <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                            {m.name}
                          </Text>
                        </View>

                        {/* Revenue breakdown mini cards */}
                        <View style={{ flexDirection: 'row', gap: 6, paddingLeft: 42 }}>
                          {[
                            { label: 'Total',     value: m.revenue,          color: theme.colors.accent },
                            { label: 'Jasa',      value: m.serviceRevenue,   color: theme.colors.primary },
                            { label: 'Margin SP', value: m.sparepartMargin,  color: theme.colors.warning },
                          ].map((item) => (
                            <View key={item.label} style={{
                              flex: 1, backgroundColor: theme.colors.cardLight,
                              borderRadius: 8, padding: 7, alignItems: 'center',
                            }}>
                              <Text style={{ color: theme.colors.textMuted, fontSize: 9, marginBottom: 3 }}>
                                {item.label}
                              </Text>
                              <Text style={{ color: item.color, fontSize: 11, fontWeight: '700' }}>
                                {formatCompactCurrency(item.value)}
                              </Text>
                            </View>
                          ))}
                        </View>

                        {/* Pembagian hasil calculator */}
                        <View style={{
                          marginLeft: 42,
                          backgroundColor: theme.colors.cardLight,
                          borderRadius: 10,
                          padding: 10,
                          gap: 8,
                        }}>
                          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                            Pembagian Hasil
                          </Text>

                          {/* Source chips */}
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {([
                              { key: 'all'     as ShareSource, label: 'Semua' },
                              { key: 'service' as ShareSource, label: 'Jasa' },
                              { key: 'margin'  as ShareSource, label: 'Margin SP' },
                            ]).map((src) => {
                              const active = cfg.source === src.key;
                              return (
                                <Pressable
                                  key={src.key}
                                  onPress={() => updateMechConfig(m.id, { source: src.key })}
                                  style={{
                                    paddingHorizontal: 9, paddingVertical: 4,
                                    borderRadius: 7,
                                    backgroundColor: active ? theme.colors.success + '22' : theme.colors.card,
                                    borderWidth: 1,
                                    borderColor: active ? theme.colors.success : theme.colors.border,
                                  }}
                                >
                                  <Text style={{
                                    fontSize: 11, fontWeight: active ? '700' : '500',
                                    color: active ? theme.colors.success : theme.colors.textSecondary,
                                  }}>
                                    {src.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          {/* % input + result */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{
                              flexDirection: 'row', alignItems: 'center',
                              backgroundColor: theme.colors.card,
                              borderRadius: 8, borderWidth: 1,
                              borderColor: theme.colors.border,
                              paddingHorizontal: 10, height: 36,
                              gap: 4, flex: 1,
                            }}>
                              <TextInput
                                value={cfg.pct}
                                onChangeText={(v) => {
                                  const cleaned = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                  const num = parseFloat(cleaned);
                                  if (cleaned === '' || cleaned === '.' || (num >= 0 && num <= 100)) {
                                    updateMechConfig(m.id, { pct: cleaned });
                                  }
                                }}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                                placeholder="0"
                                placeholderTextColor={theme.colors.textMuted}
                                style={{
                                  flex: 1, color: theme.colors.text,
                                  fontSize: 14, fontWeight: '700', padding: 0,
                                }}
                              />
                              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>%</Text>
                            </View>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                              dari {SOURCE_LABEL[cfg.source]}
                            </Text>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>=</Text>
                            <View style={{
                              flex: 2, backgroundColor: theme.colors.success + '18',
                              borderRadius: 8, borderWidth: 1,
                              borderColor: theme.colors.success + '44',
                              paddingHorizontal: 10, height: 36,
                              justifyContent: 'center',
                            }}>
                              <Text style={{ color: theme.colors.success, fontSize: 13, fontWeight: '800' }}>
                                {formatCompactCurrency(shareAmount)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  <View style={{ height: 1, backgroundColor: theme.colors.border, marginTop: 6, marginBottom: 2 }} />
                  <Row
                    label="Total Gaji Mekanik"
                    value={formatCurrency(localTotalMechanicShare)}
                    color={theme.colors.accent}
                    bold
                    theme={theme}
                  />
                </>
              )}
            </Card>

            {/* ── PERFORMA KASIR ────────────────────────────────────────── */}
            <Card>
              <SectionTitle icon="person" label="Performa Kasir" color={theme.colors.primary} theme={theme} />
              {loading ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : cashiers.length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 16, fontSize: 13 }}>
                  Tidak ada data kasir pada periode ini
                </Text>
              ) : (
                <>
                  {cashiers.map((cashier, i) => {
                    const isExpanded = expandedCashier === (cashier.cashier_id ?? 'none');
                    return (
                      <View
                        key={cashier.cashier_id ?? 'none'}
                        style={{ paddingVertical: 12, borderBottomWidth: i < cashiers.length - 1 ? 1 : 0, borderBottomColor: theme.colors.divider, gap: 8 }}
                      >
                        <Pressable
                          onPress={() => setExpandedCashier(isExpanded ? null : (cashier.cashier_id ?? 'none'))}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                        >
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? theme.colors.success : theme.colors.cardLight, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{i + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>{cashier.cashier_name}</Text>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{cashier.transaction_count} transaksi</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '800' }}>{formatCompactCurrency(cashier.total_revenue)}</Text>
                          </View>
                          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textMuted} />
                        </Pressable>
                        {isExpanded && cashier.payment_methods.length > 0 && (
                          <View style={{ marginLeft: 40, backgroundColor: theme.colors.cardLight, borderRadius: 10, padding: 10, gap: 6 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>Metode Pembayaran</Text>
                            {cashier.payment_methods.map((pm) => (
                              <View key={pm.method} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name={pm.method === 'Tunai' ? 'cash' : pm.method === 'Transfer' ? 'swap-horizontal' : pm.method === 'QRIS' ? 'qr-code' : 'card'} size={13} color={theme.colors.textSecondary} />
                                <Text style={{ color: theme.colors.text, fontSize: 12, flex: 1 }}>{pm.method}</Text>
                                <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{pm.count}x</Text>
                                <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>{formatCompactCurrency(pm.total)}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </Card>

            {/* ── BIAYA OPERASIONAL ─────────────────────────────────────── */}
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 9,
                    backgroundColor: theme.colors.danger + '22',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="receipt" size={16} color={theme.colors.danger} />
                  </View>
                  <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>Biaya Operasional</Text>
                </View>
                <Pressable
                  onPress={() => setAddOpexOpen(true)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 10, paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: theme.colors.danger + '18',
                    borderWidth: 1,
                    borderColor: theme.colors.danger + '44',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="add" size={14} color={theme.colors.danger} />
                  <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '700' }}>Tambah</Text>
                </Pressable>
              </View>

              {data.operationalCosts.length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 16, fontSize: 13 }}>
                  Belum ada biaya operasional
                </Text>
              ) : (
                <>
                  {data.operationalCosts.map((c, i) => (
                    <View key={c.id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}>
                        <View style={{
                          width: 32, height: 32, borderRadius: 8,
                          backgroundColor: theme.colors.cardLight,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Ionicons name="pricetag" size={14} color={theme.colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>{c.name}</Text>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                            {c.category} · {fmt(c.cost_date)}
                          </Text>
                        </View>
                        <Text style={{ color: theme.colors.danger, fontSize: 14, fontWeight: '700' }}>
                          {formatCurrency(c.amount)}
                        </Text>
                        <Pressable
                          onPress={() => handleDeleteOpex(c)}
                          hitSlop={8}
                          style={({ pressed }) => ({
                            width: 30, height: 30, borderRadius: 8,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: pressed ? theme.colors.danger + '22' : 'transparent',
                          })}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                        </Pressable>
                      </View>
                      {i < data.operationalCosts.length - 1 && divider}
                    </View>
                  ))}
                  <View style={{ height: 1, backgroundColor: theme.colors.border, marginTop: 6, marginBottom: 2 }} />
                  <Row
                    label="Total Biaya Operasional"
                    value={formatCurrency(data.totalOperationalCost)}
                    color={theme.colors.danger}
                    bold
                    theme={theme}
                  />
                </>
              )}
            </Card>

            {/* ── RINGKASAN KEUANGAN ────────────────────────────────────── */}
            <Card>
              <SectionTitle icon="bar-chart" label="Ringkasan Keuangan" color={theme.colors.primary} theme={theme} />

              <Row label="Omzet"                  value={formatCurrency(data.omzet)}               theme={theme} />
              {divider}
              <Row label="Pendapatan Kotor"        value={formatCurrency(data.grossIncome)}          color={theme.colors.success} theme={theme} />
              {divider}
              <Row label="(−) Gaji Mekanik"        value={formatCurrency(localTotalMechanicShare)}   color={theme.colors.accent}  theme={theme} indent />
              {divider}
              <Row label="(−) Biaya Operasional"   value={formatCurrency(data.totalOperationalCost)} color={theme.colors.danger}  theme={theme} indent />
              {divider}
              <Row label="Total Biaya"              value={formatCurrency(totalExpenseLocal)}          theme={theme} />

              <View style={{ height: 1.5, backgroundColor: theme.colors.border, marginVertical: 12 }} />

              <View style={{
                backgroundColor: (netProfitLocal >= 0 ? theme.colors.success : theme.colors.danger) + '14',
                borderRadius: 12, padding: 14,
                borderWidth: 1,
                borderColor: (netProfitLocal >= 0 ? theme.colors.success : theme.colors.danger) + '40',
                gap: 10,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={netProfitLocal >= 0 ? 'trending-up' : 'trending-down'}
                      size={18}
                      color={netProfitLocal >= 0 ? theme.colors.success : theme.colors.danger}
                    />
                    <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>Laba Bersih</Text>
                  </View>
                  <Text style={{
                    color: netProfitLocal >= 0 ? theme.colors.success : theme.colors.danger,
                    fontSize: 20, fontWeight: '800',
                  }}>
                    {formatCurrency(netProfitLocal)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Margin Laba</Text>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
                    backgroundColor: (netProfitLocal >= 0 ? theme.colors.success : theme.colors.danger) + '22',
                  }}>
                    <Text style={{
                      color: netProfitLocal >= 0 ? theme.colors.success : theme.colors.danger,
                      fontSize: 14, fontWeight: '800',
                    }}>
                      {profitMarginLocal.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
            {/* ── BANNER AD ────────────────────────────────────────────── */}
            <AdBanner />
          </>
        )}
      </ScrollView>

      {/* ── Custom Range Modal ─────────────────────────────────────────────── */}
      <Modal visible={customModalOpen} transparent animationType="fade" onRequestClose={() => setCustomModalOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 20 }}
          onPress={() => { setCustomModalOpen(false); setDatePickerTarget(null); }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 20, padding: 20,
              borderWidth: 1, borderColor: theme.colors.border,
            }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>
              Pilih Rentang Tanggal
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {(['start', 'end'] as const).map((target) => {
                const ts = target === 'start' ? tempStart : tempEnd;
                const active = datePickerTarget === target;
                return (
                  <Pressable
                    key={target}
                    onPress={() => setDatePickerTarget(active ? null : target)}
                    style={({ pressed }) => ({
                      flex: 1, height: 52, borderRadius: 10,
                      backgroundColor: active ? theme.colors.accent + '18' : theme.colors.cardLight,
                      borderWidth: 1.5,
                      borderColor: active ? theme.colors.accent : theme.colors.border,
                      alignItems: 'center', justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                      {target === 'start' ? 'Dari' : 'Sampai'}
                    </Text>
                    <Text style={{ color: active ? theme.colors.accent : theme.colors.text, fontSize: 13, fontWeight: '700' }}>
                      {fmt(ts)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {datePickerTarget !== null && Platform.OS === 'ios' && (
              <DateTimePicker
                value={new Date(datePickerTarget === 'start' ? tempStart : tempEnd)}
                mode="date" display="spinner"
                onChange={(_, d) => {
                  if (!d) return;
                  const x = new Date(d);
                  if (datePickerTarget === 'start') { x.setHours(0,0,0,0); setTempStart(x.getTime()); }
                  else { x.setHours(23,59,59,999); setTempEnd(x.getTime()); }
                }}
                style={{ height: 120 }}
              />
            )}
            {datePickerTarget !== null && Platform.OS === 'android' && (
              <DateTimePicker
                value={new Date(datePickerTarget === 'start' ? tempStart : tempEnd)}
                mode="date" display="default"
                onChange={(ev, d) => {
                  setDatePickerTarget(null);
                  if (ev.type === 'set' && d) {
                    const x = new Date(d);
                    if (datePickerTarget === 'start') { x.setHours(0,0,0,0); setTempStart(x.getTime()); }
                    else { x.setHours(23,59,59,999); setTempEnd(x.getTime()); }
                  }
                }}
              />
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => {
                  setCustomStart(tempStart);
                  setCustomEnd(tempEnd);
                  setPeriod('custom');
                  setCustomModalOpen(false);
                  setDatePickerTarget(null);
                }}
                style={({ pressed }) => ({
                  flex: 1, backgroundColor: theme.colors.accent,
                  paddingVertical: 13, borderRadius: 12,
                  alignItems: 'center', opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Terapkan</Text>
              </Pressable>
              <Pressable
                onPress={() => { setCustomModalOpen(false); setDatePickerTarget(null); }}
                style={({ pressed }) => ({
                  flex: 1, backgroundColor: theme.colors.cardLight,
                  paddingVertical: 13, borderRadius: 12,
                  alignItems: 'center', opacity: pressed ? 0.8 : 1,
                  borderWidth: 1, borderColor: theme.colors.border,
                })}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 14 }}>Batal</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Add Biaya Operasional modal ────────────────────────────────────── */}
      <Modal visible={addOpexOpen} transparent animationType="slide" onRequestClose={() => setAddOpexOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}
            onPress={() => setAddOpexOpen(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                paddingTop: 8,
                paddingBottom: Math.max(24, insets.bottom + 16),
              }}
            >
              <View style={{
                width: 40, height: 4, borderRadius: 2,
                backgroundColor: theme.colors.borderLight,
                alignSelf: 'center', marginBottom: 14,
              }} />
              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '800' }}>
                  Tambah Biaya Operasional
                </Text>

                <View>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 7 }}>NAMA BIAYA</Text>
                  <TextInput
                    value={opexName} onChangeText={setOpexName}
                    placeholder="Mis. Tagihan Listrik April"
                    placeholderTextColor={theme.colors.textMuted}
                    style={{
                      backgroundColor: theme.colors.card,
                      borderWidth: 1, borderColor: theme.colors.border,
                      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                      color: theme.colors.text, fontSize: 14,
                    }}
                  />
                </View>

                <View>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>KATEGORI</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row', gap: 7 }}
                  >
                    {OPEX_CATEGORIES.map((cat) => {
                      const active = opexCategory === cat;
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => setOpexCategory(cat)}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
                            backgroundColor: active ? theme.colors.danger + '22' : theme.colors.card,
                            borderWidth: 1, borderColor: active ? theme.colors.danger : theme.colors.border,
                          }}
                        >
                          <Text style={{ color: active ? theme.colors.danger : theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                            {cat}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <View>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 7 }}>JUMLAH (Rp)</Text>
                  <TextInput
                    value={opexAmount}
                    onChangeText={(v) => setOpexAmount(v.replace(/[^0-9]/g, ''))}
                    placeholder="0" keyboardType="numeric"
                    placeholderTextColor={theme.colors.textMuted}
                    style={{
                      backgroundColor: theme.colors.card,
                      borderWidth: 1, borderColor: theme.colors.border,
                      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                      color: theme.colors.text, fontSize: 16, fontWeight: '700',
                    }}
                  />
                  {!!opexAmount && (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      {formatCurrency(parseInt(opexAmount || '0', 10))}
                    </Text>
                  )}
                </View>

                <View>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 7 }}>TANGGAL</Text>
                  <Pressable
                    onPress={() => setOpexDatePickerOpen(true)}
                    style={({ pressed }) => ({
                      backgroundColor: theme.colors.card,
                      borderWidth: 1, borderColor: theme.colors.border,
                      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={{ color: theme.colors.text, fontSize: 14 }}>{formatDate(opexDate)}</Text>
                  </Pressable>
                  {opexDatePickerOpen && (
                    <DateTimePicker
                      value={new Date(opexDate)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(ev, d) => {
                        if (Platform.OS === 'android') setOpexDatePickerOpen(false);
                        if (d) { const x = new Date(d); x.setHours(12,0,0,0); setOpexDate(x.getTime()); }
                      }}
                    />
                  )}
                  {Platform.OS === 'ios' && opexDatePickerOpen && (
                    <Pressable onPress={() => setOpexDatePickerOpen(false)} style={{ alignItems: 'center', paddingVertical: 8 }}>
                      <Text style={{ color: theme.colors.accent, fontWeight: '700' }}>Selesai</Text>
                    </Pressable>
                  )}
                </View>

                <View>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 7 }}>CATATAN (opsional)</Text>
                  <TextInput
                    value={opexNotes} onChangeText={setOpexNotes}
                    placeholder="Catatan tambahan..."
                    placeholderTextColor={theme.colors.textMuted}
                    multiline numberOfLines={2}
                    style={{
                      backgroundColor: theme.colors.card,
                      borderWidth: 1, borderColor: theme.colors.border,
                      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                      color: theme.colors.text, fontSize: 14, minHeight: 60,
                    }}
                  />
                </View>

                <Pressable
                  onPress={handleAddOpex}
                  disabled={savingOpex}
                  style={({ pressed }) => ({
                    backgroundColor: theme.colors.danger,
                    paddingVertical: 14, borderRadius: 12,
                    alignItems: 'center', marginTop: 4,
                    opacity: pressed || savingOpex ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                    {savingOpex ? 'Menyimpan...' : 'Simpan Biaya'}
                  </Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
