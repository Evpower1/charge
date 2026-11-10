import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ScreenProps } from '../types';
import StationMap from '../components/StationMap';

type Connector = { id: string; type: string; powerKw: number; status: string; lastSeenAt: string | null };
type Station = { id: string; name: string; city: string; address: string; latitude: number; longitude: number; verified: boolean; isDemo: boolean; connectors: Connector[]; availabilityUpdatedAt: string | null };
type Coordinates = { latitude: number; longitude: number };
const connectorState = (connector: Connector) => {
  const age = connector.lastSeenAt ? Date.now() - Date.parse(connector.lastSeenAt) : Infinity;
  return Number.isFinite(age) && age >= 0 && age < 120000 ? connector.status : 'unknown';
};
const available = (station: Station) => station.connectors.filter(c => connectorState(c) === 'available').length;
const distanceKm = (a: Coordinates, b: Coordinates) => {
  const radians = (v: number) => v * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
};
const stateColor = (status: string) => status === 'available' ? '#078a72' : status === 'charging' ? '#0754de' : status === 'faulted' ? '#b34d4d' : '#7b8d9f';
const stateLabel = (status: string) => (({ available: 'Available', charging: 'In use', faulted: 'Fault reported', offline: 'Offline', unknown: 'Status unknown' } as Record<string, string>)[status] || 'Status unknown');
function updated(station: Station) {
  const seen = station.connectors.map(c => c.lastSeenAt ? Date.parse(c.lastSeenAt) : 0).filter(Number.isFinite);
  const newest = Math.max(0, ...seen);
  if (!newest) return 'Awaiting a charger status feed';
  const age = Math.max(0, Math.floor((Date.now() - newest) / 1000));
  return age > 120 ? 'Status feed is stale · availability unknown' : 'Last report ' + (age < 60 ? age + ' seconds' : Math.floor(age / 60) + ' minute') + ' ago';
}

