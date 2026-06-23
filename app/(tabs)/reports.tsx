import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AdBanner, InterstitialAd, RewardAd } from '../../src/components/ui/AdBanner';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useTranslation } from '../../src/i18n';
import { exportService } from '../../src/services/exportService';
import { reportService } from '../../src/services/reportService';
import { settingsService } from '../../src/services/settingsService';
import { transactionService } from '../../src/services/transactionService';
import { useAppStore } from '../../src/store/useAppStore';
import { CashierStats, CategoryStats, CustomerLoyaltyItem, PaymentMethodTotal, ReportData, RevenueStats, TopMechanic, TopService, TopSparepart, VehicleTypeStats } from '../../src/types';
import { formatCompactCurrency, formatCurrency } from '../../src/utils/currency';
import { endOfDay, endOfMonth, endOfYear, formatDate, startOfDay, startOfMonth, startOfYear } from '../../src/utils/date';
type SectionKey = 'service' | 'sparepart' | 'mechanic' | 'paymentMethod' | 'category' | 'summary' | 'vehicle' | 'loyalty' | 'workshopLoyalty' | 'cashier';
type ShareSource = 'all' | 'service' | 'margin';
interface MechShareConfig { source: ShareSource; pct: string; }

interface DateRange {
  start?: number;
  end?: number;
}

function formatShortDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
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
  const router = useRouter();
  const t = useTranslation();
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
  const [sortModal, setSortModal] = useState<SectionKey | null>(null);

  const [paymentMethodData, setPaymentMethodData] = useState<PaymentMethodTotal[]>([]);
  const [paymentMethodType, setPaymentMethodType] = useState<'all' | 'service' | 'retail'>('all');

  const [topMech, setTopMech] = useState<TopMechanic[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [vehicleStats, setVehicleStats] = useState<VehicleTypeStats>({ motor: 0, mobil: 0 });
  const [customerLoyalty, setCustomerLoyalty] = useState<CustomerLoyaltyItem[]>([]);
  const [loyaltyType, setLoyaltyType] = useState<'all' | 'service' | 'retail'>('all');
  const [workshopLoyalty, setWorkshopLoyalty] = useState<CustomerLoyaltyItem[]>([]);
  const [workshopLoyaltyType, setWorkshopLoyaltyType] = useState<'all' | 'service' | 'retail'>('all');
  const [topCashiers, setTopCashiers] = useState<CashierStats[]>([]);
  const [expandedCashier, setExpandedCashier] = useState<string | null>(null);
  const [mechShareConfigs, setMechShareConfigs] = useState<Record<string, MechShareConfig>>({});
  const [revStats, setRevStats] = useState<RevenueStats>({
    totalRevenue: 0,
    serviceRevenue: 0,
    sparepartRevenue: 0,
    sparepartCost: 0,
    sparepartMargin: 0,
    grossProfit: 0,
    totalDiscount: 0,
    itemDiscount: 0,
    customDiscount: 0,
  });

  const [ranges, setRanges] = useState<Record<SectionKey, DateRange>>({
    service: {},
    sparepart: {},
    mechanic: {},
    paymentMethod: {},
    category: {},
    summary: {},
    vehicle: {},
    loyalty: {},
    workshopLoyalty: {},
    cashier: {},
  });

  const [tempStart, setTempStart] = useState<number | undefined>(undefined);
  const [tempEnd, setTempEnd] = useState<number | undefined>(undefined);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, m, t, s, mech, pm, cat, rev, cfgRaw, veh, loyalty, workshopLoy, cashiers] = await Promise.all([
      reportService.getDailyReport(7),
      reportService.getMonthlyReport(12),
      reportService.getTopServices(topSvcLimit, ranges.service.start, ranges.service.end),
      reportService.getTopSpareparts(topSpLimit, ranges.sparepart.start, ranges.sparepart.end, topSpType),
      reportService.getTopMechanics(topMechLimit, ranges.mechanic.start, ranges.mechanic.end),
      reportService.getPaymentMethodTotals(ranges.paymentMethod.start, ranges.paymentMethod.end, paymentMethodType),
      reportService.getCategoryStats(10, ranges.category.start, ranges.category.end),
      reportService.getRevenueStats(ranges.summary.start, ranges.summary.end),
      settingsService.get('mech_share_configs'),
      reportService.getVehicleTypeStats(ranges.vehicle.start, ranges.vehicle.end),
      reportService.getCustomerLoyalty(loyaltyType, ranges.loyalty.start, ranges.loyalty.end, 30, 'orang'),
      reportService.getCustomerLoyalty(workshopLoyaltyType, ranges.workshopLoyalty.start, ranges.workshopLoyalty.end, 30, 'bengkel'),
      reportService.getTopCashiers(20, ranges.cashier.start, ranges.cashier.end),
    ]);
    setDaily(d);
    setMonthly(m);
    setTopSvc(t);
    setTopSp(s);
    setTopMech(mech);
    setPaymentMethodData(pm);
    setCategoryStats(cat);
    setRevStats(rev);
    if (cfgRaw) {
      try { setMechShareConfigs(JSON.parse(cfgRaw)); } catch {}
    }
    setVehicleStats(veh);
    setCustomerLoyalty(loyalty);
    setWorkshopLoyalty(workshopLoy);
    setTopCashiers(cashiers);
    setLoading(false);
  }, [topSvcLimit, topSpLimit, topMechLimit, topSpType, paymentMethodType, loyaltyType, workshopLoyaltyType, ranges]);

  const updateMechConfig = useCallback(async (mechId: string, patch: Partial<MechShareConfig>) => {
    setMechShareConfigs((prev) => {
      const defaultConfig: MechShareConfig = { source: 'all', pct: '10' };
      const updated = {
        ...prev,
        [mechId]: { ...defaultConfig, ...prev[mechId], ...patch },
      };
      settingsService.set('mech_share_configs', JSON.stringify(updated));
      return updated;
    });
  }, []);

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
      const tx = await transactionService.getAllWithLineItems();
      if (tx.length === 0) {
        showToast(t.reports.exportCSVEmpty, 'error');
        return;
      }
      await exportService.exportTransactionsToCSV(tx);
      showToast(t.reports.exportCSVSuccess, 'success');
      await RewardAd.show();
    } catch (e: any) {
      console.error('Export error:', e);
      showToast(t.reports.exportCSVFailed + ': ' + (e?.message ?? 'Unknown error'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 100 + (Platform.OS === 'android' ? 48 : 34) }}
    >
      <ScreenHeader title={t.reports.title} subtitle={t.reports.subtitle} />

      {/* Summary cards */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 }}>
        {/* HARI INI */}
        <Card style={{ flex: 1 }} padding={14}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            {t.reports.today}
          </Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            <View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Service</Text>
              <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(todayServiceRev)}
              </Text>
            </View>
            <View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Kasir</Text>
              <Text style={{ color: theme.colors.success, fontSize: 14, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(todayRetailRev)}
              </Text>
            </View>
          </View>
        </Card>
        {/* 7 HARI */}
        <Card style={{ flex: 1 }} padding={14}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            {t.reports.sevenDays}
          </Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            <View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Service</Text>
              <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(totalWeekServiceRev)}
              </Text>
            </View>
            <View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Kasir</Text>
              <Text style={{ color: theme.colors.success, fontSize: 14, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(totalWeekRetailRev)}
              </Text>
            </View>
          </View>
        </Card>
        {/* BULAN INI */}
        <Card style={{ flex: 1 }} padding={14}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            {t.reports.thisMonth}
          </Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            <View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Service</Text>
              <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(totalMonthServiceRev)}
              </Text>
            </View>
            <View>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Kasir</Text>
              <Text style={{ color: theme.colors.success, fontSize: 14, fontWeight: '700' }}>
                {loading ? '...' : formatCompactCurrency(totalMonthRetailRev)}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Revenue Summary */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
              {t.reports.revenueSummary}
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(ranges.summary.start);
                setTempEnd(ranges.summary.end);
                setDatePickerTarget(null);
                setSortModal('summary');
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.md,
                backgroundColor: (ranges.summary.start || ranges.summary.end)
                  ? theme.colors.accent + '22'
                  : theme.colors.cardLight,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons
                name="funnel"
                size={12}
                color={(ranges.summary.start || ranges.summary.end) ? theme.colors.accent : theme.colors.textSecondary}
              />
              <Text style={{
                fontSize: 11,
                color: (ranges.summary.start || ranges.summary.end) ? theme.colors.accent : theme.colors.textSecondary,
                fontWeight: (ranges.summary.start || ranges.summary.end) ? '700' : '400',
              }}>
                {ranges.summary.start || ranges.summary.end
                  ? `${formatShortDate(ranges.summary.start)} - ${formatShortDate(ranges.summary.end)}`
                  : t.common.all}
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <Skeleton height={180} />
          ) : (
            <View style={{ gap: 0 }}>
              {/* Row: Total Pendapatan */}
              {[
                {
                  label: t.reports.totalRevenue,
                  value: revStats.totalRevenue,
                  color: theme.colors.text,
                  icon: 'wallet' as const,
                  iconColor: theme.colors.primary,
                  bold: true,
                },
                {
                  label: t.reports.serviceRevenue,
                  value: revStats.serviceRevenue,
                  color: theme.colors.accent,
                  icon: 'construct' as const,
                  iconColor: theme.colors.accent,
                  bold: false,
                },
                {
                  label: t.reports.sparepartRevenue,
                  value: revStats.sparepartRevenue,
                  color: theme.colors.success,
                  icon: 'cube' as const,
                  iconColor: theme.colors.success,
                  bold: false,
                },
                {
                  label: 'HPP Sparepart',
                  value: revStats.sparepartCost,
                  color: theme.colors.danger,
                  icon: 'receipt' as const,
                  iconColor: theme.colors.danger,
                  bold: false,
                  negate: true,
                },
                {
                  label: 'Diskon',
                  value: revStats.totalDiscount,
                  color: theme.colors.danger,
                  icon: 'pricetag' as const,
                  iconColor: theme.colors.danger,
                  bold: false,
                  negate: true,
                },
                {
                  label: t.reports.sparepartMargin,
                  value: revStats.sparepartMargin,
                  color: theme.colors.warning,
                  icon: 'trending-up' as const,
                  iconColor: theme.colors.warning,
                  bold: false,
                },
                {
                  label: t.reports.grossProfit,
                  value: revStats.grossProfit,
                  color: theme.colors.primary,
                  icon: 'star' as const,
                  iconColor: theme.colors.primary,
                  bold: true,
                },
              ].map((row, i, arr) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderBottomColor: theme.colors.divider,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      backgroundColor: row.iconColor + '18',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name={row.icon} size={14} color={row.iconColor} />
                    </View>
                    <Text style={{
                      color: theme.colors.text,
                      fontSize: 13,
                      fontWeight: row.bold ? '700' : '500',
                    }}>
                      {row.label}
                    </Text>
                  </View>
                  <Text style={{
                    color: row.color,
                    fontSize: row.bold ? 15 : 13,
                    fontWeight: row.bold ? '800' : '700',
                  }}>
                    {(row as any).negate && row.value > 0 ? '-' : ''}{formatCurrency(row.value)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>

      {/* Laporan Keuangan Lengkap button */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Pressable
          onPress={() => router.push('/financial-report')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.lg,
            paddingHorizontal: 18,
            paddingVertical: 16,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 11,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="bar-chart" size={20} color="#fff" />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Laporan Keuangan Lengkap</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 }}>
                Omzet · Laba · Gaji Mekanik · Biaya Operasional
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>

      {/* Daily chart */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
              {t.reports.last7DaysRevenue}
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
              {t.reports.noData}
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
            {t.reports.monthlyRevenue}
          </Text>
          {loading ? (
            <Skeleton height={80} />
          ) : (
            <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {monthly.filter(m => m.serviceRevenue > 0 || m.retailRevenue > 0).length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
                  {t.reports.noData}
                </Text>
              ) : (
                <View style={{ gap: 0 }}>
                  {monthly.filter(m => m.serviceRevenue > 0 || m.retailRevenue > 0).map((m, i, arr) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: i < arr.length - 1 ? 1 : 0,
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
                </View>
              )}
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
              💳 {t.reports.paymentMethods}
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(ranges.paymentMethod.start);
                setTempEnd(ranges.paymentMethod.end);
                setDatePickerTarget(null);
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
                  : t.common.all}
              </Text>
            </Pressable>
          </View>

          {/* Type toggle chips */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
            {[
              { key: 'all', label: t.common.all },
              { key: 'service', label: 'Service' },
              { key: 'retail', label: t.dashboard.cashier },
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
              {t.reports.noData}
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
                        {pm.count} {t.reports.transactions}
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
              🏆 {t.reports.topServices}
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(ranges.service.start);
                setTempEnd(ranges.service.end);
                setDatePickerTarget(null);
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
                {topSvcSort === 'sold' ? t.reports.sold : t.reports.revenue}
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
              {t.reports.noData}
            </Text>
          ) : (
            <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
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
                      {t.reports.sold}: {sv.totalSold}
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
              🏆 {t.reports.topSpareparts}
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(ranges.sparepart.start);
                setTempEnd(ranges.sparepart.end);
                setDatePickerTarget(null);
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
                {topSpSort === 'sold' ? t.reports.sold : t.reports.revenue}
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
              { key: 'all', label: t.common.all },
              { key: 'service', label: 'Service' },
              { key: 'retail', label: t.dashboard.cashier },
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
              {t.reports.noData}
            </Text>
          ) : (
            <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
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
                      {t.reports.sold}: {sp.totalSold}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Margin</Text>
                      <Text style={{ color: theme.colors.warning, fontSize: 12, fontWeight: '700' }}>
                        {formatCompactCurrency(sp.margin ?? 0)}
                      </Text>
                    </View>
                    <View style={{ width: 1, height: 24, backgroundColor: theme.colors.divider }} />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Pendapatan</Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>
                        {formatCompactCurrency(sp.revenue)}
                      </Text>
                    </View>
                  </View>
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
              📦 {t.reports.revenueByCategory}
            </Text>
            <Pressable
              onPress={() => {
                setTempStart(ranges.category.start);
                setTempEnd(ranges.category.end);
                setDatePickerTarget(null);
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
              {t.reports.noData}
            </Text>
          ) : (
            <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
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
                      {cat.itemsSold} {t.reports.itemsSold}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Margin</Text>
                      <Text style={{ color: theme.colors.warning, fontSize: 13, fontWeight: '700' }}>
                        {formatCompactCurrency(cat.margin ?? 0)}
                      </Text>
                    </View>
                    <View style={{ width: 1, height: 24, backgroundColor: theme.colors.divider }} />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>Pendapatan</Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>
                        {formatCompactCurrency(cat.totalRevenue)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>

      {/* Vehicle Type Donut */}
      {(() => {
        const total = vehicleStats.motor + vehicleStats.mobil;
        const motorPct = total > 0 ? vehicleStats.motor / total : 0;
        const mobilPct = total > 0 ? vehicleStats.mobil / total : 0;
        const motorDeg = motorPct * 360;
        return (
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
                  🚗 Jenis Kendaraan
                </Text>
                <Pressable
                  onPress={() => { setTempStart(ranges.vehicle.start); setTempEnd(ranges.vehicle.end); setDatePickerTarget(null); setSortModal('vehicle'); }}
                  hitSlop={8}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.md, backgroundColor: theme.colors.cardLight, opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="funnel" size={12} color={theme.colors.textSecondary} />
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                    {ranges.vehicle.start || ranges.vehicle.end ? `${formatShortDate(ranges.vehicle.start)} - ${formatShortDate(ranges.vehicle.end)}` : 'Semua'}
                  </Text>
                </Pressable>
              </View>
              {loading ? <Skeleton height={120} /> : total === 0 ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 20 }}>Belum ada data</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                  {/* Donut ring using nested Views */}
                  <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
                    {/* Outer ring Motor */}
                    <View style={{ position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: theme.colors.accent, overflow: 'hidden' }}>
                      {mobilPct > 0 && (
                        <View style={{ position: 'absolute', right: 0, bottom: 0, width: 100, height: 100, backgroundColor: theme.colors.success, transform: [{ rotate: `${motorDeg}deg` }], transformOrigin: '0 0' }} />
                      )}
                    </View>
                    {/* Inner hole */}
                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '800' }}>{total}</Text>
                      <Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>Total</Text>
                    </View>
                  </View>
                  {/* Legend */}
                  <View style={{ flex: 1, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: theme.colors.accent }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>Motor</Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{vehicleStats.motor} kendaraan</Text>
                      </View>
                      <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '800' }}>
                        {Math.round(motorPct * 100)}%
                      </Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: theme.colors.success }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>Mobil</Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{vehicleStats.mobil} kendaraan</Text>
                      </View>
                      <Text style={{ color: theme.colors.success, fontSize: 14, fontWeight: '800' }}>
                        {Math.round(mobilPct * 100)}%
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </Card>
          </View>
        );
      })()}

      {/* Filter Modal: Sort + Date Range */}
      <Modal
        visible={sortModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setDatePickerTarget(null); setSortModal(null); }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}
          onPress={() => { setDatePickerTarget(null); setSortModal(null); }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.xl,
              padding: 20,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            {/* Sort options — hanya untuk service & sparepart */}
            {(sortModal === 'service' || sortModal === 'sparepart') && (
              <>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
                  {t.reports.sortBy}
                </Text>
                {[
                  { key: 'sold', label: t.reports.mostSold, icon: 'cart' },
                  { key: 'revenue', label: t.reports.highestRevenue, icon: 'cash' },
                ].map((opt) => {
                  const active = sortModal === 'service' ? topSvcSort === opt.key : topSpSort === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => {
                        if (sortModal === 'service') setTopSvcSort(opt.key as 'sold' | 'revenue');
                        else setTopSpSort(opt.key as 'sold' | 'revenue');
                        setSortModal(null);
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        paddingVertical: 12, paddingHorizontal: 16, borderRadius: theme.radius.lg,
                        backgroundColor: pressed ? theme.colors.cardLight : active ? theme.colors.accent + '18' : theme.colors.card,
                        marginBottom: 8, borderWidth: 1, borderColor: active ? theme.colors.accent : theme.colors.border,
                      })}
                    >
                      <Ionicons name={opt.icon as any} size={18} color={active ? theme.colors.accent : theme.colors.textMuted} />
                      <Text style={{ color: active ? theme.colors.accent : theme.colors.text, fontWeight: active ? '700' : '600', fontSize: 14 }}>
                        {opt.label}
                      </Text>
                      {active && <Ionicons name="checkmark" size={18} color={theme.colors.accent} style={{ marginLeft: 'auto' }} />}
                    </Pressable>
                  );
                })}
                <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 12 }} />
              </>
            )}

            {/* Date range header */}
            <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10 }}>
              {t.transactions.dateRange}
            </Text>

            {/* Preset chips */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {[
                { label: 'Hari ini', start: startOfDay(), end: endOfDay() },
                { label: 'Bulan ini', start: startOfMonth(), end: endOfMonth() },
                { label: 'Tahun ini', start: startOfYear(), end: endOfYear() },
              ].map((p) => {
                const active = tempStart === p.start && tempEnd === p.end;
                return (
                  <Pressable
                    key={p.label}
                    onPress={() => { setTempStart(p.start); setTempEnd(p.end); }}
                    style={{
                      flex: 1, paddingVertical: 7, borderRadius: theme.radius.md, alignItems: 'center',
                      backgroundColor: active ? theme.colors.accent : theme.colors.cardLight,
                      borderWidth: 1, borderColor: active ? theme.colors.accent : theme.colors.border,
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 11, fontWeight: '600' }}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Date buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Pressable
                onPress={() => setDatePickerTarget('start')}
                style={({ pressed }) => ({
                  flex: 1, height: 44, borderRadius: theme.radius.md,
                  backgroundColor: datePickerTarget === 'start' ? theme.colors.accent + '18' : theme.colors.cardLight,
                  borderWidth: 1, borderColor: datePickerTarget === 'start' ? theme.colors.accent : theme.colors.border,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: tempStart ? theme.colors.text : theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {t.transactions.from}
                </Text>
                <Text style={{ color: tempStart ? theme.colors.accent : theme.colors.textMuted, fontSize: 12 }}>
                  {tempStart ? formatDate(tempStart) : 'Pilih'}
                </Text>
              </Pressable>
              <View style={{ width: 1, backgroundColor: theme.colors.divider, alignSelf: 'center', height: 28 }} />
              <Pressable
                onPress={() => setDatePickerTarget('end')}
                style={({ pressed }) => ({
                  flex: 1, height: 44, borderRadius: theme.radius.md,
                  backgroundColor: datePickerTarget === 'end' ? theme.colors.accent + '18' : theme.colors.cardLight,
                  borderWidth: 1, borderColor: datePickerTarget === 'end' ? theme.colors.accent : theme.colors.border,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: tempEnd ? theme.colors.text : theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {t.transactions.to}
                </Text>
                <Text style={{ color: tempEnd ? theme.colors.accent : theme.colors.textMuted, fontSize: 12 }}>
                  {tempEnd ? formatDate(tempEnd) : 'Pilih'}
                </Text>
              </Pressable>
            </View>

            {/* iOS inline date picker */}
            {Platform.OS === 'ios' && datePickerTarget !== null && (
              <View style={{ marginBottom: 8 }}>
                <DateTimePicker
                  value={datePickerTarget === 'start' ? new Date(tempStart ?? Date.now()) : new Date(tempEnd ?? Date.now())}
                  mode="date"
                  display="spinner"
                  onChange={(_, date) => {
                    if (!date) return;
                    if (datePickerTarget === 'start') {
                      const d = new Date(date); d.setHours(0, 0, 0, 0);
                      setTempStart(d.getTime());
                    } else {
                      const d = new Date(date); d.setHours(23, 59, 59, 999);
                      setTempEnd(d.getTime());
                    }
                  }}
                  style={{ height: 130 }}
                />
                <Pressable
                  onPress={() => setDatePickerTarget(null)}
                  style={{ alignItems: 'center', paddingVertical: 8 }}
                >
                  <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 14 }}>Selesai</Text>
                </Pressable>
              </View>
            )}

            {/* Android native date picker (shows as system dialog) */}
            {Platform.OS === 'android' && datePickerTarget !== null && (
              <DateTimePicker
                value={datePickerTarget === 'start' ? new Date(tempStart ?? Date.now()) : new Date(tempEnd ?? Date.now())}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setDatePickerTarget(null);
                  if (event.type === 'set' && date) {
                    if (datePickerTarget === 'start') {
                      const d = new Date(date); d.setHours(0, 0, 0, 0);
                      setTempStart(d.getTime());
                    } else {
                      const d = new Date(date); d.setHours(23, 59, 59, 999);
                      setTempEnd(d.getTime());
                    }
                  }
                }}
              />
            )}

            {/* Apply / Reset */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => {
                  const section = sortModal as SectionKey;
                  setRanges((prev) => ({ ...prev, [section]: { start: tempStart, end: tempEnd } }));
                  setDatePickerTarget(null);
                  setSortModal(null);
                }}
                style={{ flex: 1, backgroundColor: theme.colors.accent, paddingVertical: 12, borderRadius: theme.radius.lg, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Terapkan</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const section = sortModal as SectionKey;
                  setRanges((prev) => ({ ...prev, [section]: {} }));
                  setTempStart(undefined);
                  setTempEnd(undefined);
                  setDatePickerTarget(null);
                  setSortModal(null);
                }}
                style={{ flex: 1, backgroundColor: theme.colors.cardLight, paddingVertical: 12, borderRadius: theme.radius.lg, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14 }}>Reset</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Customer Loyalty */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
              👥 Loyalitas Pelanggan
            </Text>
            <Pressable
              onPress={() => { setTempStart(ranges.loyalty.start); setTempEnd(ranges.loyalty.end); setDatePickerTarget(null); setSortModal('loyalty'); }}
              hitSlop={8}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.md, backgroundColor: theme.colors.cardLight, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="funnel" size={12} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                {ranges.loyalty.start || ranges.loyalty.end ? `${formatShortDate(ranges.loyalty.start)} - ${formatShortDate(ranges.loyalty.end)}` : 'Semua'}
              </Text>
            </Pressable>
          </View>
          {/* Tabs */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
            {([{ key: 'all', label: 'Semua' }, { key: 'service', label: 'Service' }, { key: 'retail', label: 'Kasir' }] as const).map((tab) => {
              const active = loyaltyType === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setLoyaltyType(tab.key)}
                  style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radius.md, backgroundColor: active ? theme.colors.primary : theme.colors.cardLight }}
                >
                  <Text style={{ color: active ? '#fff' : theme.colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {loading ? <Skeleton height={80} /> : customerLoyalty.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 16 }}>Belum ada data</Text>
          ) : (
            <ScrollView nestedScrollEnabled style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {customerLoyalty.map((item, i) => (
                <View
                  key={item.customer_id ?? 'none'}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < customerLoyalty.length - 1 ? 1 : 0, borderBottomColor: theme.colors.divider, gap: 12 }}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? theme.colors.primary : theme.colors.cardLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: item.customer_id ? theme.colors.text : theme.colors.textMuted, fontSize: 13, fontWeight: '600', fontStyle: item.customer_id ? 'normal' : 'italic' }}>
                      {item.customer_name}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: theme.colors.accent, fontSize: 15, fontWeight: '800' }}>{item.transaction_count}</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>transaksi</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>

      {/* Workshop Loyalty */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700' }}>
              🏭 Loyalitas Workshop
            </Text>
            <Pressable
              onPress={() => { setTempStart(ranges.workshopLoyalty.start); setTempEnd(ranges.workshopLoyalty.end); setDatePickerTarget(null); setSortModal('workshopLoyalty'); }}
              hitSlop={8}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.md, backgroundColor: theme.colors.cardLight, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="funnel" size={12} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                {ranges.workshopLoyalty.start || ranges.workshopLoyalty.end ? `${formatShortDate(ranges.workshopLoyalty.start)} - ${formatShortDate(ranges.workshopLoyalty.end)}` : 'Semua'}
              </Text>
            </Pressable>
          </View>
          {/* Tabs */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
            {([{ key: 'all', label: 'Semua' }, { key: 'service', label: 'Service' }, { key: 'retail', label: 'Kasir' }] as const).map((tab) => {
              const active = workshopLoyaltyType === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setWorkshopLoyaltyType(tab.key)}
                  style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radius.md, backgroundColor: active ? theme.colors.primary : theme.colors.cardLight }}
                >
                  <Text style={{ color: active ? '#fff' : theme.colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {loading ? <Skeleton height={80} /> : workshopLoyalty.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 16 }}>Belum ada data</Text>
          ) : (
            <ScrollView nestedScrollEnabled style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {workshopLoyalty.map((item, i) => (
                <View
                  key={item.customer_id ?? 'none'}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < workshopLoyalty.length - 1 ? 1 : 0, borderBottomColor: theme.colors.divider, gap: 12 }}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? theme.colors.primary : theme.colors.cardLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: item.customer_id ? theme.colors.text : theme.colors.textMuted, fontSize: 13, fontWeight: '600', fontStyle: item.customer_id ? 'normal' : 'italic' }}>
                      {item.customer_name}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: theme.colors.accent, fontSize: 15, fontWeight: '800' }}>{item.transaction_count}</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>transaksi</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>

      {/* Export */}
      <View style={{ paddingHorizontal: 16, marginTop: 8, gap: 10 }}>
        <Button
          title={t.reports.exportCSV}
          variant="secondary"
          onPress={exportCSV}
          loading={exporting}
          icon={<Ionicons name="grid" size={18} color="#fff" />}
          fullWidth
        />
      </View>

      {/* Banner Ad */}
      <View style={{ marginTop: 20 }}>
        <AdBanner />
      </View>
    </ScrollView>
  );
}
