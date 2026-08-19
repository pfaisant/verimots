// Google Analytics 4 with Consent Mode v2
// Measurement ID: G-6R0YS8HW30
// Property: Verimots (550806688)

(function () {
  'use strict';

  const MEASUREMENT_ID = 'G-6R0YS8HW30';
  const CONSENT_KEY = 'verimots-consent';
  const WAIT_FOR_UPDATE = 500;

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  window.gtag = gtag;

  // Queue consent defaults BEFORE loading gtag.js
  // Consent Mode v2: all identifying storage denied by default
  // Only analytics_storage will be granted if user accepts
  // ad_storage, ad_user_data, ad_personalization stay denied
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: WAIT_FOR_UPDATE,
  });

  // Restore stored consent choice from localStorage
  const storedConsent = localStorage.getItem(CONSENT_KEY);
  if (storedConsent === 'granted') {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
    });
  } else if (storedConsent === 'denied') {
    gtag('consent', 'update', {
      analytics_storage: 'denied',
    });
  }

  // Load gtag.js
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
  document.head.appendChild(script);

  // Configure GA4
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, {
    anonymize_ip: true,
  });

  // Handle consent banner
  function showBanner() {
    const banner = document.getElementById('consent');
    if (banner) {
      banner.hidden = false;
      banner.setAttribute('aria-hidden', 'false');
    }
  }

  function hideBanner() {
    const banner = document.getElementById('consent');
    if (banner) {
      banner.hidden = true;
      banner.setAttribute('aria-hidden', 'true');
    }
  }

  function handleConsent(choice) {
    localStorage.setItem(CONSENT_KEY, choice);
    
    gtag('consent', 'update', {
      analytics_storage: choice,
    });
    
    hideBanner();
  }

  // Show banner if no stored choice
  if (!storedConsent) {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }

  // Handle consent button clicks
  document.addEventListener('click', function (e) {
    const target = e.target.closest('[data-consent]');
    if (target) {
      const choice = target.getAttribute('data-consent');
      handleConsent(choice);
    }

    // Handle cookie settings button
    if (e.target.closest('[data-cookies]')) {
      showBanner();
    }
  });
})();