export default function StationsScreen({ api, config, notify, refreshKey, navigate }: ScreenProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('All');
  const [connector, setConnector] = useState('All');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [clock, tick] = useState(0);
  const load = useCallback(async (manual = false) => {
    tick(value => value + 1);
    if (manual) setRefreshing(true);
    try {
      const result = await api.request<{ items: Station[] }>('/v1/stations');
      setStations(result.items.filter(station => station.verified));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not refresh charging locations.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [api]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 15000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [load, refreshKey]);
  const filtered = useMemo(() => {
    const list = stations.filter(station => (city === 'All' || station.city === city) && (connector === 'All' || station.connectors.some(c => c.type === connector)) && (!onlyAvailable || available(station) > 0) && [station.name, station.address, station.city].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
    return location ? list.sort((a, b) => distanceKm(location, a) - distanceKm(location, b)) : list;
  }, [stations, city, connector, onlyAvailable, query, location, clock]);
  const selected = filtered.find(station => station.id === selectedId) || filtered[0];
  async function useLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { notify('Location permission was not granted. You can still search by city or station name.'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      notify('Locations are now sorted by distance from your current position.');
    } catch { notify('Your location could not be read. Search by city or station name instead.'); }
    finally { setLocating(false); }
  }
  return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#0754de" />}>
    <View><Text style={s.eyebrow}>FIND YOUR NEXT CHARGE</Text><Text style={s.title}>A place to recharge.</Text><Text style={s.subtitle}>Verified locations. Availability from connected chargers.</Text></View>
    <View style={s.search}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="search-outline" size={21} color="#6e86a0" /><TextInput accessibilityLabel="Search charging locations" placeholder="Search station, area or city" placeholderTextColor="#8a9aad" value={query} onChangeText={setQuery} style={s.searchInput} autoCorrect={false} /><Pressable accessibilityRole="button" accessibilityLabel="Sort stations by my location" onPress={() => void useLocation()} disabled={locating} style={s.locate}>{locating ? <ActivityIndicator color="#0754de" size="small" /> : <Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="locate-outline" size={22} color="#0754de" />}</Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{['All', ...(config?.serviceCities || ['Addis Ababa', 'Adama'])].map(value => <Pressable accessibilityRole="button" accessibilityState={{ selected: city === value }} key={value} onPress={() => setCity(value)} style={[s.chip, city === value && s.activeChip]}><Text style={[s.chipText, city === value && s.activeChipText]}>{value === 'All' ? 'All cities' : value}</Text></Pressable>)}</ScrollView>
    <StationMap stations={filtered} selectedId={selected?.id} onSelect={setSelectedId} />
    <View style={s.filters}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.plugChips}>{['All', 'CCS2', 'Type2', 'GB/T', 'CHAdeMO'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: connector === value }} onPress={() => setConnector(value)} style={[s.plugChip, connector === value && s.activePlug]}><Text style={[s.plugText, connector === value && s.activePlugText]}>{value === 'All' ? 'All plugs' : value}</Text></Pressable>)}</ScrollView><View style={s.switchRow}><View><Text style={s.filterTitle}>Available now</Text><Text style={s.filterHint}>Only fresh, available connector reports</Text></View><Switch accessibilityLabel="Show only available chargers" value={onlyAvailable} onValueChange={setOnlyAvailable} trackColor={{ false: '#dce5ee', true: '#9de8f2' }} thumbColor={onlyAvailable ? '#0754de' : '#fff'} /></View></View>
    {error ? <View style={s.error}><Text style={s.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load(true)}><Text style={s.link}>Refresh locations</Text></Pressable></View> : null}
    <View style={s.sectionHeading}><Text style={s.sectionTitle}>{filtered.length} {filtered.length === 1 ? 'location' : 'locations'}</Text>{location && <Text style={s.distanceHint}>Nearest first</Text>}</View>
    {loading && !stations.length ? <ActivityIndicator color="#0754de" style={{ padding: 30 }} /> : filtered.length ? filtered.map(station => {
      const count = available(station), known = station.connectors.some(c => connectorState(c) !== 'unknown');
      return <View key={station.id} style={[s.station, selected?.id === station.id && s.selectedStation]}>
        <Pressable accessibilityRole="button" accessibilityLabel={'Select ' + station.name} onPress={() => setSelectedId(station.id)} style={s.stationHeading}><View style={s.stationIcon}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="flash" size={24} color="#0754de" /></View><View style={s.grow}><Text style={s.stationName}>{station.name}</Text><Text style={s.stationAddress}>{station.address}, {station.city}</Text></View><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name={selected?.id === station.id ? 'radio-button-on' : 'radio-button-off'} size={19} color={selected?.id === station.id ? '#0754de' : '#b7c6d5'} /></Pressable>
        <View style={s.badges}><View style={s.verified}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="checkmark-circle" size={12} color="#527b9e" /><Text style={s.verifiedText}>Verified location</Text></View>{station.isDemo && <Text style={s.sample}>Sample station</Text>}{location && <Text style={s.distance}>{distanceKm(location, station).toFixed(1)} km away</Text>}</View>
        <View style={s.connectors}>{station.connectors.map(c => <View key={c.id} style={s.connector}><View style={s.connectorTop}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="git-compare-outline" size={15} color="#597a99" /><Text style={s.connectorType}>{c.type}</Text><Text style={s.power}>{c.powerKw} kW</Text></View><View style={s.statusRow}><View style={[s.dot, { backgroundColor: stateColor(connectorState(c)) }]} /><Text style={[s.connectorStatus, { color: stateColor(connectorState(c)) }]}>{stateLabel(connectorState(c))}</Text></View></View>)}</View>
        <View style={s.stationFooter}><View style={s.grow}><Text style={[s.availability, { color: count > 0 ? '#078a72' : '#6b8096' }]}>{count ? count + ' connector' + (count === 1 ? '' : 's') + ' available' : known ? 'No fresh available report' : 'Availability unknown'}</Text><Text style={s.updated}>{updated(station)}</Text></View><Pressable accessibilityRole="button" style={s.directions} onPress={() => void Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + station.latitude + ',' + station.longitude)}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="navigate-outline" size={16} color="#0754de" /><Text style={s.link}>Directions</Text></Pressable></View>
      </View>;
    }) : <View style={s.empty}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="location-outline" size={33} color="#6c8caa" /><Text style={s.emptyTitle}>{stations.length ? 'No locations match these filters' : 'Verified stations are coming into view'}</Text><Text style={s.copy}>{stations.length ? 'Try another city, plug type, or turn off Available now.' : 'Evpower has not added verified station information to this service yet. Availability appears only after the charger connection is reporting.'}</Text><Pressable accessibilityRole="button" style={s.primary} onPress={() => navigate('book')}><Text style={s.primaryText}>Request mobile charging</Text></Pressable></View>}
    <View style={s.note}><Ionicons aria-hidden={true} accessible={false} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" name="information-circle-outline" size={19} color="#5d80a0" /><Text style={s.noteText}>Availability refreshes while this screen is open. A connector can be taken before you arrive; an available report is not a reservation.</Text></View>
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f8fc' }, content: { padding: 22, paddingBottom: 36, gap: 17, maxWidth: 980, width: '100%', alignSelf: 'center' }, eyebrow: { color: '#55738e', fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginBottom: 9 }, title: { color: '#122d4d', fontSize: 28, fontWeight: '800', letterSpacing: -.8 }, subtitle: { color: '#718298', fontSize: 12, lineHeight: 19, marginTop: 8 },
  search: { flexDirection: 'row', gap: 9, alignItems: 'center', borderWidth: 1, borderColor: '#e0eaf5', borderRadius: 14, backgroundColor: '#fff', paddingLeft: 14 }, searchInput: { flex: 1, minWidth: 0, minHeight: 51, color: '#173452', fontSize: 13, paddingVertical: 12 }, locate: { padding: 14 }, chips: { gap: 8 }, chip: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe9f4' }, activeChip: { backgroundColor: '#0754de', borderColor: '#0754de' }, chipText: { color: '#627d97', fontSize: 12, fontWeight: '600' }, activeChipText: { color: '#fff' },
  filters: { backgroundColor: '#fff', borderRadius: 15, padding: 14, borderWidth: 1, borderColor: '#e1eaf5', gap: 15 }, plugChips: { gap: 7 }, plugChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, backgroundColor: '#f3f7fc' }, activePlug: { backgroundColor: '#e3f2ff' }, plugText: { fontSize: 10, color: '#6d8299', fontWeight: '600' }, activePlugText: { color: '#0754de' }, switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, filterTitle: { fontSize: 12, fontWeight: '700', color: '#274560' }, filterHint: { fontSize: 10, color: '#7a8ea2', marginTop: 4 }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { fontSize: 16, fontWeight: '800', color: '#173452' }, distanceHint: { color: '#6c8299', fontSize: 11 },
  station: { backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#e1eaf5', padding: 16, gap: 13 }, selectedStation: { borderColor: '#a4cbf6' }, stationHeading: { flexDirection: 'row', gap: 11, alignItems: 'center' }, stationIcon: { width: 42, height: 44, backgroundColor: '#edf5ff', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, grow: { flex: 1 }, stationName: { fontSize: 15, fontWeight: '700', color: '#173452' }, stationAddress: { color: '#73889e', fontSize: 11, lineHeight: 18, marginTop: 3 }, badges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, verified: { flexDirection: 'row', alignItems: 'center', gap: 4 }, verifiedText: { color: '#6987a2', fontSize: 9 }, sample: { fontSize: 9, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 5, backgroundColor: '#fff2d3', color: '#886411' }, distance: { fontSize: 9, color: '#627e9a', marginLeft: 'auto' }, connectors: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, connector: { backgroundColor: '#f7faff', borderWidth: 1, borderColor: '#e9f0f7', borderRadius: 10, padding: 10, minWidth: 130, flexGrow: 1 }, connectorTop: { flexDirection: 'row', alignItems: 'center', gap: 5 }, connectorType: { color: '#385b7b', fontSize: 11, fontWeight: '700' }, power: { color: '#7a91a6', fontSize: 10, marginLeft: 'auto' }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }, dot: { width: 5, height: 5, borderRadius: 3 }, connectorStatus: { fontSize: 10, fontWeight: '600' }, stationFooter: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: '#edf2f7', paddingTop: 12 }, availability: { fontSize: 11, fontWeight: '700' }, updated: { color: '#8395a7', fontSize: 9, marginTop: 5 }, directions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 9 }, link: { color: '#0754de', fontWeight: '700', fontSize: 11 },
  empty: { borderRadius: 17, padding: 23, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1eaf5', gap: 10 }, emptyTitle: { color: '#274560', fontSize: 16, fontWeight: '700' }, copy: { color: '#758a9f', fontSize: 12, lineHeight: 20 }, primary: { marginTop: 5, minHeight: 46, backgroundColor: '#0754de', borderRadius: 11, alignItems: 'center', justifyContent: 'center', padding: 12 }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '700' }, note: { flexDirection: 'row', gap: 9, padding: 13, borderRadius: 12, backgroundColor: '#eaf4fe' }, noteText: { flex: 1, fontSize: 10, lineHeight: 17, color: '#63809a' }, error: { padding: 13, borderRadius: 12, backgroundColor: '#fff1f1', gap: 8 }, errorText: { color: '#a33c45', fontSize: 12, lineHeight: 18 }
});
