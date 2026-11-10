import { createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

export function chapaProvider(config) {
  if (!config.chapaSecret) return null;
  const request = async (path, body) => {
    const response = await fetch('https://api.chapa.co/v1/' + path, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: 'Bearer ' + config.chapaSecret, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) throw new Error('Payment provider is unavailable');
    const result = await response.json();
    if (result.status !== 'success') throw new Error('Payment provider rejected the request');
    return result.data;
  };
  return {
    async initialize({ reference, amountMinor, user }) {
      const names = user.name.trim().split(/\s+/);
      const data = await request('transaction/initialize', {
        amount: (amountMinor / 100).toFixed(2), currency: 'ETB', email: user.email,
        first_name: names[0], last_name: names.slice(1).join(' ') || names[0],
        tx_ref: reference, callback_url: config.publicUrl + '/v1/payments/chapa/webhook',
        return_url: config.publicUrl + '/payment-return',
        customization: { title: 'Evpower service credit', description: 'Credit for Evpower charging services' }
      });
      const url = new URL(data.checkout_url);
      if (url.protocol !== 'https:' || !(url.hostname === 'chapa.co' || url.hostname.endsWith('.chapa.co'))) throw new Error('Invalid checkout URL');
      return { checkoutUrl: url.href };
    },
    async verify(reference) {
      const data = await request('transaction/verify/' + encodeURIComponent(reference));
      return { status: data.status, reference: data.tx_ref, amount: String(data.amount), currency: data.currency };
    }
  };
}

export function validSignature(raw, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export function smtpMailer(config) {
  if (!config.smtpUrl || !config.mailFrom) return null;
  const url = new URL(config.smtpUrl);
  if (!['smtp:', 'smtps:'].includes(url.protocol)) throw new Error('SMTP_URL must use smtp:// or smtps://.');
  const secure = url.protocol === 'smtps:';
  const transport = nodemailer.createTransport({ host:url.hostname,port:Number(url.port||(secure?465:587)),secure,
    requireTLS:config.production&&!secure,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
    ...(url.username?{auth:{user:decodeURIComponent(url.username),pass:decodeURIComponent(url.password)}}:{}),tls:{minVersion:'TLSv1.2'} });
  return { async send({ to, kind, actionToken }) {
    const action = kind === 'reset' ? 'Reset your password' : 'Verify your email';
    const url = config.publicUrl + '/app/#kind=' + kind + '&token=' + encodeURIComponent(actionToken);
    await transport.sendMail({ from: config.mailFrom, to, subject: 'Evpower · ' + action,
      text: action + ': ' + url + '\n\nYou can also enter this one-time code in the Evpower app:\n' + actionToken + '\n\nIf you did not request this, ignore this email.' });
  } };
}
