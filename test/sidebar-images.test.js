const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('a lista lateral recarrega retratos após o salvamento automático',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
 const start=source.indexOf('function renderSidebar()'),end=source.indexOf('\nlet announcedPointGrants',start);
 const characterList={innerHTML:''},filter={classList:{toggle(){}},innerHTML:''};
 let painted=null;
 const character={id:'silas',name:'Silas',profile:{level:15,parent:'Hades'},portrait:{path:'/media/foto-silas'}};
 const sandbox={db:{characters:[character]},currentId:'silas',directoryTableFilter:'all',
  $:selector=>selector==='#character-list'?characterList:filter,
  campaignTables:()=>[],isMaster:()=>false,unreadPointGrants:()=>[],
  portraitCss:()=>'',esc:value=>String(value),n:value=>Number(value)||0,
  paintImages:element=>{painted=element}
 };
 vm.createContext(sandbox);
 vm.runInContext(source.slice(start,end),sandbox);
 sandbox.renderSidebar();
 assert.match(characterList.innerHTML,/data-image-path="\/media\/foto-silas"/);
 assert.equal(painted,characterList);
});
