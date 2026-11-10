import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import type { ScreenProps, User } from '../types';

type Vehicle = { id: string; make: string; model: string; plate: string; connector: string; batteryKwh: number | null };
type Address = { id: string; label: string; address: string; latitude: number | null; longitude: number | null };
type Notice = { id: string; title: string; message: string; readAt: string | null; createdAt: string };
type Props = ScreenProps & { onLogout: () => Promise<void>; onUserChanged: (user: User) => void };
type Section = 'profile' | 'vehicles' | 'addresses' | 'notifications' | 'support' | 'privacy' | 'delete';
const connectors = ['CCS2', 'Type2', 'GB/T', 'CHAdeMO'];
const failure = (e: unknown) => e instanceof Error ? e.message : 'Unable to complete this request. Please try again.';

function Field({ label, value, onChange, placeholder, keyboardType, secure, multiline }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboardType?: KeyboardTypeOptions; secure?: boolean; multiline?: boolean }) {
  return <><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input, multiline && s.multiline]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#8b9bb0" keyboardType={keyboardType} secureTextEntry={secure} multiline={multiline} autoCapitalize={secure ? 'none' : 'sentences'} /></>;
}
function Button({ title, onPress, disabled, secondary, danger }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, danger && s.dangerButton, disabled && s.disabled]}><Text style={[s.buttonText, secondary && s.secondaryText, danger && s.dangerText]}>{title}</Text></Pressable>;
}

