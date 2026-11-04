import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { getDb, demoMode } from './db';
import { sessionUser } from './server';
import { getWebsiteState } from './website-server';

export const websiteForRequest = cache(async () => {
  await connection();
  const requested = (await headers()).get('x-evpower-editor-preview') === '1';
  const preview = requested && (demoMode || sessionUser((await cookies()).get('evpower_session')?.value)?.role === 'admin');
  const state = getWebsiteState(getDb());
  return { site: preview ? state.draft : state.published, preview };
});
export async function pageMetadata(path: string, fallback: string) {
  const {site, preview} = await websiteForRequest();
  const page = site.pages[path];
  if (!preview && page?.enabled === false) notFound();
  return { title: page?.seoTitle || fallback, description: page?.seoDescription || site.settings.seoDescription, alternates:{canonical:path}, ...(preview?{robots:{index:false,follow:false}}:{}) };
}

export async function ensurePageVisible(path:string){const {site,preview}=await websiteForRequest();if(!preview&&site.pages[path]?.enabled===false)notFound();}
