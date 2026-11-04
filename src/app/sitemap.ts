import type { MetadataRoute } from 'next';
export default function sitemap():MetadataRoute.Sitemap{const base=process.env.APP_URL||'https://evpower.et';return ['','/services','/locations','/shop','/about','/contact','/faq','/privacy','/terms'].map(p=>({url:base+p,changeFrequency:p==='/shop'||p==='/locations'?'weekly':'monthly',priority:p===''?1:.7}));}
