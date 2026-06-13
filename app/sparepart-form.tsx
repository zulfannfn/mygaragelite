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
import { useTranslation } from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { useSparepartStore } from '../src/store/useSparepartStore';
import { InterstitialAd } from '../src/components/ui/AdBanner';
import { parseCurrency } from '../src/utils/currency';
import { isEmpty } from '../src/utils/validation';

export default function SparepartForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const showToast = useAppStore((s) => s.showToast);
  const { theme } = useTheme();
  const t = useTranslation();
  const { add, update, remove } = useSparepartStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Lainnya');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [existingCustomCategories, setExistingCustomCategories] = useState<string[]>([]);
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    sparepartService.getUniqueCategories().then((cats) => {
      const customs = cats.filter(c => !(SPAREPART_CATEGORIES as readonly string[]).includes(c));
      setExistingCustomCategories(customs);
    });

    if (isEdit && id) {
      sparepartService.getById(id).then((s) => {
        if (!s) return;
        setName(s.name);
        setCategory(s.category);
        if (!(SPAREPART_CATEGORIES as readonly string[]).includes(s.category)) {
          // If the loaded sparepart uses a custom category,
          // we can just set category to that value since it's now in the list.
          // Wait, if it's in the list, we don't need to show custom category input,
          // because they can just pick it from the list!
        }
        setStock(String(s.stock));
        setMinStock(String(s.min_stock));
        setBuyPrice(String(s.buy_price));
        setSellPrice(String(s.sell_price));
      });
    }
  }, [id, isEdit]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (isEmpty(name)) e.name = t.spareparts.nameRequired;
    if (parseCurrency(sellPrice) <= 0) e.sellPrice = t.spareparts.sellPriceRequired;
    if (showCustomCategory && isEmpty(customCategory)) e.customCategory = t.common.required;
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
        showToast(t.spareparts.updatedSuccess, 'success');
        await InterstitialAd.show();
      } else {
        await add(input);
        showToast(t.spareparts.addedSuccess, 'success');
      }
      router.back();
    } catch {
      showToast(t.spareparts.saveFailed, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (!id) return;
    await remove(id);
    showToast(t.spareparts.deletedSuccess, 'success');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={isEdit ? t.spareparts.editSparepart : t.spareparts.newSparepart} showBack />
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Input
            label={`${t.spareparts.name} *`}
            value={name}
            onChangeText={setName}
            placeholder={t.spareparts.namePlaceholder}
            error={errors.name}
          />
          <Picker
            label={t.spareparts.categoryLabel}
            value={category}
            options={[...SPAREPART_CATEGORIES, ...existingCustomCategories, 'Tambah Kategori Baru']}
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
                setCategory('Tambah Kategori Baru');
                setShowCustomCategory(true);
              } else {
                setCategory(v);
                setShowCustomCategory(false);
              }
            }}
          />
          {showCustomCategory && (
            <Input
              label={`${t.spareparts.newCategoryName} *`}
              value={customCategory}
              onChangeText={setCustomCategory}
              placeholder={t.spareparts.categoryPlaceholder}
              error={errors.customCategory}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label={t.spareparts.stock}
                value={stock}
                onChangeText={(v) => setStock(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t.spareparts.minStock}
                value={minStock}
                onChangeText={(v) => setMinStock(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="5"
              />
            </View>
          </View>
          <Input
            label={t.spareparts.buyPrice}
            value={buyPrice}
            onChangeText={(v) => setBuyPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="0"
          />
          <Input
            label={`${t.spareparts.sellPrice} *`}
            value={sellPrice}
            onChangeText={(v) => setSellPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="0"
            error={errors.sellPrice}
          />

          <View style={{ marginTop: 12, gap: 10 }}>
            <Button
              title={isEdit ? t.common.saveChanges : t.spareparts.addSparepart}
              onPress={save}
              loading={loading}
              size="lg"
              fullWidth
            />
            {isEdit && (
              <Button
                title={t.spareparts.deleteSparepart}
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
        title={t.spareparts.deleteTitle}
        message={t.spareparts.deleteMessage}
        confirmText={t.common.delete}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
