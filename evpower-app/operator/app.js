(function () {
  'use strict';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  const nodes = {
    login: $('#login-view'), workspace: $('#workspace'), loginForm: $('#login-form'),
    loginMessage: $('#login-message'), refresh: $('#refresh'), toast: $('#toast'),
    bookingDialog: $('#booking-dialog'), stationDialog: $('#station-dialog')
  };
  const statuses = ['requested', 'confirmed', 'en_route', 'arrived', 'charging', 'completed', 'cancelled'];
  const nextStatuses = {
    requested: ['confirmed', 'cancelled'], confirmed: ['en_route', 'cancelled'],
    en_route: ['arrived', 'cancelled'], arrived: ['charging', 'cancelled'],
    charging: ['completed'], completed: [], cancelled: []
  };
  const labels = {
    requested: 'Requested', confirmed: 'Confirmed', en_route: 'En route', arrived: 'Arrived',
    charging: 'Charging', completed: 'Completed', cancelled: 'Cancelled', available: 'Available',
    faulted: 'Faulted', offline: 'Offline', unknown: 'Unknown', paid: 'Paid', unpaid: 'Unpaid',
    refunded: 'Refunded', verified: 'Verified', draft: 'Draft', demo: 'Sample', open: 'Open'
  };
  let session = null;
  let sessionVersion = 0;
  let refreshing = null;
  let poll = null;
  let toastTimer = null;
  let loading = false;
  let activeView = 'overview';
  let dashboard = { overview: null, bookings: [], stations: [], config: null };
  let selectedBooking = null;
  let selectedStation = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function replace(target, children) {
    const node = typeof target === 'string' ? $(target) : target;
    node.replaceChildren(...children);
  }
  function badge(status, text) {
    const known = Object.prototype.hasOwnProperty.call(labels, status) ? status : 'unknown';
    return element('span', 'badge ' + known, text || labels[known]);
  }
  function money(minor) {
    if (!Number.isSafeInteger(minor)) return 'Awaiting quote';
    return new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 2 }).format(minor / 100);
  }
  function date(value) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Africa/Addis_Ababa'
    }).format(timestamp) + ' EAT';
  }
  function readableStatus(status) { return labels[status] || 'Unknown'; }
  function announce(message, error = false) {
    window.clearTimeout(toastTimer);
    nodes.toast.textContent = message;
    nodes.toast.classList.toggle('error', error);
    nodes.toast.hidden = false;
    toastTimer = window.setTimeout(() => { nodes.toast.hidden = true; }, 6500);
  }
  function setFormMessage(id, message) { $(id).textContent = message || ''; }
  function errorText(error) {
    return error && error.message ? error.message : 'Something went wrong. Please try again.';
  }
  async function rawRequest(path, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    const headers = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.auth !== false && session) headers.Authorization = 'Bearer ' + session.accessToken;
    try {
      const response = await fetch(path, {
        method: options.method || 'GET', headers, credentials: 'omit', cache: 'no-store',
        body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal
      });
      let data = null;
      if (response.status !== 204) {
        const text = await response.text();
        if (text) {
          try { data = JSON.parse(text); }
          catch (_error) { throw new Error('The server returned an unexpected response. Please try again.'); }
        }
      }
      return { response, data };
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The request timed out. Check your connection and try again.');
      if (error instanceof TypeError) throw new Error('Cannot reach the Evpower server. Check your connection and try again.');
      throw error;
    } finally { window.clearTimeout(timer); }
  }
  function serverError(response, data) {
    const error = new Error(data && data.error && data.error.message ? data.error.message : 'The request could not be completed.');
    error.status = response.status;
    error.code = data && data.error && data.error.code;
    return error;
  }
  async function rotateSession() {
    if (refreshing) return refreshing;
    if (!session) throw new Error('Please sign in again.');
    const refreshToken = session.refreshToken;
    const version = sessionVersion;
    refreshing = (async () => {
      const { response, data } = await rawRequest('/v1/auth/refresh', {
        method: 'POST', auth: false, body: { refreshToken }
      });
      if (!response.ok || !data || !data.accessToken || !data.user || data.user.role !== 'admin') {
        if (version === sessionVersion) clearSession('Your session ended. Please sign in again.');
        throw new Error('Your session ended. Please sign in again.');
      }
      if (version !== sessionVersion) throw new Error('This session has ended.');
      session = data;
      return data;
    })();
    try { return await refreshing; }
    finally { refreshing = null; }
  }
  async function api(path, options = {}, retry = true) {
    const { response, data } = await rawRequest(path, options);
    if (response.status === 401 && options.auth !== false && retry && session) {
      await rotateSession();
      return api(path, options, false);
    }
    if (!response.ok) throw serverError(response, data);
    return data;
  }
  function stopPolling() { if (poll) window.clearInterval(poll); poll = null; }
  function startPolling() {
    stopPolling();
    poll = window.setInterval(() => {
      if (session && document.visibilityState === 'visible') loadDashboard(false);
    }, 15000);
  }
  function clearSession(message) {
    session = null;
    sessionVersion++;
    stopPolling();
    selectedBooking = null;
    selectedStation = null;
    dashboard = { overview: null, bookings: [], stations: [], config: null };
    closeDialog(nodes.bookingDialog);
    closeDialog(nodes.stationDialog);
    nodes.workspace.hidden = true;
    nodes.login.hidden = false;
    $('#login-password').value = '';
    nodes.loginMessage.textContent = message || '';
    ['#metrics', '#recent-bookings', '#booking-list', '#station-list', '#ticket-list', '#service-connections'].forEach(id => replace(id, []));
    $('#login-email').focus();
  }
  async function logout() {
    const refreshToken = session && session.refreshToken;
    clearSession();
    if (refreshToken) {
      try { await api('/v1/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }); }
      catch (_error) { /* The local session is cleared even if the network is unavailable. */ }
    }
  }
  async function withButton(button, busyText, action) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
    try { return await action(); }
    finally { button.disabled = false; button.textContent = original; }
  }
  function switchView(view) {
    const titles = { overview: 'Overview', bookings: 'Charging requests', stations: 'Charging stations', support: 'Customer support', connections: 'Connections' };
    if (!Object.prototype.hasOwnProperty.call(titles, view)) return;
    activeView = view;
    $$('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== view; });
    $$('.nav-item').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    $('#view-title').textContent = titles[view];
  }
  function empty(title, detail) {
    const box = element('div', 'empty-state');
    box.append(element('strong', '', title), element('p', '', detail));
    return box;
  }
  async function loadDashboard(showFeedback = true) {
    if (!session || loading) return;
    loading = true;
    const version = sessionVersion;
    nodes.refresh.disabled = true;
    if (showFeedback) $('#last-updated').textContent = 'Refreshing workspace…';
    try {
      const [overview, bookings, stations, config] = await Promise.all([
        api('/v1/admin/overview'), api('/v1/admin/bookings'), api('/v1/admin/stations'), api('/v1/config', { auth: false })
      ]);
      if (version !== sessionVersion || !session) return;
      dashboard = {
        overview, bookings: Array.isArray(bookings.items) ? bookings.items : [],
        stations: Array.isArray(stations.items) ? stations.items : [], config
      };
      renderDashboard();
      $('#last-updated').textContent = 'Updated ' + date(new Date().toISOString());
    } catch (error) {
      if (version === sessionVersion && session) {
        $('#last-updated').textContent = 'Could not refresh. Previously loaded data may be out of date.';
        if (showFeedback) announce(errorText(error), true);
      }
    } finally {
      loading = false;
      nodes.refresh.disabled = false;
    }
  }
  function renderDashboard() {
    const overview = dashboard.overview || {};
    const metrics = [
      ['Active requests', overview.activeBookings, 'Requests still in progress'],
      ['Customers', overview.customers, 'Registered customer accounts'],
      ['Charging locations', overview.stations, 'Configured in your network'],
      ['Total requests', overview.totalBookings, 'Across all service statuses']
    ].map(([label, value, caption]) => {
      const card = element('div', 'metric');
      card.append(element('span', 'metric-label', label), element('strong', 'metric-value', Number.isSafeInteger(value) ? value : '—'), element('span', 'metric-caption', caption));
      return card;
    });
    replace('#metrics', metrics);
    const recent = dashboard.bookings.slice(0, 5);
    replace('#recent-bookings', recent.length ? recent.map(bookingRow) : [empty('Your request desk is clear', 'New mobile charging requests will appear here when customers book through the app.')]);
    renderBookings(); renderStations(); renderTickets(); renderConnections();
    const connectors = dashboard.stations.flatMap(station => station.connectors || []);
    const verified = dashboard.stations.filter(station => station.verified).length;
    const available = connectors.filter(connector => connectorState(connector) === 'available').length;
    const unknown = connectors.filter(connector => connectorState(connector) === 'unknown').length;
    replace('#network-summary', [
      networkStat('Verified locations', verified), networkStat('Available connectors', available), networkStat('Awaiting a fresh report', unknown)
    ]);
    $('#demo-banner').hidden = !(dashboard.config && dashboard.config.isDemo);
    $('#connection-label').textContent = dashboard.config && dashboard.config.telemetryConfigured ? 'Charger integration configured' : 'Charger feed not connected';
  }
  function networkStat(label, value) {
    const row = element('div', 'network-stat');
    row.append(element('span', '', label), element('strong', '', value));
    return row;
  }
  function bookingRow(booking) {
    const row = element('button', 'request-row');
    row.type = 'button';
    row.setAttribute('aria-label', 'Open request ' + booking.reference);
    const left = element('span');
    const reference = element('span', 'request-reference', booking.reference);
    left.append(reference, element('span', 'request-address', booking.address || booking.city), element('span', 'request-meta', [booking.city, booking.connector, booking.requestedKwh + ' kWh', date(booking.createdAt)].filter(Boolean).join(' · ')));
    const right = element('span', 'request-right');
    right.append(badge(booking.status), element('span', 'request-price', money(booking.quoteMinor)));
    row.append(left, right);
    row.addEventListener('click', () => openBooking(booking));
    return row;
  }
  function renderBookings() {
    const query = $('#booking-search').value.trim().toLowerCase();
    const filter = $('#booking-filter').value;
    const bookings = dashboard.bookings.filter(booking => {
      if (filter !== 'all' && booking.status !== filter) return false;
      return !query || [booking.reference, booking.city, booking.address, booking.customerName].filter(Boolean).join(' ').toLowerCase().includes(query);
    });
    replace('#booking-list', bookings.length ? bookings.map(bookingRow) : [empty('No matching requests', query || filter !== 'all' ? 'Try another search or choose all statuses.' : 'Customer charging requests will appear here. No request is confirmed until your team reviews it.')]);
  }
  function connectorState(connector) {
    const seen = Date.parse(connector.lastSeenAt);
    const age = Date.now() - seen;
    if (!Number.isFinite(seen) || age > 120000 || age < -60000) return 'unknown';
    return ['available', 'charging', 'faulted', 'offline'].includes(connector.status) ? connector.status : 'unknown';
  }
  function renderStations() {
    if (!dashboard.stations.length) {
      replace('#station-list', [empty('Build your charging network', 'Add a verified real location to show it in the customer app. Availability stays unknown until a charger feed is connected.')]);
      return;
    }
    const cards = dashboard.stations.map(station => {
      const card = element('section', 'station-card');
      const top = element('div', 'station-top');
      const heading = element('div');
      heading.append(element('h3', '', station.name));
      if (station.isDemo) heading.append(badge('demo'));
      top.append(heading, badge(station.verified ? 'verified' : 'draft'));
      card.append(top, element('p', 'station-address', [station.city, station.address].filter(Boolean).join(' · ')));
      if (Number.isFinite(station.latitude) && Number.isFinite(station.longitude)) card.append(element('p', 'station-coordinates', station.latitude.toFixed(6) + ', ' + station.longitude.toFixed(6)));
      const connectors = element('div', 'connector-list');
      (station.connectors || []).forEach(connector => {
        const row = element('div', 'connector-chip');
        const detail = element('span', '', [connector.type, connector.powerKw + ' kW', connector.id].join(' · '));
        detail.append(element('small', '', connector.lastSeenAt ? 'Last report ' + date(connector.lastSeenAt) : 'No charger report received'));
        row.append(detail, badge(connectorState(connector)));
        connectors.append(row);
      });
      const footer = element('div', 'station-footer');
      const available = (station.connectors || []).filter(connector => connectorState(connector) === 'available').length;
      footer.append(element('span', 'station-status', available + ' of ' + (station.connectors || []).length + ' available'));
      const edit = element('button', 'text-button', 'Edit location →');
      edit.type = 'button'; edit.addEventListener('click', () => openStation(station));
      footer.append(edit); card.append(connectors, footer); return card;
    });
    replace('#station-list', cards);
  }
  function renderTickets() {
    const tickets = dashboard.overview && Array.isArray(dashboard.overview.tickets) ? dashboard.overview.tickets : [];
    if (!tickets.length) { replace('#ticket-list', [empty('No support enquiries yet', 'Requests sent from the customer app will appear here for your team to review.')]); return; }
    replace('#ticket-list', tickets.map(ticket => {
      const card = element('article', 'ticket');
      const heading = element('div', 'ticket-heading');
      heading.append(element('h3', '', ticket.subject), badge(ticket.status || 'open'));
      card.append(heading, element('p', 'ticket-meta', [ticket.name, ticket.email, date(ticket.createdAt)].filter(Boolean).join(' · ')), element('p', 'ticket-message', ticket.message));
      return card;
    }));
  }
  function renderConnections() {
    const config = dashboard.config || {};
    const services = [
      ['Charger telemetry', !!config.telemetryConfigured, 'Receives connector status from your trusted charger gateway. Without a recent report, availability remains unknown.'],
      ['Chapa payments', !!config.paymentsEnabled, 'Customers top up service credit through hosted Chapa checkout. Credit is added only after the API verifies the payment.']
    ];
    replace('#service-connections', services.map(([name, ready, detail]) => {
      const card = element('article', 'connection-card');
      card.append(badge(ready ? 'available' : 'unknown', ready ? 'Configured' : 'Not configured'), element('h3', '', name), element('p', '', detail));
      return card;
    }));
  }
  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  function closeDialog(dialog) {
    if (!dialog.hasAttribute('open')) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
  function detailTerm(label, value, wide = false) {
    const wrapper = element('div', wide ? 'wide' : '');
    wrapper.append(element('dt', '', label), element('dd', '', value === null || value === undefined || value === '' ? '—' : value));
    return wrapper;
  }
  function openBooking(booking) {
    selectedBooking = booking;
    $('#booking-title').textContent = booking.reference;
    const grid = element('dl', 'detail-grid');
    grid.append(detailTerm('Status', readableStatus(booking.status)), detailTerm('Payment', readableStatus(booking.paymentStatus)), detailTerm('Requested energy', booking.requestedKwh + ' kWh · ' + booking.connector), detailTerm('Requested time', booking.scheduledAt ? date(booking.scheduledAt) : 'As soon as available'), detailTerm('Location', [booking.city, booking.address].filter(Boolean).join(' · '), true));
    if (booking.notes) grid.append(detailTerm('Customer notes', booking.notes, true));
    const events = element('div', 'event-list');
    (booking.events || []).forEach(event => {
      const item = element('div', 'event');
      item.append(element('p', '', event.message || readableStatus(event.status)), element('time', '', date(event.at)));
      events.append(item);
    });
    replace('#booking-details', [grid, events]);
    $('#booking-form').reset();
    $('#booking-quote').value = Number.isSafeInteger(booking.quoteMinor) ? (booking.quoteMinor / 100).toFixed(2) : '';
    $('#booking-quote').disabled = booking.paymentStatus === 'paid' || ['completed', 'cancelled'].includes(booking.status);
    const statusSelect = $('#booking-status');
    statusSelect.replaceChildren();
    const allowed = [booking.status, ...(nextStatuses[booking.status] || [])];
    allowed.forEach(status => {
      const option = element('option', '', readableStatus(status));
      option.value = status;
      if (['en_route', 'arrived', 'charging', 'completed'].includes(status) && status !== booking.status && booking.paymentStatus !== 'paid' && booking.quoteMinor !== 0) option.disabled = true;
      statusSelect.append(option);
    });
    $('#booking-dispatch-name').value = booking.dispatchName || '';
    $('#booking-dispatch-phone').value = booking.dispatchPhone || '';
    $('#booking-payment-note').textContent = booking.paymentStatus === 'paid' ? 'Payment received. The paid quote is locked.' : 'A confirmed quote must be paid by the customer before dispatch, unless the quoted total is zero.';
    $('#booking-save').disabled = ['completed', 'cancelled'].includes(booking.status);
    setFormMessage('#booking-message');
    openDialog(nodes.bookingDialog);
  }
  function minorUnits(value) {
    const text = value.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Enter a valid quote in ETB, with up to two decimal places.');
    const [whole, fraction = ''] = text.split('.');
    const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(minor) || minor < 0 || minor > 100000000) throw new Error('The quote is outside the supported range.');
    return minor;
  }
  function connectorRow(connector = {}) {
    const row = element('div', 'connector-row');
    const idLabel = element('label', '', 'Connector ID');
    const id = element('input'); id.name = 'connectorId'; id.required = true; id.maxLength = 100; id.value = connector.id || '';
    const typeLabel = element('label', '', 'Connection type');
    const type = element('select'); type.name = 'connectorType';
    ['CCS2', 'Type2', 'GB/T', 'CHAdeMO'].forEach(name => { const option = element('option', '', name); option.value = name; type.append(option); });
    type.value = connector.type || 'CCS2';
    const powerLabel = element('label', '', 'Power (kW)');
    const power = element('input'); power.name = 'connectorPower'; power.type = 'number'; power.min = '.1'; power.max = '1000'; power.step = 'any'; power.required = true; power.value = Number.isFinite(connector.powerKw) ? connector.powerKw : '';
    const remove = element('button', 'remove-connector', '×'); remove.type = 'button'; remove.setAttribute('aria-label', 'Remove connector');
    remove.addEventListener('click', () => { row.remove(); updateConnectorButtons(); });
    idLabel.append(id); typeLabel.append(type); powerLabel.append(power); row.append(idLabel, typeLabel, powerLabel, remove);
    return row;
  }
  function updateConnectorButtons() {
    const rows = $$('.connector-row', $('#connector-inputs'));
    rows.forEach(row => { $('.remove-connector', row).disabled = rows.length <= 1; });
    $('#add-connector').disabled = rows.length >= 16;
  }
  function openStation(station = null) {
    selectedStation = station;
    $('#station-form').reset();
    $('#station-title').textContent = station ? 'Edit charging station' : 'Add a station';
    const cities = dashboard.config && Array.isArray(dashboard.config.serviceCities) ? dashboard.config.serviceCities : ['Addis Ababa', 'Adama'];
    const city = $('#station-city'); city.replaceChildren();
    cities.forEach(name => { const option = element('option', '', name); option.value = name; city.append(option); });
    $('#station-name').value = station ? station.name : '';
    city.value = station ? station.city : cities[0];
    $('#station-address').value = station ? station.address : '';
    $('#station-latitude').value = station ? station.latitude : '';
    $('#station-longitude').value = station ? station.longitude : '';
    $('#station-verified').checked = !!(station && station.verified);
    replace('#connector-inputs', (station && station.connectors && station.connectors.length ? station.connectors : [{}]).map(connectorRow));
    updateConnectorButtons();
    setFormMessage('#station-message');
    openDialog(nodes.stationDialog);
  }

  nodes.loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    nodes.loginMessage.textContent = '';
    const password = $('#login-password').value;
    const email = $('#login-email').value.trim();
    try {
      await withButton($('#login-submit'), 'Signing in…', async () => {
        const result = await api('/v1/auth/login', { method: 'POST', auth: false, body: { email, password } });
        if (!result || !result.user || result.user.role !== 'admin') {
          if (result && result.refreshToken) {
            try { await api('/v1/auth/logout', { method: 'POST', auth: false, body: { refreshToken: result.refreshToken } }); } catch (_error) { /* No operator session is retained. */ }
          }
          throw new Error('This account does not have operator access. Use the customer app or contact your administrator.');
        }
        sessionVersion++; session = result;
        $('#operator-name').textContent = result.user.name;
        nodes.login.hidden = true; nodes.workspace.hidden = false;
        $('#workspace-date').textContent = 'EVPOWER OPERATIONS · ETHIOPIA';
        switchView('overview');
        await loadDashboard();
        startPolling();
      });
    } catch (error) { nodes.loginMessage.textContent = errorText(error); }
    finally { $('#login-password').value = ''; }
  });
  $('#logout').addEventListener('click', logout);
  nodes.refresh.addEventListener('click', () => loadDashboard());
  $$('[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
  $$('[data-go]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.go)));
  $('#booking-search').addEventListener('input', renderBookings);
  $('#booking-filter').addEventListener('change', renderBookings);
  $('#new-station').addEventListener('click', () => openStation());
  $('#add-connector').addEventListener('click', () => {
    if ($$('.connector-row', $('#connector-inputs')).length >= 16) return;
    $('#connector-inputs').append(connectorRow()); updateConnectorButtons();
  });
  $$('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(document.getElementById(button.dataset.close))));
  [nodes.bookingDialog, nodes.stationDialog].forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
    });
  });
  $('#booking-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!selectedBooking || !session) return;
    setFormMessage('#booking-message');
    try {
      const status = $('#booking-status').value;
      if (!statuses.includes(status)) throw new Error('Choose a valid request status.');
      const body = {
        status, dispatchName: $('#booking-dispatch-name').value.trim(),
        dispatchPhone: $('#booking-dispatch-phone').value.trim(), note: $('#booking-note').value.trim()
      };
      const quote = $('#booking-quote').value.trim();
      if (!$('#booking-quote').disabled && quote !== '') body.quoteMinor = minorUnits(quote);
      if (status === 'confirmed' && selectedBooking.quoteMinor === null && body.quoteMinor === undefined) throw new Error('Set the quote before confirming this request.');
      await withButton($('#booking-save'), 'Saving…', async () => {
        await api('/v1/admin/bookings/' + encodeURIComponent(selectedBooking.id), { method: 'PATCH', body });
        closeDialog(nodes.bookingDialog); announce('Request updated. The customer can see the latest status.');
        await loadDashboard(false);
      });
    } catch (error) { setFormMessage('#booking-message', errorText(error)); }
  });
  $('#station-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!session) return;
    setFormMessage('#station-message');
    try {
      const connectors = $$('.connector-row', $('#connector-inputs')).map(row => ({
        id: $('[name="connectorId"]', row).value.trim(), type: $('[name="connectorType"]', row).value,
        powerKw: Number($('[name="connectorPower"]', row).value)
      }));
      if (!connectors.length || connectors.some(connector => !connector.id || !Number.isFinite(connector.powerKw) || connector.powerKw <= 0)) throw new Error('Provide an ID, type and power for every connector.');
      if (new Set(connectors.map(connector => connector.id)).size !== connectors.length) throw new Error('Each connector must have a different ID.');
      const latitude = Number($('#station-latitude').value), longitude = Number($('#station-longitude').value);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Enter valid latitude and longitude coordinates.');
      const body = {
        name: $('#station-name').value.trim(), city: $('#station-city').value, address: $('#station-address').value.trim(),
        latitude, longitude, verified: $('#station-verified').checked, connectors
      };
      const path = '/v1/admin/stations' + (selectedStation ? '/' + encodeURIComponent(selectedStation.id) : '');
      await withButton($('#station-save'), 'Saving…', async () => {
        await api(path, { method: selectedStation ? 'PATCH' : 'POST', body });
        closeDialog(nodes.stationDialog); announce('Charging station saved.'); await loadDashboard(false);
      });
    } catch (error) { setFormMessage('#station-message', errorText(error)); }
  });
  document.addEventListener('visibilitychange', () => {
    if (session && document.visibilityState === 'visible') loadDashboard(false);
  });
  window.addEventListener('pagehide', stopPolling);
  window.addEventListener('pageshow', () => { if (session) { startPolling(); loadDashboard(false); } });
}());
