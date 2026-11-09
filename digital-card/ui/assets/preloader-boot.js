/* Starts before the card paints; independently fails open even if card.js fails. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList || window.EvpowerCardPreloader) return;
  var active = false;
  var exiting = false;
  var started = new Date().getTime();
  var exitTimer;
  var normalTimer;
  var safetyTimer;
  function node() { return document.querySelector('[data-evpc-preloader]'); }
  function remove() {
    window.clearTimeout(normalTimer);
    window.clearTimeout(safetyTimer);
    window.clearTimeout(exitTimer);
    var overlay = node();
    var restoreFocus = overlay && overlay.contains(document.activeElement);
    active = false;
    exiting = false;
    root.classList.remove('evpc-is-loading');
    root.classList.remove('evpc-is-exiting');
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
    if (restoreFocus) {
      var action = document.querySelector('[data-evpc-open-qr]');
      if (action) action.focus();
    }
  }
  function hide(immediate) {
    if (!active) return;
    if (immediate === true) { remove(); return; }
    if (exiting) return;
    var remaining = 900 - (new Date().getTime() - started);
    if (remaining > 0) { window.clearTimeout(normalTimer); normalTimer = window.setTimeout(hide, remaining); return; }
    exiting = true;
    root.classList.add('evpc-is-exiting');
    var overlay = node();
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
    exitTimer = window.setTimeout(remove, 190);
  }
  window.EvpowerCardPreloader = {hide:hide, isActive:function () { return active; }};
  var motion;
  try { if (typeof window.matchMedia === 'function') motion = window.matchMedia('(prefers-reduced-motion: reduce)'); }
  catch (error) { /* Motion APIs are optional. */ }
  if (motion && motion.matches) return;
  // Set this timeout before activating: later script or image failures cannot trap the card.
  safetyTimer = window.setTimeout(remove, 1500);
  active = true;
  root.classList.add('evpc-is-loading');
  normalTimer = window.setTimeout(hide, 900);
  function bind() {
    var overlay = node();
    if (!overlay) { remove(); return; }
    overlay.setAttribute('aria-hidden', active ? 'false' : 'true');
    var image = overlay.querySelector('img');
    if (image) {
      image.addEventListener('error', function () { hide(true); });
      if (image.complete && !image.naturalWidth) hide(true);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (target && typeof target.getAttribute === 'function' && target.getAttribute('data-evpc-preloader-skip') !== null) hide(true);
  });
  document.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target.classList && target.classList.contains('evpc-preloader__image')) hide(true);
  }, true);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.keyCode === 27) hide(true);
  });
  window.addEventListener('pagehide', function () { hide(true); });
  window.addEventListener('pageshow', function (event) { if (event.persisted) hide(true); });
  window.addEventListener('beforeprint', function () { hide(true); });
  function changed(event) { if (event.matches) hide(true); }
  try {
    if (motion && motion.addEventListener) motion.addEventListener('change', changed);
    else if (motion && motion.addListener) motion.addListener(changed);
  } catch (error) { /* An unavailable change listener never blocks the card. */ }
}());
