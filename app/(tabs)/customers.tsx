import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { AdBanner } from '../../src/components/ui/AdBanner';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { SkeletonCard } from '../../src/components/ui/Skeleton';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useCustomerStore } from '../../src/store/useCustomerStore';
import { useTranslation } from '../../src/i18n';

export default function CustomersScreen() {
  const router = useRouter();
  const { customers, loading, hasMore, search, setSearch, load, loadMore } = useCustomerStore();
  const { theme } = useTheme();
  const t = useTranslation();

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleEndReached = () => {
    loadMore();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title={t.customers.title}
        subtitle={`${customers.length} ${t.customers.registered}`}
        rightElement={
          <Pressable
            onPress={() => router.push('/customer-form')}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        }
      />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t.customers.searchPlaceholder}
      />

      {loading && customers.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 100,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => (
            <>
              {loading && customers.length > 0 && <View style={{ padding: 16 }}><SkeletonCard /></View>}
              <View style={{ marginTop: 8 }}><AdBanner /></View>
            </>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={t.customers.empty}
              description={t.customers.emptyDesc}
            />
          }
          renderItem={({ item }) => {
            const vehicleIcon: keyof typeof Ionicons.glyphMap =
              item.vehicle_type === 'Mobil' ? 'car-sport' : 'bicycle';
            return (
              <Card
                onPress={() =>
                  router.push({ pathname: '/customer-detail', params: { id: item.id } })
                }
                padding="md"
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  {/* Avatar with initial */}
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 14,
                      backgroundColor: theme.colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: theme.colors.primaryLight,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons
                        name={item.customer_type === 'bengkel' ? 'business' : 'person'}
                        size={12}
                        color={theme.colors.textMuted}
                      />
                      <Text
                        style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      {item.plate_number ? (
                        <Badge label={item.plate_number} variant="accent" />
                      ) : null}
                      {item.customer_type !== 'bengkel' && (
                        <View
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <Ionicons
                            name={vehicleIcon}
                            size={12}
                            color={theme.colors.textMuted}
                          />
                          <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                            {item.vehicle_brand || item.vehicle_type}
                          </Text>
                        </View>
                      )}
                    </View>
                    {item.phone ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 4,
                        }}
                      >
                        <Ionicons
                          name="call"
                          size={11}
                          color={theme.colors.textMuted}
                        />
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                          {item.phone}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
