const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const output=path.join(root,'mobile-web');
fs.rmSync(output,{recursive:true,force:true});
fs.cpSync(path.join(root,'src'),output,{recursive:true});
fs.cpSync(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});

const htmlFile=path.join(output,'index.html');
const html=fs.readFileSync(htmlFile,'utf8').replaceAll('../assets/','assets/');
fs.writeFileSync(htmlFile,html,'utf8');
