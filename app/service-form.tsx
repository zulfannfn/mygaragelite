import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { serviceService } from '../src/services/serviceService';
import { useTranslation } from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { InterstitialAd } from '../src/components/ui/AdBanner';
import { isEmpty } from '../src/utils/validation';

export default function ServiceForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const showToast = useAppStore((s) => s.showToast);
  const { theme } = useTheme();
  const t = useTranslation();

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
    if (isEmpty(name)) e.name = t.services.nameRequired;
    if (parseInt(price || '0', 10) <= 0) e.price = t.services.priceRequired;
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
        showToast(t.services.updatedSuccess, 'success');
        await InterstitialAd.show();
      } else {
        await serviceService.create(input);
        showToast(t.services.addedSuccess, 'success');
      }
      router.back();
    } catch {
      showToast(t.services.saveFailed, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    if (!id) return;
    await serviceService.delete(id);
    showToast(t.services.deletedSuccess, 'success');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={isEdit ? t.services.editService : t.services.newService} showBack />
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Input
            label={`${t.services.name} *`}
            value={name}
            onChangeText={setName}
            placeholder={t.services.namePlaceholder}
            error={errors.name}
          />
          <Input
            label={`${t.services.price} *`}
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="0"
            error={errors.price}
          />

          <View style={{ marginTop: 12, gap: 10 }}>
            <Button
              title={isEdit ? t.common.saveChanges : t.services.addService}
              onPress={save}
              loading={loading}
              size="lg"
              fullWidth
            />
            {isEdit && (
              <Button
                title={t.services.deleteService}
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
        title={t.services.deleteTitle}
        message={t.services.deleteMessage}
        confirmText={t.common.delete}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}
