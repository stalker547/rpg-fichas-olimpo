const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function register(result,draft,selected){
 const sandbox={draft,n:value=>Number(value)||0,$:selector=>({value:selector==='#roll-outcome-value'?(result>=50?'success':'failure'):result}),currentRoll:()=>({selected,effects:[],modifier:0}),rollProgressType:'skill',markDirty(){},toast(){},render(){},uid:()=>`id-${Math.random()}`,normalizeName:value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')};
 vm.createContext(sandbox);
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),start=source.indexOf('function registerRollResult(){'),end=source.indexOf('\nfunction ',start+1);
 vm.runInContext(source.slice(start,end)+'\nregisterRollResult()',sandbox);
 return draft;
}

test('primeiro uso transforma perícia temporária em aprendizado',()=>{
 const draft={skills:[],learning:[],quests:[],abilities:[],creations:[]};
 register(60,draft,[{temporary:true,key:'temporary:atletismo',name:'Atletismo'}]);
 assert.equal(draft.learning[0].name,'Atletismo');
 assert.equal(draft.learning[0].current,2);
 assert.equal(draft.learning[0].goal,10);
});

test('aprendizado em 10 vira perícia de nível 1',()=>{
 const draft={skills:[],learning:[{name:'Percepção',current:9,goal:10}],quests:[],abilities:[],creations:[]};
 register(40,draft,[{learning:true,key:'learning:0',name:'Percepção'}]);
 assert.equal(draft.learning.length,0);
 assert.equal(draft.skills[0].name,'Percepção');
 assert.equal(draft.skills[0].value,1);
});
