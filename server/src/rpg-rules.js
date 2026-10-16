(function(root){
 const number=value=>Number(value)||0;
 const rarityBonus={comum:1,incomum:2,raro:3,lendario:4,divino:5};
 function skillPointCost(before,after){let cost=0;for(let level=Math.floor(before)+1;level<=after;level++){if(level>30)throw new Error('A partir de 30, a perícia só aumenta pelo uso.');cost+=Math.ceil(level/10)}return cost}
 function advanceSkill(skill,success){
  const level=number(skill.value);if(level>=50)return 0;
  if(level<10){const gained=Math.min(10-level,success?2:1);skill.value=level+gained;return gained}
  const tier=Math.floor(level/10),threshold=success?tier:tier+1,key=success?'successCount':'failureCount';
  skill[key]=number(skill[key])+1;if(skill[key]<threshold)return 0;
  skill.value=Math.min(50,level+1);skill.successCount=0;skill.failureCount=0;return 1;
 }
 function purchaseSkillLevel(character,index){const skill=character.skills?.[index];if(!skill)throw new Error('Perícia não encontrada.');const cost=skillPointCost(number(skill.value),number(skill.value)+1),available=number(character.pointPools?.skills);if(available<cost)throw new Error(`São necessários ${cost} pontos de perícia.`);character.pointPools.skills=available-cost;skill.value=number(skill.value)+1;return cost}
 function addPaidSkill(character,id){const available=number(character.pointPools?.skills);if(available<3)throw new Error('São necessários 3 pontos para adicionar uma perícia.');character.skills||=[];character.skills.push({id:id||globalThis.crypto.randomUUID(),name:'Nova perícia',value:1,bonus:0});character.pointPools.skills=available-3;return 3}
 function advanceQuest(quest,success,authorized=false){
  const tier=Math.max(10,number(quest.value)||10);if(tier>=40&&!authorized)return 0;
  const amount=tier<=10?(success?2:1):(success?1:0),before=number(quest.current),goal=number(quest.goal);
  quest.current=goal>0?Math.min(goal,before+amount):before+amount;return quest.current-before;
 }
 function effects(item){return item.effects?.length?item.effects:[{attribute:item.attribute,targetType:item.targetType||'attribute',bonus:number(item.bonus)}]}
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function attributeBonus(character,name){return (character.receptacles||[]).filter(item=>item.equipped).flatMap(effects).filter(effect=>effect.targetType!=='god'&&normalize(effect.attribute)===normalize(name)).reduce((sum,effect)=>sum+number(effect.bonus),0)}
 function capacities(character){const items=(character.receptacles||[]).filter(i=>i.containerType!=='custom'),equipped=items.filter(i=>i.equipped).length,stored=items.length-equipped;return {chain:character.receptacleCapacity?.chain|| (equipped>5?15:5),box:character.receptacleCapacity?.box||(stored>5?20:5)}}
 function validateEquipment(character){
  const items=(character.receptacles||[]).filter(i=>i.containerType!=='custom'),limits=capacities(character);
  if(items.filter(i=>i.equipped).length>limits.chain)return 'A corrente não possui espaço disponível.';
  if(items.filter(i=>!i.equipped).length>limits.box)return 'A caixa não possui espaço disponível.';
  return '';
 }
 const rules={skillPointCost,purchaseSkillLevel,addPaidSkill,advanceSkill,advanceQuest,rarityBonus,attributeBonus,capacities,validateEquipment};
 root.RpgRules=rules;if(typeof module!=='undefined'&&module.exports)module.exports=rules;
})(globalThis);
