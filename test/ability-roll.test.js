const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const {applyProgression}=require('../src/progression');
function roll(result,current=0,successTarget=50){
 const ability={name:'Mochila infinita',level:1,useCurrent:current,useGoal:25};
 const sandbox={draft:{abilities:[ability]},n:value=>Number(value)||0,$:selector=>({value:selector==='#roll-outcome-value'?(result>=successTarget?'success':'failure'):result}),currentRoll:()=>({selected:[{ability:true,key:'ability:0'}],effects:[],successTarget}),rollProgressType:'ability',markDirty(){},toast(){},render(){applyProgression(sandbox.draft)}};
 vm.createContext(sandbox);const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');const start=source.indexOf('function registerRollResult(){'),end=source.indexOf('\nfunction ',start+1);
 vm.runInContext(source.slice(start,end)+'\nregisterRollResult()',sandbox);return ability;
}
test('ability success at 60 grants two uses',()=>assert.equal(roll(60).useCurrent,2));
test('ability failure at 40 still grants one use',()=>assert.equal(roll(40).useCurrent,1));
test('50 is success and 49 is failure',()=>{assert.equal(roll(50).useCurrent,2);assert.equal(roll(49).useCurrent,1)});
test('ability effect can lower success target from 50 to 45',()=>{assert.equal(roll(45,0,45).useCurrent,2);assert.equal(roll(44,0,45).useCurrent,1)});
test('ability selected as an effect records its use',()=>{
 const ability={name:'Ataque certeiro',level:1,useCurrent:0,useGoal:25};
 const sandbox={draft:{abilities:[ability]},n:value=>Number(value)||0,$:selector=>({value:selector==='#roll-outcome-value'?'success':55}),currentRoll:()=>({selected:[],effects:[{key:'ability:0'}],successTarget:50}),rollProgressType:'skill',markDirty(){},toast(){},render(){applyProgression(sandbox.draft)}};
 vm.createContext(sandbox);const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),start=source.indexOf('function registerRollResult(){'),end=source.indexOf('\nfunction ',start+1);
 vm.runInContext(source.slice(start,end)+'\nregisterRollResult()',sandbox);assert.equal(ability.useCurrent,2);
});
test('completing evolution increases the level and preserves extra uses',()=>{const ability=roll(60,24);assert.equal(ability.level,2);assert.equal(ability.useCurrent,1)});
