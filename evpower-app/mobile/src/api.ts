import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { Session } from './types';

export class ApiError extends Error {
  constructor(message:string, public status:number, public code:string, public fields?:unknown) { super(message); this.name='ApiError'; }
}
type Options = {method?:string; body?:unknown; headers?:Record<string,string>};
const REFRESH_KEY = 'evpower.refresh.v1';

export class ApiClient {
  readonly baseUrl:string;
  private accessToken:string|null=null;
  private refreshToken:string|null=null;
  private refreshing:Promise<Session>|null=null;
  private sessionEpoch=0;
  private storageQueue:Promise<void>=Promise.resolve();
  onSession:(session:Session|null)=>void=()=>{};
  constructor(baseUrl:string) { this.baseUrl=baseUrl.replace(/\/+$/,''); }
  newIdempotencyKey():string { return Crypto.randomUUID(); }
  async setSession(session:Session):Promise<void> {
    ++this.sessionEpoch;
    this.accessToken=session.accessToken; this.refreshToken=session.refreshToken;
    this.onSession(session);
    if (Platform.OS!=='web') {
      this.storageQueue=this.storageQueue.then(async()=>{
        try { await SecureStore.setItemAsync(REFRESH_KEY,session.refreshToken,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}); }
        catch { /* Login remains in memory if device storage is unavailable. */ }
      });
      await this.storageQueue;
    }
  }
  async restore():Promise<Session|null> {
    if (Platform.OS==='web') return null;
    try { this.refreshToken=await SecureStore.getItemAsync(REFRESH_KEY); }
    catch { return null; }
    if (!this.refreshToken) return null;
    try { return await this.refresh(); }
    catch(error) {
      if(error instanceof ApiError && error.status===401) return null;
      throw error; // A temporary outage must not erase a valid device session.
    }
  }
  async clear():Promise<void> {
    ++this.sessionEpoch;
    this.accessToken=null; this.refreshToken=null;
    this.onSession(null);
    if (Platform.OS!=='web') {
      this.storageQueue=this.storageQueue.then(async()=>{try {await SecureStore.deleteItemAsync(REFRESH_KEY);} catch {}});
      await this.storageQueue;
    }
  }
  async logout():Promise<void> {
    const token=this.refreshToken;
    await this.clear();
    if(token) await this.send('/v1/auth/logout',{method:'POST',body:{refreshToken:token}},false);
  }
  private async refresh():Promise<Session> {
    if (this.refreshing) return this.refreshing;
    if (!this.refreshToken) throw new ApiError('Please sign in to continue.',401,'UNAUTHENTICATED');
    const epoch=this.sessionEpoch;
    this.refreshing=(async()=>{
      try {
        const session=await this.send<Session>('/v1/auth/refresh',{method:'POST',body:{refreshToken:this.refreshToken}},false);
        if(epoch!==this.sessionEpoch) throw new ApiError('Your session has changed. Please sign in again.',401,'SESSION_CHANGED');
        await this.setSession(session); return session;
      } catch (error) {
        if(error instanceof ApiError && error.status===401 && epoch===this.sessionEpoch) await this.clear();
        throw error;
      } finally { this.refreshing=null; }
    })();
    return this.refreshing;
  }
  async request<T>(path:string,options:Options={}):Promise<T> {
    try { return await this.send<T>(path,options,true); }
    catch (error) {
      if (error instanceof ApiError && error.status===401 && this.refreshToken && !path.startsWith('/v1/auth/')) {
        await this.refresh(); return this.send<T>(path,options,true);
      }
      throw error;
    }
  }
  private async send<T>(path:string,options:Options,authorized:boolean):Promise<T> {
    if (!path.startsWith('/v1/')) throw new ApiError('Invalid API route.',0,'INVALID_ROUTE');
    if (!this.baseUrl) throw new ApiError('The Evpower service connection has not been configured yet.',0,'API_NOT_CONFIGURED');
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(this.baseUrl+path,{
        method:options.method||'GET',signal:controller.signal,
        headers:{Accept:'application/json',...(options.body!==undefined?{'Content-Type':'application/json'}:{}),
          ...(authorized&&this.accessToken?{Authorization:`Bearer ${this.accessToken}`} : {}),...options.headers},
        ...(options.body!==undefined?{body:JSON.stringify(options.body)}:{}),
      });
      const text=await response.text(); let data:any;
      try { data=text?JSON.parse(text):{}; } catch { throw new ApiError('The service returned an unreadable response. Please try again.',response.status,'INVALID_RESPONSE'); }
      if(!response.ok) throw new ApiError(data?.error?.message||'Unable to complete the request.',response.status,data?.error?.code||'REQUEST_FAILED',data?.error?.fields);
      return data as T;
    } catch(error) {
      if(error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted?'The request timed out. Please try again.':'Cannot reach Evpower. Check your connection and try again.',0,'NETWORK_ERROR');
    } finally { clearTimeout(timer); }
  }
}

const configured=process.env.EXPO_PUBLIC_API_URL;
export const api=new ApiClient(configured||(__DEV__?(Platform.OS==='android'?'http://10.0.2.2:4100':'http://localhost:4100'):''));