export default function AccountScreen({ user, api, config, navigate, notify, refreshKey, onRequireAuth, onLogout, onUserChanged }: Props) {
  const [expanded, setExpanded] = useState<Section | null>('profile');
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [verification, setVerification] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [make, setMake] = useState(''); const [model, setModel] = useState(''); const [plate, setPlate] = useState('');
  const [connector, setConnector] = useState('CCS2'); const [battery, setBattery] = useState('');
  const [addressLabel, setAddressLabel] = useState(''); const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(''); const [longitude, setLongitude] = useState('');
  const [subject, setSubject] = useState(''); const [supportMessage, setSupportMessage] = useState('');
  const [deletePassword, setDeletePassword] = useState(''); const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const mounted = useRef(true); const loadId = useRef(0);

  useEffect(() => { setName(user?.name || ''); setPhone(user?.phone || ''); }, [user?.name, user?.phone]);
  async function load() {
    if (!user) return;
    const current = ++loadId.current; setLoading(true);
    const results = await Promise.allSettled([
      api.request<{ items: Vehicle[] }>('/v1/vehicles'), api.request<{ items: Address[] }>('/v1/addresses'), api.request<{ items: Notice[] }>('/v1/notifications'),
    ]);
    if (!mounted.current || current !== loadId.current) return;
    if (results[0].status === 'fulfilled') setVehicles(results[0].value.items);
    if (results[1].status === 'fulfilled') setAddresses(results[1].value.items);
    if (results[2].status === 'fulfilled') setNotifications(results[2].value.items);
    const rejected = results.find(item => item.status === 'rejected');
    if (rejected?.status === 'rejected') setError(failure(rejected.reason));
    setLoading(false);
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; loadId.current++; }; }, [user?.id, refreshKey]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (AppState.currentState === 'active' || Platform.OS === 'web') api.request<{ items: Notice[] }>('/v1/notifications').then(result => { if (mounted.current) setNotifications(result.items); }).catch(() => {}); };
    const interval = setInterval(refresh, 15000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(interval); listener.remove(); };
  }, [user?.id]);

  async function act(key: string, task: () => Promise<void>, success: string) {
    if (busy) return; setBusy(key); setError('');
    try { await task(); if (mounted.current) { notify(success); await load(); } }
    catch (e) { if (mounted.current) setError(failure(e)); }
    finally { if (mounted.current) setBusy(''); }
  }
  function resetVehicle() { setVehicleId(null); setMake(''); setModel(''); setPlate(''); setConnector('CCS2'); setBattery(''); }
  function editVehicle(item: Vehicle) { setVehicleId(item.id); setMake(item.make); setModel(item.model); setPlate(item.plate); setConnector(item.connector); setBattery(item.batteryKwh == null ? '' : String(item.batteryKwh)); }
  function saveVehicle() {
    if (!make.trim() || !model.trim() || !plate.trim()) { setError('Enter the vehicle make, model and plate.'); return; }
    if (!battery.trim() || !Number.isFinite(Number(battery)) || Number(battery) < 1 || Number(battery) > 300) { setError('Enter the battery capacity between 1 and 300 kWh.'); return; }
    void act('vehicle', async () => { await api.request('/v1/vehicles' + (vehicleId ? '/' + encodeURIComponent(vehicleId) : ''), { method: vehicleId ? 'PATCH' : 'POST', body: { make: make.trim(), model: model.trim(), plate: plate.trim(), connector, batteryKwh: Number(battery) } }); resetVehicle(); }, vehicleId ? 'Vehicle updated.' : 'Vehicle saved.');
  }
  function saveAddress() {
    if (!addressLabel.trim() || !address.trim()) { setError('Enter a label and address.'); return; }
    const hasLat = !!latitude.trim(), hasLon = !!longitude.trim();
    if (hasLat !== hasLon || (hasLat && (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180))) { setError('Enter valid latitude and longitude together, or leave both empty.'); return; }
    void act('address', async () => { await api.request('/v1/addresses', { method: 'POST', body: { label: addressLabel.trim(), address: address.trim(), latitude: hasLat ? Number(latitude) : null, longitude: hasLon ? Number(longitude) : null } }); setAddressLabel(''); setAddress(''); setLatitude(''); setLongitude(''); }, 'Address saved.');
  }
  async function openContact(url: string) { try { await Linking.openURL(url); } catch { notify('This link could not be opened on this device.'); } }
  const unread = notifications.filter(item => !item.readAt).length;
  function section(key: Section, title: string, subtitle: string, content: React.ReactNode) {
    const open = expanded === key;
    return <View style={s.panel} key={key}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => { setExpanded(open ? null : key); setError(''); }} style={s.panelHeading}><View style={s.headingCopy}><Text style={s.panelTitle}>{title}</Text><Text style={s.panelSubtitle}>{subtitle}</Text></View><Text style={s.chevron}>{open ? '−' : '+'}</Text></Pressable>{open && <View style={s.panelBody}>{content}</View>}</View>;
  }

  if (!user) return <View style={s.empty}><Text style={s.title}>Your Evpower account.</Text><Text style={s.intro}>Sign in to manage your vehicles, addresses and charging requests.</Text><Button title="Sign in or create an account" onPress={onRequireAuth} /></View>;
  return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
    <Text style={s.eyebrow}>YOUR EVPOWER</Text><Text style={s.title}>Account</Text><Text style={s.intro}>Everything for a smoother charging journey.</Text>
    <View style={s.profile}><View style={s.avatar}><Text style={s.avatarText}>{user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</Text></View><View style={s.headingCopy}><Text style={s.profileName}>{user.name}</Text><Text style={s.profileEmail}>{user.email}</Text><Text style={[s.verificationBadge, !user.emailVerified && s.unverified]}>{config?.isBrowserDemo ? 'Demo account · this browser only' : user.emailVerified ? 'Email verified' : 'Email verification pending'}</Text></View></View>
    <Pressable accessibilityRole="button" onPress={() => navigate('wallet')} style={s.walletLink}><View><Text style={s.walletTitle}>Evpower service credit</Text><Text style={s.walletCopy}>View your balance and transaction history</Text></View><Text style={s.walletArrow}>→</Text></Pressable>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {loading && <ActivityIndicator color="#0754de" style={s.spinner} />}

    {section('profile', 'Personal details', 'Name, phone and email verification', <>
      <Field label="Full name" value={name} onChange={setName} /><Field label="Phone number" value={phone} onChange={setPhone} keyboardType="phone-pad" />
      <Button title={busy === 'profile' ? 'Saving…' : 'Save profile'} disabled={!!busy} onPress={() => void act('profile', async () => { const updated = await api.request<User>('/v1/me', { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() } }); onUserChanged(updated); }, 'Profile updated.')} />
      {!user.emailVerified && !config?.isBrowserDemo && <View style={s.inset}><Text style={s.help}>Verify your email to protect access to your account.</Text><Button secondary title={busy === 'resend' ? 'Requesting…' : 'Send verification email'} disabled={!!busy} onPress={() => void act('resend', async () => { await api.request('/v1/auth/resend-verification', { method: 'POST' }); }, 'Verification instructions requested. Check your inbox.')} /><Field label="Verification token from email" value={verification} onChange={setVerification} /><Button secondary title="Verify email" disabled={!!busy || !verification.trim()} onPress={() => void act('verify', async () => { await api.request('/v1/auth/verify-email', { method: 'POST', body: { token: verification.trim() } }); const updated = await api.request<User>('/v1/me'); onUserChanged(updated); setVerification(''); }, 'Email verified.')} /></View>}
    </>)}

    {section('vehicles', 'My vehicles', `${vehicles.length} saved · connector and battery details`, <>
      {!vehicles.length && <Text style={s.help}>Save your vehicle to make your next booking quicker.</Text>}
      {vehicles.map(item => <View style={s.listCard} key={item.id}><Text style={s.itemTitle}>{item.make} {item.model}</Text><Text style={s.itemCopy}>{item.plate} · {item.connector}{item.batteryKwh ? ` · ${item.batteryKwh} kWh` : ''}</Text><View style={s.row}><Button secondary title={`Edit ${item.plate}`} disabled={!!busy} onPress={() => editVehicle(item)} /><Button secondary title={`Remove ${item.plate}`} disabled={!!busy} onPress={() => void act('remove-vehicle', async () => { await api.request('/v1/vehicles/' + encodeURIComponent(item.id), { method: 'DELETE' }); if (vehicleId === item.id) resetVehicle(); }, 'Vehicle removed.')} /></View></View>)}
      <Text style={s.formTitle}>{vehicleId ? 'Edit vehicle' : 'Add a vehicle'}</Text><Field label="Make" value={make} onChange={setMake} placeholder="e.g. BYD" /><Field label="Model" value={model} onChange={setModel} /><Field label="Plate number" value={plate} onChange={setPlate} />
      <Text style={s.label}>Connector</Text><View style={s.chips}>{connectors.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: connector === item }} onPress={() => setConnector(item)} style={[s.chip, connector === item && s.chipActive]}><Text style={[s.chipText, connector === item && s.chipTextActive]}>{item}</Text></Pressable>)}</View>
      <Field label="Battery capacity in kWh" value={battery} onChange={setBattery} keyboardType="decimal-pad" placeholder="e.g. 60" /><Button title={busy === 'vehicle' ? 'Saving…' : vehicleId ? 'Update vehicle' : 'Save vehicle'} disabled={!!busy} onPress={saveVehicle} />{vehicleId && <Button secondary title="Cancel editing" disabled={!!busy} onPress={resetVehicle} />}
    </>)}

    {section('addresses', 'Saved addresses', `${addresses.length} saved pickup locations`, <>
      {!addresses.length && <Text style={s.help}>Add home, work or another place you often charge.</Text>}
      {addresses.map(item => <View style={s.listCard} key={item.id}><Text style={s.itemTitle}>{item.label}</Text><Text style={s.itemCopy}>{item.address}</Text><Button secondary title={`Remove ${item.label}`} disabled={!!busy} onPress={() => void act('remove-address', async () => { await api.request('/v1/addresses/' + encodeURIComponent(item.id), { method: 'DELETE' }); }, 'Address removed.')} /></View>)}
      <Text style={s.formTitle}>Add an address</Text><Field label="Address label" value={addressLabel} onChange={setAddressLabel} placeholder="Home or work" /><Field label="Street address and landmark" value={address} onChange={setAddress} multiline /><Text style={s.help}>Coordinates are optional. Your booking can use your current location instead.</Text><Field label="Latitude (optional)" value={latitude} onChange={setLatitude} keyboardType="numbers-and-punctuation" /><Field label="Longitude (optional)" value={longitude} onChange={setLongitude} keyboardType="numbers-and-punctuation" /><Button title={busy === 'address' ? 'Saving…' : 'Save address'} disabled={!!busy} onPress={saveAddress} />
    </>)}

    {section('notifications', 'Notifications', unread ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'Booking and payment updates', <>
      {!notifications.length && <Text style={s.help}>Updates about your bookings and payments will appear here.</Text>}
      {notifications.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.title + (item.readAt ? ', read' : ', mark as read')} onPress={() => { if (!item.readAt) void act('notice', async () => { await api.request('/v1/notifications/' + encodeURIComponent(item.id) + '/read', { method: 'POST' }); }, 'Update marked as read.'); }} style={[s.listCard, !item.readAt && s.unreadCard]}><Text style={s.itemTitle}>{!item.readAt ? '• ' : ''}{item.title}</Text><Text style={s.itemCopy}>{item.message}</Text><Text style={s.timestamp}>{new Date(item.createdAt).toLocaleString()}</Text></Pressable>)}
    </>)}

    {section('support', 'Help & support', 'Speak with the Evpower team', <>
      <View style={s.contactGrid}><Button secondary title="Call toll-free 8890" onPress={() => void openContact('tel:' + (config?.contact.tollFree || '8890'))} /><Button secondary title="WhatsApp Evpower" onPress={() => void openContact('https://wa.me/' + (config?.contact.whatsapp || '+251911049916').replace(/\D/g, ''))} /><Button secondary title="Email support" onPress={() => void openContact('mailto:' + (config?.contact.email || 'info@evpower.et'))} /></View>
      <Text style={s.formTitle}>Send a support request</Text><Field label="Subject" value={subject} onChange={setSubject} /><Field label="How can we help?" value={supportMessage} onChange={setSupportMessage} multiline /><Text style={s.help}>Include your booking reference if you have one. Never send passwords or payment PINs.</Text><Button title={busy === 'support' ? 'Sending…' : 'Send request'} disabled={!!busy || !subject.trim() || !supportMessage.trim()} onPress={() => void act('support', async () => { await api.request('/v1/support', { method: 'POST', body: { subject: subject.trim(), message: supportMessage.trim() } }); setSubject(''); setSupportMessage(''); }, config?.isBrowserDemo ? 'Preview message saved locally. Evpower has not received it.' : 'Your support request has been received.')} />
    </>)}

    {section('privacy', 'Privacy & service information', 'Your data and how charging requests work', <>
      <Text style={s.help}>Evpower uses your name, contact details, saved vehicles and booking information to arrange charging and provide support. Location is requested only when you choose to use your current position for a request.</Text><Text style={s.help}>Charging availability comes from connected station equipment. A missing or stale station feed is shown as unknown. A mobile charging request requires confirmation and an operator quote; it is not a guaranteed booking until confirmed.</Text><Text style={s.help}>Chapa handles payment checkout. Evpower service credit can be used for Evpower bookings; it is not a bank account and does not support transfers or cash withdrawals in this app.</Text><Text style={s.help}>You may delete your account below. Some transaction records may be retained without your profile details where necessary for financial records. Contact info@evpower.et with privacy questions or if account deletion requires help.</Text>
      {!!api.baseUrl && <><Button secondary title="Open full privacy policy" onPress={() => void openContact(api.baseUrl + '/privacy')} /><Button secondary title="Account deletion information" onPress={() => void openContact(api.baseUrl + '/account-deletion')} /></>}
    </>)}

    {section('delete', 'Delete account', 'Permanently remove your account and saved details', <>
      <Text style={s.help}>This signs you out and removes your saved profile, vehicles and addresses. Resolve any remaining service credit or active charging service with support first.</Text><Field label="Confirm your password" value={deletePassword} onChange={setDeletePassword} secure /><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: deleteConfirmed }} onPress={() => setDeleteConfirmed(!deleteConfirmed)} style={s.checkRow}><View style={[s.check, deleteConfirmed && s.checked]}><Text style={s.checkText}>{deleteConfirmed ? '✓' : ''}</Text></View><Text style={s.checkLabel}>I understand that this permanently deletes my account.</Text></Pressable><Button danger title={busy === 'delete' ? 'Deleting…' : 'Delete my account permanently'} disabled={!!busy || !deletePassword || !deleteConfirmed} onPress={() => { setBusy('delete'); setError(''); api.request('/v1/me', { method: 'DELETE', body: { password: deletePassword } }).then(async () => { await onLogout(); notify('Your account has been deleted.'); }).catch(e => { if (mounted.current) { setError(failure(e)); setBusy(''); } }); }} />
    </>)}
    <Button secondary title="Sign out" disabled={!!busy} onPress={() => { setBusy('logout'); onLogout().catch(e => { setError(failure(e)); setBusy(''); }); }} />
    <Text style={s.footer}>EVPOWER · POWERING YOUR JOURNEY</Text>
  </ScrollView></KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, page: { padding: 22, paddingBottom: 40, width: '100%', maxWidth: 700, alignSelf: 'center' }, empty: { padding: 25, gap: 18 }, eyebrow: { color: '#0754de', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 10 }, title: { fontSize: 33, fontWeight: '800', letterSpacing: -1.1, color: '#12233e' }, intro: { color: '#70839b', fontSize: 13, lineHeight: 21, marginTop: 8, marginBottom: 22 }, profile: { flexDirection: 'row', gap: 15, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1eaf5', padding: 20, borderRadius: 20, marginBottom: 12 }, avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#e8f3ff', borderWidth: 1, borderColor: '#d1e5ff', justifyContent: 'center', alignItems: 'center' }, avatarText: { color: '#0754de', fontWeight: '800', fontSize: 20 }, headingCopy: { flex: 1, minWidth: 0 }, profileName: { color: '#142b49', fontSize: 19, fontWeight: '700' }, profileEmail: { color: '#70839a', fontSize: 12, marginTop: 5 }, verificationBadge: { color: '#187662', fontSize: 10, fontWeight: '600', marginTop: 8 }, unverified: { color: '#946412' }, walletLink: { borderRadius: 16, padding: 18, backgroundColor: '#0754de', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 }, walletTitle: { color: '#fff', fontSize: 13, fontWeight: '700' }, walletCopy: { color: '#d5eaff', fontSize: 11, marginTop: 5 }, walletArrow: { color: '#7bf1ff', fontSize: 23 }, panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1eaf5', borderRadius: 17, marginBottom: 11, overflow: 'hidden' }, panelHeading: { minHeight: 82, padding: 19, flexDirection: 'row', alignItems: 'center', gap: 12 }, panelTitle: { color: '#213b5c', fontSize: 14, fontWeight: '700' }, panelSubtitle: { color: '#8492a7', fontSize: 11, lineHeight: 17, marginTop: 5 }, chevron: { color: '#0754de', fontSize: 24, width: 24, textAlign: 'center' }, panelBody: { padding: 19, paddingTop: 2 }, label: { color: '#3c5674', fontSize: 11, fontWeight: '600', marginBottom: 7 }, input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#dce6f2', backgroundColor: '#fbfdff', paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: '#12233e', marginBottom: 15 }, multiline: { minHeight: 95, textAlignVertical: 'top' }, button: { minHeight: 46, padding: 12, backgroundColor: '#0754de', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginVertical: 4 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' }, secondary: { borderWidth: 1, borderColor: '#dce8f4', backgroundColor: '#f9fcff' }, secondaryText: { color: '#315d8f' }, dangerButton: { backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#f1ccd0' }, dangerText: { color: '#b32f43' }, disabled: { opacity: .5 }, help: { color: '#6e8097', fontSize: 12, lineHeight: 20, marginBottom: 14 }, inset: { borderTopWidth: 1, borderTopColor: '#edf2f8', marginTop: 18, paddingTop: 17 }, formTitle: { color: '#244263', fontSize: 13, fontWeight: '700', marginTop: 13, marginBottom: 17 }, listCard: { borderWidth: 1, borderColor: '#e7eef6', borderRadius: 12, backgroundColor: '#fbfdff', padding: 13, marginBottom: 10 }, itemTitle: { color: '#304c6c', fontSize: 13, fontWeight: '700', lineHeight: 20 }, itemCopy: { color: '#75869c', fontSize: 12, lineHeight: 20, marginTop: 4 }, row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 7 }, chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }, chip: { paddingHorizontal: 13, minHeight: 40, borderWidth: 1, borderColor: '#dbe6f2', backgroundColor: '#fbfdff', borderRadius: 10, justifyContent: 'center' }, chipActive: { backgroundColor: '#eaf3ff', borderColor: '#0754de' }, chipText: { color: '#667b95', fontSize: 12, fontWeight: '600' }, chipTextActive: { color: '#0754de' }, error: { color: '#a42e42', backgroundColor: '#fff0f1', borderRadius: 10, padding: 13, marginBottom: 15, fontSize: 12, lineHeight: 19 }, spinner: { padding: 10 }, unreadCard: { backgroundColor: '#f0f7ff', borderColor: '#cfe2ff' }, timestamp: { color: '#96a3b5', fontSize: 10, marginTop: 8 }, contactGrid: { gap: 5, marginBottom: 14 }, checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 }, check: { width: 22, height: 22, borderWidth: 1, borderColor: '#9cb2cc', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: '#0754de', borderColor: '#0754de' }, checkText: { color: '#fff', fontWeight: '800' }, checkLabel: { flex: 1, color: '#74849a', fontSize: 12, lineHeight: 19 }, footer: { color: '#9aabbd', fontSize: 9, letterSpacing: 1.2, textAlign: 'center', marginTop: 24 },
});
