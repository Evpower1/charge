import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { connection } from 'next/server';
export const dynamic = 'force-dynamic';
import type { Product } from '@/lib/types';
import { ProductPage } from '@/components/pages';
import { pageMetadata,websiteForRequest,ensurePageVisible } from '@/lib/website-request';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){await connection();const db=getDb();const {id}=await params;const p=db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product|undefined;const metadata=await pageMetadata('/shop/*',p?.name||'Product not found');const {site}=await websiteForRequest();return {...metadata,description:site.pages['/shop/*']?.seoDescription||p?.description,alternates:{canonical:'/shop/'+id}};}
export default async function Page({params}:{params:Promise<{id:string}>}){await ensurePageVisible('/shop/*');await connection();const db=getDb();const {id}=await params;const p=db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product|undefined;if(!p)notFound();return <ProductPage product={{...p}}/>;}
