import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { Picker } from '../src/components/ui/Picker';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { employeeService } from '../src/services/employeeService';
import { useAppStore } from '../src/store/useAppStore';
import { useEmployeeStore } from '../src/store/useEmployeeStore';
import { EmployeeRole } from '../src/types';
import { InterstitialAd } from '../src/components/ui/AdBanner';
import { isEmpty } from '../src/utils/validation';

const ROLES: EmployeeRole[] = ['Mekanik', 'Kasir'];

export default function EmployeeForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const showToast = useAppStore((s) => s.showToast);
  const { theme } = useTheme();
  const { add, update, remove } = useEmployeeStore();

  const [name, setName] = useState('');
  const [role, setRole] = useState<EmployeeRole>('Mekanik');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      employeeService.getById(id).then((e) => {
        if (!e) return;
        setName(e.name);
        setRole(e.role === 'Admin' ? 'Mekanik' : e.role);
        setPhone(e.phone);
        setIsActive(e.is_active === 1);
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
        role,
        phone: phone.trim(),
        is_active: isActive,
      };
      if (isEdit && id) {
        await update(id, input);
        showToast('Karyawan diperbarui', 'success');
      } else {
        await add(input);
        showToast('Karyawan ditambahkan', 'success');
        await InterstitialAd.show();
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
    const res = await remove(id);
    showToast(
      res.deleted ? 'Karyawan dihapus' : 'Karyawan dinonaktifkan (terkait transaksi)',
      'success'
    );
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={isEdit ? 'Edit Karyawan' : 'Karyawan Baru'} showBack />
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Input
            label="Nama Karyawan *"
            value={name}
            onChangeText={setName}
            placeholder="Mis. Pak Joko"
            error={errors.name}
          />
          <Picker
            label="Jabatan"
            value={role}
            options={ROLES}
            onChange={(v) => setRole(v as EmployeeRole)}
            optionIcons={{
              Mekanik: 'construct',
              Kasir: 'cash',
            }}
          />
          <Input
            label="Nomor HP"
            value={phone}
            onChangeText={setPhone}
            placeholder="081234567890"
            keyboardType="phone-pad"
          />

          <Pressable
            onPress={() => setIsActive(!isActive)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
              marginBottom: 16,
            }}
          >
            <Ionicons
              name={isActive ? 'checkmark-circle' : 'close-circle'}
              size={22}
              color={isActive ? theme.colors.success : theme.colors.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                Status: {isActive ? 'Aktif' : 'Nonaktif'}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                Hanya karyawan aktif yang muncul di pilihan transaksi
              </Text>
            </View>
            <View
              style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                backgroundColor: isActive ? theme.colors.success : theme.colors.border,
                padding: 3,
                alignItems: isActive ? 'flex-end' : 'flex-start',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                }}
              />
            </View>
          </Pressable>

          <View style={{ gap: 10 }}>
            <Button
              title={isEdit ? 'Simpan Perubahan' : 'Tambah Karyawan'}
              onPress={save}
              loading={loading}
              size="lg"
              fullWidth
            />
            {isEdit && (
              <Button
                title="Hapus Karyawan"
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
        title="Hapus Karyawan?"
        message="Jika karyawan ini sudah pernah dipakai di transaksi, ia akan dinonaktifkan saja agar riwayat tetap utuh."
        confirmText="Hapus"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
