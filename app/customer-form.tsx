import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { Picker } from '../src/components/ui/Picker';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { VEHICLE_TYPES } from '../src/constants/config';
import { theme } from '../src/constants/theme';
import { customerService } from '../src/services/customerService';
import { useAppStore } from '../src/store/useAppStore';
import { useCustomerStore } from '../src/store/useCustomerStore';
import { VehicleType } from '../src/types';
import { isEmpty } from '../src/utils/validation';

export default function CustomerForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const showToast = useAppStore((s) => s.showToast);
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
    if (isEmpty(name)) e.name = 'Nama wajib diisi';
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
        showToast('Pelanggan diperbarui', 'success');
      } else {
        await add(input);
        showToast('Pelanggan ditambahkan', 'success');
      }
      router.back();
    } catch {
      showToast('Gagal menyimpan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (!id) return;
    await remove(id);
    showToast('Pelanggan dihapus', 'success');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={isEdit ? 'Edit Pelanggan' : 'Pelanggan Baru'} showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Input
            label="Nama Pelanggan *"
            value={name}
            onChangeText={setName}
            placeholder="Mis. Budi Santoso"
            error={errors.name}
          />
          <Input
            label="Nomor HP"
            value={phone}
            onChangeText={setPhone}
            placeholder="081234567890"
            keyboardType="phone-pad"
          />
          <Input
            label="Plat Nomor"
            value={plate}
            onChangeText={setPlate}
            placeholder="B 1234 ABC"
            autoCapitalize="characters"
          />
          <Picker
            label="Jenis Kendaraan"
            value={vehicleType}
            options={VEHICLE_TYPES}
            onChange={(v) => setVehicleType(v as VehicleType)}
          />
          <Input
            label="Merk / Tipe Kendaraan"
            value={vehicleBrand}
            onChangeText={setVehicleBrand}
            placeholder="Mis. Honda Vario 150"
          />
          <Input
            label="Catatan"
            value={notes}
            onChangeText={setNotes}
            placeholder="Catatan tambahan (opsional)"
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          <View style={{ marginTop: 12, gap: 10 }}>
            <Button
              title={isEdit ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
              onPress={save}
              loading={loading}
              size="lg"
              fullWidth
            />
            {isEdit && (
              <Button
                title="Hapus Pelanggan"
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
        title="Hapus Pelanggan?"
        message="Data pelanggan dan riwayat servis terkait tidak dapat dikembalikan."
        confirmText="Hapus"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
