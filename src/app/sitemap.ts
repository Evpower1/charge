import type { MetadataRoute } from 'next';
import { websiteForRequest } from '@/lib/website-request';
import { getDb } from '@/lib/db';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const {site}=await websiteForRequest();const base=process.env.APP_URL||'https://evpower.et';
 const pages=Object.entries(site.pages).filter(([path,p])=>p.enabled&&!path.includes('*')).map(([path])=>({url:base+(path==='/'?'':path),changeFrequency:'weekly' as const,priority:path==='/'?1:.7}));
 if(site.pages['/shop']?.enabled&&site.pages['/shop/*']?.enabled)for(const row of getDb().prepare('SELECT id FROM products').all())pages.push({url:`${base}/shop/${encodeURIComponent(String(row.id))}`,changeFrequency:'weekly',priority:.7});
 return pages;
}
