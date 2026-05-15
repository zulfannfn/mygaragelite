import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdBanner } from '../../src/components/ui/AdBanner';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { SkeletonCard } from '../../src/components/ui/Skeleton';
import { useTheme } from '../../src/contexts/ThemeContext';
import { reportService } from '../../src/services/reportService';
import { transactionService } from '../../src/services/transactionService';
import { useAppStore } from '../../src/store/useAppStore';
import { DashboardStats, ReportData, Transaction } from '../../src/types';
import { formatCompactCurrency, formatCurrency } from '../../src/utils/currency';
import { formatRelative } from '../../src/utils/date';

function MiniBarChart({ data, theme }: { data: ReportData[]; theme: any }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const chartHeight = 60;
  const barWidth = 16;
  const gap = 4;

  // Extract month from date (format: MM/YYYY or similar)
  const getMonth = (date: string) => {
    const parts = date.split('/');
    return parts[0] || date; // First part is month (MM/YYYY format)
  };

  const barColor = '#87CEEB'; // Light blue color that works in both modes
  const textColor = '#FFFFFF'; // White color that works in both modes

  return (
    <View style={{ width: 120, height: 100, justifyContent: 'flex-end' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: chartHeight }}>
        {data.map((d, i) => {
          const height = (d.revenue / maxRevenue) * chartHeight;
          return (
            <View key={i} style={{ width: barWidth, height: chartHeight, justifyContent: 'flex-end' }}>
              <View
                style={{
                  width: '100%',
                  height: height,
                  backgroundColor: barColor,
                  borderRadius: 4,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ color: textColor, fontSize: 8, textAlign: 'center', flex: 1 }}>
            {getMonth(d.date)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const workshopName = useAppStore((s) => s.workshopName);
  const { theme } = useTheme();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pending, setPending] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyData, setMonthlyData] = useState<ReportData[]>([]);
  const [transactionTypeModalOpen, setTransactionTypeModalOpen] = useState(false);

  const load = useCallback(async () => {
    const [s, p, m] = await Promise.all([
      reportService.getDashboardStats(),
      transactionService.getAll({ status: 'pending' }),
      reportService.getMonthlyReport(4),
    ]);
    setStats(s);
    setPending(p.slice(0, 5));
    setMonthlyData(m);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
      {/* Header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Selamat datang</Text>
            <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
              {workshopName}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Hero Revenue */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <Card padding={20} style={{ backgroundColor: theme.colors.primary }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' }}>
                PENDAPATAN HARI INI
              </Text>
              {loading || !stats ? (
                <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>...</Text>
              ) : (
                <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>
                  {formatCurrency(stats.todayRevenue)}
                </Text>
              )}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Tahun ini</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                    {stats ? formatCompactCurrency(stats.yearRevenue) : '-'}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Bulan ini</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                    {stats ? formatCompactCurrency(stats.monthRevenue) : '-'}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Belum lunas</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                    {stats?.pendingTransactions ?? 0}
                  </Text>
                </View>
              </View>
            </View>
            <MiniBarChart data={monthlyData} theme={theme} />
          </View>
        </Card>
      </View>

      {/* Stats Grid */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard
            title="Total Transaksi"
            value={loading ? '-' : String(stats?.totalTransactions ?? 0)}
            icon="receipt"
            color={theme.colors.blue}
            theme={theme}
          />
          <StatCard
            title="Total Sparepart"
            value={loading ? '-' : String(stats?.totalSpareparts ?? 0)}
            icon="cube"
            color={theme.colors.success}
            theme={theme}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard
            title="Total Jasa"
            value={loading ? '-' : String(stats?.totalServices ?? 0)}
            icon="construct"
            color={theme.colors.accent}
            theme={theme}
          />
          <StatCard
            title="Pending"
            value={loading ? '-' : String(stats?.pendingTransactions ?? 0)}
            icon="time"
            color={theme.colors.warning}
            theme={theme}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatCard
            title="Stok Menipis"
            value={loading ? '-' : String(stats?.lowStockCount ?? 0)}
            icon="warning"
            color={theme.colors.warning}
            theme={theme}
          />
          <StatCard
            title="Stok Habis"
            value={loading ? '-' : String(stats?.outOfStockCount ?? 0)}
            icon="alert-circle"
            color={theme.colors.danger}
            theme={theme}
          />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
          Aksi Cepat
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          gap: 10,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <QuickAction
          icon="add-circle"
          label="Transaksi Baru"
          color={theme.colors.accent}
          theme={theme}
          onPress={() => setTransactionTypeModalOpen(true)}
        />
        <QuickAction
          icon="person-add"
          label="Pelanggan"
          color={theme.colors.blue}
          theme={theme}
          onPress={() => router.push('/customer-form')}
        />
        <QuickAction
          icon="construct"
          label="Jasa"
          color={theme.colors.primaryLight}
          theme={theme}
          onPress={() => router.push('/services')}
        />
        <QuickAction
          icon="cube"
          label="Sparepart"
          color={theme.colors.success}
          theme={theme}
          onPress={() => router.push('/sparepart-form')}
        />
        <QuickAction
          icon="people"
          label="Karyawan"
          color={theme.colors.primaryLight}
          theme={theme}
          onPress={() => router.push('/employees')}
        />
      </View>

      <AdBanner />

      {/* Perhatian — Pending Transactions */}
      <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 12 }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
          ⚠️ Perhatian
        </Text>
      </View>
      <View style={{ paddingHorizontal: 16, gap: 10, marginBottom: 8 }}>
        {loading ? (
          <SkeletonCard />
        ) : pending.length === 0 ? (
          <Card>
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
              Tidak ada transaksi pending
            </Text>
          </Card>
        ) : (
          pending.map((tx, i) => (
            <Card
              key={tx.id ?? `pending-${i}`}
              onPress={() =>
                router.push({ pathname: '/transaction-detail', params: { id: tx.id } })
              }
              padding="md"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: theme.colors.warning + '1F',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: theme.colors.warning + '40',
                  }}
                >
                  <Ionicons name="time" size={20} color={theme.colors.warning} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: 14,
                        fontWeight: '700',
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {tx.customer_name ?? 'Tanpa Pelanggan'}
                    </Text>
                    <Text
                      style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '800' }}
                    >
                      {formatCompactCurrency(tx.total_amount)}
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 3 }}>
                    {tx.customer_plate ?? '-'} • {formatRelative(tx.created_at)} • Pending
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </View>

      </ScrollView>

      <Modal visible={transactionTypeModalOpen} transparent animationType="fade" onRequestClose={() => setTransactionTypeModalOpen(false)}>
        <Pressable
          onPress={() => setTransactionTypeModalOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            paddingHorizontal: 32,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              alignSelf: 'center',
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 18,
                fontWeight: '700',
                marginBottom: 8,
              }}
            >
              Pilih Jenis Transaksi
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
              Apakah ini transaksi servis atau kasir (retail)?
            </Text>
            <View style={{ flexDirection: 'column', gap: 10 }}>
              <Button
                title="Servis"
                onPress={() => {
                  setTransactionTypeModalOpen(false);
                  router.push({ pathname: '/transaction-form', params: { type: 'service' } });
                }}
                fullWidth
                icon={<Ionicons name="construct" size={18} color="#fff" />}
              />
              <Button
                title="Kasir (Retail)"
                onPress={() => {
                  setTransactionTypeModalOpen(false);
                  router.push({ pathname: '/transaction-form', params: { type: 'retail' } });
                }}
                fullWidth
                variant="outline"
                icon={<Ionicons name="cart" size={18} color={theme.colors.accent} />}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  theme,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  theme: any;
}) {
  return (
    <Card padding="sm" style={{ flex: 1 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: color + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
        {title.toUpperCase()}
      </Text>
      <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 }}>
        {value}
      </Text>
    </Card>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  theme: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: '22%',
        backgroundColor: theme.colors.card,
        padding: 14,
        borderRadius: theme.radius.lg,
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: color + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
