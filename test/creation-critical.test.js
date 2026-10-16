const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function roll(result,remaining=27){
 const creation={name:'Rastro marcado',current:remaining,requirement:40};
 const sandbox={draft:{creations:[creation]},n:v=>Number(v)||0,$:()=>({value:result}),currentRoll:()=>({selected:[{creation:true,key:'creation:0',current:remaining}]}),rollProgressType:'creation',markDirty(){},toast(){},render(){}};
 vm.createContext(sandbox);const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');const start=source.indexOf('function registerRollResult(){'),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end)+'\nregisterRollResult()',sandbox);return creation.current;
}
test('critical creation roll reduces remaining by three',()=>assert.equal(roll(100),24));
test('normal success reduces by two and failure by one',()=>{assert.equal(roll(60),25);assert.equal(roll(24),26)});
test('critical cannot reduce remaining below zero',()=>assert.equal(roll(100,2),0));
