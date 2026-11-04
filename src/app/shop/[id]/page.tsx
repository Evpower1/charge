import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import type { Product } from '@/lib/types';
import { ProductPage } from '@/components/pages';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const p=db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product|undefined;return {title:p?.name||'Product not found',description:p?.description};}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const p=db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product|undefined;if(!p)notFound();return <ProductPage product={{...p}}/>;}
