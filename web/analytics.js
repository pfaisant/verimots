// Consent bridge. The Google Analytics tag itself is injected server-side
// (scripts/ga-inject.mjs, one GA4 property for every pfa87 hostname), so this
// file no longer carries a measurement ID and never loads gtag.js.
// It only runs this page's consent banner and records the answer, for the
// shared tag to read on the next load and to apply straight away on this one.

(function () {
  'use strict';

  var LEGACY_KEY = 'verimots-consent';
  var SHARED_KEY = 'pfa87-consent';
  var COPY = {
    fr: ['Ce site utilise Google Analytics pour mesurer l’audience. Les cookies de mesure ne sont activés que si vous acceptez.', 'En savoir plus', 'Accepter', 'Refuser', '/confidentialite.html'],
    en: ['This site uses Google Analytics to measure visits. Analytics cookies are enabled only if you accept.', 'Learn more', 'Accept', 'Decline', '/privacy.html'],
    es: ['Este sitio utiliza Google Analytics para medir las visitas. Las cookies de medición solo se activan si aceptas.', 'Más información', 'Aceptar', 'Rechazar', '/privacidad.html'],
    ca: ['Aquest lloc utilitza Google Analytics per mesurar les visites. Les galetes de mesurament només s’activen si acceptes.', 'Més informació', 'Accepta', 'Rebutja', '/privadesa.html'],
  };

  function translate() {
    var lang = document.documentElement.lang.slice(0, 2);
    var copy = COPY[lang] || COPY.fr;
    var title = document.getElementById('consent-title');
    if (!title) return;
    title.textContent = copy[0] + ' ';
    var link = document.createElement('a');
    link.href = copy[4];
    link.textContent = copy[1];
    title.appendChild(link);
    document.querySelector('#consent [data-consent="granted"]').textContent = copy[2];
    document.querySelector('#consent [data-consent="denied"]').textContent = copy[3];
  }

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }

  function stored() {
    try {
      return localStorage.getItem(SHARED_KEY) || localStorage.getItem(LEGACY_KEY);
    } catch (e) {
      return null;
    }
  }

  function banner(show) {
    var el = document.getElementById('consent');
    if (!el) return;
    translate();
    el.hidden = !show;
    el.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  document.addEventListener('verimots-lang', translate);

  function choose(choice) {
    try {
      localStorage.setItem(SHARED_KEY, choice);
      localStorage.setItem(LEGACY_KEY, choice);
    } catch (e) {
      // Private mode: the choice applies to this page view only.
    }
    gtag('consent', 'update', { analytics_storage: choice });
    banner(false);
  }

  if (!stored()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { banner(true); });
    else banner(true);
  }

  document.addEventListener('click', function (e) {
    var pick = e.target.closest('[data-consent]');
    if (pick) choose(pick.getAttribute('data-consent'));
    if (e.target.closest('[data-cookies]')) banner(true);
  });
})();
