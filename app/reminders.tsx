import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { EmptyState } from '../src/components/ui/EmptyState';
import { Input } from '../src/components/ui/Input';
import { Picker } from '../src/components/ui/Picker';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { SearchBar } from '../src/components/ui/SearchBar';
import { REMINDER_TYPES } from '../src/constants/config';
import { theme } from '../src/constants/theme';
import { customerService } from '../src/services/customerService';
import { reminderService } from '../src/services/reminderService';
import { useTranslation } from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { Customer, Reminder, ReminderType } from '../src/types';
import { addDays, daysBetween, formatDate } from '../src/utils/date';

export default function RemindersScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const t = useTranslation();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pickCustomerOpen, setPickCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [selCustomer, setSelCustomer] = useState<Customer | null>(null);
  const [type, setType] = useState<ReminderType>('oil_change');
  const [days, setDays] = useState('30');
  const [notes, setNotes] = useState('');

  const TYPE_LABEL: Record<ReminderType, string> = {
    oil_change: t.reminders.oilChange,
    periodic_service: t.reminders.periodicService,
    tune_up: t.reminders.tuneUp,
  };

  const load = useCallback(async () => {
    const data = await reminderService.getAll();
    setReminders(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    customerService.getAll().then(setCustomers);
  }, []);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.plate_number.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const submit = async () => {
    if (!selCustomer) {
      showToast(t.reminders.selectCustomerError, 'error');
      return;
    }
    await reminderService.create({
      customer_id: selCustomer.id,
      type,
      due_date: addDays(Date.now(), parseInt(days || '30', 10)),
      notes: notes.trim(),
    });
    showToast(t.reminders.createdSuccess, 'success');
    setAddOpen(false);
    setSelCustomer(null);
    setNotes('');
    setDays('30');
    load();
  };

  const handleDelete = async (id: string) => {
    await reminderService.delete(id);
    showToast(t.reminders.deletedSuccess, 'success');
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title={t.reminders.title}
        subtitle={`${reminders.length} ${t.reminders.activeReminders}`}
        showBack
        rightElement={
          <Pressable
            onPress={() => setAddOpen(true)}
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

      <FlatList
        data={reminders}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + (Platform.OS === 'android' ? 48 : 34) }}
        ListEmptyComponent={
          <EmptyState
            icon="alarm-outline"
            title={t.reminders.empty}
            description={t.reminders.emptyDesc}
          />
        }
        renderItem={({ item }) => {
          const days = daysBetween(Date.now(), item.due_date);
          const overdue = days < 0;
          const upcoming = days >= 0 && days <= 7;
          return (
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                    {item.customer_name ?? '-'}
                  </Text>
                  <Text
                    style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}
                  >
                    {item.customer_plate ?? '-'} • {TYPE_LABEL[item.type]}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                    <Badge
                      label={
                        overdue
                          ? `${t.reminders.overdue} ${Math.abs(days)} ${t.reminders.overdueDay}`
                          : days === 0
                            ? t.reminders.today
                            : `${days} ${t.reminders.daysLeft}`
                      }
                      variant={overdue ? 'danger' : upcoming ? 'warning' : 'info'}
                    />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                      {formatDate(item.due_date)}
                    </Text>
                  </View>
                  {item.notes ? (
                    <Text
                      style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}
                    >
                      📝 {item.notes}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => handleDelete(item.id)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                </Pressable>
              </View>
            </Card>
          );
        }}
      />

      {/* Add Reminder Modal */}
      <Modal
        visible={addOpen}
        animationType="slide"
        onRequestClose={() => setAddOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <ScreenHeader title={t.reminders.newReminder} showBack />
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Pressable onPress={() => setPickCustomerOpen(true)}>
              <Card>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                  {t.transactions.sectionCustomer}
                </Text>
                <Text style={{ color: theme.colors.text, fontWeight: '700', marginTop: 4 }}>
                  {selCustomer ? selCustomer.name : t.reminders.selectCustomer}
                </Text>
              </Card>
            </Pressable>
            <View style={{ height: 12 }} />
            <Picker
              label={t.reminders.reminderType}
              value={type}
              options={REMINDER_TYPES as unknown as string[]}
              onChange={(v) => setType(v as ReminderType)}
            />
            <Input
              label={t.reminders.daysFromNow}
              value={days}
              onChangeText={(v) => setDays(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
            <Input
              label={t.reminders.notes}
              value={notes}
              onChangeText={setNotes}
              placeholder={t.reminders.optional}
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />
            <Button title={t.common.save} size="lg" fullWidth onPress={submit} />
          </ScrollView>
        </View>
      </Modal>

      {/* Customer Picker */}
      <Modal
        visible={pickCustomerOpen}
        animationType="slide"
        onRequestClose={() => setPickCustomerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <ScreenHeader title={t.reminders.pickCustomer} showBack />
          <SearchBar value={customerSearch} onChangeText={setCustomerSearch} />
          <FlatList
            data={filteredCustomers}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <Card
                onPress={() => {
                  setSelCustomer(item);
                  setPickCustomerOpen(false);
                }}
                style={{ marginBottom: 8 }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{item.name}</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                  {item.plate_number}
                </Text>
              </Card>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
