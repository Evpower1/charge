(function () {
  'use strict';

  function readableContact(data) {
    return [
      data.fullName || data.company,
      [data.designation, data.company].filter(Boolean).join(' · '),
      data.phone ? 'Phone: ' + data.phone : '',
      data.whatsapp ? 'WhatsApp: ' + data.whatsapp : '',
      data.email || '', data.website || '', data.address || ''
    ].filter(Boolean).join('\n');
  }
  function publicUrl(candidate) {
    if (!candidate) return '';
    try {
      var url = new URL(candidate, location.href);
      if (!/^https?:$/.test(url.protocol)) return '';
      var host = url.hostname.toLowerCase();
      if (host === 'localhost' || host === '[::1]' || /^127\./.test(host) || host.endsWith('.localhost') || host.endsWith('.test') || host.endsWith('.invalid')) return '';
      if (host === 'github.com' || host === 'raw.githubusercontent.com' || host.endsWith('.githubusercontent.com')) return '';
      var privateKeys = ['preview', 'preview_id', 'preview_nonce', '_wpnonce', 'elementor-preview', 'evpower-layout-preview', 'wp_customize', 'customize_changeset_uuid'];
      if (privateKeys.some(function (key) { return url.searchParams.has(key); })) return '';
      return url.href;
    } catch (error) { return ''; }
  }
  function init(card) {
    if (card.dataset.evpcReady === 'true') return;
    var source = card.querySelector('.evpc-config');
    var data;
    try { data = JSON.parse(source ? source.textContent : '{}'); }
    catch (error) { return; }
    card.dataset.evpcReady = 'true';
    var status = card.querySelector('[data-evpc-status]');
    function announce(message) { if (status) status.textContent = message; }
    var save = card.querySelector('[data-evpc-save]');
    if (save && data.vcard) {
      save.addEventListener('click', function (event) {
        // Regular contact-file links also work without JavaScript.
        if (!window.Blob || !window.URL || !URL.createObjectURL) return;
        event.preventDefault();
        var file = new Blob([data.vcard], { type: 'text/vcard;charset=utf-8' });
        var address = URL.createObjectURL(file);
        var download = document.createElement('a');
        download.href = address;
        download.download = data.downloadName || 'evpower-contact.vcf';
        document.body.appendChild(download);
        download.click();
        download.remove();
        window.setTimeout(function () { URL.revokeObjectURL(address); }, 1000);
        announce('Open the contact file to save these details to your phone.');
      });
    }
    var share = card.querySelector('[data-evpc-share]');
    if (share) {
      share.hidden = false;
      share.addEventListener('click', async function () {
        // Draft preview URLs can contain authorization nonces and are never shared.
        var link = publicUrl(data.cardUrl);
        if (!link && data.allowLocationShare === true) link = publicUrl(location.href);
        var text = readableContact(data);
        var payload = { title: (data.fullName || data.company || 'Evpower') + ' · Contact', text: link ? [data.fullName, data.designation, data.company].filter(Boolean).join(' · ') : text };
        if (link) payload.url = link;
        try {
          if (navigator.share) {
            try { await navigator.share(payload); announce('Card shared.'); return; }
            catch (error) {
              if (error && error.name === 'AbortError') { announce('Sharing cancelled.'); return; }
            }
          }
          var copied = link || text;
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(copied);
          } else {
            var field = document.createElement('textarea');
            field.value = copied;
            field.setAttribute('readonly', '');
            field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
            document.body.appendChild(field);
            field.select();
            var success = document.execCommand('copy');
            field.remove();
            share.focus();
            if (!success) throw new Error('Clipboard unavailable');
          }
          announce(link ? 'Card link copied. Paste it wherever you’d like to share it.' : 'Contact details copied. Paste them wherever you’d like to share them.');
        } catch (error) {
          announce('Use your browser’s share menu, or save the contact file.');
        }
      });
    }
    var print = card.querySelector('[data-evpc-print]');
    if (print) {
      print.hidden = false;
      print.addEventListener('click', function () { window.print(); });
    }
    var downloadQr = card.querySelector('[data-evpc-download-qr]');
    if (downloadQr && window.Blob && window.XMLSerializer && window.URL && URL.createObjectURL) {
      downloadQr.hidden = false;
      downloadQr.addEventListener('click', function () {
        var code = card.querySelector('.evpc-qr__code svg');
        if (!code) { announce('The QR code is not available yet.'); return; }
        var copy = code.cloneNode(true);
        copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        var svg = new XMLSerializer().serializeToString(copy);
        var address = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
        var link = document.createElement('a');
        link.href = address;
        link.download = 'evpower-qr.svg';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () { URL.revokeObjectURL(address); }, 1000);
        announce('QR code downloaded.');
      });
    }
  }
  function start() { document.querySelectorAll('[data-evpc-card]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());

/* Standalone phone-card app: full-screen QR, install help and offline readiness. */
(function () {
  'use strict';
  var deferredInstall;
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstall = event;
    var button = document.querySelector('[data-evpc-install]');
    if (button) { button.hidden = false; button.textContent = 'Install app'; }
  });
  function startApp() {
    var card = document.querySelector('[data-evpc-card]');
    if (!card) return;
    var open = card.querySelector('[data-evpc-open-qr]');
    var dialog = card.querySelector('[data-evpc-qr-modal]');
    var target = card.querySelector('[data-evpc-modal-code]');
    var svg = card.querySelector('.evpc-qr__code svg');
    if (target && svg) target.appendChild(svg.cloneNode(true));
    function show(node) {
      if (!node) return;
      if (typeof node.showModal === 'function') node.showModal();
      else { node.setAttribute('open', ''); node.classList.add('evpc-dialog-fallback'); }
    }
    function close(node) {
      if (!node) return;
      if (typeof node.close === 'function') node.close();
      else node.removeAttribute('open');
    }
    if (open && dialog) open.addEventListener('click', function (event) { event.preventDefault(); show(dialog); });
    var closeQr = card.querySelector('[data-evpc-close-qr]');
    if (closeQr) closeQr.addEventListener('click', function () { close(dialog); open.focus(); });
    var help = card.querySelector('[data-evpc-install-modal]');
    var closeHelp = card.querySelector('[data-evpc-close-install]');
    if (closeHelp) closeHelp.addEventListener('click', function () { close(help); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        [dialog, help].forEach(function (node) { if (node && node.classList.contains('evpc-dialog-fallback')) close(node); });
      }
    });
    var install = card.querySelector('[data-evpc-install]');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (install) {
      install.hidden = standalone;
      install.addEventListener('click', async function () {
        if (deferredInstall) {
          await deferredInstall.prompt();
          var result = await deferredInstall.userChoice;
          if (result.outcome === 'accepted') install.hidden = true;
          deferredInstall = null;
        } else show(help);
      });
    }
    var state = card.querySelector('[data-evpc-offline-state]');
    function ready() { if (state) state.textContent = 'Ready offline'; }
    if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
      navigator.serviceWorker.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'EVPC_CACHE_READY') ready();
      });
      navigator.serviceWorker.register('./service-worker.js', {scope: './'}).then(function () {
        return navigator.serviceWorker.ready;
      }).then(function (registration) {
        if (registration.active) registration.active.postMessage({type:'EVPC_CHECK_READY'});
      }).catch(function () { if (state) state.textContent = 'Open online once to prepare offline use'; });
    } else if (state && location.protocol === 'file:') state.textContent = 'Offline card preview';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp, {once:true});
  else startApp();
}());
