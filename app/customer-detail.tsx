import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge } from '../src/components/ui/Badge';
import { Card } from '../src/components/ui/Card';
import { EmptyState } from '../src/components/ui/EmptyState';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { customerService } from '../src/services/customerService';
import { transactionService } from '../src/services/transactionService';
import { Customer, Transaction } from '../src/types';
import { formatCompactCurrency } from '../src/utils/currency';
import { formatDateTime } from '../src/utils/date';

export default function CustomerDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);

  const infoRow = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  };

  const load = useCallback(async () => {
    if (!id) return;
    const [c, h] = await Promise.all([
      customerService.getById(id),
      transactionService.getByCustomer(id),
    ]);
    setCustomer(c);
    setHistory(h);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!customer) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScreenHeader title="Detail Pelanggan" showBack />
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }}>
          Memuat...
        </Text>
      </View>
    );
  }

  const totalSpent = history
    .filter((t) => t.status === 'paid')
    .reduce((s, t) => s + t.total_amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title="Detail Pelanggan"
        showBack
        rightElement={
          <Pressable
            onPress={() => router.push({ pathname: '/customer-form', params: { id: customer.id } })}
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
            <Ionicons name="create-outline" size={20} color={theme.colors.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Customer Card */}
        <Card style={{ marginBottom: 12 }}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>
                {customer.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700' }}>
              {customer.name}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {customer.plate_number ? (
                <Badge label={customer.plate_number} variant="accent" />
              ) : null}
              <Badge label={customer.vehicle_type} variant="info" />
            </View>
          </View>

          {customer.phone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${customer.phone}`)}
              style={infoRow}
            >
              <Ionicons name="call" size={16} color={theme.colors.success} />
              <Text style={{ color: theme.colors.text, flex: 1 }}>{customer.phone}</Text>
              <Pressable
                onPress={() => Linking.openURL(`https://wa.me/62${customer.phone.replace(/^0/, '')}`)}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              </Pressable>
            </Pressable>
          ) : null}
          {customer.vehicle_brand ? (
            <View style={infoRow}>
              <Ionicons name="car-sport" size={16} color={theme.colors.blue} />
              <Text style={{ color: theme.colors.text }}>{customer.vehicle_brand}</Text>
            </View>
          ) : null}
          {customer.notes ? (
            <View style={[infoRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="document-text" size={16} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, flex: 1 }}>
                {customer.notes}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <Card style={{ flex: 1 }} padding={12}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>TOTAL SERVIS</Text>
            <Text
              style={{
                color: theme.colors.accent,
                fontSize: 18,
                fontWeight: '800',
                marginTop: 4,
              }}
            >
              {history.length}
            </Text>
          </Card>
          <Card style={{ flex: 1 }} padding={12}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>TOTAL BELANJA</Text>
            <Text
              style={{
                color: theme.colors.success,
                fontSize: 16,
                fontWeight: '800',
                marginTop: 4,
              }}
            >
              {formatCompactCurrency(totalSpent)}
            </Text>
          </Card>
        </View>

        <Text
          style={{
            color: theme.colors.text,
            fontSize: 15,
            fontWeight: '700',
            marginBottom: 8,
          }}
        >
          Riwayat Servis
        </Text>

        {history.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Belum ada servis"
            description="Riwayat servis akan muncul di sini."
          />
        ) : (
          history.map((tx) => (
            <Card
              key={tx.id}
              onPress={() => router.push({ pathname: '/transaction-detail', params: { id: tx.id } })}
              style={{ marginBottom: 8 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                    {formatDateTime(tx.created_at)}
                  </Text>
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
                    style={{ marginTop: 6 }}
                  />
                </View>
                <Text
                  style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '800' }}
                >
                  {formatCompactCurrency(tx.total_amount)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
