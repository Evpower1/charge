/* No dependency, remote request or fabricated loading percentage. */
(function () {
  'use strict';
  if (window.EvpowerPreloader) return;

  var config = window.evpPreloaderConfig || {};
  var root = document.documentElement;
  var sessionKey = 'evpower_emblem_preloader_seen_v1';
  var sessionOnly = config.sessionOnly !== false;
  var preview = config.preview === true;
  var limit = Math.min(10000, Math.max(1500, Number(config.maxWait) || 6000));
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var active = false;
  var exiting = false;
  var shown = false;
  var started = 0;
  var safetyTimer;
  var holdTimer;
  var exitTimer;

  function overlay() { return document.querySelector('[data-evp-preloader]'); }
  function seen() {
    if (shown) return true;
    try { return window.sessionStorage.getItem(sessionKey) === '1'; }
    catch (error) { return false; }
  }
  function remember() {
    shown = true;
    try { window.sessionStorage.setItem(sessionKey, '1'); }
    catch (error) { /* Storage is optional. */ }
  }
  function clearTimers() {
    window.clearTimeout(safetyTimer);
    window.clearTimeout(holdTimer);
    window.clearTimeout(exitTimer);
  }
  function remove() {
    clearTimers();
    root.classList.remove('evp-is-loading', 'evp-is-exiting');
    active = false;
    exiting = false;
    var node = overlay();
    if (node) node.setAttribute('aria-hidden', 'true');
  }
  function hide(immediately) {
    if (!active) return;
    if (immediately === true || motion.matches) { remove(); return; }
    if (exiting) return;
    window.clearTimeout(holdTimer);
    var remaining = 640 - (performance.now() - started);
    if (remaining > 0) {
      holdTimer = window.setTimeout(hide, remaining);
      return;
    }
    exiting = true;
    root.classList.add('evp-is-exiting');
    var node = overlay();
    if (node) node.setAttribute('aria-hidden', 'true');
    exitTimer = window.setTimeout(remove, 300);
  }
  function addContacts() {
    var node = overlay();
    if (!node) return;
    node.setAttribute('aria-hidden', active ? 'false' : 'true');
    var svg = node.querySelector('.evp-preloader__pulse');
    if (!svg || svg.querySelector('.evp-preloader__contacts')) return;
    var ns = 'http://www.w3.org/2000/svg';
    var group = document.createElementNS(ns, 'g');
    group.setAttribute('class', 'evp-preloader__contacts');
    [[994,615],[1046,615],[1098,615],[994,672],[1046,672],[1098,672]].forEach(function (point, index) {
      var pin = document.createElementNS(ns, 'circle');
      pin.setAttribute('cx', point[0]);
      pin.setAttribute('cy', point[1]);
      pin.setAttribute('r', '14');
      pin.style.animationDelay = (index * .075) + 's';
      group.appendChild(pin);
    });
    svg.appendChild(group);
  }
  function show(options) {
    options = options || {};
    if (!options.force && sessionOnly && seen()) return false;
    clearTimers();
    active = true;
    exiting = false;
    started = performance.now();
    root.classList.remove('evp-is-exiting', 'evp-is-loading');
    // Restart the CSS safety timer when the demo's Replay button is used.
    void root.offsetWidth;
    root.classList.add('evp-is-loading');
    remember();
    addContacts();
    safetyTimer = window.setTimeout(function () { hide(true); }, limit);
    return true;
  }

  window.EvpowerPreloader = { show: show, hide: hide, isActive: function () { return active; } };
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (target instanceof Element && target.closest('[data-evp-skip]')) hide(true);
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') hide(true); });
  window.addEventListener('pagehide', function () { hide(true); });
  window.addEventListener('pageshow', function (event) { if (event.persisted) hide(true); });
  function motionChanged(event) { if (event.matches) hide(true); }
  if (motion.addEventListener) motion.addEventListener('change', motionChanged);
  else if (motion.addListener) motion.addListener(motionChanged);

  show();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addContacts, { once: true });
  else addContacts();
  if (!preview) {
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', function () { hide(); }, { once: true });
  }
}());
