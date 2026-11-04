import type { MetadataRoute } from 'next';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/api/','/admin','/account','/checkout']},sitemap:`${process.env.APP_URL||'https://evpower.et'}/sitemap.xml`};}
