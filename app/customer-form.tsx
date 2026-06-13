import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { Picker } from '../src/components/ui/Picker';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { VEHICLE_TYPES } from '../src/constants/config';
import { useTheme } from '../src/contexts/ThemeContext';
import { customerService } from '../src/services/customerService';
import { useTranslation } from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { useCustomerStore } from '../src/store/useCustomerStore';
import { VehicleType } from '../src/types';
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
  const [notes, setNotes] = useState('');
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
        setNotes(c.notes);
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
      const input = {
        name: name.trim(),
        phone: phone.trim(),
        plate_number: plate.trim().toUpperCase(),
        vehicle_type: vehicleType,
        vehicle_brand: vehicleBrand.trim(),
        notes: notes.trim(),
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
          <Input
            label={t.customers.notes}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.customers.notesPlaceholder}
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

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
