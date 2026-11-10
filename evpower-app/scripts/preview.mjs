import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const api=resolve(root,'api'),mobile=resolve(root,'mobile');
const folder=resolve(root,'.preview-data');
const database=resolve(folder,'mobile.sqlite');
const credentialsPath=resolve(folder,'operator-access.json');
const port=Number(process.env.EVPOWER_PREVIEW_PORT||4100);
const base=`http://127.0.0.1:${port}`;
const npm=process.platform==='win32'?'npm.cmd':'npm';
const environment={...process.env,NODE_ENV:'development',DEMO_MODE:'true',HOST:'127.0.0.1',PORT:String(port),
  DATABASE_PATH:database,API_PUBLIC_URL:base,EXPO_PUBLIC_API_URL:base,CORS_ORIGINS:base,
  PAYMENTS_ENABLED:'false',CHAPA_SECRET_KEY:'',CHAPA_WEBHOOK_SECRET:'',SMTP_URL:'',MAIL_FROM:'',
  TELEMETRY_INGEST_KEY:'',TRUSTED_PROXY_IPS:'',EAS_BUILD_PROFILE:'preview',
  EXPO_PUBLIC_BROWSER_DEMO:'false',EXPO_PUBLIC_WEB_BASE_PATH:'/app',
  EXPO_NO_TELEMETRY:'1',EXPO_NO_DOTENV:'1',EXPO_OFFLINE:'1',CI:'1'};

function run(command,args,cwd,{input,quiet=false}={}){
  return new Promise((resolveRun,reject)=>{
    const child=spawn(command,args,{cwd,env:environment,shell:process.platform==='win32'&&command===npm,
      stdio:quiet?['pipe','pipe','pipe']:'inherit'});
    let output='';
    if(quiet){child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);child.stdin.end(input||'');}
    child.once('error',reject);
    child.once('close',code=>code===0?resolveRun(output):reject(new Error(output.trim()||`${command} exited with code ${code}`)));
  });
}
async function checkPort(){
  const server=createServer();
  await new Promise((resolvePort,reject)=>{
    server.once('error',error=>reject(new Error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Stop that preview or set EVPOWER_PREVIEW_PORT to another port.`:`Cannot open the local preview port (${error.code}).`)));
    server.listen(port,'127.0.0.1',()=>server.close(resolvePort));
  });
}
function openBrowser(url){
  let child;
  if(process.platform==='win32')child=spawn('cmd',['/d','/c','start','',url],{stdio:'ignore'});
  else child=spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});
  child.once('error',()=>console.log('Open the app URL above in your browser.'));
}
async function main(){
  if(Number(process.versions.node.split('.')[0])!==24)throw new Error('Install Node.js 24 LTS from https://nodejs.org before starting this preview.');
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('EVPOWER_PREVIEW_PORT must be a port from 1024 to 65535.');
  await checkPort();
  console.log('Preparing your local Evpower preview. Real payments, email and charger connections are disabled.');
  for(const [directory,dependency] of [[api,'fastify'],[mobile,'expo']]){
    if(!existsSync(resolve(directory,'node_modules',dependency,'package.json'))){
      console.log(`Installing ${directory===api?'API':'app'} dependencies from the lockfile…`);
      await run(npm,['ci','--no-audit','--no-fund'],directory);
    }
  }
  console.log('Building the browser app…');
  await run(npm,['run','export:web','--','--max-workers','2'],mobile);
  mkdirSync(folder,{recursive:true,mode:0o700});
  if(!existsSync(credentialsPath)||!existsSync(database)){
    const access={adminEmail:`preview-${randomBytes(4).toString('hex')}@evpower.test`,adminPassword:randomBytes(24).toString('base64url')};
    await run(process.execPath,['src/cli.mjs','admin','--email',access.adminEmail,'--name','Local preview operator','--phone','+251900000000','--password-stdin'],api,{quiet:true,input:access.adminPassword+'\n'});
    writeFileSync(credentialsPath,JSON.stringify(access,null,2)+'\n',{mode:0o600});
  }
  // Re-running the preview preserves the same private local database and login.
  try{await run(process.execPath,['src/cli.mjs','demo-stations'],api,{quiet:true});}
  catch(error){if(!error.message.includes('Demo stations are already present.'))throw error;}
  let access;
  try{access=JSON.parse(readFileSync(credentialsPath,'utf8'));}
  catch{throw new Error('Local operator access file is invalid. Check .preview-data/operator-access.json.');}
  if(!access.adminEmail||!access.adminPassword)throw new Error('Local operator access file is invalid.');
  const server=spawn(process.execPath,['src/server.mjs'],{cwd:api,env:environment,stdio:'inherit'});
  let stopped=false,exited=false;
  const stop=()=>{if(!stopped){stopped=true;server.kill('SIGTERM');}};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  server.once('error',error=>{console.error(error.message);process.exitCode=1;});
  server.once('exit',code=>{exited=true;process.exitCode=stopped?0:(code||0);});
  let ready=false;
  for(let attempt=0;attempt<60&&!stopped&&!exited;attempt++){
    try{const response=await fetch(base+'/health',{signal:AbortSignal.timeout(1500)});if(response.ok){ready=true;break;}}
    catch{}
    await new Promise(resolveWait=>setTimeout(resolveWait,500));
  }
  if(stopped)return;
  if(!ready||exited){stop();throw new Error('The local API did not start. Check the message above and try again.');}
  console.log(`\nApp: ${base}/app/\nOperator dashboard: ${base}/operator/\nOperator login: open ${credentialsPath}\nKeep this terminal open. Press Ctrl+C to stop the preview.\nUse test details only. This preview does not dispatch a real charging team.\n`);
  if(!process.argv.includes('--no-open'))openBrowser(base+'/app/');
}
main().catch(error=>{console.error(`Preview could not start: ${error.message}`);process.exitCode=1;});
