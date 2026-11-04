import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fieldKey, sectionSchema } from '../src/lib/website.ts';

const base=process.env.TEST_SECURE_URL||'http://localhost:3002';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'CMS tests require a disposable local instance.');
const credentials=process.env.TEST_ADMIN_PASSWORD?{email:process.env.TEST_ADMIN_EMAIL,password:process.env.TEST_ADMIN_PASSWORD}:JSON.parse(readFileSync(process.env.TEST_ADMIN_CREDENTIALS_FILE||'/tmp/evpower-editor-test-credentials.json','utf8'));
let cookie='',original=null,revision=0,media=null,customerCookie='';
const headingKey=fieldKey('home','text','A better way');
const heading='Private editor draft '+randomUUID().slice(0,8);
async function call(path,body,{method=body?'POST':'GET',session=cookie,origin=base}={}){
 const multipart=body instanceof FormData;
 const res=await fetch(base+'/api/'+path,{method,headers:{Origin:origin,...(!multipart?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session}:{})},body:body?(multipart?body:JSON.stringify(body)):undefined});
 const data=await res.json();return {res,data};
}
test('production CMS endpoints reject anonymous access and cross-origin writes',async()=>{
 assert.equal((await call('cms/site',undefined,{session:''})).res.status,403);
 assert.equal((await call('cms/draft',{revision:0,document:{}},{method:'PUT',session:''})).res.status,403);
 const login=await call('auth/login',credentials,{session:''});assert.equal(login.res.status,200);
 cookie=login.res.headers.get('set-cookie').split(';')[0];assert.equal(login.data.user.role,'admin');
 assert.equal((await call('cms/draft',{}, {method:'PUT',origin:'https://untrusted.example'})).res.status,403);
 const state=await call('cms/site');assert.equal(state.res.status,200);original=structuredClone(state.data.published);revision=state.data.revision;
});
test('customer accounts cannot read drafts, upload images, or publish the website',async()=>{
 const register=await call('auth/register',{name:'CMS Customer',email:`cms-${randomUUID()}@example.com`,password:randomUUID()},{session:''});assert.equal(register.res.status,200);customerCookie=register.res.headers.get('set-cookie').split(';')[0];
 for(const [path,method,body] of [['cms/site','GET',undefined],['cms/publish','POST',{revision}],['cms/media','POST',{}]])assert.equal((await call(path,body,{method,session:customerCookie})).res.status,403);
});
test('unsafe link/image content and missing core pages are rejected without changing the draft',async()=>{
 for(const mutate of [d=>d.overrides['home.link.invalid']='javascript:alert(1)',d=>d.overrides['home.image.invalid']='data:image/svg+xml,<svg/>',d=>delete d.pages['/']]){
  const document=structuredClone(original);mutate(document);
  assert.equal((await call('cms/draft',{document,revision},{method:'PUT'})).res.status,400);
 }
 assert.equal((await call('cms/site')).data.revision,revision);
});
test('draft edits and custom pages stay private, and stale saves are rejected',async()=>{
 const document=structuredClone(original);document.overrides[headingKey]=heading;
 document.pages['/cms-test-page']={name:'CMS test page',enabled:true,seoTitle:'CMS search title',seoDescription:'A custom page created without code.',sections:[sectionSchema.parse({id:'cms-test-intro',label:'Introduction',type:'hero',title:'A new page from the editor',body:'A private draft before publication.'})]};
 document.pages['/apiary-guides']=structuredClone(document.pages['/cms-test-page']);
 document.pages['/about'].enabled=false;
 const saved=await call('cms/draft',{document,revision},{method:'PUT'});assert.equal(saved.res.status,200);const stale=revision;revision=saved.data.revision;
 assert.equal((await call('cms/draft',{document,revision:stale},{method:'PUT'})).res.status,409);
 const publicCatalog=(await call('catalog',undefined,{session:''})).data;assert.ok(!JSON.stringify(publicCatalog.site).includes(heading));
 const publicHome=await fetch(base+'/');assert.ok(!(await publicHome.text()).includes(heading));
 assert.equal((await fetch(base+'/cms-test-page')).status,404);
 const privateHome=await fetch(base+'/?editorPreview=1',{headers:{Cookie:cookie}});assert.ok((await privateHome.text()).includes(heading));
 const unauthorizedPreview=await fetch(base+'/?editorPreview=1',{headers:{Cookie:customerCookie}});assert.ok(!(await unauthorizedPreview.text()).includes(heading));
 assert.equal((await fetch(base+'/cms-test-page?editorPreview=1',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await fetch(base+'/apiary-guides?editorPreview=1',{headers:{Cookie:cookie}})).status,200);
});
test('the media library accepts raster images and serves immutable, non-executable media',async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV1cAAAAASUVORK5CYII=','base64');
 const form=new FormData();form.set('file',new Blob([png],{type:'image/png'}),'editor-test.png');
 const upload=await call('cms/media',form);assert.equal(upload.res.status,200);media=upload.data;
 const res=await fetch(base+media.url);assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await res.arrayBuffer()),png);
 assert.equal((await fetch(base+media.url,{headers:{'If-None-Match':`"${media.id}"`}})).status,304);
 const bad=new FormData();bad.set('file',new Blob(['<svg onload="alert(1)"/>'],{type:'image/svg+xml'}),'bad.svg');assert.equal((await call('cms/media',bad)).res.status,400);
 const state=(await call('cms/site')).data;const document=state.draft;document.overrides[fieldKey('home','image','/images/evpower-hero.webp')]=media.url;document.settings.theme.accent='#b9e879';
 const saved=await call('cms/draft',{document,revision},{method:'PUT'});assert.equal(saved.res.status,200);revision=saved.data.revision;
});
test('publishing makes page content, SEO, images and page visibility effective',async()=>{
 const result=await call('cms/publish',{revision});assert.equal(result.res.status,200);
 const catalog=(await call('catalog',undefined,{session:''})).data;assert.equal(catalog.site.overrides[headingKey],heading);assert.equal(catalog.site.settings.theme.accent,'#b9e879');
 const home=await fetch(base+'/');assert.ok((await home.text()).includes(heading));
 const custom=await fetch(base+'/cms-test-page');assert.equal(custom.status,200);const html=await custom.text();assert.ok(html.includes('A new page from the editor'));assert.ok(html.includes('CMS search title'));
 assert.equal((await fetch(base+'/about')).status,404);
 const sitemap=await(await fetch(base+'/sitemap.xml')).text();assert.ok(sitemap.includes('/cms-test-page'));assert.ok(!sitemap.includes('/about</loc>'));
});
test('product photographs persist independently of page drafts and revisions',async()=>{
 const product=(await call('catalog')).data.products[0];
 assert.equal((await call('admin/products',{...product,image_url:media.url},{method:'PUT'})).res.status,200);
 assert.equal((await call('catalog')).data.products[0].image_url,media.url);
 const versions=(await call('cms/site')).data.history;assert.ok(versions.length>=2);
 const before=versions.find(v=>v.note==='Before first editor publication');assert.ok(before);
 const restored=await call('cms/restore',{id:before.id,revision});assert.equal(restored.res.status,200);revision=restored.data.revision;
 assert.equal((await call('catalog')).data.site.overrides[headingKey],heading,'Restore must only change the draft');
 assert.equal((await call('cms/publish',{revision})).res.status,200);
 assert.ok(!(await call('catalog')).data.site.overrides[headingKey]);
 assert.equal((await call('catalog')).data.products[0].image_url,media.url,'Site rollback must not roll back product data');
 assert.equal((await call('admin/products',{...product,image_url:product.image_url||''},{method:'PUT'})).res.status,200);
 assert.equal((await call('cms/media',{id:media.id},{method:'DELETE'})).res.status,200);
 assert.ok(!(await call('cms/media')).data.media.some(m=>m.id===media.id));
 assert.equal((await fetch(base+media.url)).status,200,'Archived images remain available to existing published pages and history');
});
after(async()=>{
 if(!original||!cookie)return;
 const state=await call('cms/site');
 const saved=await call('cms/draft',{document:original,revision:state.data.revision},{method:'PUT'});
 if(saved.res.ok)await call('cms/publish',{revision:saved.data.revision});
});
