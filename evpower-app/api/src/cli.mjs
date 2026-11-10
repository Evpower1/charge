import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { openDatabase, transaction } from './database.mjs';
import { environmentConfig } from './app.mjs';
import { hashPassword, id } from './auth.mjs';

const command = process.argv[2];
const { values } = parseArgs({ args:process.argv.slice(3), options:{email:{type:'string'},name:{type:'string'},phone:{type:'string'},'password-stdin':{type:'boolean'}} });
const config = environmentConfig();
const db = openDatabase(config.databasePath);
try {
  if (command === 'admin') {
    if (!values['password-stdin']) throw new Error('Use --password-stdin. Passwords must not be passed as command arguments.');
    const data = z.object({email:z.string().email().transform(v=>v.toLowerCase()),name:z.string().min(2).max(100),phone:z.string().min(7).max(24),password:z.string().min(12).max(200)}).parse({...values,password:readFileSync(0,'utf8').replace(/\r?\n$/,'')});
    const encoded=await hashPassword(data.password);
    if(db.prepare('SELECT id FROM users WHERE email=?').get(data.email))throw new Error('This email already exists. Use a separate new operator email.');
    transaction(db,()=>{const uid=id();db.prepare("INSERT INTO users(id,name,email,phone,password_hash,role,email_verified,created_at) VALUES(?,?,?,?,?,'admin',1,?)").run(uid,data.name,data.email,data.phone,encoded,new Date().toISOString());db.prepare('INSERT INTO balances(user_id) VALUES(?)').run(uid);});
    console.log('Operator account created. Sign in at /operator/.');
  } else if(command==='demo-stations') {
    if(config.production||!config.isDemo)throw new Error('Demo stations require DEMO_MODE=true and a non-production environment.');
    const count=db.prepare('SELECT count(*) AS n FROM stations WHERE is_demo=1').get().n;
    if(count)throw new Error('Demo stations are already present.');
    transaction(db,()=>{
      for(const [name,city,address,lat,lon]of [['Demo · Addis Ababa training bay','Addis Ababa','Sample location only — not a real Evpower station',9.0108,38.7613],['Demo · Adama training bay','Adama','Sample location only — not a real Evpower station',8.5406,39.2686]]){
        const sid=id();db.prepare('INSERT INTO stations VALUES(?,?,?,?,?,?,1,1)').run(sid,name,city,address,lat,lon);db.prepare("INSERT INTO connectors(id,station_id,type,power_kw,status) VALUES('demo-1',?,'CCS2',60,'unknown')").run(sid);
      }
    });
    console.log('Two clearly marked demo locations added. Availability remains unknown.');
  } else throw new Error('Usage: npm run admin -- --email EMAIL --name NAME --phone PHONE --password-stdin, or npm run demo:stations');
} finally { db.close(); }
