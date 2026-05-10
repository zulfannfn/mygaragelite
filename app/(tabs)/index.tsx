import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdBanner } from '../../src/components/ui/AdBanner';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { SkeletonCard } from '../../src/components/ui/Skeleton';
import { theme } from '../../src/constants/theme';
import { reportService } from '../../src/services/reportService';
import { transactionService } from '../../src/services/transactionService';
import { useAppStore } from '../../src/store/useAppStore';
import { DashboardStats, Transaction } from '../../src/types';
import { formatCompactCurrency, formatCurrency } from '../../src/utils/currency';
import { formatRelative } from '../../src/utils/date';

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const workshopName = useAppStore((s) => s.workshopName);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([
      reportService.getDashboardStats(),
      transactionService.getAll(),
    ]);
    setStats(s);
    setRecent(r.slice(0, 5));
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
              {workshopName} 🔧
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
        </Card>
      </View>

      {/* Stats Grid */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard
            title="Servis"
            value={loading ? '-' : String(stats?.todayServiceCount ?? 0)}
            icon="construct"
            color={theme.colors.accent}
          />
          <StatCard
            title="Transaksi"
            value={loading ? '-' : String(stats?.todayTransactionCount ?? 0)}
            icon="receipt"
            color={theme.colors.blue}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatCard
            title="Sparepart"
            value={loading ? '-' : String(stats?.todaySparepartSold ?? 0)}
            icon="cube"
            color={theme.colors.success}
          />
          <StatCard
            title="Stok Menipis"
            value={loading ? '-' : String(stats?.lowStockCount ?? 0)}
            icon="warning"
            color={theme.colors.warning}
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
          label="Servis Baru"
          color={theme.colors.accent}
          onPress={() => router.push('/transaction-form')}
        />
        <QuickAction
          icon="person-add"
          label="Pelanggan"
          color={theme.colors.blue}
          onPress={() => router.push('/customer-form')}
        />
        <QuickAction
          icon="cube"
          label="Sparepart"
          color={theme.colors.success}
          onPress={() => router.push('/sparepart-form')}
        />
        <QuickAction
          icon="alarm"
          label="Reminder"
          color={theme.colors.warning}
          onPress={() => router.push('/reminders')}
        />
        <QuickAction
          icon="people"
          label="Karyawan"
          color={theme.colors.primaryLight}
          onPress={() => router.push('/employees')}
        />
      </View>

      <AdBanner />

      {/* Recent transactions */}
      <View
        style={{
          paddingHorizontal: 20,
          marginTop: 8,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
          Transaksi Terbaru
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/transactions')}>
          <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '600' }}>
            Lihat Semua
          </Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : recent.length === 0 ? (
          <Card>
            <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: 12 }}>
              Belum ada transaksi
            </Text>
          </Card>
        ) : (
          recent.map((tx) => {
            const statusColor =
              tx.status === 'paid'
                ? theme.colors.success
                : tx.status === 'pending'
                  ? theme.colors.warning
                  : theme.colors.danger;
            const initial = (tx.customer_name ?? '?').charAt(0).toUpperCase();
            return (
              <Card
                key={tx.id}
                onPress={() =>
                  router.push({ pathname: '/transaction-detail', params: { id: tx.id } })
                }
                padding="md"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: statusColor + '1F',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: statusColor + '40',
                    }}
                  >
                    <Text style={{ color: statusColor, fontSize: 16, fontWeight: '800' }}>
                      {initial}
                    </Text>
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
                          fontSize: 14.5,
                          fontWeight: '700',
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {tx.customer_name ?? 'Tanpa Pelanggan'}
                      </Text>
                      <Text
                        style={{ color: theme.colors.accent, fontSize: 14.5, fontWeight: '800' }}
                      >
                        {formatCompactCurrency(tx.total_amount)}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 5,
                      }}
                    >
                      <Badge
                        label={
                          tx.status === 'paid'
                            ? 'Lunas'
                            : tx.status === 'pending'
                              ? 'Pending'
                              : 'Batal'
                        }
                        variant={
                          tx.status === 'paid'
                            ? 'success'
                            : tx.status === 'pending'
                              ? 'warning'
                              : 'danger'
                        }
                      />
                      <Text
                        style={{ color: theme.colors.textMuted, fontSize: 11 }}
                        numberOfLines={1}
                      >
                        {tx.customer_plate ?? '-'} • {formatRelative(tx.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <Card style={{ flex: 1 }} padding={14}>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
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
      <Text style={{ color: theme.colors.text, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
