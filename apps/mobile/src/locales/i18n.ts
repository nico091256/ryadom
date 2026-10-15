import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uz from './uz.json';
import ru from './ru.json';
import en from './en.json';
// Screen-area translations live in their own files and are merged on top of the base ones
import customerUz from './customer/uz.json';
import customerRu from './customer/ru.json';
import customerEn from './customer/en.json';
import sellerUz from './seller/uz.json';
import sellerRu from './seller/ru.json';
import sellerEn from './seller/en.json';

export const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en'] as const;
export const LANGUAGE_STORAGE_KEY = 'preferred_language';

const resources = {
  uz: { translation: { ...uz, ...customerUz, ...sellerUz } },
  ru: { translation: { ...ru, ...customerRu, ...sellerRu } },
  en: { translation: { ...en, ...customerEn, ...sellerEn } },
};

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources,
  lng: 'uz', // default language as mandated by specification Section 10
  fallbackLng: 'uz',
  interpolation: {
    escapeValue: false,
  },
});

// Restore the language picked on a previous launch (also for guests, who have no profile)
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((lang) => {
    if (lang && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang) && lang !== i18n.language) {
      i18n.changeLanguage(lang);
    }
  })
  .catch(() => {});

export default i18n;
