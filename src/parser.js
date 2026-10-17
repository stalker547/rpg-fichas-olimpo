(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FichaParser = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const clean = line => line.replace(/\*\*/g, '').trim();
  const num = value => Number(String(value).replace(',', '.')) || 0;
  const officialSkills=['Artes marciais','Luta corporal','Atletismo','Acrobacia','Mergulho','Furtividade','Armas curtas','Armas médias','Armas longas','Armas a distância','Armas pesadas','Atuação','Canto','Colagem','Fotografia','Ilusionismo','Instrumentos musicais','Piano','Violão','Botânica','Caça','Culinária','Investigação','Medicina','Sobrevivência','Veterinária','Marcenaria','Intuição','Percepção','Olfato','Audição','Controle','Poder divino','Treinamento','Grego','História','Necromancia','Teogonia','Venenos'];
  const skillKey=value=>{const key=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'');return key.length>3&&key.endsWith('s')?key.slice(0,-1):key};
  function canonicalSkillName(value,existing=[]){const key=skillKey(value),official=officialSkills.find(name=>skillKey(name)===key);if(official)return official;return existing.find(name=>skillKey(name)===key)||String(value||'').trim()}
  function canonicalSkills(items,existing=[]){const result=[];for(const raw of items||[]){const item={...raw,name:canonicalSkillName(raw.name,existing)},found=result.find(entry=>skillKey(entry.name)===skillKey(item.name));if(!found){result.push(item);continue}for(const field of ['value','bonus','current','goal','successCount','failureCount'])if(num(item[field])>num(found[field]))found[field]=item[field]}return result}
  const fieldMap = {
    nome: ['name'], idade: ['profile','age'], corrente: ['profile','current'], parente: ['profile','parent'],
    reconhecido: ['profile','recognized'], nível: ['profile','level'], nivel: ['profile','level'], xp: ['profile','xp'],
    'vida atual': ['profile','healthCurrent'], 'vida máxima': ['profile','healthMax'], 'vida maxima': ['profile','healthMax'],
    'bônus divino': ['profile','divineBonus'], 'bonus divino': ['profile','divineBonus'],
    'pontos de atributos para gastar': ['pointPools','attributes'], 'pontos para gastar em atributos': ['pointPools','attributes'],
    'pontos de perícias para gastar': ['pointPools','skills'], 'pontos de pericias para gastar': ['pointPools','skills'],
    'pontos para gastar em perícias': ['pointPools','skills'], 'pontos para gastar em pericias': ['pointPools','skills']
  };
  const sectionNames = {
    atributos:'attributes', pericias:'skills', perícias:'skills', 'perícias em quest':'questSkills', 'pericias em quest':'questSkills',
    quest:'questProgress', 'criação de habilidade':'creation', 'criacao de habilidade':'creation', mochila:'backpack', 'mochila!':'backpack', 'corrente de receptáculos':'inventory', 'caixa de receptáculos':'inventory', deuses:'gods'
  };
  function setNested(target, path, value) { let o=target;path.slice(0,-1).forEach(k=>o=o[k]||(o[k]={}));o[path.at(-1)]=value; }
  function parse(text) {
    const result={profile:{},pointPools:{},attributes:{},skills:[],learning:[],quests:[],creations:[],ideas:[],gods:{},backpack:{},inventoryParts:[],recognized:[]};
    const lines=String(text||'').replace(/\r/g,'').split('\n').map(clean);
    let section='', lastQuest='',currentCreation=null,creationType='Aprendizado';
    for (const raw of lines) {
      if (!raw || raw==='.') continue;
      const lower=raw.toLocaleLowerCase('pt-BR');
      const normalized=lower.replace(/:$/,'').trim();
      if(sectionNames[normalized]){section=sectionNames[normalized];continue;}
      const colon=raw.match(/^([^:]+):\s*(.*)$/);
      if(colon){
        const key=colon[1].trim().toLocaleLowerCase('pt-BR');
        const allowedGlobal=key==='bônus divino'||key==='bonus divino'||fieldMap[key]?.[0]==='pointPools';
        if(fieldMap[key]&&(!section||allowedGlobal)){const isNumber=['level','xp','divineBonus','coins','attributes','skills','healthCurrent','healthMax'].includes(fieldMap[key].at(-1));setNested(result,fieldMap[key],isNumber?num(colon[2]):colon[2]);result.recognized.push(colon[1].trim());continue;}
        if(key==='moedas')continue;
      }
      if(section==='attributes' && colon){
        const value=colon[2].trim(),totalMatch=value.match(/^\s*(-?\d+(?:[.,]\d+)?)/),bonusMatch=value.match(/\(\s*([+-]?\d+(?:[.,]\d+)?)\s*\)/);
        if(totalMatch){const total=num(totalMatch[1]),bonus=bonusMatch?num(bonusMatch[1]):0;result.attributes[colon[1].trim()]=total-bonus;}
        continue;
      }
      if(section==='skills'){
        const learning=raw.match(/^(.*?)\s+aprendendo\s*\((\d+)\s*\/\s*(\d+)\)$/i);
        if(learning){result.learning.push({name:learning[1].trim(),current:num(learning[2]),goal:num(learning[3])});continue;}
        const skill=raw.match(/^(.*?)\s*-\s*(-?\d+)(?:\s*\(\+?(-?\d+)\))?$/);
        if(skill){result.skills.push({name:skill[1].trim(),value:num(skill[2]),bonus:num(skill[3])});continue;}
      }
      if(section==='questSkills'){
        const q=raw.match(/^(.*?)\s*-\s*(-?\d+)(?:\s*\(\+?(-?\d+)\))?$/);if(q){result.quests.push({name:q[1].trim(),value:num(q[2]),bonus:q[3]===undefined?0:num(q[3]),current:0,goal:10,action:'use'});continue;}
      }
      if(section==='questProgress'){
        const req=raw.match(/^Requisito\s*:\s*(?:(use|acerte)\s*)?(\d+)\s*\/\s*(\d+)(?:\s*\([^)]*\))?\s*[.!]?$/i);
        if(req && lastQuest){const questName=lastQuest.replace(/\s*\([^)]*\)\s*$/,'').trim();let q=result.quests.find(x=>skillKey(x.name)===skillKey(questName));if(!q){q={name:questName,value:0,current:0,goal:10,action:'use'};result.quests.push(q);}q.current=num(req[2]);q.goal=num(req[3]);q.action=num(q.value)>=20?'use':String(req[1]||'use').toLocaleLowerCase('pt-BR');continue;}
        lastQuest=raw;continue;
      }
      if(section==='creation'){
        if(!colon){creationType=raw;continue;}
        const key=colon[1].trim().toLocaleLowerCase('pt-BR'),value=colon[2].trim();
        if(key==='nome'){
          const id=`import-creation-${result.creations.length}-${skillKey(value)}`;
          currentCreation={id,ideaId:`idea-${id}`,type:'Criação de habilidade',sourceType:creationType||'Aprendizado',name:value,current:0,requirement:0,progressMode:'countdown',initialized:true};
          result.creations.push(currentCreation);continue;
        }
        if(!currentCreation)continue;
        if(key==='requisito'||key==='requisito inicial'){
          const requirement=Math.max(0,num(value.match(/-?\d+(?:[.,]\d+)?/)?.[0]));currentCreation.requirement=requirement;if(!currentCreation.current)currentCreation.current=requirement;continue;
        }
        if(key==='restante'){currentCreation.current=Math.max(0,num(value));continue;}
      }
      if(section==='gods'){
        const god=raw.match(/^(.*?)\s*-\s*(-?\d+)$/);if(god){result.gods[god[1].trim()]=num(god[2]);continue;}
      }
      if(section==='backpack' && colon){
        const resources={ouro:['profile','coins'],'ração de pet':['backpack','petFood'],'racao de pet':['backpack','petFood'],'ração especial':['backpack','specialPetFood'],'racao especial':['backpack','specialPetFood'],'refeição de viagem':['backpack','travelMeals'],'refeicao de viagem':['backpack','travelMeals'],'refeição de viagem premium':['backpack','premiumTravelMeals'],'refeicao de viagem premium':['backpack','premiumTravelMeals']};
        const path=resources[colon[1].trim().toLocaleLowerCase('pt-BR')];if(path){setNested(result,path,Math.max(0,num(colon[2])));continue;}
      }
      if(section==='inventory') result.inventoryParts.push(raw);
    }
    result.inventory=result.inventoryParts.join('\n');delete result.inventoryParts;
    result.creations=result.creations.filter(creation=>creation.name&&creation.requirement>0);
    result.ideas=result.creations.map(creation=>({id:creation.ideaId,name:creation.name,type:'active',status:'Em desenvolvimento',initialRequirement:creation.requirement,effect:'',requirements:'',development:'',evolution:'',masterRequest:'Importada do TXT para revisão da mestre.',approvedFromImport:true}));
    return result;
  }
  function apply(character, parsed) {
    const out=JSON.parse(JSON.stringify(character));
    if(parsed.name)out.name=parsed.name;
    out.profile={...out.profile,...parsed.profile};
    if(Object.keys(parsed.pointPools||{}).length)out.pointPools={...(out.pointPools||{}),...parsed.pointPools};
    if(Object.keys(parsed.attributes).length)out.attributes={...out.attributes,...parsed.attributes};
    const existingNames=[...(out.skills||[]),...(out.learning||[]),...(out.quests||[])].map(item=>item.name);
    if(parsed.skills.length)out.skills=canonicalSkills(parsed.skills,existingNames);
    if(parsed.learning.length)out.learning=canonicalSkills(parsed.learning,existingNames);
    if(parsed.quests.length)out.quests=canonicalSkills(parsed.quests,existingNames);
    if(parsed.creations?.length){out.creations||=[];out.ideas||=[];for(const parsedCreation of parsed.creations){let creation=out.creations.find(item=>skillKey(item.name)===skillKey(parsedCreation.name)),idea=out.ideas.find(item=>skillKey(item.name)===skillKey(parsedCreation.name));if(!idea){idea={...(parsed.ideas||[]).find(item=>skillKey(item.name)===skillKey(parsedCreation.name))};out.ideas.push(idea)}idea.id||=parsedCreation.ideaId;idea.name=parsedCreation.name;idea.status='Em desenvolvimento';idea.initialRequirement=parsedCreation.requirement;idea.approvedFromImport=true;if(!creation){creation={...parsedCreation};out.creations.push(creation)}else{creation.type='Criação de habilidade';creation.current=parsedCreation.current;creation.requirement=parsedCreation.requirement;creation.progressMode='countdown';creation.initialized=true}creation.ideaId=idea.id}}
    if(Object.keys(parsed.gods).length)out.gods=parsed.gods;
    if(Object.keys(parsed.backpack||{}).length)out.backpack={...(out.backpack||{}),...parsed.backpack};
    if(parsed.inventory)out.inventory=parsed.inventory;
    return out;
  }
  return { parse, apply };
});
