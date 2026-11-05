// Signing in by email (27 October 2026): the sign-in tokens, shared by Home and the project pages.
// Kept in this tab only (sessionStorage), or, when the person ticked "keep me signed in" on their own
// computer, in this browser for 30 days (localStorage). Never in the address. Without "keep", the
// person is signed out after a working day (12 hours). The admin page keeps its own copy in the same
// place, so the master's sign-in works here unchanged.
(function () {
  'use strict';
  var K = 'vt_auth', KK = 'vt_auth_keep', DAY = 864e5, WORKDAY = 12 * 36e5;
  function read() {
    try { var t = JSON.parse(sessionStorage.getItem(K) || 'null'); if (t) return t; } catch (e) {}
    try {
      var k = JSON.parse(localStorage.getItem(KK) || 'null');
      if (k && k.keep_until && k.keep_until > Date.now()) { sessionStorage.setItem(K, JSON.stringify(k)); return k; }
      if (k) localStorage.removeItem(KK);
    } catch (e) {}
    return null;
  }
  function write(t) {
    try { sessionStorage.setItem(K, JSON.stringify(t)); } catch (e) {}
    if (t.keep_until) { try { localStorage.setItem(KK, JSON.stringify(t)); } catch (e) {} }
  }
  function clear() { try { sessionStorage.removeItem(K); localStorage.removeItem(KK); } catch (e) {} }
  function dayOver(t) { return !t.keep_until && t.signed_at && Date.now() - t.signed_at > WORKDAY; }
  async function refresh(t) {
    try {
      var r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh', refresh_token: t.refresh_token }) });
      if (!r.ok) return null;
      var d = await r.json();
      var n = Object.assign({}, t, { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000 });
      write(n); return n;
    } catch (e) { return null; }
  }
  window.VTAuth = {
    get: read,
    clear: clear,
    signedIn: function () { var t = read(); return !!(t && t.access_token && !dayOver(t)); },
    user: function () { var t = read(); return (t && t.user) || null; },
    save: function (d, keep) {
      var t = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, signed_at: Date.now(), user: d.user || null };
      if (keep) t.keep_until = Date.now() + 30 * DAY;
      write(t); return t;
    },
    setUser: function (u) { var t = read(); if (t) { t.user = Object.assign({}, t.user || {}, u); write(t); } },
    // the Authorization header for an API call, refreshed when it is about to run out
    header: async function () {
      var t = read(); if (!t || !t.access_token) return null;
      if (dayOver(t)) { clear(); return null; }
      if (t.expires_at && t.expires_at - Date.now() < 90e3 && t.refresh_token) { t = await refresh(t); if (!t) return null; }
      return 'Bearer ' + t.access_token;
    },
    refreshNow: async function () { var t = read(); return !!(t && t.refresh_token && await refresh(t)); },
    // the sign-in link lands with the tokens after "#": read once, keep, and clear the address
    fromLink: function () {
      if (!/access_token=|error_code=/.test(location.hash)) return null;
      var h = new URLSearchParams(location.hash.slice(1));
      history.replaceState(null, '', location.pathname + location.search);
      if (h.get('error_code') || h.get('error')) return { error: h.get('error_code') || h.get('error') };
      var keep = false; try { keep = localStorage.getItem('vt_keep_pending') === '1'; localStorage.removeItem('vt_keep_pending'); } catch (e) {}
      var d = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: Number(h.get('expires_in')) || 3600 };
      return d.access_token ? window.VTAuth.save(d, keep) : null;
    }
  };
})();
