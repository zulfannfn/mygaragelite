import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Badge } from '../src/components/ui/Badge';
import { Card } from '../src/components/ui/Card';
import { EmptyState } from '../src/components/ui/EmptyState';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { theme } from '../src/constants/theme';
import { useEmployeeStore } from '../src/store/useEmployeeStore';

export default function EmployeesScreen() {
  const router = useRouter();
  const { employees, load } = useEmployeeStore();

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const activeCount = employees.filter((e) => e.is_active === 1).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title="Karyawan"
        subtitle={`${activeCount} aktif dari ${employees.length} total`}
        showBack
        rightElement={
          <Pressable
            onPress={() => router.push('/employee-form')}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
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

      <FlatList
        data={employees}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 100,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Belum ada karyawan"
            description="Tambahkan karyawan/mekanik untuk dipakai di transaksi servis."
          />
        }
        renderItem={({ item }) => {
          const isActive = item.is_active === 1;
          const roleColor =
            item.role === 'Mekanik'
              ? theme.colors.accent
              : item.role === 'Kasir'
                ? theme.colors.blue
                : theme.colors.success;
          return (
            <Card
              onPress={() =>
                router.push({ pathname: '/employee-form', params: { id: item.id } })
              }
              style={{ opacity: isActive ? 1 : 0.55 }}
              padding="md"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: roleColor + '1F',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: roleColor + '40',
                  }}
                >
                  <Ionicons
                    name={
                      item.role === 'Mekanik'
                        ? 'construct'
                        : item.role === 'Kasir'
                          ? 'cash'
                          : 'shield-checkmark'
                    }
                    size={24}
                    color={roleColor}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 6,
                      marginTop: 6,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: theme.radius.full,
                        backgroundColor: roleColor + '25',
                      }}
                    >
                      <Text
                        style={{
                          color: roleColor,
                          fontSize: 11,
                          fontWeight: '700',
                          letterSpacing: 0.3,
                        }}
                      >
                        {item.role.toUpperCase()}
                      </Text>
                    </View>
                    {!isActive ? <Badge label="Nonaktif" variant="danger" /> : null}
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
                      <Ionicons name="call" size={11} color={theme.colors.textMuted} />
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                        {item.phone}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
