import 'server-only';
import { fetch as proxyFetch, EnvHttpProxyAgent } from 'undici';
const agent = new EnvHttpProxyAgent();
export async function chapa(path: string, body?: unknown) {
  if (!process.env.CHAPA_SECRET_KEY) throw new Error('Live payments are not configured yet. Please contact the team.');
  const res = await proxyFetch(`https://api.chapa.co/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    dispatcher: agent,
    signal: AbortSignal.timeout(20000)
  });
  const data = await res.json() as { status: string; data: Record<string, string>; message: unknown };
  if (!res.ok || data.status !== 'success') throw new Error('The payment provider could not complete this request. Please try again.');
  return data.data;
}
