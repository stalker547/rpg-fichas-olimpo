const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function roll(outcome,remaining=27){
 const creation={name:'Rastro marcado',current:remaining,requirement:40};
 const sandbox={draft:{creations:[creation]},n:v=>Number(v)||0,$:selector=>({value:selector==='#roll-outcome-value'?outcome:''}),currentRoll:()=>({selected:[{creation:true,key:'creation:0',current:remaining}]}),rollProgressType:'creation',markDirty(){},toast(){},render(){}};
 vm.createContext(sandbox);const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');const start=source.indexOf('function registerRollResult(){'),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end)+'\nregisterRollResult()',sandbox);return creation.current;
}
test('creation success reduces remaining by two',()=>assert.equal(roll('success'),25));
test('creation failure reduces remaining by one',()=>assert.equal(roll('failure'),26));
test('creation critical on natural 100 reduces remaining by three',()=>assert.equal(roll('critical'),24));
test('creation progress cannot go below zero',()=>assert.equal(roll('success',1),0));
