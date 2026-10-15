import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { mobileApi } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { resolveLocalizedText, SupportedLanguage } from '@localshop/shared';
import { ArrowLeft, Check } from 'lucide-react-native';
import SellerImagePicker from '../../components/SellerImagePicker';

const EMPTY_FORM = {
  name_uz: '',
  name_ru: '',
  name_en: '',
  category_id: '',
  priceUzs: '',
  stock: '20',
  description_uz: '',
  description_ru: '',
  description_en: '',
  is_available: true,
  image_url: '',
};

export default function ProductEditorScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = ((i18n.language || 'uz').slice(0, 2) as SupportedLanguage) || SupportedLanguage.UZ;
  const categoryName = (c: any) =>
    resolveLocalizedText({ uz: c.name_uz, ru: c.name_ru, en: c.name_en }, lang);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const categoriesRef = useRef<any[]>([]);

  // This screen is a hidden tab and keeps its state between visits,
  // so reset (or load the product being edited) every time it is opened
  useFocusEffect(
    useCallback(() => {
      if (!id) {
        setFormData((prev) => ({ ...EMPTY_FORM, category_id: categoriesRef.current[0]?.id || '' }));
        return;
      }
      setLoadingProduct(true);
      mobileApi
        .getSellerProducts()
        .then((list: any[]) => {
          const p = (list || []).find((x) => x.id === id);
          if (!p) {
            Alert.alert(t('sellerUi.common.error'), t('sellerUi.editor.notFound'));
            router.back();
            return;
          }
          setFormData({
            name_uz: p.name_uz || '',
            name_ru: p.name_ru || '',
            name_en: p.name_en || '',
            category_id: p.category_id,
            priceUzs: String(Math.round(p.price / 100)),
            stock: String(p.stock ?? 0),
            description_uz: p.description_uz || '',
            description_ru: p.description_ru || '',
            description_en: p.description_en || '',
            is_available: !!p.is_available,
            image_url: p.image_url || '',
          });
        })
        .catch((e) => Alert.alert(t('sellerUi.common.error'), e.message || t('sellerUi.editor.loadFailed')))
        .finally(() => setLoadingProduct(false));
    }, [id]),
  );


  useEffect(() => {
    mobileApi.getCategories().then((cats) => {
      setCategories(cats);
      categoriesRef.current = cats;
      if (cats.length > 0) {
        setFormData((prev) => (prev.category_id ? prev : { ...prev, category_id: cats[0].id }));
      }
    });
  }, []);

  const handleSave = async () => {
    if (!formData.name_uz.trim()) {
      Alert.alert(t('sellerUi.common.error'), t('sellerUi.editor.nameRequired'));
      return;
    }
    const priceNum = parseInt(formData.priceUzs, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert(t('sellerUi.common.error'), t('sellerUi.editor.priceInvalid'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name_uz: formData.name_uz.trim(),
        name_ru: formData.name_ru.trim() || undefined,
        name_en: formData.name_en.trim() || undefined,
        category_id: formData.category_id,
        price: priceNum * 100, // convert UZS to tiyin
        stock: parseInt(formData.stock, 10) || 0,
        description_uz: formData.description_uz.trim() || undefined,
        description_ru: formData.description_ru.trim() || undefined,
        description_en: formData.description_en.trim() || undefined,
        is_available: formData.is_available,
        // Send empty string on edit so a removed image is actually cleared
        image_url: formData.image_url || (isEdit ? '' : undefined),
      };
      if (isEdit) {
        await mobileApi.updateSellerProduct(id!, payload);
      } else {
        await mobileApi.createSellerProduct(payload);
      }

      router.back();
    } catch (err: any) {
      Alert.alert(t('sellerUi.common.error'), err.message || t('sellerUi.editor.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? t('sellerUi.editor.titleEdit') : t('sellerUi.editor.titleNew')}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveHeaderBtn}
          disabled={loading}
          accessibilityLabel={t('sellerUi.editor.save')}
        >
          <Check size={20} color="#16a34a" />
        </TouchableOpacity>
      </View>

      {loadingProduct && (
        <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 24 }} />
      )}
      <ScrollView contentContainerStyle={styles.content} style={loadingProduct ? { opacity: 0.4 } : undefined}>
        {/* Product Image */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('sellerUi.editor.imageTitle')}</Text>
          <Text style={styles.cardSubtitle}>{t('sellerUi.editor.imageSubtitle')}</Text>
          <SellerImagePicker
            value={formData.image_url}
            onChange={(url) => setFormData((prev) => ({ ...prev, image_url: url }))}
          />
        </View>

        {/* Name Fields (with multi-language fallback) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('sellerUi.editor.nameTitle')}</Text>
          <Text style={styles.cardSubtitle}>
            {t('sellerUi.editor.nameHint')}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('sellerUi.editor.nameUz')}</Text>
            <TextInput
              style={styles.input}
              value={formData.name_uz}
              onChangeText={(text) => setFormData({ ...formData, name_uz: text })}
              placeholder={t('sellerUi.editor.example', { text: 'Samarqand noni' })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('sellerUi.editor.nameRu')}</Text>
            <TextInput
              style={styles.input}
              value={formData.name_ru}
              onChangeText={(text) => setFormData({ ...formData, name_ru: text })}
              placeholder={t('sellerUi.editor.example', { text: 'Самаркандская лепешка' })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('sellerUi.editor.nameEn')}</Text>
            <TextInput
              style={styles.input}
              value={formData.name_en}
              onChangeText={(text) => setFormData({ ...formData, name_en: text })}
              placeholder={t('sellerUi.editor.example', { text: 'Samarkand Flatbread' })}
            />
          </View>
        </View>

        {/* Descriptions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('sellerUi.editor.descTitle')}</Text>
          <View style={[styles.inputGroup, { marginTop: 10 }]}>
            <Text style={styles.label}>{t('sellerUi.editor.descUz')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={formData.description_uz}
              onChangeText={(text) => setFormData({ ...formData, description_uz: text })}
              placeholder={t('sellerUi.editor.example', { text: "Issiq va xushbo'y an'anaviy tandir noni" })}
              multiline
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('sellerUi.editor.descRu')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={formData.description_ru}
              onChangeText={(text) => setFormData({ ...formData, description_ru: text })}
              placeholder={t('sellerUi.editor.example', { text: 'Традиционная самаркандская лепешка' })}
              multiline
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('sellerUi.editor.descEn')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={formData.description_en}
              onChangeText={(text) => setFormData({ ...formData, description_en: text })}
              placeholder={t('sellerUi.editor.example', { text: 'Fresh traditional tandoor bread' })}
              multiline
            />
          </View>
        </View>

        {/* Price and Stock */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('sellerUi.editor.priceStockTitle')}</Text>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>{t('sellerUi.editor.price')}</Text>
              <TextInput
                style={styles.input}
                value={formData.priceUzs}
                onChangeText={(text) => setFormData({ ...formData, priceUzs: text })}
                keyboardType="numeric"
                placeholder="8000"
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>{t('sellerUi.editor.stock')}</Text>
              <TextInput
                style={styles.input}
                value={formData.stock}
                onChangeText={(text) => setFormData({ ...formData, stock: text })}
                keyboardType="numeric"
                placeholder="20"
              />
            </View>
          </View>

          {/* Availability switch */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('sellerUi.editor.availableSwitch')}</Text>
            <Switch
              accessibilityLabel={t('sellerUi.editor.availableSwitch')}
              value={formData.is_available}
              onValueChange={(val) => setFormData({ ...formData, is_available: val })}
              trackColor={{ false: '#cbd5e1', true: '#86efac' }}
              thumbColor={formData.is_available ? '#16a34a' : '#f8fafc'}
            />
          </View>
        </View>

        {/* Category Picker */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('sellerUi.editor.category')}</Text>
          <View style={styles.catChips}>
            {categories.map((c) => {
              const isSelected = formData.category_id === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, isSelected && styles.catChipActive]}
                  onPress={() => setFormData({ ...formData, category_id: c.id })}
                >
                  <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                    {categoryName(c)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveBtnText}>{t('sellerUi.editor.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  saveHeaderBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  row: {
    flexDirection: 'row',
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  catChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  catChipActive: {
    backgroundColor: '#16a34a',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#ffffff',
  },
  saveBtn: {
    backgroundColor: '#16a34a',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
