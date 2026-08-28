// Consent bridge. The Google Analytics tag itself is injected server-side
// (scripts/ga-inject.mjs, one GA4 property for every pfa87 hostname), so this
// file no longer carries a measurement ID and never loads gtag.js.
// It only runs this page's consent banner and records the answer, for the
// shared tag to read on the next load and to apply straight away on this one.

(function () {
  'use strict';

  var LEGACY_KEY = 'verimots-consent';
  var SHARED_KEY = 'pfa87-consent';

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
    el.hidden = !show;
    el.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

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
