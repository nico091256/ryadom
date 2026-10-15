import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../../store/useCartStore';
import { Store, ShoppingBag, Clock, User, Map as MapIcon } from 'lucide-react-native';

export default function CustomerTabsLayout() {
  const { t } = useTranslation();
  // Keep icons clear of the phone's home indicator / gesture bar
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8) + 6;
  const cartItemsCount = useCartStore((state) =>
    state.items.reduce((sum, i) => sum + i.quantity, 0),
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f1f5f9',
          height: 58 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Store size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('customer.tabs.map'),
          tabBarIcon: ({ color, size }) => <MapIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabs.cart'),
          tabBarBadge: cartItemsCount > 0 ? cartItemsCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#16a34a', fontSize: 10 },
          tabBarIcon: ({ color, size }) => <ShoppingBag size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop/[id]"
        options={{
          href: null, // Hide from bottom tab bar
        }}
      />
      <Tabs.Screen
        name="order/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="checkout"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="address-picker"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
