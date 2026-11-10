import { spawn } from 'node:child_process';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const basePath='/charge/app-preview';
const output=resolve(root,'mobile/demo-dist');
const npm=process.platform==='win32'?'npm.cmd':'npm';
const env={...process.env,EXPO_PUBLIC_BROWSER_DEMO:'true',EXPO_PUBLIC_WEB_BASE_PATH:basePath,
  EXPO_PUBLIC_API_URL:'https://evpower1.github.io'+basePath,EAS_BUILD_PROFILE:'preview',
  EXPO_NO_TELEMETRY:'1',EXPO_NO_DOTENV:'1',EXPO_OFFLINE:'1',CI:'1'};
await new Promise((resolveBuild,reject)=>{
  const child=spawn(npm,['run','export:web','--','--output-dir','demo-dist','--max-workers','2'],{cwd:resolve(root,'mobile'),env,stdio:'inherit',shell:process.platform==='win32'});
  child.once('error',reject);child.once('close',code=>code===0?resolveBuild():reject(new Error('Browser demo export failed.')));
});
const index=resolve(output,'index.html');
await writeFile(index,(await readFile(index,'utf8')).replace('<head>','<head><meta name="robots" content="noindex,nofollow"><meta name="description" content="Evpower interactive demo. Preview data stays in your browser. No real bookings or payments.">'));
await writeFile(resolve(output,'.nojekyll'),'');
const notice='<aside style="padding:18px;background:#fff3d8;color:#70511d;font:14px/1.6 sans-serif">INTERACTIVE DEMO: this preview stores test data only in your browser. It does not submit bookings, support messages or payments to Evpower. The policy below describes the intended connected service.</aside>';
for(const [route,file] of [['privacy','privacy.html'],['support','support.html'],['account-deletion','account-deletion.html']]){
  const folder=resolve(output,route);await mkdir(folder,{recursive:true});
  let html=await readFile(resolve(root,'docs/public',file),'utf8');
  html=html.replace('<head>','<head><meta name="robots" content="noindex,nofollow">').replace(/<body([^>]*)>/,'<body$1>'+notice).replaceAll('/release-pages.css',basePath+'/release-pages.css');
  for(const page of ['privacy','support','account-deletion'])html=html.replaceAll(`href="/${page}"`,`href="${basePath}/${page}/"`);
  await writeFile(resolve(folder,'index.html'),html);
}
await writeFile(resolve(output,'release-pages.css'),await readFile(resolve(root,'docs/public/styles.css')));
console.log('Browser-only demo exported to mobile/demo-dist. It uses local test data and cannot send real service requests.');
