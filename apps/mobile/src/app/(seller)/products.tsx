import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  Switch,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../services/api';
import { formatPrice, SupportedLanguage, resolveLocalizedText } from '@localshop/shared';
import { Plus, Search, Trash2, Edit2, Package } from 'lucide-react-native';

export default function SellerProductsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const currentLang = (i18n.language as SupportedLanguage) || SupportedLanguage.UZ;

  const loadProducts = async () => {
    try {
      const data = await mobileApi.getSellerProducts();
      setProducts(data);
    } catch (e) {
      console.warn('Failed to load seller products', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleToggleAvailable = async (product: any) => {
    try {
      await mobileApi.updateSellerProduct(product.id, {
        is_available: !product.is_available,
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: !p.is_available } : p)),
      );
    } catch (err: any) {
      Alert.alert('Xatolik', err.message);
    }
  };

  const handleDelete = (productId: string) => {
    Alert.alert('O\'chirish', 'Mahsulotni o\'chirishni tasdiqlaysizmi?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'O\'chirish',
        style: 'destructive',
        onPress: async () => {
          try {
            await mobileApi.deleteSellerProduct(productId);
            loadProducts();
          } catch (err: any) {
            Alert.alert('Xatolik', err.message);
          }
        },
      },
    ]);
  };

  const filtered = products.filter((p) =>
    (p.name_uz + p.name_ru + p.name_en).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <div>
          <Text style={styles.headerTitle}>{t('tabs.products')}</Text>
          <Text style={styles.headerSubtitle}>{products.length} ta mahsulot do'konda mavjud</Text>
        </div>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(seller)/product-editor')}
        >
          <Plus size={18} color="#ffffff" />
          <Text style={styles.addBtnText}>Qo'shish</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={16} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Mahsulot nomi orqali qidirish..."
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* Products List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <Package size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Mahsulotlar topilmadi</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const localizedName = resolveLocalizedText(
            { uz: item.name_uz, ru: item.name_ru, en: item.name_en },
            currentLang,
          );

          return (
            <View style={styles.productCard}>
              <View style={styles.productImgWrapper}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.productImg} />
                ) : (
                  <Text style={{ fontSize: 24 }}>🛍</Text>
                )}
              </View>

              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {localizedName}
                </Text>
                <Text style={styles.productPrice}>{formatPrice(item.price, currentLang)}</Text>
                <Text style={styles.stockText}>Qoldiq: {item.stock} ta</Text>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Mavjudlik:</Text>
                  <Switch
                    value={item.is_available}
                    onValueChange={() => handleToggleAvailable(item)}
                    trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                    thumbColor={item.is_available ? '#16a34a' : '#f8fafc'}
                  />
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id)}
                >
                  <Trash2 size={16} color="#e11d48" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
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
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  productImgWrapper: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16a34a',
    marginTop: 2,
  },
  stockText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  switchLabel: {
    fontSize: 11,
    color: '#475569',
  },
  cardActions: {
    justifyContent: 'center',
    paddingLeft: 6,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#fff1f2',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 12,
  },
});
