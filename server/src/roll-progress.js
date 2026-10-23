import crypto from 'node:crypto';
import './rpg-rules.js';
import './progression.js';

const num=value=>Number(value)||0;
const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const find=(list,name)=>(list||[]).find(item=>key(item.name)===key(name));
const abilityGoal=level=>20+Math.max(1,num(level)||1)*5;
const abilityMax=type=>type==='passive'?5:type==='active'||!type?10:null;

export function applyRollProgress(character,roll){
 if(!roll||typeof roll.id!=='string'||!roll.id||roll.id.length>100||!['success','failure','critical'].includes(roll.outcome)||!Array.isArray(roll.items)||roll.items.length>100||!Array.isArray(roll.effects)||roll.effects.length>100)throw new Error('Rolagem inválida.');
 const data=structuredClone(character),history=data.rollHistory||[],success=roll.outcome!=='failure',critical=roll.outcome==='critical',advanced=[],failures=[];
 if(history.some(item=>item.id===roll.id))return {data,duplicate:true,advanced,failures};
 globalThis.RpgProgression.applyProgression(data);
 for(const selected of roll.items){
  const name=String(selected?.name||'').trim(),kind=selected?.kind;
  if(!name||name.length>100||!['skill','quest','learning','temporary','creation','ability'].includes(kind))throw new Error('Item de rolagem inválido.');
  let effectiveKind=kind;
  if(['skill','quest','learning','temporary'].includes(kind)){
   for(const candidate of [kind,'quest','skill','learning']){
    if(candidate==='temporary')continue;
    const list={skill:data.skills,quest:data.quests,learning:data.learning}[candidate];
    if(find(list,name)){effectiveKind=candidate;break}
   }
  }
  if(effectiveKind==='temporary'){
   data.learning||=[];const amount=success?2:1;data.learning.push({id:crypto.randomUUID(),name,current:amount,goal:10});advanced.push(`${name} começou a aprender (${amount}/10)`);continue;
  }
  const collection={skill:'skills',quest:'quests',learning:'learning',creation:'creations',ability:'abilities'}[effectiveKind],item=find(data[collection],name);
  if(!item)throw new Error(`${name} não foi encontrado na ficha atual.`);
  if(effectiveKind==='skill'){const gain=globalThis.RpgRules.advanceSkill(item,success);advanced.push(`${name} ${gain?`+${gain}`:'— uso registrado'}`)}
  if(effectiveKind==='quest'){const authorized=Boolean(item.extraRequirementApproved),gain=globalThis.RpgRules.advanceQuest(item,success,authorized);if(num(item.value)>=40)item.extraRequirementApproved=false;if(gain)advanced.push(`${name} +${gain}`);else failures.push(`${name} — sem avanço`)}
  if(effectiveKind==='learning'){const goal=Math.max(1,num(item.goal)||10);item.current=Math.min(goal,Math.max(0,num(item.current))+(success?2:1));advanced.push(`${name} ${item.current>=goal?'aprendida':`${item.current}/${goal}`}`);if(item.current>=goal){data.learning=data.learning.filter(entry=>entry!==item);data.skills||=[];if(!find(data.skills,name))data.skills.push({id:item.id||crypto.randomUUID(),name,value:1,bonus:0,successCount:0,failureCount:0})}}
  if(effectiveKind==='creation'){const before=Math.max(0,num(item.current));item.current=Math.max(0,before-(critical?3:success?2:1));item.progressMode='countdown';item.initialized=true;(success?advanced:failures).push(`${name} −${before-item.current}`)}
  if(effectiveKind==='ability'){const max=abilityMax(item.type);if(max!==null&&num(item.level)>=max)continue;item.useGoal=abilityGoal(item.level);item.useCurrent=Math.max(0,num(item.useCurrent))+(success?2:1);advanced.push(`${name} +${success?2:1}`)}
 }
 for(const effect of roll.effects){const name=String(effect||'').trim();if(!name||name.length>100)throw new Error('Efeito inválido.');if(roll.items.some(item=>item.kind==='ability'&&key(item.name)===key(name)))continue;const item=find(data.abilities,name);if(!item)throw new Error(`${name} não foi encontrado na ficha atual.`);const max=abilityMax(item.type);if(max!==null&&num(item.level)>=max)continue;item.useGoal=abilityGoal(item.level);item.useCurrent=Math.max(0,num(item.useCurrent))+(success?2:1)}
 globalThis.RpgProgression.applyProgression(data);
 data.rollHistory=[{id:roll.id,at:new Date().toISOString(),userName:String(roll.userName||'').slice(0,100),progressType:String(roll.progressType||'skill').slice(0,30),formula:String(roll.formula||'1d100').slice(0,300),attribute:String(roll.attribute||'').slice(0,100),attributeValue:num(roll.attributeValue),items:roll.items.map(item=>({name:item.name,kind:item.kind})),effects:roll.effects.map(String),outcome:roll.outcome,successTarget:num(roll.successTarget)||50},...history].slice(0,200);
 return {data,duplicate:false,advanced,failures};
}
