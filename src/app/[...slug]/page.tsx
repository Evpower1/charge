import { notFound } from 'next/navigation';
import { websiteForRequest, pageMetadata } from '@/lib/website-request';
import { CustomWebsitePage } from '@/components/cms-page';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string[]}>}){const path='/'+(await params).slug.join('/');const {site}=await websiteForRequest();return pageMetadata(path,site.pages[path]?.name||'Page');}
export default async function Page({params}:{params:Promise<{slug:string[]}>}){const path='/'+(await params).slug.join('/');const {site,preview}=await websiteForRequest();const page=site.pages[path];if(!page||!preview&&!page.enabled)notFound();return <CustomWebsitePage path={path}/>;}
