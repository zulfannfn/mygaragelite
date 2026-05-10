import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { theme } from '../../src/constants/theme';
import { exportService } from '../../src/services/exportService';
import { reportService } from '../../src/services/reportService';
import { transactionService } from '../../src/services/transactionService';
import { useAppStore } from '../../src/store/useAppStore';
import { ReportData, TopSparepart } from '../../src/types';
import { formatCompactCurrency, formatCurrency } from '../../src/utils/currency';

export default function ReportsScreen() {
  const showToast = useAppStore((s) => s.showToast);
  const [daily, setDaily] = useState<ReportData[]>([]);
  const [monthly, setMonthly] = useState<ReportData[]>([]);
  const [topSp, setTopSp] = useState<TopSparepart[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, m, t] = await Promise.all([
      reportService.getDailyReport(7),
      reportService.getMonthlyReport(6),
      reportService.getTopSpareparts(5),
    ]);
    setDaily(d);
    setMonthly(m);
    setTopSp(t);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const todayRevenue = daily[daily.length - 1]?.revenue ?? 0;
  const totalWeekRevenue = daily.reduce((s, x) => s + x.revenue, 0);
  const totalMonthRevenue = monthly[monthly.length - 1]?.revenue ?? 0;
  const maxDaily = Math.max(...daily.map((d) => d.revenue), 1);

  const exportPDF = async () => {
    try {
      setExporting(true);
      const tx = await transactionService.getAll();
      await exportService.exportTransactionsToPDF(tx, 'Laporan Lengkap');
      showToast('Berhasil export PDF', 'success');
    } catch {
      showToast('Gagal export', 'error');
    } finally {
      setExporting(false);
    }
  };

  const exportCSV = async () => {
    try {
      setExporting(true);
      const tx = await transactionService.getAll();
      await exportService.exportTransactionsToCSV(tx);
      showToast('Berhasil export CSV', 'success');
    } catch {
      showToast('Gagal export', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <ScreenHeader title="Laporan" subtitle="Statistik & analitik bengkel" />

      {/* Summary cards */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 }}>
        <Card style={{ flex: 1 }} padding={14}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            HARI INI
          </Text>
          <Text
            style={{ color: theme.colors.accent, fontSize: 16, fontWeight: '800', marginTop: 4 }}
          >
            {loading ? '...' : formatCompactCurrency(todayRevenue)}
          </Text>
        </Card>
        <Card style={{ flex: 1 }} padding={14}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            7 HARI
          </Text>
          <Text
            style={{ color: theme.colors.blue, fontSize: 16, fontWeight: '800', marginTop: 4 }}
          >
            {loading ? '...' : formatCompactCurrency(totalWeekRevenue)}
          </Text>
        </Card>
        <Card style={{ flex: 1 }} padding={14}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
            BULAN INI
          </Text>
          <Text
            style={{
              color: theme.colors.success,
              fontSize: 16,
              fontWeight: '800',
              marginTop: 4,
            }}
          >
            {loading ? '...' : formatCompactCurrency(totalMonthRevenue)}
          </Text>
        </Card>
      </View>

      {/* Daily chart */}
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
            Pendapatan 7 Hari Terakhir
          </Text>
          {loading ? (
            <Skeleton height={120} />
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: 140,
                gap: 6,
              }}
            >
              {daily.map((d, i) => {
                const h = Math.max((d.revenue / maxDaily) * 120, 4);
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <View
                      style={{
                        width: '100%',
                        height: h,
                        backgroundColor:
                          i === daily.length - 1 ? theme.colors.accent : theme.colors.primaryLight,
                        borderRadius: 4,
                      }}
                    />
                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: 9,
                        marginTop: 6,
                        textAlign: 'center',
                      }}
                    >
                      {d.date}
                    </Text>
                  </View>
                );
              })}
            </View>
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
            monthly.map((m, i) => (
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
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '700' }}>
                    {formatCurrency(m.revenue)}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                    {m.transactionCount} transaksi
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </View>

      {/* Top spareparts */}
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
            🏆 Sparepart Terlaris
          </Text>
          {loading ? (
            <Skeleton height={60} />
          ) : topSp.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
              Belum ada data
            </Text>
          ) : (
            topSp.map((sp, i) => (
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
            ))
          )}
        </Card>
      </View>

      {/* Export */}
      <View style={{ paddingHorizontal: 16, marginTop: 8, gap: 10 }}>
        <Button
          title="Export PDF"
          onPress={exportPDF}
          loading={exporting}
          icon={<Ionicons name="document-text" size={18} color="#fff" />}
          fullWidth
        />
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
