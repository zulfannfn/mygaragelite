import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { Picker } from '../src/components/ui/Picker';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { SPAREPART_CATEGORIES } from '../src/constants/config';
import { useTheme } from '../src/contexts/ThemeContext';
import { sparepartService } from '../src/services/sparepartService';
import { useAppStore } from '../src/store/useAppStore';
import { useSparepartStore } from '../src/store/useSparepartStore';
import { parseCurrency } from '../src/utils/currency';
import { isEmpty } from '../src/utils/validation';

export default function SparepartForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const showToast = useAppStore((s) => s.showToast);
  const { theme } = useTheme();
  const { add, update, remove } = useSparepartStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Lainnya');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      sparepartService.getById(id).then((s) => {
        if (!s) return;
        setName(s.name);
        setCategory(s.category);
        setStock(String(s.stock));
        setMinStock(String(s.min_stock));
        setBuyPrice(String(s.buy_price));
        setSellPrice(String(s.sell_price));
      });
    }
  }, [id, isEdit]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (isEmpty(name)) e.name = 'Nama wajib diisi';
    if (parseCurrency(sellPrice) <= 0) e.sellPrice = 'Harga jual harus > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const finalCategory = showCustomCategory && customCategory.trim() ? customCategory.trim() : category;
      const input = {
        name: name.trim(),
        category: finalCategory,
        stock: parseInt(stock || '0', 10),
        min_stock: parseInt(minStock || '0', 10),
        buy_price: parseCurrency(buyPrice),
        sell_price: parseCurrency(sellPrice),
      };
      if (isEdit && id) {
        await update(id, input);
        showToast('Sparepart diperbarui', 'success');
      } else {
        await add(input);
        showToast('Sparepart ditambahkan', 'success');
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
    showToast('Sparepart dihapus', 'success');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={isEdit ? 'Edit Sparepart' : 'Sparepart Baru'} showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 + (Platform.OS === 'android' ? 48 : 34), gap: 16 }}>
          <Input
            label="Nama Sparepart *"
            value={name}
            onChangeText={setName}
            placeholder="Mis. Oli Mesin Shell 1L"
            error={errors.name}
          />
          <Picker
            label="Kategori"
            value={category}
            options={[...SPAREPART_CATEGORIES, 'Tambah Kategori Baru']}
            optionIcons={{
              'Oli': 'water',
              'Filter': 'filter',
              'Ban': 'bicycle',
              'Kampas Rem': 'car',
              'Aki': 'flash',
              'Busi': 'flash',
              'Lampu': 'bulb',
              'Body': 'car',
              'Mesin': 'construct',
              'Lainnya': 'list',
              'Tambah Kategori Baru': 'add',
            }}
            onChange={(v) => {
              if (v === 'Tambah Kategori Baru') {
                setShowCustomCategory(true);
              } else {
                setCategory(v);
                setShowCustomCategory(false);
              }
            }}
          />
          {showCustomCategory && (
            <Input
              label="Nama Kategori Baru"
              value={customCategory}
              onChangeText={setCustomCategory}
              placeholder="Masukkan nama kategori"
            />
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Stok"
                value={stock}
                onChangeText={(v) => setStock(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Min. Stok"
                value={minStock}
                onChangeText={(v) => setMinStock(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="5"
              />
            </View>
          </View>
          <Input
            label="Harga Beli (Rp)"
            value={buyPrice}
            onChangeText={(v) => setBuyPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="0"
          />
          <Input
            label="Harga Jual (Rp) *"
            value={sellPrice}
            onChangeText={(v) => setSellPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="0"
            error={errors.sellPrice}
          />

          <View style={{ marginTop: 12, gap: 10 }}>
            <Button
              title={isEdit ? 'Simpan Perubahan' : 'Tambah Sparepart'}
              onPress={save}
              loading={loading}
              size="lg"
              fullWidth
            />
            {isEdit && (
              <Button
                title="Hapus Sparepart"
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
        title="Hapus Sparepart?"
        message="Data ini akan dihapus permanen."
        confirmText="Hapus"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
