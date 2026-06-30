import { useEffect, useMemo, useState } from 'react';

const PAGE_LANGUAGE = 'es';
const AVAILABLE_LANGUAGES = ['es', 'en'];
const LANGUAGE_LABELS = {
  es: 'ES',
  en: 'EN',
};

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function getCookieDomains() {
  if (typeof window === 'undefined') return [''];

  const hostname = window.location.hostname;
  const domains = ['', hostname];
  const parts = hostname.split('.').filter(Boolean);

  if (parts.length > 1) {
    domains.push(`.${parts.slice(-2).join('.')}`);
  }

  return Array.from(new Set(domains));
}

function writeGoogTransCookie(value, expires) {
  const base = `googtrans=${value}; ${expires}; path=/; SameSite=Lax`;

  getCookieDomains().forEach((domain) => {
    const domainPart = domain ? `; domain=${domain}` : '';
    document.cookie = `${base}${domainPart}`;
  });
}

function clearTranslateCookies() {
  const expired = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';

  getCookieDomains().forEach((domain) => {
    const domainPart = domain ? `; domain=${domain}` : '';
    document.cookie = `googtrans=; ${expired}; path=/${domainPart}`;
    document.cookie = `googtrans=/es/es; ${expired}; path=/${domainPart}`;
  });
}

function getInitialLanguage() {
  if (typeof document === 'undefined') return PAGE_LANGUAGE;

  const cookieValue = getCookie('googtrans');
  const parts = cookieValue.split('/').filter(Boolean);
  const current = parts[1];

  return AVAILABLE_LANGUAGES.includes(current) && current !== PAGE_LANGUAGE
    ? current
    : PAGE_LANGUAGE;
}

function setTranslateCookie(language) {
  const value = `/${PAGE_LANGUAGE}/${language}`;
  const expires = 'expires=Fri, 31 Dec 9999 23:59:59 GMT';
  writeGoogTransCookie(value, expires);
}

function triggerGoogleTranslate(language) {
  const combo = document.querySelector('.goog-te-combo');
  if (!combo) return false;

  combo.value = language;
  combo.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function reloadKeepingPosition() {
  window.location.reload();
}

export default function LanguageSelector() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const scriptId = useMemo(() => 'google-translate-script', []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.googleTranslateElementInit = function googleTranslateElementInit() {
      if (!window.google?.translate?.TranslateElement) return;
      if (!document.getElementById('google_translate_element')) return;

      new window.google.translate.TranslateElement(
        {
          pageLanguage: PAGE_LANGUAGE,
          includedLanguages: AVAILABLE_LANGUAGES.join(','),
          autoDisplay: false,
        },
        'google_translate_element'
      );
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [scriptId]);

  function changeLanguage(nextLanguage) {
    if (!AVAILABLE_LANGUAGES.includes(nextLanguage) || nextLanguage === language) return;

    setLanguage(nextLanguage);

    if (nextLanguage === PAGE_LANGUAGE) {
      // Importante: para regresar a español no se traduce el inglés al español.
      // Se eliminan las cookies de Google Translate y se recarga la página para restaurar el HTML original.
      clearTranslateCookies();
      reloadKeepingPosition();
      return;
    }

    setTranslateCookie(nextLanguage);

    const applied = triggerGoogleTranslate(nextLanguage);
    if (!applied) {
      reloadKeepingPosition();
    }
  }

  return (
    <div className="flex items-center rounded-full border border-gray-200 bg-white p-0.5 shadow-sm" aria-label="Selector de idioma">
      <div id="google_translate_element" className="google-translate-hidden" aria-hidden="true" />
      {AVAILABLE_LANGUAGES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => changeLanguage(item)}
          className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
            language === item
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-slate-500 hover:bg-brand-50 hover:text-brand-600'
          }`}
        >
          {LANGUAGE_LABELS[item]}
        </button>
      ))}
    </div>
  );
}
