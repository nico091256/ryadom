import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { UserRole } from '@localshop/shared';

export default function Index() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace('/(auth)/welcome');
      return;
    }

    if (user.role === UserRole.SELLER) {
      if (user.must_change_password) {
        router.replace('/(auth)/change-password');
      } else {
        router.replace('/(seller)/orders');
      }
    } else {
      router.replace('/(customer)');
    }
  }, [isAuthenticated, user, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#16a34a" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
