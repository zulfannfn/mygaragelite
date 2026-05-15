import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { useTheme } from '../../src/contexts/ThemeContext';
import { exportService } from '../../src/services/exportService';
import { reportService } from '../../src/services/reportService';
import { transactionService } from '../../src/services/transactionService';
import { useAppStore } from '../../src/store/useAppStore';
import { PaymentMethodTotal, ReportData, TopMechanic, TopService, TopSparepart } from '../../src/types';
import { formatCompactCurrency, formatCurrency } from '../../src/utils/currency';
type SectionKey = 'service' | 'sparepart' | 'mechanic' | 'paymentMethod' | 'category';

interface DateRange {
  start?: number;
  end?: number;
}

interface DateInput {
  d: string;
  m: string;
  y: string;
}

function formatDateInput(ts?: number): DateInput {
  if (!ts) return { d: '', m: '', y: '' };
  const date = new Date(ts);
  return {
    d: String(date.getDate()).padStart(2, '0'),
    m: String(date.getMonth() + 1).padStart(2, '0'),
    y: String(date.getFullYear()),
  };
}

function parseDateInput(input: DateInput): number | undefined {
  const day = parseInt(input.d, 10);
  const month = parseInt(input.m, 10) - 1;
  const year = parseInt(input.y, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year) || !input.d || !input.m || !input.y) return undefined;
  const date = new Date(year, month, day, 0, 0, 0, 0);
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) return undefined;
  return date.getTime();
}

function formatShortDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function emptyDateInput(): DateInput {
  return { d: '', m: '', y: '' };
}

