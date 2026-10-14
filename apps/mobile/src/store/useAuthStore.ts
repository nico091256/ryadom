import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole } from '@localshop/shared';
import i18n from '../locales/i18n';
import { mobileApi } from '../services/api';

export interface AuthUser {
  id: string;
  phone?: string | null;
  login?: string | null;
  name?: string | null;
  role: UserRole;
  language?: string;
  must_change_password?: boolean;
  shopId?: string | null;
  shop?: any;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  setLanguage: (lang: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });
    if (user?.language) {
      i18n.changeLanguage(user.language);
    }
  },

  setLanguage: async (lang) => {
    i18n.changeLanguage(lang);
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, language: lang } });
      try {
        await mobileApi.updateProfile({ language: lang });
      } catch (e) {
        console.warn('Failed to persist language', e);
      }
    }
    await AsyncStorage.setItem('preferred_language', lang);
  },

  logout: async () => {
    await mobileApi.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const token = await mobileApi.getToken();
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      const profile = await mobileApi.getProfile();
      set({
        user: profile as AuthUser,
        isAuthenticated: true,
        isLoading: false,
      });
      if (profile.language) {
        i18n.changeLanguage(profile.language);
      }
    } catch {
      await mobileApi.clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
