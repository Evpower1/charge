import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type MapStation = { id: string; name: string; latitude: number; longitude: number };
export type StationMapProps = { stations: MapStation[]; selectedId?: string; onSelect?: (id: string) => void };

export default function StationMap({ stations, selectedId, onSelect }: StationMapProps) {
  const selected = stations.find(station => station.id === selectedId) || stations[0];
  const latitude = selected?.latitude ?? 8.98;
  const longitude = selected?.longitude ?? 38.76;
  const bbox = [longitude - .055, latitude - .035, longitude + .055, latitude + .035].join(',');
  const src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent(bbox) + '&layer=mapnik' + (selected ? '&marker=' + latitude + '%2C' + longitude : '');
  return <View style={s.card}>{React.createElement('iframe', { title: selected ? 'Map of ' + selected.name : 'Charging area map', src, loading: 'lazy', referrerPolicy: 'no-referrer', style: { display: 'block', width: '100%', height: 235, border: 0, background: '#e8f4fd' } })}<View style={s.caption}><Text style={s.hint}>{selected ? selected.name : 'Map centred on Addis Ababa · no station selected'}</Text>{stations.length > 1 && <View style={s.choices}>{stations.slice(0, 5).map(station => <Pressable key={station.id} accessibilityRole="button" onPress={() => onSelect?.(station.id)} style={[s.choice, selected?.id === station.id && s.selected]}><Text style={[s.choiceText, selected?.id === station.id && s.selectedText]}>{station.name}</Text></Pressable>)}</View>}</View></View>;
}
const s = StyleSheet.create({ card: { borderRadius: 19, overflow: 'hidden', borderWidth: 1, borderColor: '#dce9f7', backgroundColor: '#fff' }, caption: { padding: 12, gap: 9 }, hint: { color: '#647e99', fontSize: 11 }, choices: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' }, choice: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#f1f6fc', borderRadius: 8 }, selected: { backgroundColor: '#e3f1ff' }, choiceText: { color: '#677f98', fontSize: 10 }, selectedText: { color: '#0754de', fontWeight: '700' } });
