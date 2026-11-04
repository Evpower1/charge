/* Leaflet and all assets are local; no API key is required. */
document.querySelectorAll('.ep-locations').forEach((root) => {
  if (!window.L) return;
  const stations = JSON.parse(root.dataset.stations || '[]');
  const map = L.map(root.querySelector('.ep-leaflet-map'), { scrollWheelZoom: false }).setView([8.82, 39.02], 9);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  const markers = new Map();
  for (const station of stations) {
    const title = document.createElement('strong');
    title.textContent = station.name;
    const marker = L.marker([station.latitude, station.longitude], { title: station.name }).bindPopup(title);
    markers.set(String(station.id), marker);
  }
  function filter() {
    const city = root.querySelector('.ep-city-filter').value;
    const verified = root.querySelector('.ep-verified-filter').checked;
    const points = [];
    let count = 0;
    root.querySelectorAll('.ep-station').forEach(card => {
      const visible = (!city || card.dataset.city === city) && (!verified || card.dataset.verified === '1');
      card.hidden = !visible;
      const marker = markers.get(card.dataset.id);
      if (visible) { marker.addTo(map); points.push(marker.getLatLng()); count++; }
      else if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    root.querySelector('.ep-no-stations').hidden = count > 0;
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [45, 45], maxZoom: 13 });
    else map.setView(city === 'Adama' ? [8.54, 39.27] : city === 'Addis Ababa' ? [9.01, 38.77] : [8.82, 39.02], city ? 12 : 9);
  }
  root.querySelector('.ep-city-filter').addEventListener('change', filter);
  root.querySelector('.ep-verified-filter').addEventListener('change', filter);
  root.querySelectorAll('.ep-station-focus').forEach(button => button.addEventListener('click', () => {
    const marker = markers.get(button.closest('.ep-station').dataset.id);
    map.setView(marker.getLatLng(), 15); marker.openPopup();
    if (innerWidth < 700) root.querySelector('.ep-leaflet-map').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }));
  filter();
  const resize = new ResizeObserver(() => map.invalidateSize());
  resize.observe(root.querySelector('.ep-leaflet-map'));
});
