import React, { useState, useEffect, useMemo } from 'react';
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
import { formatPrice, PaymentMethod } from '@localshop/shared';
import { hapticFeedback } from '../../utils/haptics';
import { toSupportedLang } from '../../utils/localize';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Banknote,
  CreditCard,
  MessageSquare,
  Clock,
  Check,
} from 'lucide-react-native';

/** Next few whole-hour delivery windows for today, e.g. "15:00 - 16:00" */
function getTodaySlots(count = 4): string[] {
  const slots: string[] = [];
  const now = new Date();
  // Earliest slot starts at least ~1 hour from now
  let startHour = now.getHours() + (now.getMinutes() > 0 ? 2 : 1);
  while (slots.length < count && startHour < 23) {
    const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
    slots.push(`${pad(startHour)} - ${pad(startHour + 1)}`);
    startHour += 1;
  }
  return slots;
}

export default function CheckoutScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { currentAddress } = useAddressStore();
  const { user } = useAuthStore();
  const { items, shopId, shopName, getTotalAmount, clearCart, promo, getDiscountAmount } =
    useCartStore();

  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');

  // Auth may resolve after mount — prefill the phone once it is known
  useEffect(() => {
    if (user?.phone) {
      setCustomerPhone((prev) => prev || user.phone || '');
    }
  }, [user?.phone]);
  const [entrance, setEntrance] = useState(currentAddress.entrance || '');
  const [floor, setFloor] = useState(currentAddress.floor || '');
  const [apartment, setApartment] = useState(currentAddress.apartment || '');
  const [doorCode, setDoorCode] = useState(currentAddress.door_code || '');

  // Picking another address on the map brings its saved apartment details along
  useEffect(() => {
    setEntrance(currentAddress.entrance || '');
    setFloor(currentAddress.floor || '');
    setApartment(currentAddress.apartment || '');
    setDoorCode(currentAddress.door_code || '');
  }, [currentAddress]);
  const [comment, setComment] = useState('');
  const [changeFrom, setChangeFrom] = useState<string>('exact'); // 'exact', '50000', '100000', '200000'
  const [deliveryOption, setDeliveryOption] = useState<'express' | 'scheduled'>('express');
  const timeSlots = useMemo(() => getTodaySlots(), []);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [loading, setLoading] = useState(false);

  const currentLang = toSupportedLang(i18n.language);
  // Notes appended to the order are read by the shopkeeper, so they are always written in Uzbek
  const tShop = i18n.getFixedT('uz');
  const subtotalTiyin = getTotalAmount();
  const discountTiyin = getDiscountAmount();
  const totalTiyin = Math.max(0, subtotalTiyin - discountTiyin);

  // Resolved on every render so the chips follow language switches
  const quickInstructions = [
    t('customer.checkout.quickLeaveAtDoor'),
    t('customer.checkout.quickDontRing'),
    t('customer.checkout.quickCallAhead'),
    t('customer.checkout.quickIntercomBroken'),
  ];

  const handlePlaceOrder = async () => {
    if (!customerPhone.trim()) {
      hapticFeedback('medium');
      Alert.alert(t('customer.common.error'), t('customer.checkout.errorPhone'));
      return;
    }

    if (!currentAddress.address_text) {
      hapticFeedback('medium');
      Alert.alert(t('customer.common.error'), t('customer.checkout.errorAddress'));
      return;
    }

    if (deliveryOption === 'scheduled' && !selectedSlot) {
      hapticFeedback('medium');
      Alert.alert(t('customer.common.error'), t('customer.checkout.errorSlot'));
      return;
    }

    setLoading(true);
    hapticFeedback('medium');

    try {
      // 1. Sync cart to backend
      await mobileApi.updateCart(
        shopId!,
        items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        true,
      );

      // 2. Assemble address details
      const addressDetailsParts = [];
      if (entrance) addressDetailsParts.push(tShop('customer.checkout.shopNote.entrance', { value: entrance }));
      if (floor) addressDetailsParts.push(tShop('customer.checkout.shopNote.floor', { value: floor }));
      if (apartment) addressDetailsParts.push(tShop('customer.checkout.shopNote.apartment', { value: apartment }));
      if (doorCode) addressDetailsParts.push(tShop('customer.checkout.shopNote.doorCode', { value: doorCode }));

      let fullAddress = currentAddress.address_text;
      if (addressDetailsParts.length > 0) {
        fullAddress += ` (${addressDetailsParts.join(', ')})`;
      }

      // 3. Assemble comment with change info
      let fullComment = comment.trim();
      if (paymentMethod === PaymentMethod.CASH) {
        if (changeFrom === 'exact') {
          fullComment += (fullComment ? ' | ' : '') + tShop('customer.checkout.shopNote.noChange');
        } else if (changeFrom) {
          fullComment += (fullComment ? ' | ' : '') + tShop('customer.checkout.shopNote.changeFrom', { amount: changeFrom });
        }
      }

      if (deliveryOption === 'scheduled' && selectedSlot) {
        fullComment += (fullComment ? ' | ' : '') + tShop('customer.checkout.shopNote.slot', { slot: selectedSlot });
      }

      // 4. Submit order (promo code is re-validated and applied server-side)
      const order = await mobileApi.createOrder({
        address_text: fullAddress,
        lat: currentAddress.lat,
        lng: currentAddress.lng,
        customer_phone: customerPhone.trim(),
        payment_method: paymentMethod,
        comment: fullComment || undefined,
        promo_code: promo?.code,
      });

      // 5. Success haptic feedback & clear cart
      hapticFeedback('success');
      clearCart();

      // 6. Navigate to live tracking
      router.replace(`/(customer)/order/${order.id}` as any);
    } catch (err: any) {
      hapticFeedback('medium');
      Alert.alert(t('customer.common.error'), err.message || t('customer.checkout.errorPlace'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            hapticFeedback('selection');
            router.back();
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>{t('checkout.title')}</Text>
          <Text style={styles.headerSub}>{shopName || t('customer.cart.localShop')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Delivery Address Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>{t('checkout.deliveryAddress')}</Text>
          </View>
          <Text style={styles.addressText}>{currentAddress.address_text}</Text>

          <TouchableOpacity
            onPress={() => {
              hapticFeedback('selection');
              router.push('/(customer)/address-picker');
            }}
            style={styles.changeAddressBtn}
          >
            <Text style={styles.changeAddressText}>{t('customer.checkout.changeOnMap')} →</Text>
          </TouchableOpacity>

          {/* Entrance / Floor / Apt details */}
          <View style={styles.subAddressRow}>
            <View style={styles.subInputWrapper}>
              <Text style={styles.subInputLabel}>{t('customer.address.entrance')}</Text>
              <TextInput
                style={styles.subInput}
                value={entrance}
                onChangeText={setEntrance}
                placeholder="1"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.subInputWrapper}>
              <Text style={styles.subInputLabel}>{t('customer.address.floor')}</Text>
              <TextInput
                style={styles.subInput}
                value={floor}
                onChangeText={setFloor}
                placeholder="4"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.subInputWrapper}>
              <Text style={styles.subInputLabel}>{t('customer.address.apartment')}</Text>
              <TextInput
                style={styles.subInput}
                value={apartment}
                onChangeText={setApartment}
                placeholder="16"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.subInputWrapper}>
              <Text style={styles.subInputLabel}>{t('customer.address.doorCode')}</Text>
              <TextInput
                style={styles.subInput}
                value={doorCode}
                onChangeText={setDoorCode}
                placeholder="16B"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        </View>

        {/* Delivery Speed / Timing */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Clock size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>{t('customer.checkout.deliveryTime')}</Text>
          </View>
          <View style={styles.deliveryTimeOptions}>
            <TouchableOpacity
              style={[
                styles.timeOption,
                deliveryOption === 'express' && styles.timeOptionActive,
              ]}
              onPress={() => {
                hapticFeedback('selection');
                setDeliveryOption('express');
              }}
            >
              <Text
                style={[
                  styles.timeOptionTitle,
                  deliveryOption === 'express' && styles.timeOptionTitleActive,
                ]}
              >
                {t('customer.checkout.express', { range: '15-25' })}
              </Text>
              <Text style={styles.timeOptionDesc}>{t('customer.checkout.expressDesc')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.timeOption,
                deliveryOption === 'scheduled' && styles.timeOptionActive,
              ]}
              onPress={() => {
                hapticFeedback('selection');
                setDeliveryOption('scheduled');
              }}
            >
              <Text
                style={[
                  styles.timeOptionTitle,
                  deliveryOption === 'scheduled' && styles.timeOptionTitleActive,
                ]}
              >
                {t('customer.checkout.scheduled')}
              </Text>
              <Text style={styles.timeOptionDesc}>{t('customer.checkout.scheduledDesc')}</Text>
            </TouchableOpacity>
          </View>

          {deliveryOption === 'scheduled' && (
            <View style={styles.changeSelectorContainer}>
              <Text style={styles.changeTitle}>{t('customer.checkout.pickSlot')}</Text>
              {timeSlots.length === 0 ? (
                <Text style={styles.inputHint}>{t('customer.checkout.noSlots')}</Text>
              ) : (
                <View style={styles.changeChipsRow}>
                  {timeSlots.map((slot) => (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.changeChip, selectedSlot === slot && styles.changeChipActive]}
                      onPress={() => {
                        hapticFeedback('selection');
                        setSelectedSlot(slot);
                      }}
                    >
                      <Text
                        style={[
                          styles.changeChipText,
                          selectedSlot === slot && styles.changeChipTextActive,
                        ]}
                      >
                        {slot}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
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
            placeholderTextColor="#94a3b8"
          />
          <Text style={styles.inputHint}>{t('customer.checkout.phoneHint')}</Text>
        </View>

        {/* Payment Methods & Change Selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('checkout.paymentMethod')}</Text>

          {/* Cash on Delivery */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === PaymentMethod.CASH && styles.paymentOptionActive,
            ]}
            onPress={() => {
              hapticFeedback('selection');
              setPaymentMethod(PaymentMethod.CASH);
            }}
          >
            <View style={styles.paymentLeft}>
              <View style={styles.paymentIcon}>
                <Banknote size={20} color="#16a34a" />
              </View>
              <View>
                <Text style={styles.paymentName}>{t('checkout.cashOnDelivery')}</Text>
                <Text style={styles.paymentDesc}>{t('customer.checkout.cashDesc')}</Text>
              </View>
            </View>
            {paymentMethod === PaymentMethod.CASH && (
              <View style={styles.checkCircle}>
                <Check size={14} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Change preparation selector if CASH is selected */}
          {paymentMethod === PaymentMethod.CASH && (
            <View style={styles.changeSelectorContainer}>
              <Text style={styles.changeTitle}>{t('customer.checkout.changeQuestion')}</Text>
              <View style={styles.changeChipsRow}>
                {[
                  { id: 'exact', label: t('customer.checkout.changeExact') },
                  { id: '50 000', label: t('customer.checkout.changeThousands', { amount: 50 }) },
                  { id: '100 000', label: t('customer.checkout.changeThousands', { amount: 100 }) },
                  { id: '200 000', label: t('customer.checkout.changeThousands', { amount: 200 }) },
                ].map((chip) => (
                  <TouchableOpacity
                    key={chip.id}
                    style={[
                      styles.changeChip,
                      changeFrom === chip.id && styles.changeChipActive,
                    ]}
                    onPress={() => {
                      hapticFeedback('selection');
                      setChangeFrom(chip.id);
                    }}
                  >
                    <Text
                      style={[
                        styles.changeChipText,
                        changeFrom === chip.id && styles.changeChipTextActive,
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Online Payment (Payme & Click) */}
          <TouchableOpacity
            style={[styles.paymentOption, styles.paymentOptionDisabled]}
            disabled={true}
          >
            <View style={styles.paymentLeft}>
              <View style={[styles.paymentIcon, { backgroundColor: '#f1f5f9' }]}>
                <CreditCard size={20} color="#94a3b8" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.paymentName, { color: '#94a3b8' }]}>
                    {t('checkout.onlinePayment')}
                  </Text>
                  <Text style={styles.soonBadge}>{t('customer.checkout.soon')}</Text>
                </View>
                <Text style={styles.paymentDesc}>{t('customer.checkout.onlineDesc')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Courier Comment & Quick Tags */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MessageSquare size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>{t('customer.checkout.commentTitle')}</Text>
          </View>

          {/* Quick instruction pills */}
          <View style={styles.quickTagsWrapper}>
            {quickInstructions.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.quickTagChip}
                onPress={() => {
                  hapticFeedback('selection');
                  setComment((prev) => (prev ? `${prev}, ${tag}` : tag));
                }}
              >
                <Text style={styles.quickTagText}>+ {tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, styles.textarea]}
            value={comment}
            onChangeText={setComment}
            placeholder={t('checkout.commentPlaceholder')}
            placeholderTextColor="#94a3b8"
            multiline
          />
        </View>

        {/* Order Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('customer.checkout.summaryTitle')}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('customer.checkout.summaryItems', { count: items.length })}</Text>
            <Text style={styles.summaryValue}>{formatPrice(subtotalTiyin, currentLang)}</Text>
          </View>
          {promo && discountTiyin > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#e11d48' }]}>
                {t('customer.checkout.summaryDiscount', { code: promo.code })}
              </Text>
              <Text style={[styles.summaryValue, { color: '#e11d48' }]}>
                -{formatPrice(discountTiyin, currentLang)}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('customer.checkout.summaryDelivery')}</Text>
            <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
              {t('customer.cart.deliveryFree', { price: formatPrice(0, currentLang) })}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('customer.checkout.summaryServiceFee')}</Text>
            <Text style={styles.summaryValue}>{formatPrice(0, currentLang)}</Text>
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
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={styles.placeOrderInner}>
              <Text style={styles.placeOrderText}>{t('checkout.placeOrder')}</Text>
              <Text style={styles.placeOrderPrice}>{formatPrice(totalTiyin, currentLang)}</Text>
            </View>
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
  headerTitleWrapper: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '700',
    marginTop: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  addressText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 2,
  },
  changeAddressBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  changeAddressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  subAddressRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  subInputWrapper: {
    flex: 1,
  },
  subInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  subInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    textAlign: 'center',
  },
  deliveryTimeOptions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  timeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  timeOptionActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  timeOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  timeOptionTitleActive: {
    color: '#166534',
  },
  timeOptionDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginTop: 4,
  },
  inputHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  textarea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  quickTagsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  quickTagChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
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
    flex: 1,
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
  soonBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
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
  changeSelectorContainer: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  changeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  changeChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  changeChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  changeChipActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  changeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  changeChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
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
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryTotalValue: {
    fontSize: 18,
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
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  placeOrderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  placeOrderText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  placeOrderPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
  },
});

