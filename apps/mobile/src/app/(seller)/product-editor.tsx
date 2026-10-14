import React, { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { mobileApi } from '../../services/api';
import { ArrowLeft, Check, Camera, Image as ImageIcon } from 'lucide-react-native';

export default function ProductEditorScreen() {
  const router = useRouter();

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name_uz: '',
    name_ru: '',
    name_en: '',
    category_id: '',
    priceUzs: '',
    stock: '20',
    description_uz: '',
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=400&q=80',
  });

  useEffect(() => {
    mobileApi.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) {
        setFormData((prev) => ({ ...prev, category_id: cats[0].id }));
      }
    });
  }, []);

  const handleSave = async () => {
    if (!formData.name_uz.trim()) {
      Alert.alert('Xatolik', 'Mahsulot nomini kiriting');
      return;
    }
    const priceNum = parseInt(formData.priceUzs, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Xatolik', 'Mahsulot narxini to\'g\'ri kiriting');
      return;
    }

    setLoading(true);
    try {
      await mobileApi.createSellerProduct({
        name_uz: formData.name_uz.trim(),
        name_ru: formData.name_ru.trim() || undefined,
        name_en: formData.name_en.trim() || undefined,
        category_id: formData.category_id,
        price: priceNum * 100, // convert UZS to tiyin
        stock: parseInt(formData.stock, 10) || 0,
        description_uz: formData.description_uz.trim() || undefined,
        is_available: formData.is_available,
        image_url: formData.image_url,
      });

      router.back();
    } catch (err: any) {
      Alert.alert('Xatolik', err.message || 'Mahsulot saqlashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yangi Mahsulot Qo'shish</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveHeaderBtn} disabled={loading}>
          <Check size={20} color="#16a34a" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Name Fields (with multi-language fallback) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mahsulot Nomi (3 tilda)</Text>
          <Text style={styles.cardSubtitle}>
            Agar faqat bitta tilda kiritilsa, qolgan tillar avtomatik unga moslashadi.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nomi (O'zbekcha) *</Text>
            <TextInput
              style={styles.input}
              value={formData.name_uz}
              onChangeText={(text) => setFormData({ ...formData, name_uz: text })}
              placeholder="Masalan: Samarqand noni"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nomi (Ruscha)</Text>
            <TextInput
              style={styles.input}
              value={formData.name_ru}
              onChangeText={(text) => setFormData({ ...formData, name_ru: text })}
              placeholder="Самаркандская лепешка"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nomi (Inglizcha)</Text>
            <TextInput
              style={styles.input}
              value={formData.name_en}
              onChangeText={(text) => setFormData({ ...formData, name_en: text })}
              placeholder="Samarkand Flatbread"
            />
          </View>
        </View>

        {/* Price and Stock */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Narxi va Ombordagi Qoldiq</Text>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Narxi (so'mda) *</Text>
              <TextInput
                style={styles.input}
                value={formData.priceUzs}
                onChangeText={(text) => setFormData({ ...formData, priceUzs: text })}
                keyboardType="numeric"
                placeholder="8000"
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Qoldiq (dona) *</Text>
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
            <Text style={styles.switchLabel}>Mijozlar uchun sotuvda mavjud</Text>
            <Switch
              value={formData.is_available}
              onValueChange={(val) => setFormData({ ...formData, is_available: val })}
              trackColor={{ false: '#cbd5e1', true: '#86efac' }}
              thumbColor={formData.is_available ? '#16a34a' : '#f8fafc'}
            />
          </View>
        </View>

        {/* Category Picker */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kategoriya</Text>
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
                    {c.name_uz}
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
            <Text style={styles.saveBtnText}>Mahsulotni Saqlash</Text>
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
