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
    var portCover = scene.querySelector('[data-ev-port-cover]');
    var padGlow = scene.querySelector('[data-ev-pad-glow]');
    var brakeLight = scene.querySelector('[data-ev-brake-light]');
    var lights = scene.querySelector('[data-ev-lights]');
    var wheels = scene.querySelectorAll('[data-ev-wheel]');
    if (!car || !plug || !cable || !battery || !percent || !status) return;
    scene.setAttribute('data-ev-ready', 'true');
    var duration = 21.6;
    var initialTime = 11.4;
    var elapsed = initialTime;
    var last = null;
    var frame = 0;
    var started = false;
    var userPaused = false;
    var onScreen = true;
    var pageHidden = false;
    var printing = false;
    var reduced = false;
    var assetsReady = false;
    var assetFailed = false;
    var media;
    var introStart = new Date().getTime();
    var card = document.querySelector('[data-evpc-card]');
    var dialogs = card ? card.querySelectorAll('dialog') : [];

    function clamp(value) { return Math.max(0, Math.min(1, value)); }
    function ease(value) { return (1 - Math.cos(Math.PI * clamp(value))) / 2; }
    function glide(value) { var p = clamp(value); return p * p * p * (p * (p * 6 - 15) + 10); }
    function attr(node, name, value) { if (node && node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value)); }
    function bezier(a, b, c, d, p) { var r = 1 - p; return r * r * r * a + 3 * r * r * p * b + 3 * r * p * p * c + p * p * p * d; }
    function pose(x, connection, charge, phase, time, distance, opening, brake) {
      var q = clamp(connection);
      var travel = clamp(q / .8);
      var angle = 180 + 180 * ease(clamp(travel / .82));
      var tipX = bezier(147, 176, 198, 224, travel);
      var tipY = bezier(235, 213, 252, 252, travel);
      if (q >= .8) { tipX = 224 + 16 * (q - .8) / .2; tipY = 252; angle = 360; }
      var radians = angle * Math.PI / 180;
      // Cable joins the handle, rather than stopping at the connector's metal tip.
      var endX = tipX - 17 * Math.cos(radians) - 7 * Math.sin(radians);
      var endY = tipY - 17 * Math.sin(radians) + 7 * Math.cos(radians);
      var path = 'M151 291C' + (154 + 8 * travel).toFixed(2) + ' 339 ' + (185 + 26 * travel).toFixed(2) + ' 338 ' + endX.toFixed(2) + ' ' + endY.toFixed(2);
      var moving = phase === 'arriving' || phase === 'departing';
      var pulse = (1 + Math.sin(time * Math.PI * .7)) / 2;
      attr(car, 'transform', 'translate(' + x.toFixed(2) + ' 0)');
      attr(plug, 'transform', 'translate(' + tipX.toFixed(2) + ' ' + tipY.toFixed(2) + ') rotate(' + angle.toFixed(2) + ')');
      attr(cable, 'd', path);
      attr(energy, 'd', path);
      attr(energy, 'stroke-dashoffset', (-time * 32).toFixed(2));
      attr(energy, 'opacity', phase === 'charging' ? .45 + .28 * pulse : phase === 'still' ? .45 : 0);
      attr(portGlow, 'opacity', opening * (phase === 'charging' ? .25 + .14 * pulse : .22));
      attr(portCover, 'opacity', opening);
      attr(chargerGlow, 'opacity', .22 + .38 * q + (phase === 'charging' ? .1 * pulse : 0));
      attr(padGlow, 'opacity', phase === 'charging' ? .34 + .1 * pulse : .24);
      attr(brakeLight, 'opacity', brake);
      attr(lights, 'opacity', moving ? .45 : .08);
      var wheelRadius = Number(scene.getAttribute('data-wheel-radius')) || 36.3;
      var wheelAngle = distance / wheelRadius * 180 / Math.PI;
      for (var i = 0; i < wheels.length; i++) {
        attr(wheels[i], 'transform', 'rotate(' + wheelAngle.toFixed(2) + ' ' + wheels[i].getAttribute('data-cx') + ' ' + wheels[i].getAttribute('data-cy') + ')');
      }
      var labels = {waiting:'Ready for the road', arriving:'Arriving', parked:'Parked · ready', connecting:'Connecting', charging:'Charging', complete:'Charge complete', disconnecting:'Disconnecting', departing:'On the road', still:'EV charging'};
      var label = labels[phase] || labels.waiting;
      if (status.textContent !== label) status.textContent = label;
      var value = phase === 'waiting' ? '—' : Math.round(charge) + '%';
      if (percent.textContent !== value) percent.textContent = value;
      battery.style.transform = 'scaleX(' + clamp(charge / 100).toFixed(4) + ')';
      attr(scene, 'data-phase', phase);
      attr(scene, 'data-time', time.toFixed(3));
      attr(scene, 'data-connection', q.toFixed(3));
      attr(scene, 'data-port-open', opening.toFixed(3));
    }
    function still() { pose(0, 1, 74, 'still', initialTime, 760, 1, 0); }
    function render(time) {
      var x = -760, q = 0, charge = 0, phase = 'waiting', distance = 0, opening = 0, brake = 0;
      if (time >= .7 && time < 4.5) {
        phase = 'arriving';
        var progress = clamp((time - .7) / 3.8);
        x = -760 * (1 - glide(progress));
        distance = 760 + x; charge = 24;
        brake = ease((progress - .58) / .32);
      } else if (time >= 4.5 && time < 5) {
        phase = 'parked'; x = 0; distance = 760; charge = 24; brake = 1;
      } else if (time >= 5 && time < 7.2) {
        phase = 'connecting'; x = 0; distance = 760; charge = 24;
        opening = ease((time - 5) / .4);
        q = time < 5.4 ? 0 : time < 6.8 ? .8 * ease((time - 5.4) / 1.4) : .8 + .2 * ease((time - 6.8) / .4);
      } else if (time >= 7.2 && time < 14.2) {
        phase = 'charging'; x = 0; q = 1; distance = 760; opening = 1;
        charge = 24 + 76 * ease((time - 7.2) / 7);
      } else if (time >= 14.2 && time < 15.1) {
        phase = 'complete'; x = 0; q = 1; charge = 100; distance = 760; opening = 1;
      } else if (time >= 15.1 && time < 17.3) {
        phase = 'disconnecting'; x = 0; distance = 760; charge = 100;
        q = time < 15.5 ? 1 - .2 * ease((time - 15.1) / .4) : time < 16.9 ? .8 * (1 - ease((time - 15.5) / 1.4)) : 0;
        opening = time < 16.9 ? 1 : 1 - ease((time - 16.9) / .4);
      } else if (time >= 17.3 && time < 20.8) {
        phase = 'departing'; x = 760 * glide((time - 17.3) / 3.5);
        distance = 760 + x; charge = 100;
      } else if (time >= 20.8) {
        x = 760; distance = 1520;
      }
      pose(x, q, charge, phase, time, distance, opening, brake);
    }
    function dialogOpen() {
      for (var i = 0; i < dialogs.length; i++) if (dialogs[i].hasAttribute('open')) return true;
      return false;
    }
    function mayRun() { return assetsReady && !assetFailed && !userPaused && !reduced && onScreen && !document.hidden && !pageHidden && !printing && !dialogOpen(); }
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
      if (!started) { started = true; elapsed = initialTime; }
      if (last !== null) elapsed += Math.max(0, Math.min(80, timestamp - last)) / 1000;
      last = timestamp;
      render(elapsed % duration);
      frame = window.requestAnimationFrame(tick);
    }
    function synchronize() {
      if (toggle) {
        toggle.hidden = reduced || !assetsReady || assetFailed;
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
      else { started = false; elapsed = initialTime; }
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
    var textures = scene.querySelectorAll('image');
    var remaining = textures.length;
    var failures = 0;
    var assetTimer;
    function assetsDone() {
      assetsReady = true;
      assetFailed = failures > 0;
      window.clearTimeout(assetTimer);
      attr(scene, 'data-ev-assets-ready', assetFailed ? 'error' : 'true');
      if (!started) still();
      synchronize();
    }
    function loadTexture(node) {
      var image = new window.Image();
      var finished = false;
      function done(failed) {
        if (finished) return;
        finished = true;
        if (failed) failures++;
        remaining--;
        if (!remaining) assetsDone();
      }
      image.onload = function () { done(false); };
      image.onerror = function () { done(true); };
      image.src = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
      if (image.complete && image.naturalWidth) done(false);
    }
    if (remaining && typeof window.Image === 'function') {
      attr(scene, 'data-ev-assets-ready', 'false');
      assetTimer = window.setTimeout(function () {
        assetsReady = true; assetFailed = true;
        attr(scene, 'data-ev-assets-ready', 'error');
        synchronize();
      }, 8000);
      for (var t = 0; t < textures.length; t++) loadTexture(textures[t]);
    } else assetsDone();
    synchronize();
  }
  function start() {
    var scenes = document.querySelectorAll('[data-ev-scene]');
    for (var i = 0; i < scenes.length; i++) init(scenes[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
