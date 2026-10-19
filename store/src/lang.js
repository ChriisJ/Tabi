// Setzt Texte je nach ?lang=de|en (Standard: de) aus data-de / data-en.
(() => {
  const lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'de';
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-de]')) el.innerHTML = el.dataset[lang];
})();
