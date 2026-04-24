/* =========================================================
   HELIX — Page Analytics Tracker
   Records page visits, daily counts, and referrers
   into localStorage for the admin analytics dashboard.
========================================================= */
(function () {
  'use strict';

  try {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    if (!page || !page.includes('.')) page = 'index.html';

    /* Page visit counts */
    var visits = JSON.parse(localStorage.getItem('helix_page_visits') || '{}');
    visits[page] = (visits[page] || 0) + 1;
    localStorage.setItem('helix_page_visits', JSON.stringify(visits));

    /* Daily visit counts */
    var today = new Date().toISOString().split('T')[0];
    var daily = JSON.parse(localStorage.getItem('helix_daily_visits') || '{}');
    daily[today] = (daily[today] || 0) + 1;
    localStorage.setItem('helix_daily_visits', JSON.stringify(daily));

    /* Referrer tracking */
    if (document.referrer) {
      try {
        var refDomain = new URL(document.referrer).hostname;
        if (refDomain && refDomain !== window.location.hostname) {
          var refs = JSON.parse(localStorage.getItem('helix_referrers') || '{}');
          refs[refDomain] = (refs[refDomain] || 0) + 1;
          localStorage.setItem('helix_referrers', JSON.stringify(refs));
        }
      } catch (e) {}
    }

    /* Signup date tracking (for growth chart) — triggered from signup.html */
    /* Called externally by signup.html after account creation */

  } catch (e) {}
})();
