import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatPrice, resolveLocalizedText } from '@localshop/shared';
import { X, Plus, Minus, ShoppingBag, CheckCircle, ShieldCheck } from 'lucide-react-native';
import { hapticFeedback } from '../utils/haptics';
import { toSupportedLang } from '../utils/localize';

const { width } = Dimensions.get('window');

interface ProductDetailModalProps {
  visible: boolean;
  product: any;
  currentQuantity: number;
  onClose: () => void;
  onAddToCart: (product: any, quantity: number) => void;
  shopName?: string;
}

export default function ProductDetailModal({
  visible,
  product,
  currentQuantity,
  onClose,
  onAddToCart,
  shopName,
}: ProductDetailModalProps) {
  const { t, i18n } = useTranslation();
  const currentLang = toSupportedLang(i18n.language);
  const [qty, setQty] = useState(currentQuantity > 0 ? currentQuantity : 1);

  if (!product) return null;

  const title = resolveLocalizedText(
    {
      uz: product.name_uz,
      ru: product.name_ru,
      en: product.name_en,
    },
    currentLang,
  );

  // Seller's description in the current language (falls back to Uzbek), else a generic blurb
  const description =
    resolveLocalizedText(
      {
        uz: product.description_uz,
        ru: product.description_ru,
        en: product.description_en,
      },
      currentLang,
    ) || t('customer.product.defaultDescription');

  const priceFormatted = formatPrice(product.price, currentLang);
  const totalFormatted = formatPrice(product.price * qty, currentLang);

  const handleIncrement = () => {
    hapticFeedback.light();
    setQty((prev) => Math.min(prev + 1, Math.max(product.stock || 0, 1)));
  };

  const handleDecrement = () => {
    hapticFeedback.light();
    setQty((prev) => Math.max(prev - 1, 1));
  };

  const handleAdd = () => {
    hapticFeedback.success();
    onAddToCart(product, qty);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="#64748b" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Image */}
            <View style={styles.imageWrapper}>
              {product.image_url ? (
                <Image source={{ uri: product.image_url }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <ShoppingBag size={56} color="#cbd5e1" />
                </View>
              )}
            </View>

            {/* Shop info */}
            {shopName && (
              <View style={styles.shopRow}>
                <CheckCircle size={14} color="#059669" />
                <Text style={styles.shopNameText}>{shopName}</Text>
              </View>
            )}

            {/* Title & Price */}
            <Text style={styles.title}>{title}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{priceFormatted}</Text>
              {product.stock > 0 ? (
                <View style={styles.inStockBadge}>
                  <Text style={styles.inStockText}>
                    {t('customer.product.inStock', { count: product.stock })}
                  </Text>
                </View>
              ) : (
                <View style={styles.outStockBadge}>
                  <Text style={styles.outStockText}>{t('shop.outOfStock')}</Text>
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.descBox}>
              <Text style={styles.descTitle}>{t('customer.product.description')}</Text>
              <Text style={styles.descText}>{description}</Text>
            </View>

            {/* Delivery Promise */}
            <View style={styles.guaranteeBox}>
              <ShieldCheck size={18} color="#059669" />
              <Text style={styles.guaranteeText}>
                {t('customer.product.guarantee')}
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={styles.footer}>
            {/* Quantity Stepper */}
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepBtn, qty <= 1 && styles.stepBtnDisabled]}
                onPress={handleDecrement}
                disabled={qty <= 1}
              >
                <Minus size={18} color={qty <= 1 ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qty}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={handleIncrement}
                disabled={qty >= (Math.max(product.stock || 0, 1))}
              >
                <Plus size={18} color="#0f172a" />
              </TouchableOpacity>
            </View>

            {/* Add to Cart CTA */}
            <TouchableOpacity
              style={[styles.addBtn, product.stock <= 0 && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={product.stock <= 0}
            >
              <Text style={styles.addBtnText}>
                {t('shop.addToCart')} • {totalFormatted}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  imageWrapper: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    marginBottom: 16,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  unitText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  shopNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  price: {
    fontSize: 24,
    fontWeight: '900',
    color: '#059669',
  },
  inStockBadge: {
    backgroundColor: '#ecfdf5',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  inStockText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  outStockBadge: {
    backgroundColor: '#ffe4e6',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  outStockText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e11d48',
  },
  descBox: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
  },
  descTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  descText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  guaranteeText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 4,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepBtnDisabled: {
    backgroundColor: '#f8fafc',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginHorizontal: 14,
  },
  addBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
