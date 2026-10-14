import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../../store/useCartStore';
import { useAddressStore } from '../../store/useAddressStore';
import { useAuthStore } from '../../store/useAuthStore';
import { mobileApi } from '../../services/api';
import { formatPrice, SupportedLanguage, PaymentMethod } from '@localshop/shared';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Banknote,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Check,
} from 'lucide-react-native';

export default function CheckoutScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { currentAddress } = useAddressStore();
  const { user } = useAuthStore();
  const { items, shopId, getTotalAmount, clearCart } = useCartStore();

  const [customerPhone, setCustomerPhone] = useState(user?.phone || '+998901234567');
  const [comment, setComment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [loading, setLoading] = useState(false);

  const currentLang = (i18n.language as SupportedLanguage) || SupportedLanguage.UZ;
  const totalTiyin = getTotalAmount();

  const handlePlaceOrder = async () => {
    if (!customerPhone.trim()) {
      Alert.alert('Xatolik', 'Telefon raqamingizni kiriting');
      return;
    }

    setLoading(true);
    try {
      // 1. Sync cart to backend
      await mobileApi.updateCart(
        shopId!,
        items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        true,
      );

      // 2. Submit order
      const order = await mobileApi.createOrder({
        address_text: currentAddress.address_text,
        lat: currentAddress.lat,
        lng: currentAddress.lng,
        customer_phone: customerPhone.trim(),
        payment_method: paymentMethod,
        comment: comment.trim() || undefined,
      });

      // 3. Clear local cart
      clearCart();

      // 4. Navigate to live order tracking screen
      router.replace(`/(customer)/order/${order.id}` as any);
    } catch (err: any) {
      Alert.alert('Xatolik', err.message || 'Buyurtma rasmiylashtirishda xatolik');
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
        <Text style={styles.headerTitle}>{t('checkout.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Delivery Address Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>{t('checkout.deliveryAddress')}</Text>
          </View>
          <Text style={styles.addressText}>{currentAddress.address_text}</Text>
          <TouchableOpacity
            onPress={() => router.push('/(customer)/address-picker')}
            style={styles.changeAddressBtn}
          >
            <Text style={styles.changeAddressText}>{t('home.changeAddress')}</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Phone Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Phone size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>{t('checkout.contactPhone')}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
            placeholder="+998 90 123 45 67"
          />
        </View>

        {/* Courier Comment */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MessageSquare size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>Yetkazib berish izohi</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={comment}
            onChangeText={setComment}
            placeholder={t('checkout.commentPlaceholder')}
            multiline
          />
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('checkout.paymentMethod')}</Text>

          {/* Cash on Delivery */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === PaymentMethod.CASH && styles.paymentOptionActive,
            ]}
            onPress={() => setPaymentMethod(PaymentMethod.CASH)}
          >
            <View style={styles.paymentLeft}>
              <View style={styles.paymentIcon}>
                <Banknote size={20} color="#16a34a" />
              </View>
              <View>
                <Text style={styles.paymentName}>{t('checkout.cashOnDelivery')}</Text>
                <Text style={styles.paymentDesc}>Mahsulotlarni qo'lingizga olgach to'laysiz</Text>
              </View>
            </View>
            {paymentMethod === PaymentMethod.CASH && (
              <View style={styles.checkCircle}>
                <Check size={14} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Online Payment (Phase 2 feature flag: offline by default) */}
          <TouchableOpacity
            style={[styles.paymentOption, styles.paymentOptionDisabled]}
            disabled={true}
          >
            <View style={styles.paymentLeft}>
              <View style={[styles.paymentIcon, { backgroundColor: '#f1f5f9' }]}>
                <CreditCard size={20} color="#94a3b8" />
              </View>
              <View>
                <Text style={[styles.paymentName, { color: '#94a3b8' }]}>
                  {t('checkout.onlinePayment')}
                </Text>
                <Text style={styles.paymentDesc}>Tez orada: Payme & Click</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Xarid hisobi</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Mahsulotlar soni:</Text>
            <Text style={styles.summaryValue}>{items.length} ta</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Yetkazib berish:</Text>
            <Text style={[styles.summaryValue, { color: '#16a34a' }]}>0 so'm (BEPUL)</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>{t('cart.total')}:</Text>
            <Text style={styles.summaryTotalValue}>{formatPrice(totalTiyin, currentLang)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order CTA Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.placeOrderBtn}
          onPress={handlePlaceOrder}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.placeOrderText}>{t('checkout.placeOrder')}</Text>
          )}
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  addressText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginTop: 4,
  },
  changeAddressBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  changeAddressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginTop: 6,
  },
  textarea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginTop: 10,
  },
  paymentOptionActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  paymentOptionDisabled: {
    opacity: 0.6,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  paymentDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    marginTop: 10,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  summaryTotalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#16a34a',
  },
  footer: {
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  placeOrderBtn: {
    backgroundColor: '#16a34a',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  placeOrderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
