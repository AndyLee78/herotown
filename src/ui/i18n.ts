import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import ko from '../locales/ko.json'

const stored = localStorage.getItem('locale')
const browserKorean = navigator.language.toLowerCase().startsWith('ko')
const lng = stored === 'en' || stored === 'ko' ? stored : browserKorean ? 'ko' : 'en'

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ko: { translation: ko },
  },
  lng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