function Chart({ daily, maxDaily, theme }: { daily: ReportData[]; maxDaily: number; theme: any }) {
  const [width, setWidth] = useState(0);
  const chartHeight = 120;
  const paddingX = 16;
  const paddingY = 8;

  const getX = (i: number) => {
    if (daily.length <= 1) return paddingX;
    return paddingX + (i / (daily.length - 1)) * (width - paddingX * 2);
  };
  const getY = (val: number) => {
    return paddingY + chartHeight - paddingY * 2 - (val / maxDaily) * (chartHeight - paddingY * 2);
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ width: '100%', height: chartHeight, position: 'relative' }}>
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio, idx) => (
          <View
            key={`grid-${idx}`}
            style={{
              position: 'absolute',
              left: paddingX,
              right: paddingX,
              top: paddingY + (1 - ratio) * (chartHeight - paddingY * 2),
              height: 1,
              backgroundColor: theme.colors.divider,
            }}
          />
        ))}
        {/* Service line segments */}
        {daily.slice(0, -1).map((_, i) => {
          const x1 = getX(i);
          const y1 = getY(daily[i].serviceRevenue);
          const x2 = getX(i + 1);
          const y2 = getY(daily[i + 1].serviceRevenue);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={`svc-line-${i}`}
              style={{
                position: 'absolute',
                left: x1,
                top: y1,
                width: length,
                height: 2,
                backgroundColor: theme.colors.accent,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: '0 50%',
              }}
            />
          );
        })}
        {/* Retail line segments */}
        {daily.slice(0, -1).map((_, i) => {
          const x1 = getX(i);
          const y1 = getY(daily[i].retailRevenue);
          const x2 = getX(i + 1);
          const y2 = getY(daily[i + 1].retailRevenue);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={`rtl-line-${i}`}
              style={{
                position: 'absolute',
                left: x1,
                top: y1,
                width: length,
                height: 2,
                backgroundColor: theme.colors.success,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: '0 50%',
              }}
            />
          );
        })}
        {/* Service dots */}
        {daily.map((d, i) => (
          <View
            key={`svc-dot-${i}`}
            style={{
              position: 'absolute',
              left: getX(i) - 4,
              top: getY(d.serviceRevenue) - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.colors.accent,
              borderWidth: 1.5,
              borderColor: theme.colors.card,
            }}
          />
        ))}
        {/* Retail dots */}
        {daily.map((d, i) => (
          <View
            key={`rtl-dot-${i}`}
            style={{
              position: 'absolute',
              left: getX(i) - 4,
              top: getY(d.retailRevenue) - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.colors.success,
              borderWidth: 1.5,
              borderColor: theme.colors.card,
            }}
          />
        ))}
      </View>
      {/* X axis labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: paddingX - 8 }}>
        {daily.map((d, i) => (
          <Text key={i} style={{ color: theme.colors.textMuted, fontSize: 9, textAlign: 'center', width: 32 }}>
            {d.date}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const showToast = useAppStore((s) => s.showToast);
  const { theme } = useTheme();
  const [daily, setDaily] = useState<ReportData[]>([]);
  const [monthly, setMonthly] = useState<ReportData[]>([]);
  const [topSp, setTopSp] = useState<TopSparepart[]>([]);
  const [topSvc, setTopSvc] = useState<TopService[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [topSpLimit, setTopSpLimit] = useState(20);
  const [topSvcLimit, setTopSvcLimit] = useState(20);
  const [topMechLimit, setTopMechLimit] = useState(20);

  const [topSvcSort, setTopSvcSort] = useState<'sold' | 'revenue'>('sold');
  const [topSpSort, setTopSpSort] = useState<'sold' | 'revenue'>('sold');
  const [topSpType, setTopSpType] = useState<'all' | 'service' | 'retail'>('all');
  const [sortModal, setSortModal] = useState<'service' | 'sparepart' | 'mechanic' | 'paymentMethod' | null>(null);

  const [paymentMethodData, setPaymentMethodData] = useState<PaymentMethodTotal[]>([]);
  const [paymentMethodType, setPaymentMethodType] = useState<'all' | 'service' | 'retail'>('all');

  const [topMech, setTopMech] = useState<TopMechanic[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);

  const [ranges, setRanges] = useState<Record<SectionKey, DateRange>>({
    service: {},
    sparepart: {},
    mechanic: {},
    paymentMethod: {},
    category: {},
  });

  const [tempStart, setTempStart] = useState<DateInput>(emptyDateInput());
  const [tempEnd, setTempEnd] = useState<DateInput>(emptyDateInput());

  const load = useCallback(async () => {
    setLoading(true);
    const [d, m, t, s, mech, pm, cat] = await Promise.all([
      reportService.getDailyReport(7),
      reportService.getMonthlyReport(12),
      reportService.getTopServices(topSvcLimit, ranges.service.start, ranges.service.end),
      reportService.getTopSpareparts(topSpLimit, ranges.sparepart.start, ranges.sparepart.end, topSpType),
      reportService.getTopMechanics(topMechLimit, ranges.mechanic.start, ranges.mechanic.end),
      reportService.getPaymentMethodTotals(ranges.paymentMethod.start, ranges.paymentMethod.end, paymentMethodType),
      reportService.getCategoryStats(10, ranges.category.start, ranges.category.end),
    ]);
    setDaily(d);
    setMonthly(m);
    setTopSvc(t);
    setTopSp(s);
    setTopMech(mech);
    setPaymentMethodData(pm);
    setCategoryStats(cat);
    setLoading(false);
  }, [topSvcLimit, topSpLimit, topMechLimit, topSpType, paymentMethodType, ranges]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const todayData = daily[daily.length - 1];
  const todayRevenue = todayData?.revenue ?? 0;
  const todayServiceRev = todayData?.serviceRevenue ?? 0;
  const todayRetailRev = todayData?.retailRevenue ?? 0;
  const totalWeekRevenue = daily.reduce((s, x) => s + x.revenue, 0);
  const totalWeekServiceRev = daily.reduce((s, x) => s + x.serviceRevenue, 0);
  const totalWeekRetailRev = daily.reduce((s, x) => s + x.retailRevenue, 0);
  const monthData = monthly[monthly.length - 1];
  const totalMonthRevenue = monthData?.revenue ?? 0;
  const totalMonthServiceRev = monthData?.serviceRevenue ?? 0;
  const totalMonthRetailRev = monthData?.retailRevenue ?? 0;
  const maxDaily = Math.max(...daily.map((d) => Math.max(d.serviceRevenue, d.retailRevenue)), 1);

  const exportCSV = async () => {
    try {
      setExporting(true);
      const tx = await transactionService.getAll();
      await exportService.exportTransactionsToCSV(tx);
      showToast('Berhasil export CSV', 'success');
    } catch (e: any) {
      console.error('Export error:', e);
      showToast('Gagal export: ' + (e?.message ?? 'Unknown error'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 100 + (Platform.OS === 'android' ? 48 : 34) }}
    >
      <ScreenHeader title="Laporan" subtitle="Statistik & analitik bengkel" />

      {/* Summary cards */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 }}>
        {/* HARI INI */}
        <Card style={{ flex: 1 }} padding={14}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            HARI INI
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 6, gap: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>Service</Text>
              <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(todayServiceRev)}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>Kasir</Text>
              <Text style={{ color: theme.colors.success, fontSize: 13, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(todayRetailRev)}
              </Text>
            </View>
          </View>
        </Card>
        {/* 7 HARI */}
        <Card style={{ flex: 1 }} padding={14}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            7 HARI
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 6, gap: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>Service</Text>
              <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(totalWeekServiceRev)}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>Kasir</Text>
              <Text style={{ color: theme.colors.success, fontSize: 13, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(totalWeekRetailRev)}
              </Text>
            </View>
          </View>
        </Card>
        {/* BULAN INI */}
        <Card style={{ flex: 1 }} padding={14}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            BULAN INI
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 6, gap: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>Service</Text>
              <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(totalMonthServiceRev)}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.colors.divider }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>Kasir</Text>
              <Text style={{ color: theme.colors.success, fontSize: 13, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(totalMonthRetailRev)}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Daily chart */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
              Pendapatan 7 Hari Terakhir
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: theme.colors.accent }} />
                <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Service</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: theme.colors.success }} />
                <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Kasir</Text>
              </View>
            </View>
          </View>
          {loading ? (
            <Skeleton height={120} />
          ) : daily.length === 0 || maxDaily === 0 ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 40 }}>
              Belum ada data
            </Text>
          ) : (
            <Chart daily={daily} maxDaily={maxDaily} theme={theme} />
          )}
        </Card>
      </View>

      {/* Monthly */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 15,
              fontWeight: '700',
              marginBottom: 12,
            }}
          >
            Pendapatan Per Bulan
          </Text>
          {loading ? (
            <Skeleton height={80} />
          ) : (
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              {monthly.map((m, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: i < monthly.length - 1 ? 1 : 0,
                    borderBottomColor: theme.colors.divider,
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: 14 }}>{m.date}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                        {formatCurrency(m.serviceRevenue)}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>
                        {m.serviceCount} svc
                      </Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: theme.colors.divider, height: 20 }} />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.colors.success, fontSize: 13, fontWeight: '700' }}>
                        {formatCurrency(m.retailRevenue)}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>
                        {m.retailCount} ksr
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>

      {/* Payment method totals */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              💳 Metode Pembayaran
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(formatDateInput(ranges.paymentMethod.start));
                setTempEnd(formatDateInput(ranges.paymentMethod.end));
                setSortModal('paymentMethod');
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.cardLight,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="funnel" size={12} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                {ranges.paymentMethod.start || ranges.paymentMethod.end
                  ? `${formatShortDate(ranges.paymentMethod.start)} - ${formatShortDate(ranges.paymentMethod.end)}`
                  : 'Semua'}
              </Text>
            </Pressable>
          </View>

          {/* Type toggle chips */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
            {[
              { key: 'all', label: 'Semua' },
              { key: 'service', label: 'Service' },
              { key: 'retail', label: 'Kasir' },
            ].map((chip) => {
              const active = paymentMethodType === (chip.key as typeof paymentMethodType);
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => setPaymentMethodType(chip.key as typeof paymentMethodType)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: theme.radius.md,
                    backgroundColor: active ? theme.colors.primary : theme.colors.cardLight,
                  }}
                >
                  <Text
                    style={{
                      color: active ? '#fff' : theme.colors.textSecondary,
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <Skeleton height={40} />
          ) : paymentMethodData.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
              Belum ada data
            </Text>
          ) : (
            <View style={{ gap: 0 }}>
              {paymentMethodData.map((pm, i) => (
                <View
                  key={pm.method}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: i < paymentMethodData.length - 1 ? 1 : 0,
                    borderBottomColor: theme.colors.divider,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name={
                        pm.method === 'Tunai' ? 'cash' :
                        pm.method === 'Transfer' ? 'swap-horizontal' :
                        pm.method === 'QRIS' ? 'qr-code' :
                        pm.method === 'Debit' ? 'card' :
                        'cash'
                      }
                      size={16}
                      color={theme.colors.accent}
                    />
                    <View>
                      <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                        {pm.method}
                      </Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                        {pm.count} transaksi
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '700' }}>
                    {formatCurrency(pm.total)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>

      {/* Top services */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              🏆 Jasa Terlaris
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(formatDateInput(ranges.service.start));
                setTempEnd(formatDateInput(ranges.service.end));
                setSortModal('service');
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.cardLight,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="funnel" size={12} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                {topSvcSort === 'sold' ? 'Terjual' : 'Pendapatan'}
                {' · '}
                {ranges.service.start || ranges.service.end
                  ? `${formatShortDate(ranges.service.start)} - ${formatShortDate(ranges.service.end)}`
                  : 'Semua'}
              </Text>
            </Pressable>
          </View>
          {loading ? (
            <Skeleton height={60} />
          ) : topSvc.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
              Belum ada data
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {[...topSvc]
                .sort((a, b) => (topSvcSort === 'sold' ? b.totalSold - a.totalSold : b.revenue - a.revenue))
                .map((sv, i) => (
                <View
                  key={sv.name + i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    gap: 12,
                    borderBottomWidth: i < topSvc.length - 1 ? 1 : 0,
                    borderBottomColor: theme.colors.divider,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor:
                        i === 0 ? theme.colors.accent : theme.colors.cardLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                      {sv.name}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                      Terjual: {sv.totalSold}
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                    {formatCompactCurrency(sv.revenue)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>

      {/* Top spareparts */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              🏆 Sparepart Terlaris
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(formatDateInput(ranges.sparepart.start));
                setTempEnd(formatDateInput(ranges.sparepart.end));
                setSortModal('sparepart');
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.cardLight,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="funnel" size={12} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                {topSpSort === 'sold' ? 'Terjual' : 'Pendapatan'}
                {' · '}
                {ranges.sparepart.start || ranges.sparepart.end
                  ? `${formatShortDate(ranges.sparepart.start)} - ${formatShortDate(ranges.sparepart.end)}`
                  : 'Semua'}
              </Text>
            </Pressable>
          </View>
          {/* Type filter chips */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            {[
              { key: 'all', label: 'Semua' },
              { key: 'service', label: 'Service' },
              { key: 'retail', label: 'Kasir' },
            ].map((chip) => {
              const active = topSpType === (chip.key as typeof topSpType);
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => setTopSpType(chip.key as typeof topSpType)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: theme.radius.md,
                    backgroundColor: active ? theme.colors.accent + '22' : theme.colors.cardLight,
                    borderWidth: 1,
                    borderColor: active ? theme.colors.accent : theme.colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: active ? '700' : '600',
                      color: active ? theme.colors.accent : theme.colors.textSecondary,
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {loading ? (
            <Skeleton height={60} />
          ) : topSp.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
              Belum ada data
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {[...topSp]
                .sort((a, b) => (topSpSort === 'sold' ? b.totalSold - a.totalSold : b.revenue - a.revenue))
                .map((sp, i) => (
                <View
                  key={sp.id ?? i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    gap: 12,
                    borderBottomWidth: i < topSp.length - 1 ? 1 : 0,
                    borderBottomColor: theme.colors.divider,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor:
                        i === 0 ? theme.colors.warning : theme.colors.cardLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                      {sp.name}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                      Terjual: {sp.totalSold}
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                    {formatCompactCurrency(sp.revenue)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>

      {/* Category Stats */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              📦 Pendapatan per Kategori
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(formatDateInput(ranges.category.start));
                setTempEnd(formatDateInput(ranges.category.end));
                setSortModal('category');
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.cardLight,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="funnel" size={12} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                Transaksi
                {' · '}
                {ranges.category.start || ranges.category.end
                  ? `${formatShortDate(ranges.category.start)} - ${formatShortDate(ranges.category.end)}`
                  : 'Semua'}
              </Text>
            </Pressable>
          </View>
          {loading ? (
            <Skeleton height={150} />
          ) : categoryStats.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 20 }}>
              Belum ada data
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              {categoryStats.map((cat, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: i < categoryStats.length - 1 ? 1 : 0,
                    borderBottomColor: theme.colors.divider,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                      {cat.category}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      {cat.itemsSold} item terjual
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontSize: 15,
                      fontWeight: '700',
                      marginLeft: 12,
                    }}
                  >
                    {formatCompactCurrency(cat.totalRevenue)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>

      {/* Top mechanics */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              🏆 Mekanik Perform
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(formatDateInput(ranges.mechanic.start));
                setTempEnd(formatDateInput(ranges.mechanic.end));
                setSortModal('mechanic');
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.cardLight,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="funnel" size={12} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                Transaksi
                {' · '}
                {ranges.mechanic.start || ranges.mechanic.end
                  ? `${formatShortDate(ranges.mechanic.start)} - ${formatShortDate(ranges.mechanic.end)}`
                  : 'Semua'}
              </Text>
            </Pressable>
          </View>
          {loading ? (
            <Skeleton height={60} />
          ) : topMech.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
              Belum ada data
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {topMech.map((mech, i) => (
                <View
                  key={mech.id ?? i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    gap: 12,
                    borderBottomWidth: i < topMech.length - 1 ? 1 : 0,
                    borderBottomColor: theme.colors.divider,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor:
                        i === 0 ? theme.colors.success : theme.colors.cardLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                      {mech.name}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                      {mech.transactionCount} transaksi
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                    {formatCompactCurrency(mech.revenue)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>

      {/* Filter Modal: Sort + Date Range */}
      <Modal
        visible={sortModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModal(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={() => setSortModal(null)}
        >
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.xl,
              padding: 20,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            {sortModal !== 'mechanic' && sortModal !== 'paymentMethod' && (
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginBottom: 16,
                }}
              >
                Urutkan Berdasarkan
              </Text>
            )}
            {sortModal !== 'mechanic' && sortModal !== 'paymentMethod' &&
              [
                { key: 'sold', label: 'Terjual Terbanyak', icon: 'cart' },
                { key: 'revenue', label: 'Pendapatan Terbesar', icon: 'cash' },
              ].map((opt) => {
                const active =
                  sortModal === 'service'
                    ? topSvcSort === opt.key
                    : topSpSort === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      if (sortModal === 'service') {
                        setTopSvcSort(opt.key as 'sold' | 'revenue');
                      } else {
                        setTopSpSort(opt.key as 'sold' | 'revenue');
                      }
                      setSortModal(null);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: theme.radius.lg,
                      backgroundColor: pressed
                        ? theme.colors.cardLight
                        : active
                          ? theme.colors.accent + '18'
                          : theme.colors.card,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.accent : theme.colors.border,
                    })}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={18}
                      color={active ? theme.colors.accent : theme.colors.textMuted}
                    />
                    <Text
                      style={{
                        color: active ? theme.colors.accent : theme.colors.text,
                        fontWeight: active ? '700' : '600',
                        fontSize: 14,
                      }}
                    >
                      {opt.label}
                    </Text>
                    {active && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={theme.colors.accent}
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </Pressable>
                );
              })}

            <Text
              style={{
                color: theme.colors.text,
                fontSize: 14,
                fontWeight: '700',
                marginTop: 12,
                marginBottom: 10,
              }}
            >
              Rentang Tanggal
            </Text>
            <View style={{ gap: 10 }}>
              <View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
                  Dari
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {(['d', 'm', 'y'] as const).map((k) => (
                    <TextInput
                      key={k}
                      value={tempStart[k]}
                      onChangeText={(text) => {
                        const numeric = text.replace(/\D/g, '');
                        setTempStart((prev) => ({ ...prev, [k]: numeric }));
                      }}
                      placeholder={k === 'd' ? 'DD' : k === 'm' ? 'MM' : 'YYYY'}
                      maxLength={k === 'y' ? 4 : 2}
                      keyboardType="number-pad"
                      style={{
                        flex: 1,
                        minWidth: k === 'y' ? 80 : 60,
                        height: 42,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.cardLight,
                        color: theme.colors.text,
                        paddingHorizontal: 10,
                        fontSize: 14,
                        textAlign: 'center',
                      }}
                    />
                  ))}
                </View>
              </View>
              <View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
                  Sampai
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {(['d', 'm', 'y'] as const).map((k) => (
                    <TextInput
                      key={k}
                      value={tempEnd[k]}
                      onChangeText={(text) => {
                        const numeric = text.replace(/\D/g, '');
                        setTempEnd((prev) => ({ ...prev, [k]: numeric }));
                      }}
                      placeholder={k === 'd' ? 'DD' : k === 'm' ? 'MM' : 'YYYY'}
                      maxLength={k === 'y' ? 4 : 2}
                      keyboardType="number-pad"
                      style={{
                        flex: 1,
                        minWidth: k === 'y' ? 80 : 60,
                        height: 42,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.cardLight,
                        color: theme.colors.text,
                        paddingHorizontal: 10,
                        fontSize: 14,
                        textAlign: 'center',
                      }}
                    />
                  ))}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => {
                  const section = sortModal as SectionKey;
                  const start = parseDateInput(tempStart);
                  const end = parseDateInput(tempEnd);
                  setRanges((prev) => ({
                    ...prev,
                    [section]: { start, end },
                  }));
                  setSortModal(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.accent,
                  paddingVertical: 12,
                  borderRadius: theme.radius.lg,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Terapkan</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const section = sortModal as SectionKey;
                  setRanges((prev) => ({ ...prev, [section]: {} }));
                  setTempStart(emptyDateInput());
                  setTempEnd(emptyDateInput());
                  setSortModal(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.cardLight,
                  paddingVertical: 12,
                  borderRadius: theme.radius.lg,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14 }}>
                  Reset
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Export */}
      <View style={{ paddingHorizontal: 16, marginTop: 8, gap: 10 }}>
        <Button
          title="Export CSV / Excel"
          variant="secondary"
          onPress={exportCSV}
          loading={exporting}
          icon={<Ionicons name="grid" size={18} color="#fff" />}
          fullWidth
        />
      </View>
    </ScrollView>
  );
}
