import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { protectMutation, readBody, requireAdmin, currentUser, rateLimit } from '@/lib/server';
import { websiteSchema } from '@/lib/website';
import { getWebsiteState } from '@/lib/website-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const conflict=()=>Object.assign(new Error('The website was changed in another tab. Reload the editor before saving.'),{status:409});
async function handler(req:NextRequest,context:{params:Promise<{path:string[]}>}) {
 try {
  requireAdmin(req);
  const path=(await context.params).path.join('/');
  if(req.method!=='GET')protectMutation(req,path==='media'?8*1024*1024:512*1024);
  const db=getDb();
  if(req.method==='GET'&&path==='site'){
   const state=getWebsiteState(db);
   return response({...state,history:db.prepare('SELECT id,note,author,created_at FROM website_versions ORDER BY id DESC LIMIT 40').all()});
  }
  if(req.method==='PUT'&&path==='draft'){
   const input=z.object({document:websiteSchema,revision:z.number().int().min(0)}).parse(await readBody(req,512*1024));
   getWebsiteState(db);
   const result=db.prepare('UPDATE website_state SET draft=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(input.document),input.revision);
   if(!result.changes)throw conflict();
   return response({revision:input.revision+1});
  }
  if(req.method==='POST'&&path==='publish'){
   const input=z.object({revision:z.number().int().min(0)}).parse(await readBody(req));
   db.exec('BEGIN IMMEDIATE');
   try{
    const state=getWebsiteState(db);
    if(state.revision!==input.revision)throw conflict();
    const author=currentUser(req)?.name||'Local demo editor';
    if(!db.prepare('SELECT id FROM website_versions LIMIT 1').get())db.prepare('INSERT INTO website_versions (document,note,author) VALUES (?,?,?)').run(JSON.stringify(state.published),'Before first editor publication',author);
    db.prepare('INSERT INTO website_versions (document,note,author) VALUES (?,?,?)').run(JSON.stringify(state.draft),`Published version ${state.publishedRevision+1}`,author);
    db.prepare('UPDATE website_state SET published=draft,published_revision=published_revision+1 WHERE id=1').run();
    db.prepare("UPDATE content SET value=? WHERE id='announcement'").run(state.draft.settings.announcement);
    db.exec('COMMIT');
    return response({publishedRevision:state.publishedRevision+1});
   }catch(error){db.exec('ROLLBACK');throw error;}
  }
  if(req.method==='POST'&&path==='restore'){
   const input=z.object({id:z.number().int().positive(),revision:z.number().int().min(0)}).parse(await readBody(req));
   const row=db.prepare('SELECT document FROM website_versions WHERE id=?').get(input.id);
   if(!row)return response({error:'That version is unavailable.'},404);
   const document=websiteSchema.parse(JSON.parse(String(row.document)));
   const result=db.prepare('UPDATE website_state SET draft=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(document),input.revision);
   if(!result.changes)throw conflict();
   return response({document,revision:input.revision+1});
  }
  if(req.method==='GET'&&path==='media')return response({media:db.prepare("SELECT id,name,mime,size,created_at,('/api/media/'||id) AS url FROM website_media WHERE archived=0 ORDER BY created_at DESC LIMIT 200").all()});
  if(req.method==='POST'&&path==='media'){
   rateLimit(`media:${currentUser(req)?.id||'demo'}`,80,3600000);
   const reader=req.body?.getReader();if(!reader)return response({error:'Choose an image.'},400);
   const chunks:Uint8Array[]=[];let length=0;
   while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>8*1024*1024){await reader.cancel();return response({error:'Images must be smaller than 8 MB.'},413);}chunks.push(part.value);}
   const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
   const file=form.get('file');if(!(file instanceof File)||!file.size)return response({error:'Choose a PNG, JPEG, or WebP image.'},400);
   const bytes=Buffer.from(await file.arrayBuffer());
   const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':'';
   if(!mime)return response({error:'Only PNG, JPEG, and WebP images are supported. SVG and executable files are not accepted.'},400);
   const id=randomUUID();const name=file.name.replace(/[^\p{L}\p{N} ._-]/gu,'').slice(0,120)||'Website image';
   db.prepare('INSERT INTO website_media (id,name,mime,size,bytes) VALUES (?,?,?,?,?)').run(id,name,mime,bytes.length,bytes);
   return response({id,name,mime,size:bytes.length,url:`/api/media/${id}`});
  }
  if(req.method==='DELETE'&&path==='media'){
   const input=z.object({id:z.uuid()}).parse(await readBody(req));
   db.prepare('UPDATE website_media SET archived=1 WHERE id=?').run(input.id);
   return response({ok:true});
  }
  return response({error:'Editor endpoint not found.'},404);
 }catch(error){
  if(error instanceof z.ZodError)return response({error:error.issues[0]?.message||'Check the website fields.'},400);
  const e=error as Error&{status?:number};
  if(e.status)return response({error:e.message},e.status);
  if(error instanceof SyntaxError)return response({error:'Invalid editor data.'},400);
  console.error('Website editor request failed:',e.name);
  return response({error:'Could not save your website. Please try again.'},500);
 }
}
export {handler as GET,handler as PUT,handler as POST,handler as DELETE};
