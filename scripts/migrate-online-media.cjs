const {app,net}=require('electron');
const fs=require('node:fs');const path=require('node:path');const {OnlineClient}=require('../online-client');
app.whenReady().then(async()=>{
 try{
  const client=new OnlineClient({fetch:(...args)=>net.fetch(...args)});
  const db=await client.login({username:process.env.OLIMPO_TEST_USER,password:process.env.OLIMPO_TEST_PASSWORD});
  const root=path.resolve(__dirname,'../data/midia');let files=0,characters=0,missing=0;
  for(const c of db.characters){let changed=false;const seen=new Map();
   async function visit(value){if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){
    if(key==='path'&&typeof item==='string'&&!item.startsWith('/media/')){
     const resolved=path.resolve(item);if(!resolved.startsWith(root+path.sep))continue;
     if(!fs.existsSync(resolved)){missing++;continue}
     const mime=({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'})[path.extname(resolved).toLowerCase()];if(!mime)continue;
     if(!seen.has(resolved)){seen.set(resolved,await client.upload(c.id,fs.readFileSync(resolved),path.basename(resolved),mime));files++}
     value[key]=seen.get(resolved);changed=true;
    }else if(item&&typeof item==='object')await visit(item);
   }}
   await visit(c);if(changed){await client.save(c);characters++}
  }
  console.log(JSON.stringify({uploadedFiles:files,updatedCharacters:characters,missingFiles:missing}));app.exit(0);
 }catch(error){console.error(error.message);app.exit(1)}
});
