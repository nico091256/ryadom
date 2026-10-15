import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddressStore } from '../../store/useAddressStore';
import { mobileApi } from '../../services/api';
import { formatDistance, resolveLocalizedText } from '@localshop/shared';
import {
  MapPin,
  ChevronDown,
  Store as StoreIcon,
  Search,
  X,
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  ShoppingBag,
} from 'lucide-react-native';
import ActiveOrderWidget from '../../components/ActiveOrderWidget';
import LanguageSelectorModal from '../../components/LanguageSelectorModal';
import { hapticFeedback } from '../../utils/haptics';
import { addressTitleLabel, toSupportedLang } from '../../utils/localize';

export default function CustomerHomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { currentAddress } = useAddressStore();

  const [shops, setShops] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'near'>('all');
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  const currentLang = toSupportedLang(i18n.language);

  const loadCategories = async () => {
    try {
      const catsData = await mobileApi.getCategories();
      setCategories(Array.isArray(catsData) ? catsData : []);
    } catch (err) {
      console.warn('Failed to load categories', err);
    }
  };

  const loadShops = async () => {
    try {
      const shopsData = await mobileApi.getNearbyShops(
        currentAddress.lat,
        currentAddress.lng,
        3000,
        selectedCategory || undefined,
      );
      setShops(Array.isArray(shopsData) ? shopsData : []);
    } catch (err) {
      console.warn('Failed to load nearby shops', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    setLoading(true);
    setShops([]);
    loadShops();
  }, [currentAddress, selectedCategory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCategories();
    loadShops();
  };

  const breadCategory = categories.find(
    (c) => c.icon_url === 'bread-slice' || /bread/i.test(c.name_en || ''),
  );

  // Promo Highlights
  const promos = [
    {
      id: 'promo-1',
      title: t('home.promoFree'),
      subtitle: t('home.promoFreeSub'),
      icon: <Zap size={22} color="#ffffff" />,
      color: '#059669',
      bgColor: '#ecfdf5',
      onPress: undefined as undefined | (() => void),
    },
    {
      id: 'promo-2',
      title: t('home.promoFast'),
      subtitle: t('home.promoFastSub'),
      icon: <Clock size={22} color="#ffffff" />,
      color: '#0284c7',
      bgColor: '#f0f9ff',
      // Fastest delivery comes from the closest shops
      onPress: () => setActiveFilter('near'),
    },
    {
      id: 'promo-3',
      title: t('home.promoBread'),
      subtitle: t('home.promoBreadSub'),
      icon: <Sparkles size={22} color="#ffffff" />,
      color: '#d97706',
      bgColor: '#fffbeb',
      onPress: breadCategory ? () => setSelectedCategory(breadCategory.id) : undefined,
    },
    {
      id: 'promo-4',
      title: t('home.promoSpecial'),
      subtitle: t('home.promoSpecialSub'),
      icon: <ShieldCheck size={22} color="#ffffff" />,
      color: '#7c3aed',
      bgColor: '#f5f3ff',
      onPress: () =>
        Alert.alert(
          t('home.promoSpecial'),
          t('customer.home.promoSpecialHint'),
        ),
    },
  ];

  // Filter & Search Logic
  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = shop.name.toLowerCase().includes(q);
        const matchesAddress = (shop.address_text || '').toLowerCase().includes(q);
        if (!matchesName && !matchesAddress) return false;
      }

      // Quick filter
      if (activeFilter === 'open' && !shop.isCurrentlyOpen) return false;
      if (activeFilter === 'near' && (shop.distanceMeters || 0) > 1000) return false;

      return true;
    });
  }, [shops, searchQuery, activeFilter]);

  const langFlag = currentLang === 'ru' ? '🇷🇺' : currentLang === 'en' ? '🇬🇧' : '🇺🇿';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Header Navigation Bar */}
      <View style={styles.topBar}>
        {/* Address Picker Button */}
        <TouchableOpacity
          style={styles.addressBtn}
          onPress={() => {
            hapticFeedback.selection();
            router.push('/(customer)/address-picker');
          }}
          activeOpacity={0.75}
        >
          <View style={styles.mapPinBadge}>
            <MapPin size={18} color="#059669" />
          </View>
          <View style={styles.addressInfo}>
            <Text style={styles.addressLabel}>{t('home.deliverTo')}</Text>
            <View style={styles.addressRow}>
              <Text style={styles.addressTitle} numberOfLines={1}>
                {currentAddress.title ? `${addressTitleLabel(t, currentAddress.title)}: ` : ''}
                {currentAddress.address_text}
              </Text>
              <ChevronDown size={14} color="#0f172a" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Right Action Icons: Language & Notification */}
        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => {
              hapticFeedback.selection();
              setIsLangModalOpen(true);
            }}
          >
            <Text style={styles.flagText}>{langFlag}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredShops}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />
        }
        contentContainerStyle={styles.listScroll}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Live Active Order Floating Banner */}
            <ActiveOrderWidget />

            {/* Search Input Bar */}
            <View style={styles.searchSection}>
              <View style={styles.searchBar}>
                <Search size={20} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('home.searchPlaceholder')}
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      hapticFeedback.light();
                      setSearchQuery('');
                    }}
                    style={styles.searchClearBtn}
                  >
                    <X size={16} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Promotional Highlights / Stories Carousel */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.promosScroll}
            >
              {promos.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.promoCard, { backgroundColor: p.bgColor }]}
                  activeOpacity={p.onPress ? 0.85 : 1}
                  disabled={!p.onPress}
                  onPress={() => {
                    hapticFeedback.light();
                    p.onPress?.();
                  }}
                >
                  <View style={[styles.promoIconBadge, { backgroundColor: p.color }]}>
                    {p.icon}
                  </View>
                  <View style={styles.promoTextCol}>
                    <Text style={[styles.promoTitle, { color: p.color }]}>{p.title}</Text>
                    <Text style={styles.promoSubtitle}>{p.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Categories Strip */}
            {categories.length > 0 && (
              <View style={styles.categorySection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriesScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.categoryChip,
                      selectedCategory === null && styles.categoryChipActive,
                    ]}
                    onPress={() => {
                      hapticFeedback.selection();
                      setSelectedCategory(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === null && styles.categoryChipTextActive,
                      ]}
                    >
                      {t('home.allCategories')}
                    </Text>
                  </TouchableOpacity>

                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const catName = resolveLocalizedText(
                      { uz: cat.name_uz, ru: cat.name_ru, en: cat.name_en },
                      currentLang,
                    );
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                        onPress={() => {
                          hapticFeedback.selection();
                          setSelectedCategory(isSelected ? null : cat.id);
                        }}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextActive,
                          ]}
                        >
                          {catName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Quick Filters */}
            <View style={styles.filtersRow}>
              <TouchableOpacity
                style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
                onPress={() => {
                  hapticFeedback.selection();
                  setActiveFilter('all');
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'all' && styles.filterPillTextActive,
                  ]}
                >
                  {t('home.filterAll')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, activeFilter === 'open' && styles.filterPillActive]}
                onPress={() => {
                  hapticFeedback.selection();
                  setActiveFilter('open');
                }}
              >
                <View style={styles.onlineDot} />
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'open' && styles.filterPillTextActive,
                  ]}
                >
                  {t('home.filterOpen')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, activeFilter === 'near' && styles.filterPillActive]}
                onPress={() => {
                  hapticFeedback.selection();
                  setActiveFilter('near');
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'near' && styles.filterPillTextActive,
                  ]}
                >
                  {t('home.filterNear')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{t('home.nearbyShops')}</Text>
                <Text style={styles.sectionSubtitle}>
                  {t('customer.home.shopsInRadius', { count: filteredShops.length })}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <StoreIcon size={44} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>{t('home.noShopsNearby')}</Text>
              <Text style={styles.emptyDesc}>
                {t('customer.home.emptyHint')}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isOpen = item.isCurrentlyOpen;
          const distanceText = formatDistance(item.distanceMeters ?? 0, currentLang);

          return (
            <TouchableOpacity
              style={[styles.shopCard, !isOpen && styles.shopCardClosed]}
              onPress={() => {
                hapticFeedback.selection();
                router.push(`/(customer)/shop/${item.id}` as any);
              }}
              activeOpacity={0.88}
            >
              {/* Cover Banner Image */}
              <View style={styles.shopBannerWrapper}>
                <Image
                  source={{
                    uri:
                      item.logo_url ||
                      'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
                  }}
                  style={styles.shopBannerImage}
                  resizeMode="cover"
                />
                <View style={styles.bannerGradientOverlay} />

                {/* Distance & Time Badge */}
                <View style={styles.distanceBadge}>
                  <Clock size={12} color="#ffffff" />
                  <Text style={styles.distanceBadgeText}>{distanceText} • {t('customer.home.deliveryEta', { range: '15-20' })}</Text>
                </View>

                {/* Status Badge */}
                <View
                  style={[
                    styles.statusPill,
                    isOpen ? styles.statusPillOpen : styles.statusPillClosed,
                  ]}
                >
                  <View
                    style={[
                      styles.statusPillDot,
                      { backgroundColor: isOpen ? '#10b981' : '#f43f5e' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isOpen ? '#065f46' : '#9f1239' },
                    ]}
                  >
                    {isOpen ? t('common.open') : t('common.closed')}
                  </Text>
                </View>
              </View>

              {/* Shop Details */}
              <View style={styles.shopCardBody}>
                <View style={styles.shopTitleRow}>
                  <Text style={styles.shopName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {typeof item.productCount === 'number' && (
                    <View style={styles.ratingBadge}>
                      <ShoppingBag size={12} color="#d97706" />
                      <Text style={styles.ratingText}>{t('customer.home.productCount', { count: item.productCount })}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.shopAddress} numberOfLines={1}>
                  {item.address_text}
                </Text>

                {/* Delivery and Min Order Features */}
                <View style={styles.featuresRow}>
                  <View style={styles.featureItem}>
                    <ShieldCheck size={14} color="#059669" />
                    <Text style={styles.featureItemText}>{t('common.freeDelivery')}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Language Selector Modal */}
      <LanguageSelectorModal
        visible={isLangModalOpen}
        onClose={() => setIsLangModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  addressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  mapPinBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '85%',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: {
    fontSize: 18,
  },
  listScroll: {
    paddingBottom: 30,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    marginLeft: 10,
    fontWeight: '500',
  },
  searchClearBtn: {
    padding: 4,
  },
  promosScroll: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  promoCard: {
    width: 210,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  promoIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTextCol: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  promoSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  categorySection: {
    marginVertical: 4,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  categoryChipActive: {
    backgroundColor: '#059669',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 6,
  },
  filterPillActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  shopCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  shopCardClosed: {
    opacity: 0.72,
  },
  shopBannerWrapper: {
    width: '100%',
    height: 140,
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  shopBannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerGradientOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  distanceBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusPillOpen: {
    backgroundColor: '#ecfdf5',
  },
  statusPillClosed: {
    backgroundColor: '#ffe4e6',
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  shopCardBody: {
    padding: 14,
  },
  shopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  shopName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  shopAddress: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  featureItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  featureDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#cbd5e1',
  },
  minOrderText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
