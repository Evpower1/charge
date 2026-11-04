import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './globals.css';
import './editor.css';
import { getDb, demoMode } from '@/lib/db';
import { websiteForRequest } from '@/lib/website-request';
import { fieldKey } from '@/lib/website';
import { WebsiteTheme } from '@/components/cms-runtime';
import { connection } from 'next/server';
import { StoreProvider } from '@/components/store';
import { Header, Footer, GlobalOverlays } from '@/components/shell';
import type { Product, Station } from '@/lib/types';
export const dynamic = 'force-dynamic';
const baseMetadata: Metadata = {
 metadataBase:new URL(process.env.APP_URL||'https://evpower.et'),
 title:{default:'Evpower — Powering your electric journey in Ethiopia',template:'%s | Evpower'},
 description:'A brighter way to move. Explore mobile EV charging, fleet solutions, home chargers and EV care in Addis Ababa and Adama. Call Evpower toll-free on 8890.',
 openGraph:{title:'Evpower — The road ahead is electric',description:'EV charging, chargers, and care. Made for Ethiopia.',images:[{url:'/images/evpower-hero.webp',width:1672,height:941}],type:'website',locale:'en_ET',siteName:'Evpower'},
 twitter:{card:'summary_large_image'},
 robots:{index:true,follow:true},
 icons:{icon:'/icon.svg'}
};
export async function generateMetadata():Promise<Metadata>{const {site,preview}=await websiteForRequest();return {...baseMetadata,title:{default:site.settings.seoTitle,template:`%s | ${site.settings.companyName}`},description:site.settings.seoDescription,openGraph:{...baseMetadata.openGraph,title:site.settings.seoTitle,description:site.settings.seoDescription,siteName:site.settings.companyName,images:[{url:site.overrides[fieldKey('home','image','/images/evpower-hero.webp')]||'/images/evpower-hero.webp'}]},icons:{icon:site.settings.favicon||'/icon.svg'},...(preview?{robots:{index:false,follow:false}}:{})};}
export const viewport: Viewport = {width:'device-width',initialScale:1,themeColor:'#102a2e'};
export default async function RootLayout({children}:{children:React.ReactNode}){
 await connection();
 const db = getDb();
 const {site,preview}=await websiteForRequest();
 const initial={products:db.prepare('SELECT * FROM products').all().map(p=>({...p})) as Product[],stations:db.prepare('SELECT * FROM stations').all().map(s=>({...s})) as Station[],demo:demoMode,paymentsAvailable:!!process.env.CHAPA_SECRET_KEY,announcement:site.settings.announcement,site,previewAuthorized:preview};
 return <html lang="en"><body><a href="#main" className="skip-link">Skip to content</a><StoreProvider initial={initial}><WebsiteTheme><Header/><main id="main">{children}</main><Footer/><GlobalOverlays/></WebsiteTheme></StoreProvider></body></html>;
}
