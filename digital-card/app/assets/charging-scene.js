/* A single physical timeline keeps the vehicle, cable and charging display in sync. */
(function () {
  'use strict';
  function init(scene) {
    if (scene.getAttribute('data-ev-ready') === 'true') return;
    if (typeof window.requestAnimationFrame !== 'function' || typeof window.cancelAnimationFrame !== 'function') return;
    var car = scene.querySelector('[data-ev-car]');
    var plug = scene.querySelector('[data-ev-plug]');
    var cable = scene.querySelector('[data-ev-cable]');
    var energy = scene.querySelector('[data-ev-energy]');
    var battery = scene.querySelector('[data-ev-battery]');
    var percent = scene.querySelector('[data-ev-percent]');
    var status = scene.querySelector('[data-ev-status]');
    var toggle = scene.querySelector('[data-ev-toggle]');
    var portGlow = scene.querySelector('[data-ev-port-glow]');
    var chargerGlow = scene.querySelector('[data-ev-charger-glow]');
    var lights = scene.querySelector('[data-ev-lights]');
    var wheels = scene.querySelectorAll('[data-ev-wheel]');
    if (!car || !plug || !cable || !battery || !percent || !status) return;
    scene.setAttribute('data-ev-ready', 'true');
    var duration = 16.8;
    var elapsed = 0;
    var last = null;
    var frame = 0;
    var started = false;
    var userPaused = false;
    var onScreen = true;
    var pageHidden = false;
    var printing = false;
    var reduced = false;
    var media;
    var introStart = new Date().getTime();
    var card = document.querySelector('[data-evpc-card]');
    var dialogs = card ? card.querySelectorAll('dialog') : [];

    function clamp(value) { return Math.max(0, Math.min(1, value)); }
    function ease(value) { return (1 - Math.cos(Math.PI * clamp(value))) / 2; }
    function attr(node, name, value) { if (node) node.setAttribute(name, String(value)); }
    function pose(x, connection, charge, phase, time, distance) {
      var q = clamp(connection);
      var angle = -90 * (1 - q);
      var radians = angle * Math.PI / 180;
      var tipX = 115 + 69 * q;
      var tipY = 180 + 44 * q - Math.sin(Math.PI * q) * 14;
      // Cable joins the handle, rather than stopping at the connector's metal tip.
      var endX = tipX - 17 * Math.cos(radians) - 7 * Math.sin(radians);
      var endY = tipY - 17 * Math.sin(radians) + 7 * Math.cos(radians);
      var path = 'M115 188C' + (104 - 4 * q).toFixed(2) + ' ' + (267 + 14 * q).toFixed(2) + ' ' + (148 + 10 * q).toFixed(2) + ' ' + (280 + 14 * q).toFixed(2) + ' ' + endX.toFixed(2) + ' ' + endY.toFixed(2);
      var moving = phase === 'arriving' || phase === 'departing';
      var pulse = (1 + Math.sin(time * Math.PI * 1.1)) / 2;
      attr(car, 'transform', 'translate(' + x.toFixed(2) + ' 0)');
      attr(plug, 'transform', 'translate(' + tipX.toFixed(2) + ' ' + tipY.toFixed(2) + ') rotate(' + angle.toFixed(2) + ')');
      attr(cable, 'd', path);
      attr(energy, 'd', path);
      attr(energy, 'stroke-dashoffset', (-time * 56).toFixed(2));
      attr(energy, 'opacity', phase === 'charging' ? .35 + .4 * pulse : phase === 'complete' ? .55 : 0);
      attr(portGlow, 'opacity', q * (phase === 'charging' ? .15 + .12 * pulse : .13));
      attr(chargerGlow, 'opacity', .27 + .42 * q + (phase === 'charging' ? .12 * pulse : 0));
      attr(lights, 'opacity', moving ? .7 : .2);
      var wheelAngle = distance / 29.5 * 180 / Math.PI;
      for (var i = 0; i < wheels.length; i++) {
        attr(wheels[i], 'transform', 'rotate(' + wheelAngle.toFixed(2) + ' ' + wheels[i].getAttribute('data-cx') + ' ' + wheels[i].getAttribute('data-cy') + ')');
      }
      var labels = {waiting:'Ready to charge', arriving:'Arriving', connecting:'Connecting', charging:'Charging', complete:'Charge complete', disconnecting:'Disconnecting', departing:'On the road', still:'EV charging'};
      var label = labels[phase] || labels.waiting;
      if (status.textContent !== label) status.textContent = label;
      var value = phase === 'waiting' ? '—' : Math.round(charge) + '%';
      if (percent.textContent !== value) percent.textContent = value;
      battery.style.transform = 'scaleX(' + clamp(charge / 100).toFixed(4) + ')';
      attr(scene, 'data-phase', phase);
      attr(scene, 'data-time', time.toFixed(3));
      attr(scene, 'data-connection', q.toFixed(3));
    }
    function still() { pose(0, 1, 74, 'still', 0, 640); }
    function render(time) {
      var x = -640, q = 0, charge = 0, phase = 'waiting', distance = 0;
      if (time >= .5 && time < 3.2) {
        phase = 'arriving';
        var progress = clamp((time - .5) / 2.7);
        x = -640 * Math.pow(1 - progress, 3);
        distance = 640 + x;
        charge = 22;
      } else if (time >= 3.2 && time < 4.6) {
        phase = 'connecting'; x = 0; distance = 640; charge = 22;
        q = ease((time - 3.2) / 1.4);
      } else if (time >= 4.6 && time < 10.8) {
        phase = 'charging'; x = 0; q = 1; distance = 640;
        charge = 22 + 78 * ease((time - 4.6) / 6.2);
      } else if (time >= 10.8 && time < 11.7) {
        phase = 'complete'; x = 0; q = 1; charge = 100; distance = 640;
      } else if (time >= 11.7 && time < 13.1) {
        phase = 'disconnecting'; x = 0; distance = 640; charge = 100;
        q = 1 - ease((time - 11.7) / 1.4);
      } else if (time >= 13.1 && time < 16) {
        phase = 'departing'; x = 640 * Math.pow(clamp((time - 13.1) / 2.9), 3);
        distance = 640 + x; charge = 100;
      } else if (time >= 16) {
        x = 640; distance = 1280;
      }
      pose(x, q, charge, phase, time, distance);
    }
    function dialogOpen() {
      for (var i = 0; i < dialogs.length; i++) if (dialogs[i].hasAttribute('open')) return true;
      return false;
    }
    function mayRun() { return !userPaused && !reduced && onScreen && !document.hidden && !pageHidden && !printing && !dialogOpen(); }
    function stop() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0; last = null;
      attr(scene, 'data-playing', 'false');
    }
    function tick(timestamp) {
      frame = 0;
      if (!mayRun()) { stop(); return; }
      if (document.documentElement.classList.contains('evpc-is-loading') && new Date().getTime() - introStart < 1600) {
        last = null;
        frame = window.requestAnimationFrame(tick);
        return;
      }
      if (!started) { started = true; elapsed = 0; }
      if (last !== null) elapsed += Math.max(0, Math.min(80, timestamp - last)) / 1000;
      last = timestamp;
      render(elapsed % duration);
      frame = window.requestAnimationFrame(tick);
    }
    function synchronize() {
      if (toggle) {
        toggle.hidden = reduced;
        toggle.textContent = userPaused ? 'Play animation' : 'Pause animation';
        toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
      }
      if (!mayRun()) { stop(); return; }
      if (!frame) {
        last = null;
        attr(scene, 'data-playing', 'true');
        frame = window.requestAnimationFrame(tick);
      }
    }
    try {
      if (typeof window.matchMedia === 'function') {
        media = window.matchMedia('(prefers-reduced-motion: reduce)');
        reduced = media.matches;
      }
    } catch (error) { /* A missing preference API leaves the card fully usable. */ }
    still();
    if (toggle) toggle.addEventListener('click', function () { userPaused = !userPaused; synchronize(); });
    function preference(event) {
      reduced = event.matches;
      if (reduced) still();
      else { started = false; elapsed = 0; }
      synchronize();
    }
    try {
      if (media && media.addEventListener) media.addEventListener('change', preference);
      else if (media && media.addListener) media.addListener(preference);
    } catch (error) { /* Preference changes are an optional enhancement. */ }
    try {
      if (typeof window.IntersectionObserver === 'function') {
        onScreen = false;
        var observer = new window.IntersectionObserver(function (entries) {
          onScreen = entries[0].isIntersecting;
          synchronize();
        }, {threshold:.05});
        observer.observe(scene.querySelector('.evpc-scene-stage') || scene);
      }
    } catch (error) { onScreen = true; }
    try {
      if (typeof window.MutationObserver === 'function' && dialogs.length) {
        var modalObserver = new window.MutationObserver(synchronize);
        for (var i = 0; i < dialogs.length; i++) modalObserver.observe(dialogs[i], {attributes:true, attributeFilter:['open']});
      }
    } catch (error) { /* Card controls never depend on animation observers. */ }
    document.addEventListener('visibilitychange', synchronize);
    window.addEventListener('pagehide', function () { pageHidden = true; stop(); });
    window.addEventListener('pageshow', function () { pageHidden = false; synchronize(); });
    window.addEventListener('beforeprint', function () { printing = true; stop(); still(); });
    window.addEventListener('afterprint', function () {
      printing = false;
      if (started && !reduced) render(elapsed % duration);
      synchronize();
    });
    synchronize();
  }
  function start() {
    var scenes = document.querySelectorAll('[data-ev-scene]');
    for (var i = 0; i < scenes.length; i++) init(scenes[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
