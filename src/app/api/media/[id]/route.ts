import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[a-f0-9-]{36}$/.test(id))return new NextResponse(null,{status:404});
 const row=getDb().prepare('SELECT mime,bytes FROM website_media WHERE id=?').get(id);
 if(!row)return new NextResponse(null,{status:404});
 const headers={'Content-Type':String(row.mime),'Cache-Control':'public, max-age=31536000, immutable','ETag':`"${id}"`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"};
 if(req.headers.get('if-none-match')===`"${id}"`)return new NextResponse(null,{status:304,headers});
 return new NextResponse(new Uint8Array(row.bytes as Uint8Array),{headers});
}
