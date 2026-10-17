const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, apply } = require('../src/parser.js');

const silas = `**Nome:** Silas
**Idade:** 17
**Parente:** Hades
**Nível:** 15
**XP:** 0
**Bônus divino:** 2
**Moedas:** 99

**Atributos:**
Força: 5
Destreza: 10

**Pericias: **
Armas médias - 13 (+3)
Atletismo aprendendo (3/10)

**Perícias em quest:**
Artes marciais - 10

**Quest**
Artes marciais
Requisito: use 1/10

**Deuses**
Hades - 63
Zeus - 33`;

test('interpreta o formato TXT atual', () => {
  const result = parse(silas);
  assert.equal(result.name, 'Silas');
  assert.equal(result.profile.level, 15);
  assert.equal(result.profile.divineBonus, 2);
  assert.equal(result.profile.coins, undefined);
  assert.equal(result.attributes.Moedas, undefined);
  assert.equal(result.attributes.Força, 5);
  assert.deepEqual(result.skills[0], { name: 'Armas médias', value: 13, bonus: 3 });
  assert.deepEqual(result.learning[0], { name: 'Atletismo', current: 3, goal: 10 });
  assert.equal(result.quests[0].current, 1);
  assert.equal(result.gods.Hades, 63);
});

test('não confunde nome de criação com nome do personagem', () => {
  const result = parse('Nome: Thales\n\nCriação de habilidade:\nAprendizado\nNome: Rastro marcado\nRequisito: 40');
  assert.equal(result.name, 'Thales');
  assert.equal(result.creations[0].name,'Rastro marcado');
  assert.equal(result.creations[0].current,40);
  assert.equal(result.creations[0].requirement,40);
  assert.equal(result.ideas[0].status,'Em desenvolvimento');
  assert.equal(result.ideas[0].initialRequirement,40);
});

test('requisito editado vira máximo provisório e cria ideia vinculada',()=>{
  const parsed=parse('Criação de habilidade\nAprendizado\nNome: Rastro marcado\nRequisito: 27 (editado)');
  const updated=apply({name:'Herói',profile:{},attributes:{},skills:[],learning:[],quests:[],abilities:[],creations:[],ideas:[],gods:{}},parsed);
  assert.equal(updated.creations[0].current,27);
  assert.equal(updated.creations[0].requirement,27);
  assert.equal(updated.creations[0].ideaId,updated.ideas[0].id);
  assert.equal(updated.ideas[0].status,'Em desenvolvimento');
  assert.equal(updated.ideas[0].initialRequirement,27);
});

test('preserva habilidades e ideias durante a importação', () => {
  const original = { name:'Antigo', profile:{level:1}, attributes:{}, skills:[], learning:[], quests:[], gods:{}, abilities:[{name:'Teste'}], ideas:[{name:'Ideia'}] };
  const updated = apply(original, parse(silas));
  assert.equal(updated.name, 'Silas');
  assert.equal(updated.abilities.length, 1);
  assert.equal(updated.ideas.length, 1);
});

test('preserva atributos não informados ao atualizar nível e XP', () => {
  const original = { name:'Thales', profile:{level:5,xp:2}, attributes:{Força:3,Resistência:2}, skills:[], learning:[], quests:[], gods:{} };
  const updated = apply(original, parse('Nível: 6\nXP: 4'));
  assert.equal(updated.profile.level, 6);
  assert.equal(updated.profile.xp, 4);
  assert.equal(updated.attributes.Resistência, 2);
});

test('importa vida atual e vida máxima do TXT', () => {
  const parsed=parse('Nome: Herói\nVida atual: 37\nVida máxima: 80');
  const updated=apply({name:'Herói',profile:{healthCurrent:100,healthMax:100},attributes:{},skills:[],learning:[],quests:[],gods:{}},parsed);
  assert.equal(updated.profile.healthCurrent,37);
  assert.equal(updated.profile.healthMax,80);
});

test('usa o nome oficial e elimina perícias repetidas ao colar TXT', () => {
  const parsed=parse('Perícias:\nVeneno - 4\nVenenos - 6\nConhecimento lunar - 2');
  const updated=apply({name:'Herói',profile:{},attributes:{},skills:[],learning:[],quests:[],gods:{}},parsed);
  assert.deepEqual(updated.skills.map(skill=>skill.name),['Venenos','Conhecimento lunar']);
  assert.equal(updated.skills[0].value,6);
});

test('separa o bônus entre parênteses do valor-base do atributo', () => {
  const parsed = parse('Atributos:\nResistência: 3 (+1)\nInteligência: 8');
  assert.equal(parsed.attributes.Resistência, 2);
  assert.equal(parsed.attributes.Inteligência, 8);
});

test('quest de perícia nível 20 usa o requisito use e preserva o bônus', () => {
  const parsed = parse('Perícias em quest:\nPoder divino - 20 (+3)\n\nQuest\nPoder divino\nRequisito: acerte 2/10');
  assert.equal(parsed.quests[0].value, 20);
  assert.equal(parsed.quests[0].bonus, 3);
  assert.equal(parsed.quests[0].action, 'use');
  assert.equal(parsed.quests[0].current, 2);
  assert.equal(parsed.quests[0].goal, 10);
});

test('importa o uso atual de todas as quests e aceita a marca editado', () => {
  const parsed=parse(`Perícias em quest:
Poder divino - 20 (+3)
Artes marciais - 10
Treinamento - 10
Grego - 10 (editado)

Quest
Artes marciais
Requisito: use 1/10

Treinamento
Requisito: use 9/10

Grego
Requisito: use 3/10 (editado)

Poder divino
Requisito: acerte 2/10 (editado)`);
  assert.deepEqual(Object.fromEntries(parsed.quests.map(q=>[q.name,[q.current,q.goal]])),{
    'Poder divino':[2,10],
    'Artes marciais':[1,10],
    'Treinamento':[9,10],
    'Grego':[3,10]
  });
});

test('atualiza os saldos de pontos somente quando informados no TXT', () => {
  const original = { profile:{}, pointPools:{attributes:1,skills:2}, attributes:{}, skills:[], learning:[], quests:[], gods:{} };
  const parsed = parse('Pontos de atributos para gastar: 4\nPontos de perícias para gastar: 7');
  const updated = apply(original, parsed);
  assert.deepEqual(updated.pointPools, {attributes:4,skills:7});
  assert.deepEqual(apply(updated, parse('Nível: 3')).pointPools, {attributes:4,skills:7});
});

test('importa refeição de viagem premium separadamente', () => {
  const parsed = parse('Mochila!\nOuro: 8\nRefeição de viagem: 2\nRefeição de viagem premium: 3');
  const updated = apply({profile:{coins:1},backpack:{travelMeals:7,premiumTravelMeals:0},attributes:{},skills:[],learning:[],quests:[],gods:{}}, parsed);
  assert.equal(updated.profile.coins, 8);
  assert.equal(updated.backpack.travelMeals, 2);
  assert.equal(updated.backpack.premiumTravelMeals, 3);
});
