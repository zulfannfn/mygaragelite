import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { Picker } from '../src/components/ui/Picker';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { CUSTOMER_TYPES, VEHICLE_TYPES } from '../src/constants/config';
import { useTheme } from '../src/contexts/ThemeContext';
import { customerService } from '../src/services/customerService';
import { useTranslation } from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { useCustomerStore } from '../src/store/useCustomerStore';
import { CustomerType, VehicleType } from '../src/types';
import { InterstitialAd } from '../src/components/ui/AdBanner';
import { isEmpty } from '../src/utils/validation';

export default function CustomerForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const showToast = useAppStore((s) => s.showToast);
  const { theme } = useTheme();
  const t = useTranslation();
  const { add, update, remove } = useCustomerStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('Motor');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('orang');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      customerService.getById(id).then((c) => {
        if (!c) return;
        setName(c.name);
        setPhone(c.phone);
        setPlate(c.plate_number);
        setVehicleType(c.vehicle_type);
        setVehicleBrand(c.vehicle_brand);
        setCustomerType(c.customer_type ?? 'orang');
      });
    }
  }, [id, isEdit]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (isEmpty(name)) e.name = t.customers.nameRequired;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const isWorkshop = customerType === 'bengkel';
      const input = {
        name: name.trim(),
        phone: phone.trim(),
        plate_number: isWorkshop ? '' : plate.trim().toUpperCase(),
        vehicle_type: vehicleType,
        vehicle_brand: isWorkshop ? '' : vehicleBrand.trim(),
        customer_type: customerType,
        notes: '',
      };
      if (isEdit && id) {
        await update(id, input);
        showToast(t.customers.updatedSuccess, 'success');
        await InterstitialAd.show();
      } else {
        const createdCustomer = await add(input);
        useAppStore.getState().setLastAddedCustomerId(createdCustomer.id);
        showToast(t.customers.addedSuccess, 'success');
      }
      router.back();
    } catch {
      showToast(t.customers.saveFailed, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (!id) return;
    await remove(id);
    showToast(t.customers.deletedSuccess, 'success');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={isEdit ? t.customers.editCustomer : t.customers.newCustomer} showBack />
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 8 }}>
              {t.customers.customerType}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(CUSTOMER_TYPES as readonly CustomerType[]).map((typeOpt) => {
                const active = customerType === typeOpt;
                const label = typeOpt === 'orang' ? t.customers.typeOrang : t.customers.typeBengkel;
                const icon = typeOpt === 'orang' ? 'person' : 'business';
                return (
                  <Pressable
                    key={typeOpt}
                    onPress={() => setCustomerType(typeOpt)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 12,
                      borderRadius: theme.radius.lg,
                      backgroundColor: active ? theme.colors.accent : theme.colors.cardLight,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.accent : theme.colors.border,
                    }}
                  >
                    <Ionicons name={icon} size={16} color={active ? '#fff' : theme.colors.textSecondary} />
                    <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Input
            label={`${t.customers.name} *`}
            value={name}
            onChangeText={setName}
            placeholder={t.customers.namePlaceholder}
            error={errors.name}
          />
          <Input
            label={t.customers.phone}
            value={phone}
            onChangeText={setPhone}
            placeholder="081234567890"
            keyboardType="phone-pad"
          />
          {customerType === 'orang' && (
            <>
              <Input
                label={t.customers.plate}
                value={plate}
                onChangeText={setPlate}
                placeholder="B 1234 ABC"
                autoCapitalize="characters"
              />
              <Picker
                label={t.customers.vehicleType}
                value={vehicleType}
                options={VEHICLE_TYPES}
                onChange={(v) => setVehicleType(v as VehicleType)}
                optionIcons={{
                  Motor: 'bicycle',
                  Mobil: 'car',
                }}
              />
              <Input
                label={t.customers.vehicleBrand}
                value={vehicleBrand}
                onChangeText={setVehicleBrand}
                placeholder={t.customers.vehicleBrandPlaceholder}
              />
            </>
          )}
          <View style={{ marginTop: 12, gap: 10 }}>
            <Button
              title={isEdit ? t.common.saveChanges : t.customers.addCustomer}
              onPress={save}
              loading={loading}
              size="lg"
              fullWidth
            />
            {isEdit && (
              <Button
                title={t.customers.deleteCustomer}
                variant="danger"
                onPress={() => setConfirmDelete(true)}
                fullWidth
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmDelete}
        title={t.customers.deleteConfirmTitle}
        message={t.customers.deleteConfirmMessage}
        confirmText={t.common.delete}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
