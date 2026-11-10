/* Contact links and the inline QR work without JavaScript. Optional controls
   progressively add sharing, modal QR display, installation and offline use. */
(function () {
  'use strict';
  function each(nodes, action) { for (var i = 0; i < nodes.length; i++) action(nodes[i]); }
  function readableContact(data) {
    var parts = [data.fullName || data.company,
      (data.designation || '') + (data.company ? ' · ' + data.company : ''),
      data.phone ? 'Phone: ' + data.phone : '',
      data.whatsapp ? 'WhatsApp: ' + data.whatsapp : '',
      data.tollFree ? 'Toll-free in Ethiopia: ' + data.tollFree : '',
      data.email, data.website, data.address];
    return parts.filter(function (part) { return !!part; }).join('\n');
  }
  function publicUrl(candidate) {
    if (!candidate || !window.URL) return '';
    try {
      var url = new URL(candidate, location.href);
      if (!/^https?:$/.test(url.protocol)) return '';
      var host = url.hostname.toLowerCase();
      if (host === 'localhost' || host === '[::1]' || /^127\./.test(host) || /\.(localhost|test|invalid)$/.test(host)) return '';
      if (host === 'github.com' || /(^|\.)githubusercontent\.com$/.test(host)) return '';
      var privateKeys = ['preview', 'preview_id', 'preview_nonce', '_wpnonce', 'elementor-preview', 'evpower-layout-preview', 'wp_customize', 'customize_changeset_uuid'];
      if (privateKeys.some(function (key) { return url.searchParams.has(key); })) return '';
      url.hash = '';
      return url.href;
    } catch (error) { return ''; }
  }
  function init(card) {
    if (card.getAttribute('data-evpc-ready') === 'true') return;
    var source = card.querySelector('.evpc-config');
    var data;
    try { data = JSON.parse(source ? source.textContent : '{}'); }
    catch (error) { return; }
    card.setAttribute('data-evpc-ready', 'true');
    var status = card.querySelector('[data-evpc-status]');
    function announce(message) { if (status) status.textContent = message; }

    // Keep the real .vcf link: browsers can download or open it for importing.
    var save = card.querySelector('[data-evpc-save]');
    if (save) save.addEventListener('click', function () {
      announce('Open the contact file, then choose Add contact or Import in Contacts.');
    });

    var share = card.querySelector('[data-evpc-share]');
    var manual = card.querySelector('[data-evpc-share-fallback]');
    var shareText = card.querySelector('[data-evpc-share-text]');
    function showManual(text) {
      if (manual && shareText) {
        shareText.value = text;
        manual.hidden = false;
        shareText.focus();
        shareText.select();
        announce('Select and copy the details below, or use your browser’s Share menu.');
      } else announce('Use your browser’s Share menu, or save the contact file.');
    }
    function copyText(text, isLink) {
      function copied() {
        announce(isLink ? 'Card link copied. Paste it wherever you’d like to share it.' : 'Contact details copied. Paste them wherever you’d like to share them.');
      }
      function legacyCopy() {
        var field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
        document.body.appendChild(field);
        var success = false;
        try {
          field.focus();
          field.select();
          success = typeof document.execCommand === 'function' && document.execCommand('copy');
        } catch (error) { /* A selectable field below is the final fallback. */ }
        field.parentNode.removeChild(field);
        if (success) { share.focus(); copied(); }
        else showManual(text);
      }
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          var request = navigator.clipboard.writeText(text);
          if (request && typeof request.then === 'function') { request.then(copied, legacyCopy); return; }
        }
      } catch (error) { /* Permissions and embedded browsers can block clipboard. */ }
      legacyCopy();
    }
    if (share) {
      share.hidden = false;
      share.addEventListener('click', function () {
        var link = publicUrl(data.cardUrl);
        if (!link && data.allowLocationShare === true) link = publicUrl(location.href);
        var text = readableContact(data);
        var payload = {title:(data.fullName || data.company || 'Evpower') + ' · Contact', text:link ? [data.fullName, data.designation, data.company].join(' · ') : text};
        if (link) payload.url = link;
        var copiedText = link || text;
        function failed(error) {
          if (error && error.name === 'AbortError') announce('Sharing cancelled.');
          else copyText(copiedText, !!link);
        }
        try {
          if (typeof navigator.share === 'function') {
            var request = navigator.share(payload);
            if (request && typeof request.then === 'function') {
              request.then(function () { announce('Card shared.'); }, failed);
              return;
            }
          }
        } catch (error) { failed(error); return; }
        copyText(copiedText, !!link);
      });
    }

    var activeDialog = null;
    var shade = document.createElement('div');
    shade.className = 'evpc-modal-shade';
    shade.hidden = true;
    shade.setAttribute('aria-hidden', 'true');
    document.body.appendChild(shade);
    function finishClose(node) {
      if (!activeDialog || activeDialog.node !== node) return;
      var previous = activeDialog.trigger;
      document.body.style.overflow = activeDialog.overflow;
      activeDialog = null;
      shade.hidden = true;
      node.classList.remove('evpc-dialog-fallback');
      node.removeAttribute('aria-modal');
      if (previous && typeof previous.focus === 'function') previous.focus();
    }
    function closeDialog(node) {
      if (!node) return;
      try {
        if (typeof node.close === 'function' && !node.classList.contains('evpc-dialog-fallback')) node.close();
      } catch (error) { /* Fall through to the explicit closed state. */ }
      node.removeAttribute('open');
      finishClose(node);
    }
    function showDialog(node) {
      if (!node) return;
      if (activeDialog) closeDialog(activeDialog.node);
      activeDialog = {node:node, trigger:document.activeElement, overflow:document.body.style.overflow};
      node.setAttribute('aria-modal', 'true');
      var nativeOpened = false;
      try {
        if (typeof node.showModal === 'function') { node.showModal(); nativeOpened = true; }
      } catch (error) { /* Older and embedded browsers use the fixed overlay. */ }
      if (!nativeOpened) {
        node.classList.add('evpc-dialog-fallback');
        node.setAttribute('open', '');
        shade.hidden = false;
      }
      document.body.style.overflow = 'hidden';
      var first = node.querySelector('[autofocus], button, a[href], textarea');
      if (first) first.focus();
    }
    each(card.querySelectorAll('dialog'), function (node) {
      node.addEventListener('close', function () { finishClose(node); });
      node.addEventListener('cancel', function (event) { event.preventDefault(); closeDialog(node); });
    });
    shade.addEventListener('click', function () { if (activeDialog) closeDialog(activeDialog.node); });
    document.addEventListener('keydown', function (event) {
      if (!activeDialog) return;
      if (event.key === 'Escape' || event.keyCode === 27) {
        event.preventDefault();
        closeDialog(activeDialog.node);
      } else if (event.key === 'Tab' || event.keyCode === 9) {
        var items = activeDialog.node.querySelectorAll('a[href], button:not([disabled]), textarea, [tabindex="0"]');
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    var open = card.querySelector('[data-evpc-open-qr]');
    var qrDialog = card.querySelector('[data-evpc-qr-modal]');
    if (open && qrDialog) open.addEventListener('click', function (event) { event.preventDefault(); showDialog(qrDialog); });
    var closeQr = card.querySelector('[data-evpc-close-qr]');
    if (closeQr) closeQr.addEventListener('click', function () { closeDialog(qrDialog); });
    var help = card.querySelector('[data-evpc-install-modal]');
    var closeHelp = card.querySelector('[data-evpc-close-install]');
    if (closeHelp) closeHelp.addEventListener('click', function () { closeDialog(help); });

    var install = card.querySelector('[data-evpc-install]');
    var installLabel = install ? install.textContent : 'Add to phone';
    var deferredInstall;
    var standalone = navigator.standalone === true;
    try { standalone = standalone || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches); }
    catch (error) { /* Opening as a regular card always remains available. */ }
    if (install) {
      install.hidden = !!standalone || location.protocol === 'file:';
      window.addEventListener('beforeinstallprompt', function (event) {
        if (typeof event.prompt !== 'function') return;
        event.preventDefault();
        deferredInstall = event;
        install.hidden = false;
        install.textContent = 'Install app';
      });
      window.addEventListener('appinstalled', function () { install.hidden = true; deferredInstall = null; });
      install.addEventListener('click', function () {
        if (!deferredInstall) { showDialog(help); return; }
        var event = deferredInstall;
        deferredInstall = null;
        function result(choice) {
          if (choice && choice.outcome === 'accepted') install.hidden = true;
          else install.textContent = installLabel;
        }
        function failed() { install.textContent = installLabel; showDialog(help); }
        try {
          var prompt = event.prompt();
          if (prompt && typeof prompt.then === 'function') prompt.then(function () {}, failed);
          if (event.userChoice && typeof event.userChoice.then === 'function') event.userChoice.then(result, failed);
          else failed();
        } catch (error) { failed(); }
      });
    }

    var state = card.querySelector('[data-evpc-offline-state]');
    function setState(message) { if (state) state.textContent = message; }
    function unavailable() { setState('Online card — save the QR image for offline use'); }
    if (location.protocol === 'file:') { setState('Offline card preview'); return; }
    try {
      if (data.offlineApp && navigator.serviceWorker && window.isSecureContext) {
        var expectedScope = new URL('./', location.href).href;
        setState('Preparing offline access…');
        var offlineTimer = window.setTimeout(unavailable, 12000);
        navigator.serviceWorker.addEventListener('message', function (event) {
          if (event.data && event.data.type === 'EVPC_CACHE_READY' && event.data.scope === expectedScope) {
            window.clearTimeout(offlineTimer);
            setState('Ready offline');
          }
        });
        // A previously installed parent card can control a first child visit.
        // Refresh that exact parent worker without blocking this card's setup.
        if (data.parentAppScope && typeof navigator.serviceWorker.getRegistration === 'function') {
          try {
            var parentScope = new URL(data.parentAppScope, expectedScope).href;
            var parentWorker = new URL('service-worker.js', parentScope).href;
            if (parentScope !== expectedScope && expectedScope.indexOf(parentScope) === 0) {
              navigator.serviceWorker.getRegistration(parentScope).then(function (parent) {
                try {
                  if (parent && parent.scope === parentScope && parent.active && parent.active.scriptURL === parentWorker && typeof parent.update === 'function') {
                    var update = parent.update();
                    if (update && typeof update.then === 'function') update.then(function () {}, function () {});
                  }
                } catch (error) { /* Parent refresh is optional. */ }
              }, function () {});
            }
          } catch (error) { /* Restricted browsers may block registration lookup. */ }
        }
        navigator.serviceWorker.register('./service-worker.js', {scope:'./'}).then(function (registration) {
          if (!registration || registration.scope !== expectedScope) { unavailable(); return; }
          var watched = [];
          var checkedWorker = null;
          function inspect() {
            try {
              var worker = registration.installing || registration.waiting || registration.active;
              if (!worker) return;
              if (watched.indexOf(worker) === -1) {
                watched.push(worker);
                worker.addEventListener('statechange', inspect);
              }
              if (worker === registration.active && worker.state === 'activated' && checkedWorker !== worker) {
                checkedWorker = worker;
                worker.postMessage({type:'EVPC_CHECK_READY'});
              }
            } catch (error) { unavailable(); }
          }
          registration.addEventListener('updatefound', inspect);
          navigator.serviceWorker.addEventListener('controllerchange', inspect);
          inspect();
        }).catch(unavailable);
      } else unavailable();
    } catch (error) { unavailable(); }
  }
  function start() { each(document.querySelectorAll('[data-evpc-card]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
