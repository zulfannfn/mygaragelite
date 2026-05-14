import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { theme } from '../src/constants/theme';
import { serviceService } from '../src/services/serviceService';
import { useAppStore } from '../src/store/useAppStore';
import { isEmpty } from '../src/utils/validation';

export default function ServiceForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const showToast = useAppStore((s) => s.showToast);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      serviceService.getById(id).then((s) => {
        if (!s) return;
        setName(s.name);
        setPrice(String(s.price));
      });
    }
  }, [id, isEdit]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (isEmpty(name)) e.name = 'Nama jasa wajib diisi';
    if (parseInt(price || '0', 10) <= 0) e.price = 'Harga harus > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const input = {
        name: name.trim(),
        price: parseInt(price || '0', 10),
      };
      if (isEdit && id) {
        await serviceService.update(id, input);
        showToast('Jasa diperbarui', 'success');
      } else {
        await serviceService.create(input);
        showToast('Jasa ditambahkan', 'success');
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
    await serviceService.delete(id);
    showToast('Jasa dihapus', 'success');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={isEdit ? 'Edit Jasa' : 'Jasa Baru'} showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Input
            label="Nama Jasa *"
            value={name}
            onChangeText={setName}
            placeholder="Mis. Ganti Oli, Tune Up"
            error={errors.name}
          />
          <Input
            label="Harga (Rp) *"
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="0"
            error={errors.price}
          />

          <View style={{ marginTop: 12, gap: 10 }}>
            <Button
              title={isEdit ? 'Simpan Perubahan' : 'Tambah Jasa'}
              onPress={save}
              loading={loading}
              size="lg"
              fullWidth
            />
            {isEdit && (
              <Button
                title="Hapus Jasa"
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
        title="Hapus Jasa?"
        message="Data ini akan dihapus permanen."
        confirmText="Hapus"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
