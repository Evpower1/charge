import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScreenProps, Session } from '../types';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';
type Props = ScreenProps & { onAuthenticated: (session: Session) => Promise<void>; initialAction?: { kind: 'reset' | 'verify'; token: string } };

export default function AuthScreen({ api, config, navigate, notify, onAuthenticated, initialAction }: Props) {
  const [mode, setMode] = useState<Mode>(initialAction?.kind || 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(initialAction?.token || '');
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const title: Record<Mode, string> = { login: 'Welcome back.', register: 'Your next journey starts here.', forgot: 'Reset your password.', reset: 'Choose a new password.', verify: 'Verify your email.' };

  useEffect(() => {
    if (!initialAction) return;
    setMode(initialAction.kind);
    setToken(initialAction.token);
    setPassword(''); setError(''); setMessage('');
    // Opening an email link only fills the form. Explicit submit consumes its token.
  }, [initialAction?.kind, initialAction?.token]);

  function changeMode(next: Mode) {
    setMode(next); setError(''); setMessage(''); setPassword(''); setToken('');
  }
  async function submit() {
    setError(''); setMessage('');
    if (mode === 'register' && !consent) { setError('Please read and accept the privacy notice and service terms.'); return; }
    if (['login', 'register', 'forgot'].includes(mode) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (['register', 'reset'].includes(mode) && password.length < 12) { setError('Use at least 12 characters for your password.'); return; }
    if (mode === 'register' && (!name.trim() || !phone.trim())) { setError('Enter your name and phone number.'); return; }
    if (['reset', 'verify'].includes(mode) && !token.trim()) { setError('Paste the token from your email.'); return; }
    setBusy(true);
    try {
      if (mode === 'register' || mode === 'login') {
        const session = await api.request<Session>('/v1/auth/' + mode, { method: 'POST', body: mode === 'register' ? { name: name.trim(), email: email.trim(), phone: phone.trim(), password } : { email: email.trim(), password } });
        await onAuthenticated(session);
        notify(config?.isBrowserDemo ? 'Demo account opened in this browser only.' : mode === 'register' ? 'Your Evpower account is ready.' : 'You are signed in.');
      } else if (mode === 'forgot') {
        const result = await api.request<{ message?: string }>('/v1/auth/password-reset', { method: 'POST', body: { email: email.trim() } });
        setMessage(result.message || 'If an account exists and email delivery is configured, reset instructions will be sent.');
      } else if (mode === 'reset') {
        await api.request('/v1/auth/password-reset/complete', { method: 'POST', body: { token: token.trim(), password } });
        await api.clear();
        changeMode('login'); setMessage('Your password has been changed. Sign in with your new password.');
      } else {
        await api.request('/v1/auth/verify-email', { method: 'POST', body: { token: token.trim() } });
        changeMode('login'); setMessage('Email verified. You can now sign in.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to continue. Please try again.'); }
    finally { setBusy(false); }
  }

  return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
      <Pressable accessibilityRole="button" onPress={() => navigate('home')} style={s.back}><Text style={s.link}>← Back to home</Text></Pressable>
      <View style={s.mark}><Text style={s.markText}>E</Text><View style={s.spark} /></View>
      <Text style={s.eyebrow}>EVPOWER ACCOUNT</Text>
      <Text style={s.title}>{title[mode]}</Text>
      <Text style={s.intro}>{mode === 'login' ? 'Book a mobile charge, follow your requests and keep your charging details together.' : mode === 'register' ? 'One account for mobile charging, your vehicles and service credit.' : 'Keep access to your charging account secure.'}</Text>

      <View style={s.card}>
        {(mode === 'login' || mode === 'register') && <View style={s.tabs}>
          {(['login', 'register'] as Mode[]).map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: mode === item }} disabled={busy} onPress={() => changeMode(item)} style={[s.tab, mode === item && s.tabActive]}><Text style={[s.tabText, mode === item && s.tabTextActive]}>{item === 'login' ? 'Sign in' : 'Create account'}</Text></Pressable>)}
        </View>}
        {mode === 'register' && <><Text style={s.label}>Full name</Text><TextInput accessibilityLabel="Full name" autoComplete="name" value={name} onChangeText={setName} style={s.input} placeholder="Your full name" placeholderTextColor="#8292a8" /></>}
        {['login', 'register', 'forgot'].includes(mode) && <><Text style={s.label}>Email address</Text><TextInput accessibilityLabel="Email address" autoComplete="email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={s.input} placeholder="you@example.com" placeholderTextColor="#8292a8" /></>}
        {mode === 'register' && <><Text style={s.label}>Phone number</Text><TextInput accessibilityLabel="Phone number" autoComplete="tel" keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={s.input} placeholder="+251 …" placeholderTextColor="#8292a8" /></>}
        {['reset', 'verify'].includes(mode) && <><Text style={s.label}>Token from your email</Text><TextInput accessibilityLabel="Token from your email" autoCapitalize="none" autoCorrect={false} value={token} onChangeText={setToken} style={s.input} placeholder="Paste the token here" placeholderTextColor="#8292a8" /></>}
        {['login', 'register', 'reset'].includes(mode) && <><Text style={s.label}>{mode === 'reset' ? 'New password' : 'Password'}</Text><TextInput accessibilityLabel={mode === 'reset' ? 'New password' : 'Password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} secureTextEntry value={password} onChangeText={setPassword} style={s.input} placeholder={mode === 'login' ? 'Your password' : 'At least 12 characters'} placeholderTextColor="#8292a8" onSubmitEditing={() => { if (!busy) void submit(); }} /></>}
        {mode === 'login' && <Pressable accessibilityRole="button" onPress={() => changeMode('forgot')} disabled={busy} style={s.textAction}><Text style={s.link}>Forgot password?</Text></Pressable>}
        {mode === 'register' && <>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={s.checkRow}><View style={[s.check, consent && s.checked]}><Text style={s.checkText}>{consent ? '✓' : ''}</Text></View><Text style={s.checkLabel}>I agree to the service terms and privacy notice.</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setNotice(!notice)} style={s.textAction}><Text style={s.link}>{notice ? 'Hide notice' : 'Read privacy notice and service terms'}</Text></Pressable>
          {notice && <View style={s.notice}><Text style={s.noticeText}>Evpower uses your account, vehicle and booking details to arrange charging and keep service records. Your location is requested only when you choose to share a pickup position. Payment details are handled by the payment provider. Booking requests require confirmation and a quote; submitting a request does not guarantee service availability. Contact info@evpower.et for questions. You can request account deletion in Account.</Text>{!!api.baseUrl && <Pressable accessibilityRole="link" onPress={() => { Linking.openURL(api.baseUrl + '/privacy').catch(() => setError('The full privacy policy could not be opened. Please try again.')); }} style={s.textAction}><Text style={s.link}>Open full privacy policy →</Text></Pressable>}</View>}
        </>}
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        {!!message && <Text accessibilityLiveRegion="polite" style={s.success}>{message}</Text>}
        <Pressable accessibilityRole="button" disabled={busy || (mode === 'login' && !password)} onPress={() => void submit()} style={[s.primary, busy && s.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create my account' : mode === 'forgot' ? 'Send reset instructions' : mode === 'reset' ? 'Save new password' : 'Verify email'}</Text>}</Pressable>
        {mode === 'forgot' && <Pressable accessibilityRole="button" onPress={() => changeMode('reset')} style={s.secondary}><Text style={s.link}>I already have a reset token</Text></Pressable>}
        {['forgot', 'reset', 'verify'].includes(mode) && <Pressable accessibilityRole="button" onPress={() => changeMode('login')} style={s.secondary}><Text style={s.link}>Back to sign in</Text></Pressable>}
      </View>
      <Pressable accessibilityRole="button" onPress={() => changeMode('verify')} style={s.verify}><Text style={s.muted}>Have an email verification token? <Text style={s.link}>Verify it here</Text></Text></Pressable>
      <Text style={s.bottom}>A cleaner drive. A brighter Ethiopia.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, page: { flexGrow: 1, padding: 24, paddingBottom: 44, width: '100%', maxWidth: 560, alignSelf: 'center' }, back: { marginBottom: 24, alignSelf: 'flex-start', paddingVertical: 8 }, mark: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#0754de', alignItems: 'center', justifyContent: 'center', marginBottom: 25, position: 'relative' }, markText: { color: '#fff', fontWeight: '900', fontSize: 31, fontStyle: 'italic' }, spark: { position: 'absolute', right: -3, bottom: -3, width: 17, height: 17, borderRadius: 6, backgroundColor: '#00cde8', borderWidth: 3, borderColor: '#f4f8fc' }, eyebrow: { color: '#0754de', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 12 }, title: { color: '#12233e', fontWeight: '800', fontSize: 33, letterSpacing: -1.2, lineHeight: 39, marginBottom: 12 }, intro: { color: '#667b95', fontSize: 14, lineHeight: 22, marginBottom: 25 }, card: { padding: 22, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e9f4' }, tabs: { flexDirection: 'row', backgroundColor: '#f2f6fb', padding: 4, borderRadius: 12, marginBottom: 22 }, tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, tabActive: { backgroundColor: '#fff' }, tabText: { color: '#667b95', fontSize: 13, fontWeight: '600' }, tabTextActive: { color: '#0754de' }, label: { color: '#304c6d', fontWeight: '600', fontSize: 12, marginBottom: 7 }, input: { minHeight: 49, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: '#dbe5f1', borderRadius: 11, backgroundColor: '#fbfdff', color: '#12233e', fontSize: 16, marginBottom: 17 }, textAction: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 5 }, link: { color: '#0754de', fontSize: 12, fontWeight: '700' }, primary: { backgroundColor: '#0754de', minHeight: 51, borderRadius: 12, padding: 13, alignItems: 'center', justifyContent: 'center', marginTop: 9 }, primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' }, disabled: { opacity: .55 }, secondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 }, error: { backgroundColor: '#fff1f1', color: '#a32f3e', borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 19, marginVertical: 8 }, success: { backgroundColor: '#eaf9f6', color: '#1b6b57', borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 19, marginVertical: 8 }, checkRow: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44 }, check: { width: 22, height: 22, borderRadius: 6, borderColor: '#9db7d4', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: '#0754de', borderColor: '#0754de' }, checkText: { color: '#fff', fontWeight: '800', fontSize: 14 }, checkLabel: { flex: 1, color: '#536b87', fontSize: 12, lineHeight: 19 }, notice: { backgroundColor: '#f2f8fd', padding: 12, borderRadius: 10, marginVertical: 8 }, noticeText: { color: '#536b87', fontSize: 12, lineHeight: 20 }, verify: { paddingVertical: 22, alignItems: 'center' }, muted: { color: '#70839a', fontSize: 11, lineHeight: 19, textAlign: 'center' }, bottom: { color: '#8da1b9', textAlign: 'center', fontSize: 11, marginTop: 4 },
});
