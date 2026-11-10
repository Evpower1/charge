import type { ApiClient } from './api';
export type ScreenName = 'home' | 'stations' | 'book' | 'activity' | 'account' | 'wallet' | 'auth';
export type User = {id:string; name:string; email:string; phone:string; role:'customer'|'admin'; emailVerified:boolean; createdAt:string};
export type Session = {accessToken:string; refreshToken:string; user:User};
export type AppConfig = {
  name:string; currency:'ETB'; serviceCities:string[]; paymentsEnabled:boolean; telemetryConfigured:boolean; isDemo:boolean;
  contact:{phone:string; tollFree:string; email:string; whatsapp:string};
};
export type ScreenProps = {
  user:User|null; api:ApiClient; config:AppConfig|null; navigate:(screen:ScreenName)=>void;
  notify:(message:string)=>void; refreshKey:number; onRequireAuth:()=>void;
};
