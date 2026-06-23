import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdBanner } from '../../src/components/ui/AdBanner';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { SkeletonCard } from '../../src/components/ui/Skeleton';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useTranslation } from '../../src/i18n';
import { reportService } from '../../src/services/reportService';
import { serviceReminderService } from '../../src/services/serviceReminderService';
import { transactionService } from '../../src/services/transactionService';
import { useAppStore } from '../../src/store/useAppStore';
import { DashboardStats, ReportData, Transaction } from '../../src/types';
import { formatCompactCurrency, formatCurrency } from '../../src/utils/currency';
import { formatRelative } from '../../src/utils/date';
import { checkOnline } from '../../src/utils/network';

function MiniBarChart({ data, theme }: { data: ReportData[]; theme: any }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const chartHeight = 60;
  const barWidth = 16;
  const gap = 4;

  // Extract month name from date (format: MM/YYYY or similar)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const getMonth = (date: string) => {
    // If format is like "Mei 26" or "Mei 2026", split by space and return only the month name
    const spaceParts = date.split(' ');
    if (spaceParts.length > 0 && isNaN(parseInt(spaceParts[0], 10))) {
      return spaceParts[0];
    }
    const parts = date.split('/');
    const monthNum = parseInt(parts[0], 10);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      return monthNames[monthNum - 1];
    }
    return parts[0] || date;
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
  const offlineTxCount = useAppStore((s) => s.offlineTxCount);
  const { theme } = useTheme();
  const t = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTransactions, setActiveTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyData, setMonthlyData] = useState<ReportData[]>([]);
  const [transactionTypeModalOpen, setTransactionTypeModalOpen] = useState(false);
  const [showPct, setShowPct] = useState(true);
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'in_progress' | 'waiting_payment'>('all');
  const [reminderDueCount, setReminderDueCount] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    const [s, inProg, pend, waitPay, m, reminders] = await Promise.all([
      reportService.getDashboardStats(),
      transactionService.getAll({ status: 'in_progress' }),
      transactionService.getAll({ status: 'pending' }),
      transactionService.getAll({ status: 'waiting_payment' }),
      reportService.getMonthlyReport(4),
      serviceReminderService.getDueList('this_month'),
    ]);
    setStats(s);
    setReminderDueCount(reminders.length);

    let filtered: Transaction[] = [];
    if (queueFilter === 'all') {
      filtered = [...waitPay, ...inProg, ...pend].slice(0, 8);
    } else if (queueFilter === 'pending') {
      filtered = pend.slice(0, 8);
    } else if (queueFilter === 'in_progress') {
      filtered = inProg.slice(0, 8);
    } else if (queueFilter === 'waiting_payment') {
      filtered = waitPay.slice(0, 8);
    }
    setActiveTransactions(filtered);
    setMonthlyData(m);
    setLoading(false);
  }, [queueFilter]);

  useEffect(() => {
    if (!stats) return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setShowPct((p) => !p);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [stats, fadeAnim]);

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

  const OFFLINE_TX_LIMIT = 5;
  const handleNewTransaction = async () => {
    const online = await checkOnline();
    if (!online && offlineTxCount >= OFFLINE_TX_LIMIT) {
      Alert.alert(
        'Koneksi Internet Diperlukan',
        'Dibutuhkan koneksi internet untuk melanjutkan transaksi.',
        [{ text: 'OK' }]
      );
      return;
    }
    setTransactionTypeModalOpen(true);
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
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{t.dashboard.welcome}</Text>
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
                {t.dashboard.todayRevenue}
              </Text>
              {loading || !stats ? (
                <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>...</Text>
              ) : (
                <>
                  <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>
                    {formatCurrency(stats.todayGrossProfit)}
                  </Text>
                  {(() => {
                    const today = stats.todayGrossProfit;
                    const yesterday = stats.yesterdayGrossProfit;
                    const isFlat = today === yesterday;
                    const isUp = today >= yesterday;
                    const pct = yesterday > 0
                      ? Math.round(Math.abs(((today - yesterday) / yesterday) * 100))
                      : today > 0 ? 100 : 0;
                    const color = isFlat ? 'rgba(255,255,255,0.6)' : isUp ? '#4ADE80' : '#F87171';
                    return (
                      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, opacity: fadeAnim }}>
                        {showPct ? (
                          <>
                            <Ionicons name={isFlat ? 'remove' : isUp ? 'trending-up' : 'trending-down'} size={12} color={color} />
                            <Text style={{ color, fontSize: 12, fontWeight: '600' }}>
                              {isFlat ? 'Sama seperti kemarin' : `${isUp ? '+' : '-'}${pct}% dari kemarin`}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.6)" />
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' }}>
                              Kemarin: {formatCurrency(yesterday)}
                            </Text>
                          </>
                        )}
                      </Animated.View>
                    );
                  })()}
                </>
              )}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{t.dashboard.thisYear}</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                    {stats ? formatCompactCurrency(stats.yearGrossProfit) : '-'}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{t.dashboard.thisMonth}</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                    {stats ? formatCompactCurrency(stats.monthGrossProfit) : '-'}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{t.dashboard.unpaid}</Text>
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
            title={t.dashboard.totalSpareparts}
            value={loading ? '-' : String(stats?.totalSpareparts ?? 0)}
            icon="cube"
            color={theme.colors.success}
            theme={theme}
          />
          <StatCard
            title={t.dashboard.totalServices}
            value={loading ? '-' : String(stats?.totalServices ?? 0)}
            icon="construct"
            color={theme.colors.accent}
            theme={theme}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard
            title={t.dashboard.lowStock}
            value={loading ? '-' : String(stats?.lowStockCount ?? 0)}
            icon="warning"
            color={theme.colors.warning}
            theme={theme}
            onPress={() => router.push({ pathname: '/(tabs)/spareparts', params: { filter: 'low' } })}
          />
          <StatCard
            title={t.dashboard.outOfStock}
            value={loading ? '-' : String(stats?.outOfStockCount ?? 0)}
            icon="alert-circle"
            color={theme.colors.danger}
            theme={theme}
            onPress={() => router.push({ pathname: '/(tabs)/spareparts', params: { filter: 'out' } })}
          />
        </View>
      </View>

      {/* Ringkasan Antrian */}
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
          Ringkasan Antrian
        </Text>
        <Card padding={0}>
          <View style={{ flexDirection: 'row', paddingVertical: 16 }}>
            <QueueItem
              label="Antrian"
              value={loading ? '-' : String(stats?.pendingTransactions ?? 0)}
              color={theme.colors.warning}
              icon="time"
              theme={theme}
            />
            <View style={{ width: 1, backgroundColor: theme.colors.divider, marginVertical: 4 }} />
            <QueueItem
              label="Dikerjakan"
              value={loading ? '-' : String(stats?.inProgressTransactions ?? 0)}
              color={theme.colors.accent}
              icon="construct"
              theme={theme}
            />
            <View style={{ width: 1, backgroundColor: theme.colors.divider, marginVertical: 4 }} />
            <QueueItem
              label="Menunggu Bayar"
              value={loading ? '-' : String(stats?.waitingPaymentTransactions ?? 0)}
              color="#A855F7"
              icon="cash"
              theme={theme}
            />
          </View>
        </Card>
      </View>

      {/* Quick Actions */}
      <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }}>
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
          {t.dashboard.quickActions}
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
          label={t.dashboard.newTransaction}
          color={theme.colors.accent}
          theme={theme}
          onPress={handleNewTransaction}
        />
        <QuickAction
          icon="person-add"
          label={t.nav.customers}
          color={theme.colors.blue}
          theme={theme}
          onPress={() => router.push('/customer-form')}
        />
        <QuickAction
          icon="construct"
          label={t.services.title}
          color={theme.colors.primaryLight}
          theme={theme}
          onPress={() => router.push('/services')}
        />
        <QuickAction
          icon="cube"
          label={t.nav.spareparts}
          color={theme.colors.success}
          theme={theme}
          onPress={() => router.push('/sparepart-form')}
        />
        <QuickAction
          icon="cart"
          label={t.settings.managePurchaseOrders}
          color={theme.colors.primaryLight}
          theme={theme}
          onPress={() => router.push('/purchase-orders')}
        />
        <QuickAction
          icon="notifications"
          label={t.settings.manageServiceReminders}
          color={theme.colors.warning}
          theme={theme}
          onPress={() => router.push('/service-reminders')}
          showDot={reminderDueCount > 0}
        />
      </View>

      {/* Perhatian — Active Transactions (pending + in_progress) */}
      <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
            ⚠️ {t.dashboard.attention}
          </Text>
        </View>
        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[
            { key: 'all' as const, label: 'Semua' },
            { key: 'pending' as const, label: 'Antrian' },
            { key: 'in_progress' as const, label: 'Dikerjakan' },
            { key: 'waiting_payment' as const, label: 'Menunggu Bayar' },
          ].map((filter) => (
            <Pressable
              key={filter.key}
              onPress={() => setQueueFilter(filter.key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: theme.radius.md,
                backgroundColor: queueFilter === filter.key ? theme.colors.accent : theme.colors.card,
                borderWidth: 1,
                borderColor: queueFilter === filter.key ? theme.colors.accent : theme.colors.border,
              }}
            >
              <Text
                style={{
                  color: queueFilter === filter.key ? '#fff' : theme.colors.text,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={{ paddingHorizontal: 16, gap: 10, marginBottom: 8 }}>
        {loading ? (
          <SkeletonCard />
        ) : activeTransactions.length === 0 ? (
          <Card>
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
              {t.dashboard.noPendingTransactions}
            </Text>
          </Card>
        ) : (
          activeTransactions.map((tx, i) => {
            const isInProgress = tx.status === 'in_progress';
            const isWaitingPayment = tx.status === 'waiting_payment';
            const iconColor = isWaitingPayment ? '#A855F7' : isInProgress ? theme.colors.accent : theme.colors.warning;
            const iconName: keyof typeof Ionicons.glyphMap = isWaitingPayment ? 'cash' : isInProgress ? 'construct' : 'time';
            const statusLabel = isWaitingPayment ? t.common.waitingPayment : isInProgress ? t.common.inProgress : t.common.pending;
            return (
              <Card
                key={tx.id ?? `active-${i}`}
                onPress={() => router.push({ pathname: '/transaction-detail', params: { id: tx.id } })}
                padding="md"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: iconColor + '1F', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: iconColor + '40' }}>
                    <Ionicons name={iconName} size={20} color={iconColor} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                        {tx.customer_name ?? t.dashboard.noCustomer}
                      </Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '800' }}>
                        {formatCompactCurrency(tx.total_amount)}
                      </Text>
                    </View>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 3 }}>
                      {tx.customer_plate ?? '-'} • {formatRelative(tx.created_at)} • {statusLabel}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </View>

      <AdBanner />

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
              {t.dashboard.selectTransactionType}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
              {t.dashboard.transactionTypeQuestion}
            </Text>
            <View style={{ flexDirection: 'column', gap: 10 }}>
              <Button
                title={t.dashboard.service}
                onPress={() => {
                  setTransactionTypeModalOpen(false);
                  router.push({ pathname: '/transaction-form', params: { type: 'service' } });
                }}
                fullWidth
                icon={<Ionicons name="construct" size={18} color="#fff" />}
              />
              <Button
                title={`${t.dashboard.cashier} (Retail)`}
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
  onPress,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  theme: any;
  onPress?: () => void;
}) {
  return (
    <Card padding="sm" style={{ flex: 1 }} onPress={onPress}>
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
  showDot,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  theme: any;
  showDot?: boolean;
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
        {showDot ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: theme.colors.danger,
              borderWidth: 1.5,
              borderColor: theme.colors.card,
            }}
          />
        ) : null}
      </View>
      <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function QueueItem({
  label,
  value,
  color,
  icon,
  theme,
}: {
  label: string;
  value: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: any;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '800', lineHeight: 26 }}>
        {value}
      </Text>
      <Text style={{
        color: theme.colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 15,
      }}>
        {label}
      </Text>
    </View>
  );
}
