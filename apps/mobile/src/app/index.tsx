import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { UserRole } from '@localshop/shared';

const BRAND = 'Ryadom';
const useNativeDriver = Platform.OS !== 'web';

export default function Index() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [introDone, setIntroDone] = useState(false);

  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const letters = useRef(BRAND.split('').map(() => new Animated.Value(0))).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver,
      }),
    ).start();

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver,
        }),
      ]),
      Animated.stagger(
        70,
        letters.map((v) =>
          Animated.spring(v, { toValue: 1, friction: 6, tension: 80, useNativeDriver }),
        ),
      ),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 350, useNativeDriver }),
      Animated.delay(500),
    ]).start(() => setIntroDone(true));
  }, []);

  useEffect(() => {
    if (!introDone || isLoading) return;

    let target = '/(customer)';
    if (isAuthenticated && user?.role === UserRole.SELLER) {
      target = user.must_change_password ? '/(auth)/change-password' : '/(seller)/orders';
    }

    Animated.timing(screenOpacity, { toValue: 0, duration: 250, useNativeDriver }).start(() =>
      router.replace(target as any),
    );
  }, [introDone, isLoading, isAuthenticated, user]);

  const rotate = logoRotate.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <View style={styles.logoWrap}>
        <Animated.View
          style={[styles.pulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
        />
        <Animated.View
          style={[
            styles.logoBadge,
            { opacity: logoOpacity, transform: [{ scale: logoScale }, { rotate }] },
          ]}
        >
          <Text style={styles.logoLetter}>R</Text>
        </Animated.View>
      </View>

      <View style={styles.titleRow}>
        {BRAND.split('').map((ch, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.title,
              {
                opacity: letters[i],
                transform: [
                  {
                    translateY: letters[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        {t('customer.profile.tagline')}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulse: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: '#ffffff',
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  logoLetter: {
    fontSize: 52,
    fontWeight: '900',
    color: '#16a34a',
  },
  titleRow: {
    flexDirection: 'row',
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#dcfce7',
  },
});
