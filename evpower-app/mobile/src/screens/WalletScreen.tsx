import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { ScreenProps } from '../types';

type Transaction = { id: string; kind: string; amountMinor: number; balanceAfterMinor: number; reference: string; createdAt: string };
type Wallet = { balanceMinor: number; currency: 'ETB'; paymentsEnabled: boolean; transactions: Transaction[]; pendingTopups?: Topup[] };
type Topup = { id: string; reference: string; checkoutUrl: string; status: string; createdAt?: string };
const successStatuses = ['success', 'succeeded', 'paid', 'credited', 'completed'];
const failedStatuses = ['failed', 'cancelled', 'canceled', 'expired', 'abandoned'];
const validCheckout = (url: string) => /^https:\/\/(?:[a-z0-9-]+\.)?chapa\.co(?:\/|$)/i.test(url);
const money = (minor: number) => `${(minor / 100).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
const failure = (e: unknown) => e instanceof Error ? e.message : 'Unable to complete this request. Please try again.';
function amountMinor(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const total = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

export default function WalletScreen({ user, api, config, navigate, notify, refreshKey, onRequireAuth }: ScreenProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState('500');
  const [pending, setPending] = useState<Topup | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);
  const mounted = useRef(true); const checkingRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await api.request<Wallet>('/v1/wallet');
      if (mounted.current) {
        setWallet(result); setUpdated(new Date()); setError('');
        if (Array.isArray(result.pendingTopups)) {
          const unfinished = result.pendingTopups.filter(item => !successStatuses.includes(item.status) && !failedStatuses.includes(item.status));
          unfinished.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setPending(current => unfinished.find(item => item.id === current?.id) || unfinished[0] || null);
        }
      }
    } catch (e) { if (mounted.current) setError(failure(e)); }
    finally { if (mounted.current) setLoading(false); }
  }, [user?.id, api]);

  const verify = useCallback(async (payment: Topup, quiet = false) => {
    if (checkingRef.current) return;
    checkingRef.current = true; if (mounted.current) setChecking(true);
    try {
      const result = await api.request<{ status: string }>('/v1/wallet/topups/' + encodeURIComponent(payment.id) + '/verify', { method: 'POST' });
      if (!mounted.current) return;
      await load();
      if (!mounted.current) return;
      if (successStatuses.includes(result.status)) {
        setPending(current => current?.id === payment.id ? null : current);
        notify('Payment verified. Your service credit has been updated.');
      } else if (failedStatuses.includes(result.status)) {
        setPending(current => current?.id === payment.id ? null : current);
        setError('Payment ' + payment.reference + ' was not completed (' + result.status + '). No service credit was added for this payment. You can start another top-up.');
      } else if (result.status === 'manual_review') {
        setError('This payment needs review by Evpower. Contact support with reference ' + payment.reference + '. No service credit is added while it is under review.');
      } else if (!quiet) notify('Payment is awaiting confirmation. No credit is added until it is verified.');
    } catch (e) { if (mounted.current && !quiet) setError(failure(e)); }
    finally { checkingRef.current = false; if (mounted.current) setChecking(false); }
  }, [api, load, notify]);

  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load, refreshKey]);
  useEffect(() => {
    if (!user) return;
    const foreground = () => { if (AppState.currentState === 'active' || Platform.OS === 'web') { if (pending) void verify(pending, true); else void load(); } };
    const timer = setInterval(foreground, 15000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') foreground(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [user?.id, pending, load, verify]);

  async function topup() {
    if (busy) return;
    const minor = amountMinor(amount);
    if (minor == null || minor < 1000 || minor > 10000000) { setError('Enter an amount from 10 to 100,000 ETB, with no more than two decimal places.'); return; }
    setBusy(true); setError('');
    try {
      const payment = await api.request<Topup>('/v1/wallet/topups', { method: 'POST', body: { amountMinor: minor }, headers: { 'Idempotency-Key': api.newIdempotencyKey() } });
      if (!validCheckout(payment.checkoutUrl)) throw new Error('The payment provider returned an unsupported checkout link. Contact support before paying.');
      if (!mounted.current) return;
      setPending(payment);
      await WebBrowser.openBrowserAsync(payment.checkoutUrl, { toolbarColor: '#0754de', controlsColor: '#ffffff', showTitle: true });
      if (mounted.current) await verify(payment);
    } catch (e) { if (mounted.current) setError(failure(e)); }
    finally { if (mounted.current) setBusy(false); }
  }

  if (!user) return <View style={s.empty}><Text style={s.title}>Your charging credit.</Text><Text style={s.intro}>Sign in to view your Evpower service credit and payment history.</Text><Pressable accessibilityRole="button" style={s.primary} onPress={onRequireAuth}><Text style={s.primaryText}>Sign in or create an account</Text></Pressable></View>;
  const enabled = wallet?.paymentsEnabled ?? config?.paymentsEnabled ?? false;
  return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#0754de" />}>
    <Text style={s.eyebrow}>EVPOWER WALLET</Text><Text style={s.title}>Ready for the road.</Text><Text style={s.intro}>Service credit for your next Evpower charge.</Text>
    <View style={s.balanceCard}><View style={s.balanceTop}><Text style={s.balanceLabel}>AVAILABLE SERVICE CREDIT</Text><Text style={s.currency}>ETB</Text></View>{wallet ? <Text style={s.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.6}>{money(wallet.balanceMinor).replace(/ ETB$/, '')}</Text> : loading ? <ActivityIndicator color="#fff" style={s.balanceLoading} /> : <Text style={s.balanceUnknown}>Balance unavailable</Text>}<View style={s.balanceBottom}><Text style={s.balanceHint}>Evpower charging services</Text><View style={s.energyDot} /></View></View>
    {!!updated && <Text style={s.updated}>Last checked {updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}

    <View style={s.card}>
      <Text style={s.cardTitle}>Add service credit</Text><Text style={s.copy}>Pay through Chapa using the methods available at checkout. Your balance changes only after payment is verified.</Text>
      {!enabled && <View style={s.notice}><Text style={s.noticeTitle}>Top-ups are not available yet</Text><Text style={s.noticeCopy}>{config?.isBrowserDemo ? 'All payments are disabled in this browser demo. No real money can be added or spent.' : 'Evpower is connecting its payment service. You can still request a charging quote and contact the team for help.'}</Text></View>}
      {enabled && !user.emailVerified && <View style={s.notice}><Text style={s.noticeTitle}>Verify your email first</Text><Text style={s.noticeCopy}>Email verification protects your service credit and payment records.</Text><Pressable accessibilityRole="button" onPress={() => navigate('account')} style={s.textButton}><Text style={s.textLink}>Open account verification →</Text></Pressable></View>}
      <Text style={s.label}>Amount in Ethiopian birr</Text><TextInput accessibilityLabel="Top-up amount in Ethiopian birr" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} editable={enabled && !busy} style={[s.input, !enabled && s.inputDisabled]} placeholder="500.00" placeholderTextColor="#8d9db0" />
      <View style={s.presets}>{['100', '500', '1000', '2000'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: amount === value }} disabled={!enabled || busy} onPress={() => setAmount(value)} style={[s.preset, amount === value && s.presetSelected]}><Text style={[s.presetText, amount === value && s.presetTextSelected]}>{value}</Text></Pressable>)}</View>
      {pending && <Text style={s.pendingCopy}>You have an unfinished payment below. Check its status before starting another top-up.</Text>}
      <Pressable accessibilityRole="button" disabled={!enabled || !user.emailVerified || busy || loading || checking} onPress={() => void topup()} style={[s.primary, (!enabled || !user.emailVerified || busy || loading || checking) && s.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Continue to Chapa →</Text>}</Pressable>
      <Text style={s.providerNote}>Your card details and payment PIN stay with the payment provider.</Text>
      {pending && <View style={s.pendingCard}><Text style={s.pendingTitle}>{pending.status === 'manual_review' ? 'Payment needs review' : 'Awaiting payment confirmation'}</Text><Text style={s.pendingCopy}>Reference: {pending.reference}</Text><Text style={s.pendingCopy}>If you finished checkout, check the payment again. Closing checkout does not confirm a payment.</Text><Pressable accessibilityRole="button" disabled={checking || busy} onPress={() => void verify(pending)} style={[s.secondary, (checking || busy) && s.disabled]}><Text style={s.secondaryText}>{checking ? 'Checking payment…' : 'Check payment status'}</Text></Pressable>{pending.status === 'pending' && validCheckout(pending.checkoutUrl) && <Pressable accessibilityRole="button" disabled={checking || busy} onPress={() => { const payment = pending; setBusy(true); setError(''); WebBrowser.openBrowserAsync(payment.checkoutUrl, { toolbarColor: '#0754de', controlsColor: '#fff', showTitle: true }).then(() => verify(payment)).catch(e => { if (mounted.current) setError(failure(e)); }).finally(() => { if (mounted.current) setBusy(false); }); }} style={s.textButton}><Text style={s.textLink}>Resume this secure checkout →</Text></Pressable>}{(wallet?.pendingTopups?.length || 0) > 1 && <View style={s.pendingChoices}><Text style={s.pendingFine}>Other unfinished payments</Text>{wallet?.pendingTopups?.filter(item => item.id !== pending.id).map(item => <Pressable key={item.id} accessibilityRole="button" disabled={checking || busy} onPress={() => { setPending(item); setError(''); }} style={s.textButton}><Text style={s.textLink}>{item.reference}</Text></Pressable>)}</View>}<Text style={s.pendingFine}>Unfinished payments stay available here when you reopen the app. A payment verified later will still appear in your balance.</Text></View>}
    </View>

    <View style={s.card}><View style={s.historyHeading}><Text style={s.cardTitle}>Transaction history</Text><Pressable accessibilityRole="button" onPress={() => void load()} disabled={loading} style={s.refresh}><Text style={s.textLink}>Refresh</Text></Pressable></View>
      {!wallet?.transactions.length && <View style={s.emptyHistory}><Text style={s.emptySymbol}>↗</Text><Text style={s.emptyTitle}>Your charging story starts here.</Text><Text style={s.copy}>Verified top-ups, booking payments and refunds will appear in this list.</Text></View>}
      {wallet?.transactions.map(item => {
        const positive = item.amountMinor > 0;
        const label = item.kind === 'topup' ? 'Service credit added' : item.kind === 'booking_payment' ? 'Booking payment' : item.kind === 'refund' ? 'Booking refund' : item.kind.replace(/_/g, ' ');
        return <View style={s.transaction} key={item.id}><View style={[s.transactionIcon, positive && s.transactionIconCredit]}><Text style={[s.transactionIconText, positive && s.transactionIconTextCredit]}>{positive ? '↓' : '↑'}</Text></View><View style={s.transactionCopy}><Text style={s.transactionTitle}>{label}</Text><Text style={s.transactionDate}>{new Date(item.createdAt).toLocaleString()}</Text><Text style={s.reference}>{item.reference}</Text><Text style={s.after}>Balance after: {money(item.balanceAfterMinor)}</Text></View><Text style={[s.transactionAmount, positive && s.creditAmount]}>{positive ? '+' : '−'}{money(Math.abs(item.amountMinor))}</Text></View>;
      })}
    </View>
    <View style={s.bottomNote}><Text style={s.bottomTitle}>Made for your Evpower journeys.</Text><Text style={s.copy}>This balance is service credit for Evpower bookings. Transfers and cash withdrawals are not available in the app.</Text><Pressable accessibilityRole="button" onPress={() => navigate('account')} style={s.textButton}><Text style={s.textLink}>Need help with a payment? Contact support →</Text></Pressable></View>
  </ScrollView></KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, page: { width: '100%', maxWidth: 700, alignSelf: 'center', padding: 22, paddingBottom: 40 }, empty: { padding: 25, gap: 20 }, eyebrow: { color: '#0754de', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 10 }, title: { color: '#12233e', fontSize: 31, fontWeight: '800', letterSpacing: -1.1, lineHeight: 38 }, intro: { color: '#75879f', fontSize: 13, lineHeight: 21, marginTop: 8, marginBottom: 23 }, balanceCard: { backgroundColor: '#0754de', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#0c75ec' }, balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 }, balanceLabel: { color: '#c4e8ff', fontSize: 9, fontWeight: '700', letterSpacing: 1.6 }, currency: { color: '#98f4ff', fontSize: 11, fontWeight: '700' }, balance: { color: '#fff', fontSize: 43, fontWeight: '800', letterSpacing: -1.3, paddingVertical: 21 }, balanceUnknown: { color: '#fff', fontSize: 23, fontWeight: '700', paddingVertical: 23 }, balanceLoading: { minHeight: 94, alignSelf: 'flex-start' }, balanceBottom: { borderTopWidth: 1, borderTopColor: '#3b81e7', paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, balanceHint: { color: '#d0e7ff', fontSize: 11 }, energyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#73efff' }, updated: { color: '#8b9cb0', fontSize: 10, marginTop: 10, marginBottom: 19, textAlign: 'right' }, card: { borderWidth: 1, borderColor: '#e0eaf4', borderRadius: 20, padding: 20, backgroundColor: '#fff', marginBottom: 16 }, cardTitle: { color: '#213c5d', fontSize: 16, fontWeight: '700', marginBottom: 9 }, copy: { color: '#7b8ba1', fontSize: 12, lineHeight: 20 }, label: { color: '#496480', fontSize: 11, fontWeight: '600', marginTop: 20, marginBottom: 8 }, input: { color: '#153153', borderWidth: 1, borderColor: '#d9e5f3', borderRadius: 11, minHeight: 53, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fbfdff', fontSize: 21, fontWeight: '700' }, inputDisabled: { color: '#8b9bb0', backgroundColor: '#f3f6fa' }, presets: { flexDirection: 'row', gap: 8, marginVertical: 12 }, preset: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: '#e0e9f4', borderRadius: 9, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbfdff' }, presetSelected: { borderColor: '#8cc2ff', backgroundColor: '#eff7ff' }, presetText: { color: '#778aa2', fontSize: 12, fontWeight: '600' }, presetTextSelected: { color: '#0754de' }, primary: { minHeight: 51, borderRadius: 11, backgroundColor: '#0754de', alignItems: 'center', justifyContent: 'center', padding: 13 }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '700' }, disabled: { opacity: .45 }, providerNote: { textAlign: 'center', color: '#91a0b3', fontSize: 10, lineHeight: 17, marginTop: 12 }, notice: { backgroundColor: '#eff8fc', borderWidth: 1, borderColor: '#d4ebf5', borderRadius: 11, padding: 13, marginTop: 16 }, noticeTitle: { color: '#396a89', fontWeight: '700', fontSize: 12, marginBottom: 5 }, noticeCopy: { color: '#7791a5', fontSize: 11, lineHeight: 18 }, error: { color: '#a72e44', backgroundColor: '#fff1f2', padding: 13, borderRadius: 11, fontSize: 12, lineHeight: 19, marginBottom: 15 }, pendingCard: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#e6eef6' }, pendingChoices: { borderTopWidth: 1, borderTopColor: '#edf2f8', paddingTop: 12, marginTop: 5 }, pendingTitle: { color: '#8a681e', fontSize: 13, fontWeight: '700', marginBottom: 8 }, pendingCopy: { color: '#8d8b7b', fontSize: 11, lineHeight: 19, marginBottom: 8 }, pendingFine: { color: '#9aa7b7', fontSize: 10, lineHeight: 17 }, secondary: { borderWidth: 1, borderColor: '#dbe8f5', borderRadius: 10, padding: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#0754de', fontSize: 12, fontWeight: '700' }, textButton: { minHeight: 44, justifyContent: 'center', marginVertical: 3 }, textLink: { color: '#0754de', fontSize: 11, fontWeight: '700', lineHeight: 19 }, historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, refresh: { minHeight: 40, paddingLeft: 15, justifyContent: 'center' }, emptyHistory: { alignItems: 'center', paddingVertical: 26, gap: 11 }, emptySymbol: { color: '#00b9d8', fontSize: 28 }, emptyTitle: { color: '#405e7d', fontSize: 13, fontWeight: '600' }, transaction: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#eff3f8' }, transactionIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#eef4fd', alignItems: 'center', justifyContent: 'center' }, transactionIconCredit: { backgroundColor: '#e9f9f4' }, transactionIconText: { color: '#426c9b', fontSize: 18 }, transactionIconTextCredit: { color: '#259777' }, transactionCopy: { flex: 1, minWidth: 0 }, transactionTitle: { color: '#385675', fontSize: 12, fontWeight: '700' }, transactionDate: { color: '#96a2b3', fontSize: 10, marginTop: 5 }, reference: { color: '#95a3b5', fontSize: 9, lineHeight: 15, marginTop: 3 }, after: { color: '#8194a9', fontSize: 10, marginTop: 5 }, transactionAmount: { color: '#385675', fontSize: 11, fontWeight: '700', maxWidth: 120, textAlign: 'right' }, creditAmount: { color: '#25836d' }, bottomNote: { paddingHorizontal: 3, paddingTop: 7 }, bottomTitle: { color: '#4b6786', fontWeight: '600', fontSize: 12, marginBottom: 7 },
});
