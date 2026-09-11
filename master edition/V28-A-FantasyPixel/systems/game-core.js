"use strict";

const canvas=document.getElementById("canvas");
const ctx=canvas.getContext("2d");
const CFG={
 xp:100,
 maxEnemies:28,
 maxProjectiles:220,
 maxBossProjectiles:100,
 maxEffects:120,
 maxXPDrops:120,
 maxGoldDrops:120,
 maxFloorItems:18,
 hudInterval:120,
 special:[5,10,20,25,35,45,55,65]
};

/* =========================================================
   PARTE 2 — DUNGEON PROCEDURAL
   Tiles protótipos 16-bit + obstáculos + portas
========================================================= */
const ROOM={tile:32,w:25,h:16};
let roomMap=[];
let roomObstacles=[];
let roomSeed=0;
let exitOpen=false;
let previousExitOpen=false;
let roomHistory=[];
let roomStates=[];
let lastSpecialRoom="";
let roomTransitionLock=false;
let roomDirection="forward";
function hashSeed(text){let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function seeded(){roomSeed=(Math.imul(roomSeed,1664525)+1013904223)>>>0;return roomSeed/4294967296}
function roomRandomInt(a,b){return Math.floor(seeded()*(b-a+1))+a}
function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function isInsideMap(tx,ty){return tx>0&&ty>0&&tx<ROOM.w-1&&ty<ROOM.h-1}
function generateRoomLayout(type){
 roomSeed=hashSeed(`${roomSeed}:${roomIndex}:${type}:${player.level}`);
 roomMap=Array.from({length:ROOM.h},()=>Array(ROOM.w).fill("floor"));roomObstacles=[];
 for(let y=0;y<ROOM.h;y++)for(let x=0;x<ROOM.w;x++)if(x===0||y===0||x===ROOM.w-1||y===ROOM.h-1)roomMap[y][x]="wall";
 const count=type==="boss"?14:type==="elite"?10:7+Math.min(6,Math.floor(roomIndex/4));
 for(let i=0;i<count;i++){
  const tx=roomRandomInt(2,ROOM.w-5),ty=roomRandomInt(2,ROOM.h-4),tw=roomRandomInt(1,3),th=roomRandomInt(1,2);
  const kind=type==="boss"?"ruin":(seeded()<0.4?"stone":"wall");
  const r={x:tx*ROOM.tile,y:ty*ROOM.tile,w:tw*ROOM.tile,h:th*ROOM.tile,kind};
  if(r.x<ROOM.tile*4||r.x+r.w>ROOM.tile*(ROOM.w-4))continue;
  if(Math.abs(tx+tw/2-ROOM.w/2)<3&&Math.abs(ty+th/2-ROOM.h/2)<3)continue;
  roomObstacles.push(r);for(let yy=ty;yy<ty+th;yy++)for(let xx=tx;xx<tx+tw;xx++)if(isInsideMap(xx,yy))roomMap[yy][xx]=kind;
 }
 for(let i=0;i<(type==="treasure"?18:10);i++){const x=roomRandomInt(1,ROOM.w-2),y=roomRandomInt(1,ROOM.h-2);if(roomMap[y][x]==="floor")roomMap[y][x]=seeded()<.5?"dirt":"grass";}
 for(let y=5;y<=10;y++)for(let x=10;x<=14;x++)roomMap[y][x]="floor";
 roomObstacles=roomObstacles.filter(o=>!rectsOverlap(o,{x:ROOM.tile*9,y:ROOM.tile*5,w:ROOM.tile*7,h:ROOM.tile*6}));
 exitOpen=false;
}
function collisionRect(x,y,w,h){return roomObstacles.some(o=>rectsOverlap({x,y,w,h},o))}
function canOccupy(x,y){return !collisionRect(x+3,y+7,player.size-6,player.size-7)}
function movePlayerCollidable(dx,dy){const nx=player.x+dx;if(nx>=8&&nx<=canvas.width-player.size-8&&canOccupy(nx,player.y))player.x=nx;const ny=player.y+dy;if(ny>=8&&ny<=canvas.height-player.size-8&&canOccupy(player.x,ny))player.y=ny}
function openRoomExit(){if(exitOpen)return;exitOpen=true;previousExitOpen=roomIndex>1;const b=document.getElementById("roomBanner");b.classList.add("door-open");b.textContent=`${roomLabel(roomType)} • SAÍDAS ABERTAS`;document.getElementById("roomSeedInfo").textContent=`Seed ${roomSeed>>>0}`;updateMiniMap()}
function transitionToNextRoom(){if(roomTransitionLock)return;roomTransitionLock=true;roomDirection="forward";roomIndex++;paused=false;const known=roomStates[roomIndex-1];if(known){loadKnownRoom(known)}else{nextProceduralRoom()}setTimeout(()=>roomTransitionLock=false,300)}
function transitionToPreviousRoom(){if(roomIndex<=1||roomTransitionLock)return;const targetIndex=roomIndex-1;const state=roomStates[targetIndex-1];if(!state)return;roomTransitionLock=true;roomIndex=targetIndex;roomDirection="backward";paused=false;loadKnownRoom(state);setTimeout(()=>roomTransitionLock=false,300)}
function tryExitRoom(){if(roomTransitionLock)return;const cy=canvas.height/2;if(exitOpen&&player.x+player.size>=canvas.width-34&&player.y>cy-48&&player.y<cy+48){transitionToNextRoom();return}if(previousExitOpen&&player.x<=20&&player.y>cy-48&&player.y<cy+48){transitionToPreviousRoom();return}}
function nextProceduralRoom(){nextRoom(generateRoomType(),false)}
function weightedRoomPick(){const pool=[["combat",54],["elite",14],["treasure",11],["shop",9],["rest",7]];let total=pool.reduce((s,p)=>s+p[1],0),r=Math.random()*total;for(const [t,w] of pool){r-=w;if(r<=0)return t}return"combat"}
function generateRoomType(){if(roomIndex>1&&roomIndex%8===0){roomHistory.push("boss");return"boss"}let t=weightedRoomPick(),guard=0;while(t===lastSpecialRoom&&guard++<8)t=weightedRoomPick();if(roomIndex<3&&["shop","rest","treasure"].includes(t))t="combat";lastSpecialRoom=t;roomHistory.push(t);return t}
function drawPixelTile(tx,ty,type){const x=tx*ROOM.tile,y=ty*ROOM.tile;let base="#3b2c20",detail="#4a3827";if(type==="wall"){base="#392d29";detail="#5a4437"}else if(type==="stone"){base="#5b554e";detail="#746b61"}else if(type==="ruin"){base="#4c4036";detail="#715b46"}else if(type==="dirt"){base="#4b3825";detail="#60482f"}else if(type==="grass"){base="#33432e";detail="#4b633b"}ctx.fillStyle=base;ctx.fillRect(x,y,ROOM.tile,ROOM.tile);ctx.fillStyle=detail;ctx.fillRect(x+2,y+2,ROOM.tile-4,3);ctx.fillRect(x+4,y+ROOM.tile-6,ROOM.tile-8,2);if(type!=="wall"&&type!=="stone"&&type!=="ruin"){ctx.fillRect(x+9,y+11,3,3);ctx.fillRect(x+22,y+20,2,2)}}
function drawProceduralRoom(){for(let y=0;y<ROOM.h;y++)for(let x=0;x<ROOM.w;x++)drawPixelTile(x,y,roomMap[y]?.[x]||"floor");const cy=canvas.height/2;ctx.fillStyle="#7e5b34";ctx.fillRect(18,ROOM.tile*7,6,12);ctx.fillRect(canvas.width-24,ROOM.tile*7,6,12);ctx.fillStyle="#24150d";ctx.fillRect(canvas.width-18,cy-42,18,84);ctx.fillStyle=exitOpen?"#d1a556":"#5a3b22";ctx.fillRect(canvas.width-14,cy-27,10,54);ctx.fillStyle="#24150d";ctx.fillRect(0,cy-42,18,84);ctx.fillStyle=previousExitOpen?"#547d9d":"#3d2b1c";ctx.fillRect(4,cy-27,10,54);ctx.font="10px Arial";ctx.textAlign="center";if(exitOpen){ctx.fillStyle="#f0d58a";ctx.fillText("→",canvas.width-9,cy+4)}if(previousExitOpen){ctx.fillStyle="#9cc7df";ctx.fillText("←",9,cy+4)}}


const classes={
 Guerreiro:{hp:150,vel:4.2,color:"#b94335"},
 Mago:{hp:90,vel:3.4,color:"#4d78c4"},
 Arqueiro:{hp:105,vel:5,color:"#4f9a58"},
 Penguin:{hp:120,vel:5.5,color:"#8fb9c9"}
};

const habilidades={
 Guerreiro:{title:"⚔️ Escolha sua arma",desc:"Escolha seu estilo de combate.",options:{
  "Espada":{type:"espada",dmg:9,range:58,cd:380},
  "Machado":{type:"machado",dmg:15,range:54,cd:700},
  "Espada + Escudo":{type:"escudo",dmg:6,range:52,cd:420,def:0.3},
  "Martelo":{type:"martelo",dmg:19,range:57,cd:900},
  "Duas Espadas":{type:"duasEspadas",dmg:5,range:55,cd:260}
 }},
 Mago:{title:"🔮 Escolha seu elemento",desc:"A magia define seu ataque principal.",options:{
  "🔥 Fogo":{type:"fogo",dmg:12,range:260,cd:650},
  "💧 Água":{type:"agua",dmg:9,range:260,cd:500},
  "🌱 Terra":{type:"terra",dmg:18,range:200,cd:900},
  "🌪️ Ar":{type:"ar",dmg:6,range:290,cd:250}
 }},
 Arqueiro:{title:"🏹 Escolha sua flecha",desc:"Precisão, alcance e cadência.",options:{
  "Flecha Comum":{type:"comum",dmg:7,range:330,cd:260},
  "Flecha Teleguiada":{type:"teleguiada",dmg:6,range:340,cd:300},
  "Flecha Perfurante":{type:"perfurante",dmg:9,range:360,cd:400},
  "Flecha Múltipla":{type:"multipla",dmg:5,range:320,cd:500},
  "Flecha Explosiva":{type:"explosiva",dmg:10,range:300,cd:700}
 }},
 Penguin:{title:"🐧 Escolha sua técnica",desc:"Técnicas geladas da classe secreta.",options:{
  "🐟 Peixe Congelado":{type:"peixe",dmg:10,range:290,cd:320},
  "❄️ Rajada Polar":{type:"polar",dmg:8,range:320,cd:250},
  "🐧 Investida":{type:"investida",dmg:18,range:78,cd:450}
 }}
};

const enemies={
 goblin:{name:"Goblin",color:"#6f9f3f",size:24,hp:30,speed:1.35,dmg:8,xp:20,gold:[1,3],w:8},
 goblinGuerreiro:{name:"Goblin Guerreiro",color:"#914a31",size:30,hp:65,speed:1.05,dmg:13,xp:35,gold:[2,5],w:5},
 esqueleto:{name:"Esqueleto",color:"#cfc5ad",size:28,hp:70,speed:.95,dmg:14,xp:40,gold:[2,6],w:4},
 orc:{name:"Orc",color:"#5d8048",size:38,hp:130,speed:.72,dmg:21,xp:65,gold:[4,8],w:3},
 troll:{name:"Troll",color:"#4f633a",size:48,hp:280,speed:.48,dmg:32,xp:130,gold:[8,15],w:1}
};

const activeItems={
 heal:{name:"Poção de Cura",icon:"🧪",rarity:"Comum",color:"#56d66f",use(){player.hp=Math.min(player.hpMax,player.hp+player.hpMax*.4)}},
 healBig:{name:"Poção Maior",icon:"❤️",rarity:"Raro",color:"#68a9ff",use(){player.hp=Math.min(player.hpMax,player.hp+player.hpMax*.75)}},
 barrier:{name:"Elixir da Barreira",icon:"🛡️",rarity:"Raro",color:"#5ba4ff",use(){player.tempDef=.7;player.barrierTimer=480}},
 bomb:{name:"Bomba Infernal",icon:"💣",rarity:"Raro",color:"#e06a43",use(){areaDamage(130,player.dmg*8);explode(player.x+15,player.y+15,130)}},
 thunder:{name:"Orbe do Trovão",icon:"⚡",rarity:"Raro",color:"#e5d84c",use(){[...enemiesAlive()].sort((a,b)=>distPlayer(a)-distPlayer(b)).slice(0,8).forEach(e=>damage(e,player.dmg*3));if(boss)boss.hp-=player.dmg*5}},
 fireBomb:{name:"Bomba de Fogo",icon:"🔥",rarity:"Épico",color:"#ef733d",use(){areaDamage(105,player.dmg*4);enemiesAlive().forEach(e=>{if(distPlayer(e)<105)e.burn=150});explode(player.x+15,player.y+15,105)}},
 meteor:{name:"Pergaminho do Meteoro",icon:"☄️",rarity:"Épico",color:"#df633c",use(){const x=player.x+player.dx*120,y=player.y+player.dy*120;areaDamageAt(x,y,140,player.dmg*7);if(boss&&dist(x,y,boss.x+45,boss.y+45)<185)boss.hp-=player.dmg*10;explode(x,y,140)}},
 arcane:{name:"Cristal Arcano",icon:"🔮",rarity:"Épico",color:"#a560ef",use(){for(let i=0;i<12;i++){const a=i*Math.PI*2/12;shot(Math.cos(a),Math.sin(a),player.dmg*1.8,"arcano",340,7)}}},
 ice:{name:"Coração de Gelo",icon:"❄️",rarity:"Épico",color:"#7ddbf1",use(){enemiesAlive().forEach(e=>e.freeze=240);if(boss)boss.freeze=180}},
 voidCup:{name:"Cálice Sombrio",icon:"☠️",rarity:"Épico",color:"#933fc4",use(){let heal=0;enemiesAlive().forEach(e=>{if(distPlayer(e)<150){const d=player.dmg*2;damage(e,d);heal+=d*.2}});player.hp=Math.min(player.hpMax,player.hp+heal)}},
 boots:{name:"Botas Relâmpago",icon:"⚡",rarity:"Raro",color:"#d9cf59",use(){player.speedTimer=360}},
 wings:{name:"Asas Feéricas",icon:"🪽",rarity:"Épico",color:"#d3b8ef",use(){player.x+=player.dx*180;player.y+=player.dy*180;bound()}},
 teleport:{name:"Pergaminho do Teleporte",icon:"🌀",rarity:"Raro",color:"#8a7fe8",use(){player.x=70+Math.random()*660;player.y=70+Math.random()*360}},
 crown:{name:"Coroa do Campeão",icon:"👑",rarity:"Lendário",color:"#e3b742",use(){player.dmg*=1.6;player.cd*=.65;player.def+=.2;player.crownTimer=720}},
 dragon:{name:"Essência do Dragão",icon:"🐉",rarity:"Lendário",color:"#e25a43",use(){player.dragon=true}},
 fish:{name:"Peixe Dourado",icon:"🐟",rarity:"Épico",color:"#f1cc65",use(){player.dmg*=1.25;player.hp=Math.min(player.hpMax,player.hp+35)}},
 blizzard:{name:"Orbe da Nevasca",icon:"🌨️",rarity:"Épico",color:"#bcecff",use(){enemiesAlive().forEach(e=>e.freeze=260);if(boss)boss.freeze=210}}
};

const passiveItems={
 fury:{name:"Anel da Fúria",color:"#4f8cff",apply(){player.dmg*=1.1;player.cd*=.85}},
 guardian:{name:"Escudo do Guardião",color:"#4f8cff",apply(){player.def+=.15;player.hpMax+=20;player.hp+=20}},
 tome:{name:"Grimório Arcano",color:"#a55eea",apply(){player.dmg*=1.2}},
 hunter:{name:"Cordão do Caçador",color:"#a55eea",apply(){player.range*=1.15}},
 windBoots:{name:"Botas do Vento",color:"#4f8cff",apply(){player.speed*=1.15}},
 polarFeather:{name:"Pena Polar",color:"#7ddbf1",apply(){player.speed*=1.1;player.def+=.08}}
};

const startingLoadouts={
 Guerreiro:{name:"Espada de Ferro",type:"espada",dmg:9,range:58,cd:380,def:0},
 Mago:{name:"Magia Arcana",type:"arcano",dmg:10,range:250,cd:620,def:0},
 Arqueiro:{name:"Arco Simples",type:"comum",dmg:7,range:330,cd:280,def:0},
 Penguin:{name:"Peixe de Madeira",type:"peixe",dmg:10,range:290,cd:320,def:0}
};

const secondaryCatalog={
 Guerreiro:[
  {name:"Escudo de Guarda",icon:"🛡️",type:"shieldBash",rarity:"Comum",desc:"Bloqueia por um instante e desfere um golpe que empurra."},
  {name:"Lança de Guerra",icon:"🔱",type:"spear",rarity:"Raro",desc:"Uma estocada longa que perfura vários inimigos."},
  {name:"Corrente do Carrasco",icon:"⛓️",type:"chain",rarity:"Épico",desc:"Puxa um inimigo para perto e causa dano."},
  {name:"Martelo de Guerra",icon:"🔨",type:"warHammer",rarity:"Raro",desc:"Golpe pesado que gera uma onda de choque."}
 ],
 Mago:[
  {name:"Orbe do Pulso Arcano",icon:"🔮",type:"arcanePulse",rarity:"Comum",desc:"Explode ao redor do mago."},
  {name:"Espelho Mágico",icon:"🪞",type:"magicMirror",rarity:"Raro",desc:"Lança vários fragmentos mágicos em leque."},
  {name:"Runa de Teleporte",icon:"🌀",type:"teleRune",rarity:"Épico",desc:"Teleporta e causa uma explosão arcana no destino."},
  {name:"Bastão do Trovão",icon:"⚡",type:"thunderStaff",rarity:"Épico",desc:"Dispara raios contra os inimigos próximos."}
 ],
 Arqueiro:[
  {name:"Armadilha de Caçador",icon:"🪤",type:"trap",rarity:"Comum",desc:"Cria uma armadilha no chão que prende inimigos."},
  {name:"Bumerangue do Caçador",icon:"🪃",type:"boomerang",rarity:"Raro",desc:"Vai até os inimigos e retorna ao arqueiro."},
  {name:"Bomba de Caça",icon:"💣",type:"hunterBomb",rarity:"Raro",desc:"Lança um explosivo de área."},
  {name:"Falcão Companheiro",icon:"🦅",type:"hawk",rarity:"Épico",desc:"Invoca um espírito que ataca inimigos próximos."}
 ],
 Penguin:[
  {name:"Patins de Gelo",icon:"🧊",type:"iceDash",rarity:"Secreto",desc:"Deslize em alta velocidade e congele quem atingir."},
  {name:"Tambor de Neve",icon:"🥁",type:"snowDrum",rarity:"Épico",desc:"Uma onda de neve empurra e congela os inimigos."},
  {name:"Canhão de Peixe",icon:"🐟",type:"fishCannon",rarity:"Lendário",desc:"Dispara um peixe gigante que atravessa inimigos."},
  {name:"Cubo Polar",icon:"🧊",type:"polarCube",rarity:"Raro",desc:"Cria um bloco de gelo defensivo na arena."}
 ]
};

const player={x:385,y:235,size:30,class:"",weapon:"",type:"",difficulty:"facil",hp:100,hpMax:100,speed:4,dmg:1,range:50,cd:500,def:0,dx:0,dy:1,lastAttack:0,level:1,xp:0,xpNext:100,gold:0,kills:0,active:null,secondary:null,secondaryData:null,secondaryMode:false,passives:[],evolutions:[],weaponMastery:0,weaponMasteryLevel:1,weaponMasteryNext:12,weaponCombo:0,tempDef:0,barrierTimer:0,speedTimer:0,crownTimer:0,dragon:false,lifeSteal:0,area:0,flame:false,bladeStorm:false,arcaneBlade:false,doubleSpell:false,bigSpell:false,arcaneRain:false,doubleArrow:false,bigExplosion:false,arrowRain:false,masterArcher:false,legendaryBow:false,arcaneArrow:false,penguinIce:false,penguinTriple:false,penguinSupreme:false,penguinChill:false,penguinEasterEgg:false,penguinSlideX:0,penguinSlideY:0,penguinTrailTick:0,god:false,anim:{state:"idle",until:0}};

let enemiesArr=[],shots=[],boss=null,xpDrops=[],goldDrops=[],floorItems=[],effects=[],keys={},game=false,paused=false,inventoryOpen=false,choiceOpen=false,roomType="combat",roomIndex=1,roomCleared=0,shopStock=[],terminalOpen=false,terminalHist=[],termIdx=-1,transitioningRoom=false,inventoryPausedBefore=false,terminalPausedBefore=false,lastHudUpdate=0,startingSecondaryChoices=[];
let debugMode=false,debugHitboxes=false,debugAI=false,debugInvulnerable=false,debugLastUpdate=0,debugFps=0,debugFrameCount=0,debugFpsTime=performance.now();

const roomTypes=["combat","elite","treasure","shop","rest","boss"];

function d4(){return Math.floor(Math.random()*4)+1}
function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function dist(ax,ay,bx,by){return Math.hypot(ax-bx,ay-by)}
function distPlayer(e){return dist(player.x+15,player.y+15,e.x+e.size/2,e.y+e.size/2)}
function enemiesAlive(){return enemiesArr.filter(e=>!e.dead)}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function bound(){player.x=Math.max(10,Math.min(canvas.width-player.size-10,player.x));player.y=Math.max(10,Math.min(canvas.height-player.size-10,player.y))}
function xpReq(l){return Math.floor(CFG.xp*Math.pow(1.16,l-1))}

/* Menus */
function hideMenus(){["menuInicial","menuPersonagem","menuInventario","menuGrimorio","menuConquistas","menuOpcoes","menuControles","menuMapaInfo","menuClasse","menuHabilidade","menuDificuldade","menuSecundarioInicial"].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display="none"})}
function voltarMenu(){hideMenus();document.getElementById("menuInicial").style.display="flex"}
function mostrarClasses(){hideMenus();document.getElementById("menuClasse").style.display="block";showPenguin()}
function mostrarPersonagem(){hideMenus();document.getElementById("menuPersonagem").style.display="block";updateCharacterMenu()}
function mostrarInventario(){hideMenus();document.getElementById("menuInventario").style.display="block";updateInventoryMenu()}
function mostrarGrimorio(){hideMenus();document.getElementById("menuGrimorio").style.display="block";document.getElementById("grimorioPenguin").style.display=localStorage.getItem("squareRPG_penguin")==="true"?"block":"none"}
function mostrarConquistas(){hideMenus();document.getElementById("menuConquistas").style.display="block";updateAchievements()}
function mostrarOpcoes(){hideMenus();document.getElementById("menuOpcoes").style.display="block"}
function mostrarControles(){hideMenus();document.getElementById("menuControles").style.display="block"}
function mostrarMapaInfo(){hideMenus();document.getElementById("menuMapaInfo").style.display="block"}

function updateCharacterMenu(){
 const hasPlayer=!!player.class;
 document.getElementById("personagemNome").textContent=player.class||"Herói da Arena";
 document.getElementById("personagemDescricao").textContent=hasPlayer?`${player.weapon} • Nível ${player.level}`:"Escolha uma classe e entre na arena.";
 document.getElementById("menuNivel").textContent=player.level;
 document.getElementById("menuVida").textContent=hasPlayer?`${Math.ceil(player.hp)}/${Math.ceil(player.hpMax)}`:"---";
 document.getElementById("menuDano").textContent=hasPlayer?player.dmg.toFixed(1):"---";
 document.getElementById("menuOuro").textContent=player.gold;
 document.getElementById("avatarMenu").textContent=player.class==="Penguin"?"🐧":player.class==="Mago"?"🔮":player.class==="Arqueiro"?"🏹":"⚔️";
 const masteryLevel=hasPlayer?player.weaponMasteryLevel:1;
 const masteryName=hasPlayer?weaponMasteryName():"Aprendiz";
 const masteryNow=hasPlayer?player.weaponMastery:0;
 const masteryNext=hasPlayer?player.weaponMasteryNext:12;
 const masteryPct=Math.max(0,Math.min(100,masteryNow/masteryNext*100));
 document.getElementById("menuMaestriaNome").textContent=masteryName;
 document.getElementById("menuMaestriaNivel").textContent=`Mestria ${masteryLevel}`;
 document.getElementById("menuMaestriaBarra").style.width=masteryPct+"%";
 document.getElementById("menuMaestriaTexto").textContent=`${masteryNow} / ${masteryNext} usos`;
 document.getElementById("menuArmaPrincipal").textContent=hasPlayer?`⚔️ ${player.weapon||"Nenhuma arma"}`:"⚔️ Nenhuma arma";
}

let categoriaInventarioAtual="resumo";

function desenharRetratoInventario(){
 const c=document.getElementById("inventarioRetrato");
 if(!c)return;
 const x=c.getContext("2d");
 x.clearRect(0,0,128,128);
 x.imageSmoothingEnabled=false;
 x.fillStyle="#17100b";x.fillRect(0,0,128,128);
 x.fillStyle="#3a291c";x.fillRect(8,8,112,112);
 x.fillStyle=player.class==="Guerreiro"?"#b94335":player.class==="Mago"?"#4d78c4":player.class==="Arqueiro"?"#4f9a58":player.class==="Penguin"?"#8fb9c9":"#8a6a42";
 x.fillRect(38,38,52,52);
 x.fillStyle="#d7c7aa";x.fillRect(46,30,36,18);
 x.fillStyle="#17100b";x.fillRect(50,51,6,6);x.fillRect(72,51,6,6);
 if(player.class==="Penguin"){x.fillStyle="#eef8fb";x.fillRect(45,50,38,32);x.fillStyle="#f0b64a";x.fillRect(58,58,12,7);x.fillStyle="#18232b";x.fillRect(40,44,48,38)}
 x.fillStyle="#d7bd74";x.fillRect(43,88,42,6);
}

function selecionarCategoriaInventario(categoria){
 categoriaInventarioAtual=categoria;
 document.querySelectorAll(".inventario-aba").forEach(b=>b.classList.toggle("ativa",b.dataset.categoria===categoria));
 updateInventoryMenu();
}

function updateInventoryMenu(){
 const box=document.getElementById("inventarioMenuLista");
 if(!box)return;
 const ouro=document.getElementById("inventarioOuro");
 const nome=document.getElementById("inventarioNome");
 const classe=document.getElementById("inventarioClasse");
 const nivel=document.getElementById("inventarioNivel");
 if(ouro)ouro.textContent=player.gold;
 if(nome)nome.textContent=player.class||"Herói da Arena";
 if(classe)classe.textContent=player.class?player.class:"Nenhuma classe";
 if(nivel)nivel.textContent=player.level;
 desenharRetratoInventario();

 const card=(titulo,descricao,extra="")=>`<div class="inventario-card"><strong>${titulo}</strong><span>${descricao}</span>${extra?`<small>${extra}</small>`:""}</div>`;
 let html="";

 if(categoriaInventarioAtual==="resumo"){
   html+=card("⚔️ Principal",player.weapon||"Nenhum equipado",player.type||"Ataque básico");
   html+=card("🔮 Secundário",player.secondary||"Nenhum equipado",player.secondaryMode?"Ativo agora":"Pressione F para trocar");
   html+=card("🧪 Item ativo",player.active?`${activeItems[player.active].icon} ${activeItems[player.active].name}`:"Nenhum",player.active?activeItems[player.active].rarity:"Use R durante a aventura");
   html+=card("💎 Passivos",player.passives.length?`${player.passives.length} coletado(s)`:"Nenhum coletado","Relíquias e bônus permanentes");
   html+=card("⭐ Evoluções",player.evolutions.length?`${player.evolutions.length} escolhida(s)`:"Nenhuma ainda","Melhorias da run");
 }

 if(categoriaInventarioAtual==="equipamento"){
   html+=card("⚔️ Arma principal",player.weapon||"Nenhuma",player.type||"Ataque inicial");
   html+=card("🛡️ Arma secundária",player.secondary||"Nenhuma",player.secondaryData?.name?"Pressione F para usar":"Ainda não encontrada");
   html+=card("🎮 Modo atual",player.secondaryMode?"SECUNDÁRIO":"PRINCIPAL",player.secondaryMode?"Setas usam o secundário":"Setas usam o principal");
 }

 if(categoriaInventarioAtual==="ativos"){
   html+=card("🧪 Slot de item",player.active?`${activeItems[player.active].icon} ${activeItems[player.active].name}`:"Vazio",player.active?`${activeItems[player.active].rarity} • R usa o item`:"Pegue um item para equipar");
   if(!player.active){html+=card("📦 Como conseguir","Baús, lojas, chefes e eventos","O item fica guardado até ser usado com R")}
 }

 if(categoriaInventarioAtual==="passivos"){
   if(player.passives.length){player.passives.forEach(n=>html+=card("💎 Passivo",n,"Efeito permanente nesta run"));}
   else html+=card("💎 Nenhum passivo","Você ainda não encontrou relíquias ou subitens.","Explore baús e salas especiais");
 }

 if(categoriaInventarioAtual==="evolucoes"){
   if(player.evolutions.length){player.evolutions.forEach(n=>html+=card("⭐ Evolução",n,"Escolha feita durante o level up"));}
   else html+=card("⭐ Nenhuma evolução","Sua build ainda está no começo.","As escolhas aparecem ao subir de nível");
 }

 box.innerHTML=html;
}
function updateAchievements(){
 const set=(id,key)=>document.getElementById(id).textContent=localStorage.getItem(key)==="true"?"✅":"🔒";
 set("ach1Icon","squareRPG_firstKill");set("ach2Icon","squareRPG_hunter");set("ach3Icon","squareRPG_boss");set("ach4Icon","squareRPG_level65");set("ach5Icon","squareRPG_penguin");
}
function saveAchievements(){if(player.kills>=1)localStorage.setItem("squareRPG_firstKill","true");if(player.kills>=100)localStorage.setItem("squareRPG_hunter","true");if(player.level>=65)localStorage.setItem("squareRPG_level65","true")}
function showPenguin(){if(localStorage.getItem("squareRPG_penguin")==="true")document.getElementById("penguinUnlock").style.display="block"}

function escolherClasse(c){
 player.class=c;
 document.getElementById("menuClasse").style.display="none";
 document.getElementById("menuDificuldade").style.display="block";
 const desc=document.getElementById("dificuldadeDescricao");
 if(desc)desc.textContent=c==="Penguin"?"A classe secreta mantém suas regras especiais, mas a dificuldade define seu começo.":"A dificuldade define o equipamento que você recebe no início da run.";
}
function selecionarDificuldade(nivel){
 player.difficulty=nivel;
 document.getElementById("menuDificuldade").style.display="none";
 if(nivel==="facil") abrirEscolhaSecundarioInicial();
 else startGame();
}
function voltarDificuldade(){
 document.getElementById("menuSecundarioInicial").style.display="none";
 document.getElementById("menuDificuldade").style.display="block";
}
function abrirEscolhaSecundarioInicial(){
 const opcoes=shuffle(secondaryCatalog[player.class]||[]).slice(0,2);
 startingSecondaryChoices=opcoes;
 const box=document.getElementById("opcoesSecundarioInicial");
 box.innerHTML="";
 opcoes.forEach((opt)=>{
   const c=document.createElement("button");
   c.className="secundario-inicial-card";
   c.innerHTML=`<div class="secundario-inicial-icone">${opt.icon}</div><strong>${opt.name}</strong><span>${opt.desc}</span><span class="secundario-inicial-raridade">${opt.rarity}</span>`;
   c.onclick=()=>escolherSecundarioInicial(opt);
   box.appendChild(c);
 });
 document.getElementById("secundarioInicialDescricao").textContent=`${player.class}: escolha 1 entre 2 secundários aleatórios.`;
 document.getElementById("menuSecundarioInicial").style.display="block";
}
function escolherSecundarioInicial(opt){
 player.startingSecondary=opt;
 startGame();
}
function voltarClasse(){document.getElementById("menuHabilidade").style.display="none";document.getElementById("menuDificuldade").style.display="none";document.getElementById("menuSecundarioInicial").style.display="none";document.getElementById("menuClasse").style.display="block";showPenguin()}
function escolherHabilidade(name,opt){player.weapon=name;player.type=opt.type;startGame()}
function resetPlayer(){Object.assign(player,{x:385,y:235,hp:100,hpMax:100,speed:4,dmg:1,range:50,cd:500,def:0,lastAttack:0,dx:0,dy:1,level:1,xp:0,xpNext:100,gold:0,kills:0,active:null,secondary:null,secondaryData:null,secondaryMode:false,passives:[],evolutions:[],tempDef:0,barrierTimer:0,speedTimer:0,crownTimer:0,dragon:false,lifeSteal:0,area:0,flame:false,bladeStorm:false,arcaneBlade:false,doubleSpell:false,bigSpell:false,arcaneRain:false,doubleArrow:false,bigExplosion:false,arrowRain:false,masterArcher:false,legendaryBow:false,arcaneArrow:false,penguinIce:false,penguinTriple:false,penguinSupreme:false,penguinChill:false,god:false,weaponMastery:0,weaponMasteryLevel:1,weaponMasteryNext:12,weaponCombo:0});player.startingSecondary=null;const kit=startingLoadouts[player.class]||startingLoadouts.Guerreiro;player.weapon=kit.name;player.type=kit.type;player.hp=classes[player.class].hp;player.hpMax=player.hp;player.speed=classes[player.class].vel;player.dmg=kit.dmg;player.range=kit.range;player.cd=kit.cd;player.def=kit.def||0;
 player.secondary=null;player.secondaryData=null;player.secondaryMode=false;
 let opt=null;
 if(player.startingSecondary){
   opt=player.startingSecondary;
 } else {
   const pool=secondaryCatalog[player.class]||[];
   if(pool.length) opt=pool[Math.floor(Math.random()*pool.length)];
 }
 if(opt){
   player.secondary=opt.name;
   player.secondaryData={...opt,cooldown:secondaryCooldown(opt.type),lastUse:0};
 }
 player.startingSecondary=null;
 if(player.class==="Penguin"){player.penguinChill=true;player.penguinEasterEgg=true;}
}
function weaponMasteryRequirement(level){return Math.floor(12*Math.pow(1.7,level-1))}
function weaponMasteryName(){return ["Aprendiz","Praticante","Veterano","Mestre","Lendário"][Math.max(0,Math.min(4,player.weaponMasteryLevel-1))]}
function weaponMasteryFx(){if(effects.length<CFG.maxEffects)effects.push({t:"mastery",x:player.x+15,y:player.y+15,time:30,max:30})}
function gainWeaponMastery(amount=1){player.weaponMastery=Math.min(99999,player.weaponMastery+amount);while(player.weaponMastery>=player.weaponMasteryNext&&player.weaponMasteryLevel<5){player.weaponMastery-=player.weaponMasteryNext;player.weaponMasteryLevel++;player.weaponMasteryNext=weaponMasteryRequirement(player.weaponMasteryLevel);levelFx();weaponMasteryFx()}updateHud(true);if(document.getElementById("menuMaestriaNome"))updateCharacterMenu()}

function startGame(){transitioningRoom=false;roomTransitionLock=false;resetPlayer();enemiesArr=[];shots=[];bossShots=[];xpDrops=[];goldDrops=[];floorItems=[];effects=[];boss=null;roomIndex=1;roomCleared=0;roomHistory=[];roomStates=[];lastSpecialRoom="";roomSeed=hashSeed(`${Date.now()}:${Math.random()}:${player.class}`);previousExitOpen=false;roomDirection="forward";game=true;paused=false;choiceOpen=false;inventoryOpen=false;hideMenus();document.getElementById("jogo").style.display="block";document.getElementById("bossHUD").style.display="none";document.getElementById("salaOverlay").style.display="none";document.getElementById("lojaOverlay").style.display="none";nextRoom("combat",true);requestAnimationFrame(loop)}

/* Rooms */
function nextRoom(type,first=false){transitioningRoom=false;choiceOpen=false;roomType=first?"combat":type;roomCleared=0;boss=null;bossShots=[];enemiesArr=[];xpDrops=[];goldDrops=[];floorItems=[];effects=[];generateRoomLayout(roomType);const snapshot={type:roomType,seed:roomSeed>>>0,map:roomMap.map(row=>row.slice()),obstacles:roomObstacles.map(o=>({...o}))};roomStates[roomIndex-1]=snapshot;roomHistory[roomIndex-1]=roomType;player.x=canvas.width/2-player.size/2;player.y=canvas.height/2-player.size/2;exitOpen=false;previousExitOpen=roomIndex>1;document.getElementById("bossHUD").style.display="none";document.getElementById("salaOverlay").style.display="none";document.getElementById("lojaOverlay").style.display="none";const banner=document.getElementById("roomBanner");banner.classList.remove("door-open");banner.textContent=`${roomLabel(roomType)} • Sala ${roomIndex}`;document.getElementById("roomSeedInfo").textContent=`Seed ${roomSeed>>>0}`;updateMiniMap();if(roomType==="shop"){openShop();return}if(roomType==="rest"){openRest();return}if(roomType==="treasure"){spawnTreasure();return}if(roomType==="boss"){spawnBoss();return}spawnWave(roomType)}
function loadKnownRoom(state){transitioningRoom=false;choiceOpen=false;roomType=state.type;roomSeed=state.seed>>>0;roomMap=state.map.map(row=>row.slice());roomObstacles=state.obstacles.map(o=>({...o}));boss=null;bossShots=[];enemiesArr=[];xpDrops=[];goldDrops=[];floorItems=[];effects=[];roomCleared=1;exitOpen=true;previousExitOpen=roomIndex>1;player.x=40;player.y=canvas.height/2-player.size/2;if(roomDirection==="backward"){player.x=canvas.width-70}document.getElementById("bossHUD").style.display="none";document.getElementById("salaOverlay").style.display="none";document.getElementById("lojaOverlay").style.display="none";const banner=document.getElementById("roomBanner");banner.classList.add("door-open");banner.textContent=`${roomLabel(roomType)} • Sala ${roomIndex} • VISITADA`;document.getElementById("roomSeedInfo").textContent=`Seed ${roomSeed>>>0}`;updateMiniMap()}
function updateMiniMap(){
 const box=document.getElementById("miniMapaSalas");
 if(!box)return;
 const prog=document.getElementById("miniMapaProgresso");
 const seed=document.getElementById("miniMapaSeedIcon");
 const status=document.getElementById("miniMapaStatus");
 const currentMap=document.getElementById("miniMapaSalaAtual");
 if(prog)prog.textContent=`Sala ${roomIndex} • ${roomLabel(roomType).replace("Sala de ","").replace("Sala do ","").replace("Santuário de ","").replace("Loja do ","")}`;
 if(seed)seed.title=`Seed ${roomSeed>>>0}`;
 if(status)status.textContent=exitOpen?"Saída aberta • direita avança • esquerda retorna":"Derrote a sala para revelar a saída";
 if(currentMap){
   currentMap.innerHTML="";
   const mapW=12,mapH=8;
   const srcW=ROOM.w,srcH=ROOM.h;
   for(let my=0;my<mapH;my++)for(let mx=0;mx<mapW;mx++){
     const tx=Math.min(srcW-1,Math.floor(mx/srcW*mapW?0:0));
     const sx=Math.min(srcW-1,Math.floor((mx+.5)*srcW/mapW));
     const sy=Math.min(srcH-1,Math.floor((my+.5)*srcH/mapH));
     const tile=document.createElement("span");
     const type=roomMap[sy]?.[sx]||"floor";
     tile.className=`mini-mapa-tile ${type}`;
     const px=Math.floor((player.x+player.size/2)/canvas.width*mapW);
     const py=Math.floor((player.y+player.size/2)/canvas.height*mapH);
     if(px===mx&&py===my)tile.classList.add("player");
     if(exitOpen&&mx>=mapW-2&&my>=3&&my<=4)tile.classList.add("exit");
     currentMap.appendChild(tile);
   }
 }
 box.innerHTML="";
 const start=Math.max(0,roomIndex-5);
 const end=Math.min(roomStates.length,roomIndex+1);
 for(let i=start;i<end;i++){
   const type=roomStates[i]?.type||roomHistory[i]||"combat";
   const row=document.createElement("div");
   const visited=i<roomIndex-1;
   row.className="mini-mapa-no "+(i===roomIndex-1?"atual ":"")+(i===roomIndex-2?"anterior ":"")+(type==="boss"?"boss ":"")+(visited?"visitada":"");
   const ponto=document.createElement("span");ponto.className="ponto";
   const nome=document.createElement("span");
   nome.textContent=`${roomIcon(type)||"•"} Sala ${i+1}`;
   const sub=document.createElement("small");
   sub.textContent=roomLabel(type).replace("Sala de ","").replace("Sala do ","").replace("Santuário de ","").replace("Loja do ","");
   row.appendChild(ponto);row.appendChild(nome);row.appendChild(sub);
   if(visited&&roomStates[i]){row.title="Voltar para esta sala";row.onclick=()=>{while(roomIndex>i+1)transitionToPreviousRoom()};row.style.cursor="pointer";}
   box.appendChild(row);
   if(i<end-1){const line=document.createElement("div");line.className="mini-mapa-linha";box.appendChild(line)}
 }
 if(roomIndex<roomStates.length+1){
   const unknown=document.createElement("div");
   unknown.className="mini-mapa-no desconhecida";
   const p=document.createElement("span");p.className="ponto";
   const n=document.createElement("span");n.textContent=`? Sala ${roomIndex+1}`;
   const s=document.createElement("small");s.textContent="não descoberta";
   unknown.appendChild(p);unknown.appendChild(n);unknown.appendChild(s);box.appendChild(unknown);
 }
 const back=document.getElementById("miniMapaVoltar");
 if(back){back.style.display=roomIndex>1?"block":"none";back.disabled=roomIndex<=1;back.textContent=roomIndex>1?`↩ Voltar para Sala ${roomIndex-1}`:"↩ Sem sala anterior";}
} 
function roomLabel(t){return{combat:"Sala de Combate",elite:"Sala de Elite",treasure:"Sala do Tesouro",shop:"Loja do Mercador",rest:"Santuário de Descanso",boss:"Covil do Chefão"}[t]||t}
function spawnWave(type){const count=type==="elite"?Math.min(10,4+Math.floor(player.level*.22)):Math.min(14,5+Math.floor(player.level*.38));for(let i=0;i<count;i++)spawnEnemy(type==="elite"?(Math.random()<.75?"orc":"goblinGuerreiro"):null)}
function roomDone(){if(transitioningRoom||["shop","rest","treasure"].includes(roomType))return;transitioningRoom=true;roomCleared++;setTimeout(()=>{if(game){transitioningRoom=false;openRoomExit()}},220)}
function roomIcon(t){return{combat:"⚔️",elite:"☠️",treasure:"💰",shop:"🏪",rest:"❤️",boss:"👑"}[t]}
function roomDesc(t){return{combat:"Monstros comuns e ouro.",elite:"Inimigos fortes e melhores drops.",treasure:"Recompensas garantidas.",shop:"Compre itens e melhorias.",rest:"Recupere parte da vida.",boss:"Enfrente um grande inimigo."}[t]}
function spawnTreasure(){transitioningRoom=false;paused=true;const choices=[];for(let i=0;i<3;i++){const active=Math.random()<.55;const id=active?shuffle(Object.keys(activeItems))[0]:shuffle(Object.keys(passiveItems))[0];choices.push({type:active?"active":"passive",id})}document.getElementById("salaTitulo").textContent="💰 Tesouro";document.getElementById("salaDescricao").textContent="A sala foi gerada proceduralmente. Escolha uma recompensa; o próximo cômodo será sorteado automaticamente.";const box=document.getElementById("salaOpcoes");box.innerHTML="";choices.forEach(c=>{const data=c.type==="active"?activeItems[c.id]:passiveItems[c.id];const b=document.createElement("div");b.className="sala-opcao";b.innerHTML=`<strong>${c.type==="active"?data.icon:"🎁"} ${data.name}</strong><span>${c.type==="active"?data.rarity:"Relíquia passiva"}</span>`;b.onclick=()=>{if(c.type==="active")player.active=c.id;else{data.apply();player.passives.push(data.name)}document.getElementById("salaOverlay").style.display="none";paused=false;roomIndex++;nextProceduralRoom()};box.appendChild(b)});document.getElementById("salaOverlay").style.display="flex"}
function openRest(){transitioningRoom=false;player.hp=Math.min(player.hpMax,player.hp+player.hpMax*.5);paused=true;document.getElementById("salaTitulo").textContent="❤️ Santuário";document.getElementById("salaDescricao").textContent="Você recuperou metade da vida. O próximo cômodo será gerado automaticamente.";const box=document.getElementById("salaOpcoes");box.innerHTML=`<div class="sala-opcao"><strong>❤️ Vida restaurada</strong><span>+50% do HP máximo.</span><button>Continuar</button></div>`;box.firstElementChild.onclick=()=>{document.getElementById("salaOverlay").style.display="none";paused=false;roomIndex++;nextProceduralRoom()};document.getElementById("salaOverlay").style.display="flex"}
/* Enemies */
function availableEnemyTypes(){const a=["goblin"];if(player.level>=5)a.push("goblinGuerreiro");if(player.level>=10)a.push("esqueleto");if(player.level>=20)a.push("orc");if(player.level>=35)a.push("troll");return a}
function spawnEnemy(forced=null){if(enemiesAlive().length>=CFG.maxEnemies)return;const type=forced||weightedEnemy();const d=enemies[type];let x,y,tries=0;do{x=Math.random()*(canvas.width-d.size-20)+10;y=Math.random()*(canvas.height-d.size-20)+10;tries++}while(dist(x,y,player.x,player.y)<140&&tries<40);const mul=1+(player.level-1)*.085;enemiesArr.push({type,x,y,size:d.size,hp:d.hp*mul,hpMax:d.hp*mul,speed:d.speed*(1+player.level*.006),dmg:d.dmg*mul,xp:Math.floor(d.xp*(1+player.level*.02)),gold:d.gold,burn:0,freeze:0,hit:0,lastHit:0,dead:false})}
function weightedEnemy(){const a=availableEnemyTypes();let total=a.reduce((s,t)=>s+enemies[t].w,0),r=Math.random()*total;for(const t of a){r-=enemies[t].w;if(r<=0)return t}return"goblin"}
function damage(e,n){if(!e||e.dead)return;e.hp-=n;e.hit=7;if(e.hp<=0){e.hp=0;e.dead=true}}
function updateEnemies(){const now=performance.now();for(const e of enemiesArr){if(e.dead)continue;if(e.freeze>0){e.freeze--;continue}if(e.burn>0){e.burn--;if(e.burn%15===0)damage(e,player.dmg*.06)}const dx=player.x+15-(e.x+e.size/2),dy=player.y+15-(e.y+e.size/2),d=Math.hypot(dx,dy)||1;if(d>(player.size+e.size)*.35){let enemySpeed=e.speed;if(player.penguinChill&&d<105)enemySpeed*=.72;const mx=dx/d*enemySpeed,my=dy/d*enemySpeed;const ex=e.x+mx,ey=e.y+my;if(!collisionRect(ex+3,e.y+4,e.size-6,e.size-7))e.x=ex;if(!collisionRect(e.x+3,ey+4,e.size-6,e.size-7))e.y=ey}if(d<player.size/2+e.size/2&&now-e.lastHit>750){let reduction=player.def;if(player.barrierTimer>0)reduction=Math.max(reduction,player.tempDef);if(!player.god)player.hp-=Math.max(1,e.dmg*(1-reduction));e.lastHit=now;hitFx(player.x+15,player.y+15)}if(e.hit>0)e.hit--}}
function removeDead(){
 let died=false;
 for(let i=enemiesArr.length-1;i>=0;i--){
  const e=enemiesArr[i];
  if(!e.dead)continue;
  died=true;
  dropXP(e);
  dropLoot(e);
  dropGold(e);
  player.kills++;
  enemiesArr.splice(i,1);
 }
 if(died)saveAchievements();
 if(roomType!=="boss"&&enemiesArr.length===0&&game&&!paused&&!choiceOpen&&!transitioningRoom){roomDone()}
}

/* Loot drops */
function dropGold(e){
 if(goldDrops.length>=CFG.maxGoldDrops)return;
 const amount=rand(e.gold[0],e.gold[1]);
 goldDrops.push({x:e.x+e.size/2,y:e.y+e.size/2,value:amount,spin:Math.random()*6.28,life:900});
}
function updateGold(){
 for(let i=goldDrops.length-1;i>=0;i--){
  const g=goldDrops[i];
  g.spin+=.12;
  g.life--;
  const dx=player.x+15-g.x,dy=player.y+15-g.y,d=Math.hypot(dx,dy)||1;
  if(d<130){g.x+=dx/d*2.6;g.y+=dy/d*2.6}
  if(d<30||g.life<=0){
   if(d<30){player.gold+=g.value+(player.class==="Penguin"?Math.max(1,Math.floor(g.value*.25)):0);} 
   goldDrops.splice(i,1);
  }
 }
}

/* XP */
function dropXP(e){
 const n=e.xp>=100?3:e.xp>=60?2:1;
 const val=Math.ceil(e.xp/n);
 for(let i=0;i<n&&xpDrops.length<CFG.maxXPDrops;i++)xpDrops.push({x:e.x+e.size/2+(Math.random()-.5)*20,y:e.y+e.size/2+(Math.random()-.5)*20,v:val,spin:Math.random()*6.28});
}
function updateXP(){for(let i=xpDrops.length-1;i>=0;i--){const p=xpDrops[i];p.spin+=.08;let dx=player.x+15-p.x,dy=player.y+15-p.y,d=Math.hypot(dx,dy)||1;if(d<120){p.x+=dx/d*2.3;p.y+=dy/d*2.3}if(d<28){gainXP(p.v);xpDrops.splice(i,1)}}}
function gainXP(n){if(player.level>=65)return;player.xp+=n;while(player.xp>=player.xpNext&&player.level<65&&!choiceOpen){player.xp-=player.xpNext;levelUp()}}
function levelUp(){if(player.level>=65)return;player.level++;player.xpNext=xpReq(player.level);player.hpMax+=3;player.hp=Math.min(player.hpMax,player.hp+6);if(player.level%2===0)player.dmg*=1.04;if(player.level%3===0)player.speed*=1.02;levelFx();openEvolution(CFG.special.includes(player.level));if(player.level>=65)localStorage.setItem("squareRPG_level65","true")}

function normalUpgrades(){return shuffle([{name:"⚔️ Poder",desc:"+10% dano",effect:"dmg",v:.1},{name:"❤️ Vitalidade",desc:"+18 HP máximo",effect:"hp",v:18},{name:"⚡ Agilidade",desc:"+8% velocidade",effect:"speed",v:.08},{name:"🎯 Alcance",desc:"+12% alcance",effect:"range",v:.12},{name:"🔥 Cadência",desc:"-8% cooldown",effect:"cd",v:.08},{name:"🛡️ Defesa",desc:"+8% defesa",effect:"def",v:.08}]).slice(0,3)}
function specialUpgrades(){const n=player.level,L=[];const push=(name,desc,e,v=1)=>L.push({name,desc,effect:e,v});if(player.class==="Guerreiro"){if(n===5){push("⚔️ Lâmina Afiada","+25% dano","dmg",.25);push("🛡️ Armadura Reforçada","+20% defesa","def",.2);push("⚡ Golpe Rápido","-25% cooldown","cd",.25)}if(n===10){push("🩸 Lâmina Sanguinária","Roubo de vida","life",.04);push("💥 Golpe Brutal","+35 área","area",35)}if(n===20){push("🔥 Espada Flamejante","Aplica queimadura","flame");push("👑 Mestre das Armas","+35% dano","dmg",.35)}if(n===25)push("⚔️ Tempestade de Lâminas","Segundo corte visual","storm");if(n===35)push("💥 Golpe Devastador","Grande área","area",70);if(n===45)push("👑 Lâmina do Campeão","+50% dano","dmg",.5);if(n===55)push("🌌 Espada Arcana","Lança energia","arcblade");if(n===65)push("⚔️ Lenda da Arena","Forma final","legend")}
if(player.class==="Mago"){if(n===5)push("✨ Poder Arcano","+25% dano","dmg",.25);if(n===10)push("✨ Magia Dupla","Duas magias","doubleSpell");if(n===20)push("🌌 Magia Maior","Projéteis maiores","bigSpell");if(n===25)push("☄️ Chuva Arcana","Mais projéteis","arcaneRain");if(n===35)push("🔥 Inferno","+20% dano","dmg",.2);if(n===45)push("👑 Arquimago","+50% dano","archmage");if(n===55)push("🌠 Estrela Arcana","Energia extra","star");if(n===65)push("🌌 Cataclismo","Forma final","legend")}
if(player.class==="Arqueiro"){if(n===5)push("🏹 Arco Reforçado","+25% dano","dmg",.25);if(n===10)push("🏹 Flecha Dupla","Duas flechas","doubleArrow");if(n===20)push("💥 Explosão Maior","Explosão maior","bigExplosion");if(n===25)push("🌧️ Chuva de Flechas","Sete flechas","arrowRain");if(n===35)push("🎯 Mestre Arqueiro","+30% dano e alcance","masterArcher");if(n===45)push("👑 Arco Lendário","Perfurante superior","legendaryBow");if(n===55)push("🌌 Flecha Arcana","Energia extra","arcaneArrow");if(n===65)push("🏹 Tempestade de Flechas","Forma final","legend")}
if(player.class==="Penguin"){if(n===5){push("🐟 Mestre do Peixe","+25% dano","dmg",.25);push("❄️ Pés Congelantes","Congela inimigos","pengIce");push("⚡ Penguin Veloz","+20% velocidade","speed",.2)}if(n===10)push("🐧 Trinca Polar","Três projéteis","pengTriple");if(n===20)push("🌊 Deslizamento","+25% dano","dmg",.25);if(n===25)push("❄️ Nevasca Penguin","Gelo em área","pengIce");if(n===35)push("👑 Senhor do Gelo","+40% dano","dmg",.4);if(n===45)push("🐧 Rei Penguin","+50% dano + defesa","pengKing");if(n===55)push("🌌 Penguin Arcano","Projéteis extras","pengSupreme");if(n===65)push("🐧 PENGUIN SUPREMO","Forma final","legend")}while(L.length<3)L.push(...normalUpgrades().slice(0,3-L.length));return shuffle(L).slice(0,3)}
function openEvolution(special){choiceOpen=true;paused=true;document.getElementById("tituloEvolucao").textContent=special?`👑 NÍVEL ${player.level} — EVOLUÇÃO ESPECIAL`:`⭐ NÍVEL ${player.level}`;document.getElementById("descricaoEvolucao").textContent="Escolha com o mouse ou pressione 1, 2 ou 3.";const box=document.getElementById("opcoesEvolucao");box.innerHTML="";const arr=special?specialUpgrades():normalUpgrades();window._evo=arr;arr.forEach((o,i)=>{const c=document.createElement("div");c.className="evolucao-card";c.innerHTML=`<span class="numero-evolucao">[${i+1}]</span><strong>${o.name}</strong><span>${o.desc}</span>`;c.onclick=()=>applyEvolution(o);box.appendChild(c)});document.getElementById("evolucaoOverlay").style.display="flex"}
function applyEvolution(o){player.evolutions.push(o.name);switch(o.effect){case"dmg":player.dmg*=1+o.v;break;case"hp":player.hpMax+=o.v;player.hp+=o.v;break;case"speed":player.speed*=1+o.v;break;case"range":player.range*=1+o.v;break;case"cd":player.cd*=1-o.v;break;case"def":player.def=Math.min(.9,player.def+o.v);break;case"life":player.lifeSteal+=o.v;break;case"area":player.area+=o.v;break;case"flame":player.flame=true;break;case"storm":player.bladeStorm=true;break;case"arcblade":player.arcaneBlade=true;break;case"doubleSpell":player.doubleSpell=true;break;case"bigSpell":player.bigSpell=true;break;case"arcaneRain":player.arcaneRain=true;break;case"archmage":player.dmg*=1.5;player.cd*=.8;break;case"star":player.arcaneRain=true;break;case"doubleArrow":player.doubleArrow=true;break;case"bigExplosion":player.bigExplosion=true;break;case"arrowRain":player.arrowRain=true;break;case"masterArcher":player.dmg*=1.3;player.range*=1.3;break;case"legendaryBow":player.legendaryBow=true;break;case"arcaneArrow":player.arcaneArrow=true;break;case"pengIce":player.penguinIce=true;break;case"pengTriple":player.penguinTriple=true;break;case"pengKing":player.dmg*=1.5;player.def=Math.min(.9,player.def+.15);break;case"pengSupreme":player.penguinSupreme=true;break;case"legend":player.dmg*=1.6;player.cd*=.65;player.hpMax+=80;player.hp+=80;player.speed*=1.15;player.def=Math.min(.9,player.def+.1);break}choiceOpen=false;paused=false;document.getElementById("evolucaoOverlay").style.display="none";if(player.level<65&&player.xp>=player.xpNext) {player.xp-=player.xpNext;levelUp()}}

/* Combat */
function attackUpdate(){if(paused||choiceOpen)return;let attacking=false;if(keys.arrowup){player.dx=0;player.dy=-1;attacking=true}else if(keys.arrowdown){player.dx=0;player.dy=1;attacking=true}else if(keys.arrowleft){player.dx=-1;player.dy=0;attacking=true}else if(keys.arrowright){player.dx=1;player.dy=0;attacking=true}if(attacking)attack()}
function attack(){
 const now=performance.now();
 if(player.secondaryMode&&player.secondaryData){secondaryAttack();return}
 if(now-player.lastAttack<player.cd)return;
 player.lastAttack=now;
 let dmg=player.dmg;
 if(player.dragon){dmg*=8;player.dragon=false}
 player.weaponCombo=(player.weaponCombo%3)+1;
 player.anim.state="attack";
 player.anim.until=now+Math.max(160,player.cd*.8);
 gainWeaponMastery(1);
 if(player.class==="Guerreiro")melee(dmg);
 else if(player.class==="Mago")mage(dmg);
 else if(player.class==="Arqueiro")archer(dmg);
 else penguin(dmg);
}
function melee(dmg){const cx=player.x+15,cy=player.y+15,ang=Math.atan2(player.dy,player.dx),reach=player.range+player.area+22+(player.weaponMasteryLevel>=2?8:0);for(const e of enemiesAlive()){const ix=e.x+e.size/2,iy=e.y+e.size/2,dx=ix-cx,dy=iy-cy,d=Math.hypot(dx,dy);if(d>reach||d===0)continue;const a=Math.atan2(dy,dx);const delta=Math.abs(Math.atan2(Math.sin(a-ang),Math.cos(a-ang)));if(delta>Math.PI/2)continue;damage(e,dmg);if(player.lifeSteal)player.hp=Math.min(player.hpMax,player.hp+dmg*player.lifeSteal);if(player.flame)e.burn=90}if(boss&&boss.hp>0&&dist(cx,cy,boss.x+45,boss.y+45)<reach+45){boss.hp-=dmg;if(player.lifeSteal)player.hp=Math.min(player.hpMax,player.hp+dmg*player.lifeSteal)}slashFx();if(player.bladeStorm)slashFx(-player.dx,-player.dy);if(player.arcaneBlade)shot(player.dx,player.dy,player.dmg*.6,"arcano",220,8);if(player.weaponMasteryLevel>=3&&player.weaponCombo===3)slashFx(player.dy,-player.dx);if(player.weaponMasteryLevel>=4&&player.weaponCombo===3){areaDamageAt(cx+player.dx*55,cy+player.dy*55,42,player.dmg*.35);explode(cx+player.dx*55,cy+player.dy*55,48)}}
function mage(dmg){const bonus=player.weaponMasteryLevel>=2?1.08:1;shot(player.dx,player.dy,dmg*bonus,player.type,player.range+(player.weaponMasteryLevel>=3?30:0),projectileSpeed()+(player.weaponMasteryLevel>=4?1:0));if(player.doubleSpell)shot(player.dx,player.dy,dmg*.85,player.type,player.range,projectileSpeed());if(player.arcaneRain){const a=Math.atan2(player.dy,player.dx);for(let i=-1;i<=1;i++){const x=a+i*.15;shot(Math.cos(x),Math.sin(x),dmg*.75*bonus,player.type,player.range,projectileSpeed())}}if(player.weaponMasteryLevel>=3){const a=Math.atan2(player.dy,player.dx)+.13;shot(Math.cos(a),Math.sin(a),dmg*.42,"arcano",player.range,projectileSpeed()+2)}if(player.weaponMasteryLevel>=5)explode(player.x+15+player.dx*38,player.y+15+player.dy*38,34)}
function archer(dmg){const type=player.type,bonus=player.weaponMasteryLevel>=2?1.08:1,speed=9+(player.weaponMasteryLevel>=4?1:0);if(player.arrowRain||type==="multipla"){const n=player.arrowRain?7:3,a=Math.atan2(player.dy,player.dx);for(let i=0;i<n;i++){const off=i-(n-1)/2,ang=a+off*.16;shot(Math.cos(ang),Math.sin(ang),dmg*bonus,type,player.range,speed)}}else if(player.doubleArrow){const a=Math.atan2(player.dy,player.dx);for(const side of[-1,1]){const ang=a+side*.08;shot(Math.cos(ang),Math.sin(ang),dmg*bonus,"comum",player.range,speed)}}else shot(player.dx,player.dy,dmg*bonus,type,player.range+(player.weaponMasteryLevel>=3?25:0),projectileSpeed());if(player.arcaneArrow)shot(player.dx,player.dy,dmg*.5,"arcano",player.range,13);if(player.weaponMasteryLevel>=3&&!player.doubleArrow&&!player.arrowRain){const a=Math.atan2(player.dy,player.dx);shot(Math.cos(a+.09),Math.sin(a+.09),dmg*.45,type,player.range,speed)}}
function penguin(dmg){if(player.type==="investida"){player.x+=player.dx*95;player.y+=player.dy*95;bound();for(const e of enemiesAlive())if(distPlayer(e)<player.range+40)damage(e,dmg);slashFx();return}if(shots.length<CFG.maxProjectiles){shot(player.dx,player.dy,dmg,player.type,player.range+(player.weaponMasteryLevel>=3?35:0),10+(player.weaponMasteryLevel>=4?1:0));const p=shots[shots.length-1];if(p&&player.penguinEasterEgg){p.boomerang=true;p.returning=false;p.homeX=player.x+15;p.homeY=player.y+15;p.travelLimit=Math.min(player.range+110,430)}}if(player.penguinTriple){const a=Math.atan2(player.dy,player.dx);for(let i=-1;i<=1;i++){const ang=a+i*.18;shot(Math.cos(ang),Math.sin(ang),dmg*.8,player.type,player.range,10)}}if(player.penguinIce)enemiesAlive().forEach(e=>{if(distPlayer(e)<130)e.freeze=50});if(player.penguinSupreme){shot(-player.dy,player.dx,dmg*.6,"polar",player.range,11);shot(player.dy,-player.dx,dmg*.6,"polar",player.range,11)}if(player.weaponMasteryLevel>=3&&effects.length<CFG.maxEffects)effects.push({t:"ice",x:player.x+15+player.dx*20,y:player.y+15+player.dy*20,time:18,max:18});if(player.weaponMasteryLevel>=5)areaDamageAt(player.x+15+player.dx*70,player.y+15+player.dy*70,55,dmg*.45)}
function projectileSpeed(){return{fogo:8,agua:9,terra:6,ar:12,teleguiada:7,perfurante:11,explosiva:8,peixe:9,polar:10}[player.type]||9}
function shot(dx,dy,dmg,type,range,speed){if(shots.length>=CFG.maxProjectiles)return;shots.push({x:player.x+15,y:player.y+15,dx,dy,dmg,type,range,speed,size:player.bigSpell?15:10,traveled:0,life:180,hit:[],boomerang:false,returning:false,homeX:player.x+15,homeY:player.y+15,travelLimit:range})}
function updateShots(){for(let i=shots.length-1;i>=0;i--){const p=shots[i];if(p.boomerang){if(!p.returning&&p.traveled>=p.travelLimit){p.returning=true;p.dx=-p.dx;p.dy=-p.dy}if(p.returning){const hx=p.homeX,hy=p.homeY,dd=Math.hypot(hx-p.x,hy-p.y)||1;p.dx=(hx-p.x)/dd;p.dy=(hy-p.y)/dd} }else if(p.type==="teleguiada"){const t=nearest(p);if(t){const tx=t.x+t.size/2,ty=t.y+t.size/2,d=Math.hypot(tx-p.x,ty-p.y)||1;p.dx=(tx-p.x)/d;p.dy=(ty-p.y)/d}}p.x+=p.dx*p.speed;p.y+=p.dy*p.speed;p.traveled+=p.speed;p.life--;let removed=false;for(const e of enemiesAlive()){if(p.hit.includes(e))continue;if(dist(p.x,p.y,e.x+e.size/2,e.y+e.size/2)<e.size/2+p.size/2){hitProjectile(p,e,i);removed=!shots[i];break}}if(removed||!shots[i])continue;if(boss&&dist(p.x,p.y,boss.x+45,boss.y+45)<boss.tamanho/2+p.size/2){boss.hp-=p.dmg;if(!p.boomerang||p.returning){shots.splice(i,1)}else{p.returning=true;p.dx=-p.dx;p.dy=-p.dy}continue}if(p.boomerang&&p.returning&&dist(p.x,p.y,p.homeX,p.homeY)<16){shots.splice(i,1);continue}if(!shots[i])continue;if(p.x<-60||p.x>860||p.y<-60||p.y>560||p.life<=0){shots.splice(i,1)}}} 
function nearest(p){let best=null,md=Infinity;for(const e of enemiesAlive()){if(p.hit.includes(e))continue;const d=dist(p.x,p.y,e.x+e.size/2,e.y+e.size/2);if(d<md){md=d;best=e}}return best}
function hitProjectile(p,e,i){damage(e,p.dmg);p.hit.push(e);if(p.type==="fogo")e.burn=90;if(p.type==="polar")e.freeze=100;if(p.type==="agua")e.speed*=.82;if(p.type==="ar"){e.x+=p.dx*18;e.y+=p.dy*18}if(p.type==="explosiva"){const r=player.bigExplosion?90:65;explode(e.x+e.size/2,e.y+e.size/2,r);for(const x of enemiesAlive())if(x!==e&&dist(x.x,x.y,e.x,e.y)<r)damage(x,p.dmg*.5)}if(p.type==="perfurante"){const lim=player.legendaryBow?6:3;if(p.hit.length<lim)return}if(p.type==="teleguiada"&&nearest(p))return;shots.splice(i,1)}

/* Loot */
function dropLoot(e){const passChance=e.type==="troll"?.2:e.type==="orc"?.09:.025;const activeChance=e.type==="troll"?.13:e.type==="orc"?.05:.012;if(Math.random()<passChance){const id=shuffle(Object.keys(passiveItems))[0];floorItems.push({kind:"passive",id,x:e.x+e.size/2,y:e.y+e.size/2,size:20,spin:0})}if(Math.random()<activeChance){const id=shuffle(Object.keys(activeItems))[0];floorItems.push({kind:"active",id,x:e.x+e.size/2,y:e.y+e.size/2,size:22,spin:0})}}
function updateItems(){for(let i=floorItems.length-1;i>=0;i--){const it=floorItems[i];it.spin+=.08;const dx=player.x+15-it.x,dy=player.y+15-it.y,d=Math.hypot(dx,dy)||1;if(d<110){it.x+=dx/d*1.5;it.y+=dy/d*1.5}if(it.kind==="trap"){
  it.armed--;
  enemiesAlive().forEach(e=>{if(it.armed>0&&dist(it.x,it.y,e.x+e.size/2,e.y+e.size/2)<28){damage(e,player.dmg*1.8);e.freeze=80;it.armed=0;explode(it.x,it.y,35)}});
  if(it.armed<=0)floorItems.splice(i,1);
  continue;
 }
 if(d<28){
  if(it.kind==="active")player.active=it.id;
  else{const data=passiveItems[it.id];if(data){data.apply();player.passives.push(data.name)}}
  const data=it.kind==="active"?activeItems[it.id]:passiveItems[it.id];
  if(data)itemFx(it.x,it.y,data.color);
  floorItems.splice(i,1);
 }
 }
}
function areaDamage(r,dmg){for(const e of enemiesAlive())if(distPlayer(e)<=r)damage(e,dmg);if(boss&&dist(player.x+15,player.y+15,boss.x+45,boss.y+45)<=r+45)boss.hp-=dmg}
function areaDamageAt(x,y,r,dmg){for(const e of enemiesAlive())if(dist(x,y,e.x+e.size/2,e.y+e.size/2)<=r)damage(e,dmg)}
function secondaryCooldown(type){
 const cds={shieldBash:900,spear:720,chain:950,warHammer:1100,arcanePulse:800,magicMirror:900,teleRune:1000,thunderStaff:850,trap:700,boomerang:780,hunterBomb:950,hawk:1100,iceDash:900,snowDrum:1000,fishCannon:850,polarCube:1200};
 return cds[type]||900;
}

function toggleSecondary(){
 if(!game||paused||choiceOpen||!player.secondaryData)return;
 player.secondaryMode=!player.secondaryMode;
 player.anim.state="switch";player.anim.until=performance.now()+280;
 if(player.secondaryMode) itemFx(player.x+15,player.y+15,"#7ddbf1");
 updateHud(true);
}
function secondaryAttack(){
 const data=player.secondaryData;
 if(!data)return;
 const now=performance.now();
 if(now-data.lastUse<data.cooldown)return;
 data.lastUse=now;
 const cx=player.x+15,cy=player.y+15;
 switch(data.type){
  case"iceDash":
   player.x+=player.dx*95;player.y+=player.dy*95;bound();
   enemiesAlive().forEach(e=>{if(distPlayer(e)<70){damage(e,player.dmg*1.5);e.freeze=90}});
   explode(player.x+15,player.y+15,55);
   player.penguinIce=true;break;
  case"shieldBash":
   player.tempDef=.8;player.barrierTimer=45;
   enemiesAlive().forEach(e=>{if(distPlayer(e)<78)damage(e,player.dmg*1.2)});
   explode(cx+player.dx*35,cy+player.dy*35,50);break;
  case"spear":
   shot(player.dx,player.dy,player.dmg*1.5,"perfurante",player.range+120,13);break;
  case"chain":
   {const t=nearest({x:cx,y:cy,hit:[]});if(t){damage(t,player.dmg*1.3);t.x=cx+player.dx*55;t.y=cy+player.dy*55}}break;
  case"warHammer":
   areaDamageAt(cx+player.dx*55,cy+player.dy*55,85,player.dmg*1.6);explode(cx+player.dx*55,cy+player.dy*55,85);break;
  case"arcanePulse":
   areaDamage(120,player.dmg*1.4);explode(cx,cy,120);break;
  case"magicMirror":
   {const a=Math.atan2(player.dy,player.dx);for(let i=-1;i<=1;i++){const ang=a+i*.25;shot(Math.cos(ang),Math.sin(ang),player.dmg,"arcano",260,10)}}break;
  case"teleRune":
   player.x+=player.dx*110;player.y+=player.dy*110;bound();areaDamage(90,player.dmg*1.5);explode(player.x+15,player.y+15,90);break;
  case"thunderStaff":
   [...enemiesAlive()].sort((a,b)=>distPlayer(a)-distPlayer(b)).slice(0,5).forEach(e=>{damage(e,player.dmg*1.7);itemFx(e.x+e.size/2,e.y+e.size/2,"#e5d84c")});break;
  case"trap":
   floorItems.push({kind:"trap",id:"hunterTrap",x:cx+player.dx*55,y:cy+player.dy*55,size:18,spin:0,armed:150});break;
  case"boomerang":
   shot(player.dx,player.dy,player.dmg*1.3,"comum",player.range+100,9);{const p=shots[shots.length-1];if(p){p.boomerang=true;p.travelLimit=Math.min(player.range+100,360);p.homeX=cx;p.homeY=cy}}break;
  case"hunterBomb":
   {const x=cx+player.dx*100,y=cy+player.dy*100;areaDamageAt(x,y,85,player.dmg*2);explode(x,y,85)}break;
  case"hawk":
   enemiesAlive().slice(0,4).forEach(e=>damage(e,player.dmg*.9));break;
  case"snowDrum":
   enemiesAlive().forEach(e=>{if(distPlayer(e)<145){damage(e,player.dmg*1.1);e.freeze=180}});explode(cx,cy,145);break;
  case"fishCannon":
   shot(player.dx,player.dy,player.dmg*2.2,"peixe",player.range+140,11);break;
  case"polarCube":
   roomObstacles.push({x:Math.max(32,Math.min(canvas.width-64,cx+player.dx*65-16)),y:Math.max(32,Math.min(canvas.height-64,cy+player.dy*65-16)),w:32,h:32,kind:"stone",iceTimer:480});break;
 }
 player.anim.state="secondaryAttack";player.anim.until=now+260;
}
function useActive(){if(!player.active||paused||choiceOpen)return;const it=activeItems[player.active];if(!it)return;it.use();player.active=null}

/* Shop */
function openShop(){transitioningRoom=false;paused=true;shopStock=[];for(let i=0;i<5;i++){const active=Math.random()<.55;const id=active?shuffle(Object.keys(activeItems))[0]:shuffle(Object.keys(passiveItems))[0];const data=active?activeItems[id]:passiveItems[id];const base=active?({Comum:18,Raro:35,Épico:60,Lendário:100}[data.rarity]||45):35;shopStock.push({active,id,data,price:Math.max(1,Math.floor((base+roomIndex*3)*(player.class==="Penguin"?.85:1)))})}renderShop();document.getElementById("lojaOverlay").style.display="flex"}
function renderShop(){const box=document.getElementById("lojaItens");box.innerHTML="";shopStock.forEach((s,i)=>{const c=document.createElement("div");c.className="loja-item";c.innerHTML=`<strong>${s.active?s.data.icon:"🎁"} ${s.data.name}</strong><span>${s.active?s.data.rarity:"Relíquia passiva"}</span><span class="preco">💰 ${s.price}</span><button>${player.gold>=s.price?"Comprar":"Sem ouro"}</button>`;c.querySelector("button").onclick=()=>buyShop(i);box.appendChild(c)})}
function buyShop(i){const s=shopStock[i];if(!s||player.gold<s.price)return;player.gold-=s.price;if(s.active)player.active=s.id;else{s.data.apply();player.passives.push(s.data.name)}shopStock.splice(i,1);renderShop()}
function sairLoja(){document.getElementById("lojaOverlay").style.display="none";paused=false;roomIndex++;nextProceduralRoom()}

/* Boss */
function spawnBoss(){boss={x:355,y:55,tamanho:90,hp:1800+player.level*100,hpMax:1800+player.level*100,speed:.55,dmg:40+player.level*1.5,phase:1,lastHit:0,lastShot:0,lastSpawn:0,freeze:0,name:["Gorak, Rei Goblin","Morthak, Senhor dos Ossos","Grum, Senhor Orc","Tharok, Troll Ancestral"][rand(0,3)]};document.getElementById("bossHUD").style.display="block";document.getElementById("nomeBoss").textContent="👑 "+boss.name}
function updateBoss(){if(!boss)return;if(boss.hp<=0){defeatBoss();return}if(boss.freeze>0){boss.freeze--;return}const dx=player.x-boss.x,dy=player.y-boss.y,d=Math.hypot(dx,dy)||1;boss.x+=dx/d*boss.speed;boss.y+=dy/d*boss.speed;const now=performance.now();if(d<player.size/2+boss.tamanho/2&&now-boss.lastHit>900){let red=player.def;if(player.barrierTimer>0)red=Math.max(red,player.tempDef);if(!player.god)player.hp-=Math.max(1,boss.dmg*(1-red));boss.lastHit=now}if(boss.hp<boss.hpMax*.7&&boss.phase===1){boss.phase=2;for(let i=0;i<4;i++)spawnEnemy()}if(boss.hp<boss.hpMax*.4&&boss.phase===2){boss.phase=3;boss.speed*=1.5;boss.dmg*=1.4}if(boss.phase>=2&&now-boss.lastSpawn>2600){for(let i=0;i<2;i++)spawnEnemy();boss.lastSpawn=now}if(boss.phase>=3&&now-boss.lastShot>1700){for(let i=0;i<10;i++){const a=Math.PI*2/10*i;projBoss(a)}boss.lastShot=now}document.getElementById("barraBoss").style.width=Math.max(0,boss.hp/boss.hpMax*100)+"%"}
let bossShots=[];function projBoss(a){if(bossShots.length>100)return;bossShots.push({x:boss.x+45,y:boss.y+45,dx:Math.cos(a),dy:Math.sin(a),speed:4,size:12,life:180,dmg:15+player.level})}
function updateBossShots(){for(let i=bossShots.length-1;i>=0;i--){const p=bossShots[i];p.x+=p.dx*p.speed;p.y+=p.dy*p.speed;p.life--;if(dist(p.x,p.y,player.x+15,player.y+15)<15+p.size/2){let red=player.def;if(player.barrierTimer>0)red=Math.max(red,player.tempDef);if(!player.god)player.hp-=Math.max(1,p.dmg*(1-red));bossShots.splice(i,1);continue}if(p.life<=0||p.x<-50||p.x>850||p.y<-50||p.y>550)bossShots.splice(i,1)}}
function defeatBoss(){
 const b=boss;
 boss=null;
 bossShots=[];
 document.getElementById("bossHUD").style.display="none";
 for(let i=0;i<12&&xpDrops.length<CFG.maxXPDrops;i++)xpDrops.push({x:b.x+45+(Math.random()-.5)*150,y:b.y+45+(Math.random()-.5)*150,v:100,spin:Math.random()*6.28});
 player.gold+=rand(25,45);
 localStorage.setItem("squareRPG_boss","true");
 saveAchievements();
 paused=true;
 setTimeout(()=>{if(game){paused=false;roomIndex++;nextRoom("treasure")}},450);
}

/* Player & loop */
function updatePlayer(){let dx=0,dy=0;if(keys.w)dy--;if(keys.s)dy++;if(keys.a)dx--;if(keys.d)dx++;const d=Math.hypot(dx,dy);if(d){dx/=d;dy/=d;const m=player.speedTimer>0?1.8:1;const penguinBoost=player.class==="Penguin"?1.12:1;movePlayerCollidable(dx*player.speed*m*penguinBoost,dy*player.speed*m*penguinBoost);if(player.class==="Penguin"){player.penguinSlideX=dx*1.2;player.penguinSlideY=dy*1.2;player.penguinTrailTick++;if(player.penguinTrailTick%7===0&&effects.length<CFG.maxEffects)effects.push({t:"ice",x:player.x+15,y:player.y+25,time:22,max:22})}}else if(player.class==="Penguin"&&(player.penguinSlideX||player.penguinSlideY)){movePlayerCollidable(player.penguinSlideX,player.penguinSlideY);player.penguinSlideX*=.84;player.penguinSlideY*=.84;if(Math.abs(player.penguinSlideX)<.08)player.penguinSlideX=0;if(Math.abs(player.penguinSlideY)<.08)player.penguinSlideY=0}if(player.barrierTimer>0)player.barrierTimer--;if(player.speedTimer>0)player.speedTimer--;if(player.crownTimer>0)player.crownTimer--;if(player.anim.until<performance.now())player.anim.state="idle";tryExitRoom()} 
function update(){
 if(paused||inventoryOpen||choiceOpen)return;
 updatePlayer();
 attackUpdate();
 updateEnemies();
 updateBoss();
 updateShots();
 updateBossShots();
 updateXP();
 updateGold();
 updateItems();
 updateEffects();
 if(player.hp<=0){gameOver();return}
 removeDead();
 if(player.hp<=0)gameOver();
 updateHud();
}
function gameOver(){game=false;paused=false;inventoryOpen=false;choiceOpen=false;document.getElementById("pauseOverlay").style.display="none";document.getElementById("inventarioOverlay").style.display="none";document.getElementById("salaOverlay").style.display="none";document.getElementById("lojaOverlay").style.display="none";document.getElementById("resultadoGameOver").innerHTML=`Você chegou ao <b>nível ${player.level}</b>.<br><br>💀 Derrotados: <b>${player.kills}</b><br>💰 Ouro: <b>${player.gold}</b>`;document.getElementById("gameOverOverlay").style.display="flex";saveAchievements()}
function loop(){if(!game)return;update();draw();requestAnimationFrame(loop)}

/* Pause / Inventory */
function alternarPausa(){if(!game||choiceOpen||inventoryOpen)return;paused=!paused;document.getElementById("pauseOverlay").style.display=paused?"flex":"none"}
function continuarJogo(){paused=false;document.getElementById("pauseOverlay").style.display="none"}
function reiniciarPartida(){document.getElementById("gameOverOverlay").style.display="none";if(player.class)startGame()}
function sairParaMenu(){game=false;document.getElementById("jogo").style.display="none";voltarMenu()}
let categoriaInventarioJogoAtual="resumo";
function abrirInventarioJogo(){if(!game)return;inventoryPausedBefore=paused;inventoryOpen=true;paused=true;document.getElementById("inventarioOverlay").style.display="flex";renderGameInventory()}
function fecharInventarioJogo(){inventoryOpen=false;paused=inventoryPausedBefore;document.getElementById("inventarioOverlay").style.display="none"}
function selecionarCategoriaInventarioJogo(categoria){categoriaInventarioJogoAtual=categoria;document.querySelectorAll(".inventario-jogo-aba").forEach(b=>b.classList.toggle("ativa",b.dataset.categoria===categoria));renderGameInventory()}
function renderGameInventory(){
 const box=document.getElementById("inventarioJogoLista");if(!box)return;
 const portrait=document.getElementById("inventarioJogoRetrato");
 const classe=document.getElementById("inventarioJogoClasse");
 const nivel=document.getElementById("inventarioJogoNivel");
 const principal=document.getElementById("inventarioJogoPrincipal");
 const secundario=document.getElementById("inventarioJogoSecundario");
 const ativo=document.getElementById("inventarioJogoAtivo");
 const ouro=document.getElementById("inventarioJogoOuro");
 const retratos={Guerreiro:"⚔️",Mago:"🔮",Arqueiro:"🏹",Penguin:"🐧"};
 if(portrait)portrait.textContent=retratos[player.class]||"⚔️";
 if(classe)classe.textContent=player.class||"Herói";
 if(nivel)nivel.textContent=`Nível ${player.level}`;
 if(principal)principal.textContent=`🗡️ ${player.weapon||"Nenhum"}${player.secondaryMode?"": " • ATIVO"}`;
 if(secundario)secundario.textContent=`🛡️ ${player.secondary||"Nenhum"}${player.secondaryMode?" • ATIVO":""}`;
 if(ativo)ativo.textContent=`🧪 ${player.active?activeItems[player.active].name:"Nenhum item"}`;
 if(ouro)ouro.textContent=player.gold;
 const card=(t,d,e="")=>`<div class="inventario-card"><strong>${t}</strong><span>${d}</span>${e?`<small>${e}</small>`:""}</div>`;
 let h="";
 if(categoriaInventarioJogoAtual==="resumo"){
  h+=card("⚔️ Principal",player.weapon||"Nenhum",player.secondaryMode?"Principal guardado • F alterna":"Ataque atual");
  h+=card("🛡️ Secundário",player.secondary||"Nenhum",player.secondaryMode?"Ataque atual • F alterna":"Pressione F durante a run");
  h+=card("🧪 Item ativo",player.active?`${activeItems[player.active].icon} ${activeItems[player.active].name}`:"Slot vazio",player.active?"R usa o item":"Encontre um item ativo");
  h+=card("💎 Passivos",player.passives.length?`${player.passives.length} efeito(s)`:"Nenhum","Relíquias e bônus da run");
  h+=card("⭐ Evoluções",player.evolutions.length?`${player.evolutions.length} escolhida(s)`:"Nenhuma","Suas escolhas de level up");
  h+=card("💰 Ouro",String(player.gold),"Usado em lojas e eventos");
 }
 if(categoriaInventarioJogoAtual==="equipamento"){
  h+=card("🗡️ Arma principal",player.weapon||"Nenhuma",`Mestria ${player.weaponMasteryLevel} — ${weaponMasteryName()}${player.secondaryMode?" • F: trocar para principal":" • ATIVA"}`);
  h+=card("🛡️ Arma secundária",player.secondary||"Nenhuma equipada",player.secondaryMode?"ATIVA":"F: trocar para secundário");
  h+=card("⚙️ Controles de troca","F","O sistema mantém o último equipamento escolhido");
 }
 if(categoriaInventarioJogoAtual==="ativos"){
  if(player.active){const a=activeItems[player.active];h+=card(`${a.icon} ${a.name}`,a.rarity,"R usa imediatamente • Q fecha o inventário")}else h+=card("🧪 Slot vazio","Nenhum item ativo","Encontre um em baús, lojas, elites ou eventos");
 }
 if(categoriaInventarioJogoAtual==="passivos"){
  if(player.passives.length)player.passives.forEach(n=>h+=card("💎 Passivo",n,"Ativo durante toda esta run"));
  else h+=card("💎 Nenhum passivo","Você ainda não encontrou passivos","Baús, lojas, eventos e recompensas podem fornecê-los");
 }
 if(categoriaInventarioJogoAtual==="evolucoes"){
  if(player.evolutions.length)player.evolutions.forEach(n=>h+=card("⭐ Evolução",n,"Escolhida durante o level up"));
  else h+=card("⭐ Nenhuma evolução","A primeira aparecerá ao subir de nível","Níveis 5, 10, 20, 25, 35, 45, 55 e 65 têm evoluções especiais");
 }
 box.innerHTML=h||card("Inventário vazio","Nada nesta categoria","Continue explorando a dungeon");
}

/* Status */
function alternarBarraStatus(){barStatusRight=!barStatusRight;const b=document.getElementById("barraStatus");b.classList.toggle("direita",barStatusRight);document.getElementById("posicaoStatusTexto").textContent="Posição: "+(barStatusRight?"Direita":"Esquerda")}
let barStatusRight=false;
function updateStatus(){document.getElementById("statusClasse").textContent=player.class||"Nenhum";document.getElementById("statusNivel").textContent=player.level;document.getElementById("statusVidaBarra").style.width=Math.max(0,player.hp/player.hpMax*100)+"%";document.getElementById("statusXPBarra").style.width=Math.min(100,player.xp/player.xpNext*100)+"%";document.getElementById("statusVidaTexto").textContent=`${Math.ceil(Math.max(0,player.hp))} / ${Math.ceil(player.hpMax)}`;document.getElementById("statusXPTexto").textContent=`${Math.floor(player.xp)} / ${player.xpNext}`;document.getElementById("statusDano").textContent=player.dmg.toFixed(1);document.getElementById("statusDefesa").textContent=Math.round(player.def*100)+"%";document.getElementById("statusVelocidade").textContent=player.speed.toFixed(1);document.getElementById("statusAlcance").textContent=Math.round(player.range);document.getElementById("statusOuro").textContent=player.gold;document.getElementById("statusKills").textContent=player.kills;document.getElementById("statusPrincipal").textContent=(player.weapon||"Nenhum")+` • M${player.weaponMasteryLevel}`+(player.secondaryMode?"":" • ATIVO");document.getElementById("statusSecundario").textContent=(player.secondary||"Nenhum equipado")+(player.secondaryMode?" • ATIVO":"");document.getElementById("inventarioAtivo").textContent=player.active?`🧪 R: ${activeItems[player.active].name}`:player.secondary?`F: ${player.secondaryMode?"Secundário ativo":"Trocar para secundário"}`:"🧪 R: Nenhum item"}
function updateHud(force=false){
 const now=performance.now();
 if(!force&&now-lastHudUpdate<CFG.hudInterval)return;
 lastHudUpdate=now;
 const v=Math.max(0,player.hp/player.hpMax*100),x=Math.min(100,player.xp/player.xpNext*100);
 document.getElementById("informacoes").textContent=`⚔️ ${player.class} | ${player.difficulty==="facil"?"🌿 Fácil":"💀 Difícil"} | 🗡️ ${player.weapon} | ⭐ Nível ${player.level} | 💰 ${player.gold} | 💀 ${player.kills}`;
 document.getElementById("barraVida").style.width=v+"%";
 document.getElementById("barraXP").style.width=x+"%";
 document.getElementById("textoVida").textContent=`❤️ Vida: ${Math.ceil(Math.max(0,player.hp))}/${Math.ceil(player.hpMax)}`;
 document.getElementById("textoXP").textContent=`💠 XP: ${Math.floor(player.xp)}/${player.xpNext}`;
 updateStatus();
}

/* FX */
function explode(x,y,size){if(effects.length>=CFG.maxEffects)return;effects.push({t:"explode",x,y,size,time:20,max:20})}
function slashFx(dx=player.dx,dy=player.dy){if(effects.length>=CFG.maxEffects)return;effects.push({t:"slash",x:player.x+15,y:player.y+15,dx,dy,time:12,max:12})}
function hitFx(x,y){if(effects.length>=CFG.maxEffects)return;effects.push({t:"hit",x,y,time:10,max:10})}
function levelFx(){if(effects.length>=CFG.maxEffects)return;effects.push({t:"level",x:player.x+15,y:player.y+15,time:30,max:30})}
function itemFx(x,y,c){if(effects.length>=CFG.maxEffects)return;effects.push({t:"item",x,y,c,time:24,max:24})}
function updateEffects(){for(let i=effects.length-1;i>=0;i--){effects[i].time--;if(effects[i].time<=0)effects.splice(i,1)}}

/* Draw */
function drawDebugHitboxes(){ctx.save();ctx.lineWidth=1;ctx.strokeStyle="#00ff66";ctx.setLineDash([4,3]);for(const e of enemiesArr){if(e.dead)continue;ctx.strokeRect(e.x+3,e.y+3,e.size-6,e.size-6);}if(boss){ctx.strokeStyle="#ffcc00";ctx.strokeRect(boss.x+8,boss.y+8,boss.size-16,boss.size-16);}ctx.strokeStyle="#4dd9ff";ctx.strokeRect(player.x+4,player.y+8,player.size-8,player.size-8);ctx.restore();}

function drawDebugHitboxes(){ctx.save();ctx.setLineDash([4,3]);ctx.lineWidth=1;ctx.strokeStyle="#00ff66";ctx.strokeRect(player.x+4,player.y+8,player.size-8,player.size-8);for(const e of enemiesArr){if(e.dead)continue;ctx.strokeRect(e.x+3,e.y+3,e.size-6,e.size-6)}if(boss){ctx.strokeStyle="#ffcc00";ctx.strokeRect(boss.x+8,boss.y+8,boss.size-16,boss.size-16)}for(const o of roomObstacles){ctx.strokeStyle="#66ccff";ctx.strokeRect(o.x,o.y,o.w,o.h)}ctx.restore()}

function draw(){drawProceduralRoom();drawDrops();drawGold();drawFloorItems();drawShots();drawBossShots();drawEnemies();drawBoss();drawPlayer();drawEffects();if(debugHitboxes)drawDebugHitboxes();updateHud();updateDebugHud()}
function drawGrid(){ctx.strokeStyle="rgba(164,127,81,.07)";ctx.lineWidth=1;for(let x=0;x<canvas.width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}for(let y=0;y<canvas.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}ctx.strokeStyle="#78522d";ctx.lineWidth=4;ctx.strokeRect(8,8,canvas.width-16,canvas.height-16)}
function drawGold(){for(const g of goldDrops){ctx.save();ctx.translate(g.x,g.y);const r=7+Math.sin(g.spin)*1.5;ctx.fillStyle="#e4bd49";ctx.strokeStyle="#fff0a0";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font="9px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#5a4310";ctx.fillText("G",0,0);ctx.restore()}}
function drawDrops(){for(const p of xpDrops){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillStyle="#8065d5";ctx.shadowColor="#a78aff";ctx.shadowBlur=10;ctx.fillRect(-5,-5,10,10);ctx.restore()}}
function drawFloorItems(){for(const it of floorItems){const d=it.kind==="active"?activeItems[it.id]:passiveItems[it.id];if(!d)continue;ctx.save();ctx.translate(it.x,it.y);ctx.beginPath();ctx.arc(0,0,it.size+Math.sin(it.spin)*3,0,Math.PI*2);ctx.strokeStyle=d.color;ctx.shadowColor=d.color;ctx.shadowBlur=13;ctx.lineWidth=3;ctx.stroke();ctx.font="23px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(it.kind==="active"?d.icon:"🎁",0,0);ctx.restore()}}
function drawWeaponOverlay(cx,cy){
 const data=player.secondaryMode?player.secondaryData:null;
 const attack=player.anim.state==="attack"||player.anim.state==="secondaryAttack";
 const switchFx=player.anim.state==="switch";
 const dx=player.dx,dy=player.dy;
 ctx.save();
 ctx.translate(cx,cy);
 ctx.strokeStyle="#e8c978";
 ctx.fillStyle="#d7bd74";
 ctx.lineCap="square";
 ctx.lineWidth=4;
 if(player.secondaryMode&&data){
   ctx.strokeStyle="#91dff2";
   if(data.type==="shieldBash"){ctx.fillStyle="#6f8fa8";ctx.fillRect(dx*12-9,dy*12-9,18,18);if(attack){ctx.beginPath();ctx.moveTo(dx*8,dy*8);ctx.lineTo(dx*34,dy*34);ctx.stroke();}}
   else if(data.type==="spear"){ctx.beginPath();ctx.moveTo(dx*8,dy*8);ctx.lineTo(dx*(attack?62:38),dy*(attack?62:38));ctx.stroke();ctx.beginPath();ctx.moveTo(dx*62,dy*62);ctx.lineTo(dx*50,dy*56);ctx.lineTo(dx*50,dy*68);ctx.closePath();ctx.fill();}
   else if(data.type==="chain"){ctx.beginPath();ctx.arc(dx*26,dy*26,14,0,Math.PI*1.7);ctx.stroke();}
   else if(data.type==="warHammer"){ctx.fillStyle="#725b4a";ctx.fillRect(dx*(attack?28:22)-4,dy*(attack?28:22)-16,8,32);ctx.fillStyle="#b4a7a0";ctx.fillRect(dx*(attack?28:22)-12,dy*(attack?28:22)-18,24,10);}
   else if(data.type==="arcanePulse"){ctx.strokeStyle="#c68cff";ctx.beginPath();ctx.arc(0,0,attack?38:20,0,Math.PI*2);ctx.stroke();}
   else if(data.type==="magicMirror"){ctx.strokeStyle="#a9e3ef";ctx.strokeRect(dx*16-8,dy*16-11,16,22);}
   else if(data.type==="teleRune"){ctx.strokeStyle="#9d8cff";ctx.strokeRect(dx*22-9,dy*22-9,18,18);}
   else if(data.type==="thunderStaff"){ctx.strokeStyle="#f2d95f";ctx.beginPath();ctx.moveTo(dx*8,dy*8);ctx.lineTo(dx*(attack?48:34),dy*(attack?48:34));ctx.stroke();}
   else if(data.type==="trap"){ctx.strokeStyle="#bd9970";ctx.strokeRect(dx*24-9,dy*24-9,18,18);}
   else if(data.type==="boomerang"){ctx.strokeStyle="#d8a15b";ctx.beginPath();ctx.arc(dx*25,dy*25,15,-1.2,1.2);ctx.stroke();}
   else if(data.type==="hunterBomb"){ctx.fillStyle="#e36e42";ctx.beginPath();ctx.arc(dx*28,dy*28,9,0,Math.PI*2);ctx.fill();}
   else if(data.type==="hawk"){ctx.fillStyle="#d6bc7a";ctx.beginPath();ctx.moveTo(dx*28,dy*28);ctx.lineTo(dx*14+12,dy*14-8);ctx.lineTo(dx*14-8,dy*14+10);ctx.closePath();ctx.fill();}
   else if(data.type==="iceDash"){ctx.strokeStyle="#aeeeff";ctx.beginPath();ctx.moveTo(dx*10,dy*10);ctx.lineTo(dx*52,dy*52);ctx.stroke();}
   else if(data.type==="snowDrum"){ctx.strokeStyle="#b7efff";ctx.beginPath();ctx.arc(0,0,attack?46:26,0,Math.PI*2);ctx.stroke();}
   else if(data.type==="fishCannon"){ctx.font="20px Arial";ctx.fillText("🐟",dx*34,dy*34);}
   else if(data.type==="polarCube"){ctx.strokeStyle="#aeeeff";ctx.strokeRect(dx*28-14,dy*28-14,28,28);}
 } else {
   ctx.strokeStyle="#e8c978";
   const len=attack?48:32;
   if(player.class==="Guerreiro"){ctx.beginPath();ctx.moveTo(dx*10,dy*10);ctx.lineTo(dx*len,dy*len);ctx.stroke();}
   else if(player.class==="Mago"){ctx.beginPath();ctx.moveTo(dx*10,dy*10);ctx.lineTo(dx*(attack?42:30),dy*(attack?42:30));ctx.stroke();ctx.fillStyle="#9c77df";ctx.beginPath();ctx.arc(dx*(attack?48:32),dy*(attack?48:32),attack?7:5,0,Math.PI*2);ctx.fill();}
   else if(player.class==="Arqueiro"){ctx.strokeStyle="#bd8e56";ctx.beginPath();ctx.arc(dx*18,dy*18,17,-1.1,1.1);ctx.stroke();if(attack){ctx.strokeStyle="#eee";ctx.beginPath();ctx.moveTo(dx*8,dy*8);ctx.lineTo(dx*46,dy*46);ctx.stroke();}}
   else if(player.class==="Penguin"){ctx.font="19px Arial";ctx.fillText("🐟",dx*30,dy*30);}
 }
 if(switchFx){ctx.strokeStyle="#f3dc86";ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(0,0,32,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}

function drawPlayer(){
 const cx=player.x+player.size/2, cy=player.y+player.size/2;
 ctx.fillStyle="rgba(0,0,0,.35)";ctx.beginPath();ctx.ellipse(cx,player.y+player.size+3,Math.max(12,player.size*.55),6,0,0,Math.PI*2);ctx.fill();
 let used=false;
 if(window.SquareRPGSpriteEngine) used=window.SquareRPGSpriteEngine.drawPlayer(ctx,player);
 if(!used){
  if(player.class==="Penguin") drawPenguinSprite(cx,cy);
  else{
   ctx.fillStyle=classes[player.class].color;
   ctx.fillRect(player.x,player.y,player.size+(player.anim.state==="attack"?2:0),player.size);
   ctx.fillStyle="#d7cdbb";ctx.fillRect(player.x+6,player.y+1,18,8);
   ctx.fillStyle="#17110d";ctx.fillRect(player.x+8,player.y+9,4,4);ctx.fillRect(player.x+18,player.y+9,4,4);
  }
  ctx.strokeStyle="#f5d88c";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+player.dx*24,cy+player.dy*24);ctx.stroke();
 }
 if(player.barrierTimer>0){ctx.beginPath();ctx.arc(cx,cy,25,0,Math.PI*2);ctx.strokeStyle="#60aaff";ctx.lineWidth=4;ctx.stroke();}
 if(player.crownTimer>0){ctx.font="18px Arial";ctx.textAlign="center";ctx.fillText("👑",cx,player.y-8);}
 drawWeaponOverlay(cx,cy);
}
function drawPenguinSprite(cx,cy){const bob=Math.sin(performance.now()*0.01)*1.2;const attack=player.anim.state==="attack";ctx.save();ctx.translate(0,bob);ctx.fillStyle="#18232b";ctx.fillRect(player.x+4,player.y+5,22,22);ctx.fillStyle="#eef8fb";ctx.fillRect(player.x+8,player.y+9,14,16);ctx.fillStyle="#0f161b";ctx.fillRect(player.x+7,player.y+4,16,7);ctx.fillStyle="#e7fbff";ctx.fillRect(player.x+10,player.y+1,10,6);ctx.fillStyle="#f0b64a";ctx.fillRect(player.x+13,player.y+10,6,4);ctx.fillRect(player.x+8,player.y+26,6,3);ctx.fillRect(player.x+17,player.y+26,6,3);if(player.penguinChill){ctx.strokeStyle="rgba(168,232,255,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,25+Math.sin(performance.now()*0.008)*2,0,Math.PI*2);ctx.stroke()}if(attack){ctx.fillStyle="#b8efff";ctx.fillRect(player.x+25,player.y+12,7,4)}ctx.restore()}
function drawEnemies(){for(const e of enemiesArr){const d=enemies[e.type],cx=e.x+e.size/2;ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(cx,e.y+e.size,e.size/2,6,0,0,Math.PI*2);ctx.fill();let used=false;if(window.SquareRPGSpriteEngine){used=window.SquareRPGSpriteEngine.drawEnemy(ctx,e)}if(!used){ctx.fillStyle=e.hit>0?"#fff":d.color;ctx.fillRect(e.x,e.y,e.size,e.size)}const hp=Math.max(0,e.hp/e.hpMax);ctx.fillStyle="#351714";ctx.fillRect(e.x,e.y-8,e.size,5);ctx.fillStyle="#bc3c35";ctx.fillRect(e.x,e.y-8,e.size*hp,5);if(e.freeze>0){ctx.strokeStyle="#aeeeff";ctx.lineWidth=2;ctx.strokeRect(e.x-2,e.y-2,e.size+4,e.size+4)}}}
function drawBoss(){if(!boss)return;const cx=boss.x+45;ctx.fillStyle="rgba(0,0,0,.4)";ctx.beginPath();ctx.ellipse(cx,boss.y+90,45,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=boss.phase===3?"#9b3242":"#793334";ctx.fillRect(boss.x,boss.y,90,90);ctx.font="26px Arial";ctx.textAlign="center";ctx.fillText("👑",cx,boss.y-8)}
function pcolor(t){return{fogo:"#ef7037",agua:"#4d9ae3",terra:"#967252",ar:"#dceee9",teleguiada:"#e8c549",perfurante:"#d7d0c6",explosiva:"#e36e36",peixe:"#f2ca55",polar:"#b6efff",arcano:"#c88cff",multipla:"#d6d0c8"}[t]||"#ddd3bd"}
function drawShots(){for(const p of shots){ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,p.size/2,0,Math.PI*2);ctx.fillStyle=pcolor(p.type);ctx.shadowColor=pcolor(p.type);ctx.shadowBlur=9;ctx.fill();ctx.restore()}}
function drawBossShots(){for(const p of bossShots){ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,p.size/2,0,Math.PI*2);ctx.fillStyle="#b83de0";ctx.shadowColor="#d55cff";ctx.shadowBlur=13;ctx.fill();ctx.restore()}}
function drawEffects(){for(const f of effects){const q=f.time/f.max;ctx.save();if(f.t==="explode"){ctx.beginPath();ctx.arc(f.x,f.y,f.size*(1-q),0,Math.PI*2);ctx.strokeStyle=`rgba(232,108,51,${q})`;ctx.lineWidth=5;ctx.stroke()}else if(f.t==="slash"){ctx.translate(f.x,f.y);ctx.rotate(Math.atan2(f.dy,f.dx));ctx.beginPath();ctx.arc(0,0,45+player.area,-.8,.8);ctx.strokeStyle=`rgba(245,211,132,${q})`;ctx.lineWidth=6;ctx.stroke()}else if(f.t==="ice"){ctx.fillStyle=`rgba(181,239,255,${q})`;ctx.fillRect(f.x-4,f.y-2,8,4);ctx.fillRect(f.x-2,f.y-5,4,10)}else if(f.t==="hit"){ctx.beginPath();ctx.arc(f.x,f.y,10+(1-q)*10,0,Math.PI*2);ctx.strokeStyle=`rgba(210,61,45,${q})`;ctx.lineWidth=3;ctx.stroke()}else if(f.t==="level"){ctx.beginPath();ctx.arc(f.x,f.y,25+(1-q)*55,0,Math.PI*2);ctx.strokeStyle=`rgba(229,187,97,${q})`;ctx.lineWidth=4;ctx.stroke()}else if(f.t==="mastery"){ctx.beginPath();ctx.arc(f.x,f.y,18+(1-q)*42,0,Math.PI*2);ctx.strokeStyle=`rgba(190,215,245,${q})`;ctx.lineWidth=3;ctx.stroke()}ctx.restore()}}

/* Keyboard */
window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();keys[k]=true;if(k==="escape"){if(inventoryOpen)fecharInventarioJogo();else if(!terminalOpen&&!choiceOpen)alternarPausa()}if(k==="q"&&game){if(inventoryOpen)fecharInventarioJogo();else abrirInventarioJogo()}if(k==="r"&&game)useActive();if(k==="f"&&game){toggleSecondary();}if(["1","2","3"].includes(k)&&choiceOpen&&window._evo)applyEvolution(window._evo[Number(k)-1]);if(k==="0")toggleTerminal()});
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

/* Konami */
const konami=["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];let kp=0;
window.addEventListener("keydown",e=>{const menu=document.getElementById("menuClasse");if(!menu||menu.style.display==="none")return;const k=e.key.toLowerCase();if(k===konami[kp]){kp++;document.getElementById("konamiMensagem").textContent=`Código secreto: ${kp}/${konami.length}`;if(kp===konami.length){localStorage.setItem("squareRPG_penguin","true");kp=0;document.getElementById("konamiMensagem").textContent="🐧 PENGUIN DESBLOQUEADO!";showPenguin();}}else{kp=0;document.getElementById("konamiMensagem").textContent=""}});

/* Terminal */
function syncDebugHud(){const hud=document.getElementById("debugHud");const status=document.getElementById("debugStatus");if(!hud)return;hud.classList.toggle("on",debugMode);if(status)status.textContent=debugMode?"ON":"OFF";}
function updateDebugHud(){if(!debugMode)return;const now=performance.now();debugFrameCount++;if(now-debugFpsTime>=1000){debugFps=Math.round(debugFrameCount*1000/(now-debugFpsTime));debugFrameCount=0;debugFpsTime=now;}const lines=[`FPS: ${debugFps}`,`ROOM: ${roomIndex} • ${roomType}`,`SEED: ${roomSeed>>>0}`,`PLAYER: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`,`HP: ${Math.ceil(player.hp)}/${Math.ceil(player.hpMax)} | LVL: ${player.level} | XP: ${Math.floor(player.xp)}/${player.xpNext}`,`DIFFICULTY: ${player.difficulty} | DMG: ${player.dmg.toFixed(1)} | CD: ${Math.round(player.cd)}ms`,`WEAPON: ${player.weapon} | MASTERY: ${player.weaponMasteryLevel} ${weaponMasteryName()} (${player.weaponMastery}/${player.weaponMasteryNext})`,`DIR: ${player.dx}, ${player.dy} | MODE: ${player.secondaryMode?"SECONDARY":"PRIMARY"}`,`ENEMIES: ${enemiesArr.length}/${CFG.maxEnemies}`,`SHOTS: ${shots.length}/${CFG.maxProjectiles} | BOSS SHOTS: ${bossShots.length}/${CFG.maxBossProjectiles}`,`XP DROPS: ${xpDrops.length} | GOLD: ${goldDrops.length}`,`FLOOR ITEMS: ${floorItems.length} | EFFECTS: ${effects.length}/${CFG.maxEffects}`,`BOSS: ${boss?boss.name+" | "+Math.ceil(boss.hp)+" HP":"none"}`,`FLAGS: hitbox=${debugHitboxes} ai=${debugAI} god=${player.god}`];const el=document.getElementById("debugHudBody");if(el)el.textContent=lines.join("\n");}
const termRoot=document.getElementById("devTerminal"),termHist=document.getElementById("terminalHistorico"),termInput=document.getElementById("terminalInput");
function toggleTerminal(){
 terminalOpen=!terminalOpen;
 termRoot.style.display=terminalOpen?"flex":"none";
 if(terminalOpen){terminalPausedBefore=paused;paused=true;termInput.focus()}
 else{paused=terminalPausedBefore}
}
function termPrint(t,cls=""){const d=document.createElement("div");d.className="terminalLinha "+cls;d.textContent=t;termHist.appendChild(d);termHist.scrollTop=termHist.scrollHeight}
function terminalHelp(){["help","clear","debug","hitbox","ai","noclip","roominfo","clearshots","godmode","heal","xp 500","level 10","spawn goblin","spawn orc","spawn troll","boss","killall","killboss","item heal","item bomb","coins 100","damage 100","speed 8","cd 100","reach 300","penguin","status","restart","close"].forEach(x=>termPrint(x,"terminalInfo"))}
function terminalCmd(){const text=termInput.value.trim();if(!text)return;terminalHist.push(text);termIdx=terminalHist.length;termPrint("> "+text,"terminalComando");termInput.value="";const [cmd,...a]=text.split(/\s+/);switch(cmd.toLowerCase()){case"help":terminalHelp();break;case"clear":termHist.innerHTML="";break;case"godmode":player.god=!player.god;termPrint(player.god?"GOD MODE ON":"GOD MODE OFF","terminalSucesso");break;case"debug":debugMode=!debugMode;syncDebugHud();termPrint(debugMode?"DEBUG HUD ON":"DEBUG HUD OFF","terminalSucesso");break;case"hitbox":debugHitboxes=!debugHitboxes;termPrint(debugHitboxes?"HITBOXES ON":"HITBOXES OFF","terminalSucesso");break;case"ai":debugAI=!debugAI;termPrint(debugAI?"AI DEBUG ON":"AI DEBUG OFF","terminalSucesso");break;case"noclip":debugInvulnerable=!debugInvulnerable;player.god=debugInvulnerable;termPrint(debugInvulnerable?"NOCLIP/GOD ON":"NOCLIP/GOD OFF","terminalSucesso");break;case"roominfo":termPrint(`Sala ${roomIndex} | tipo ${roomType} | seed ${roomSeed>>>0} | inimigos ${enemiesArr.length}`,"terminalInfo");break;case"clearshots":shots.length=0;bossShots.length=0;effects.length=Math.min(effects.length,20);termPrint("Projéteis e excesso de efeitos limpos.","terminalSucesso");break;case"heal":player.hp=player.hpMax;break;case"xp":gainXP(Number(a[0])||0);break;case"level":player.level=Math.max(1,Math.min(65,Number(a[0])||1));player.xpNext=xpReq(player.level);break;case"spawn":spawnEnemy(a[0]);break;case"boss":spawnBoss();break;case"killall":enemiesAlive().forEach(e=>e.dead=true);break;case"killboss":if(boss)boss.hp=0;break;case"item":if(activeItems[a[0]])player.active=a[0];else if(passiveItems[a[0]]){passiveItems[a[0]].apply();player.passives.push(passiveItems[a[0]].name)}break;case"coins":player.gold+=Number(a[0])||0;break;case"damage":player.dmg=Number(a[0])||player.dmg;break;case"speed":player.speed=Number(a[0])||player.speed;break;case"cd":player.cd=Number(a[0])||player.cd;break;case"reach":player.range=Number(a[0])||player.range;break;case"penguin":localStorage.setItem("squareRPG_penguin","true");showPenguin();break;case"status":termPrint(`Nível ${player.level} | HP ${Math.ceil(player.hp)}/${Math.ceil(player.hpMax)} | Dano ${player.dmg.toFixed(1)} | Ouro ${player.gold} | Kills ${player.kills}`,"terminalInfo");break;case"restart":toggleTerminal();startGame();break;case"close":case"exit":toggleTerminal();break;default:termPrint("Comando desconhecido.","terminalErro")}}
document.getElementById("terminalFechar").onclick=toggleTerminal;termInput.addEventListener("keydown",e=>{if(e.key==="Enter")terminalCmd()});

/* Initialize */
function boot(){voltarMenu();updateAchievements();updateCharacterMenu();updateHud(true);updateMiniMap()}
boot();


syncDebugHud();

/* =========================================================
   MENU CÊNICO — V12
========================================================= */
(function aplicarMenuCenico() {
    const menu = document.getElementById("menuInicial");
    if (!menu) return;
    document.body.classList.add("menu-cena-ativa");
})();


/* =========================================================
   V13 — CURSOR DO MENU / NAVEGAÇÃO POR TECLADO
========================================================= */
(function inicializarCursorMenu() {
    const menu = document.getElementById("menuInicial");
    if (!menu) return;

    const botoes = Array.from(
        menu.querySelectorAll(".menu-botoes button")
    );
    const descricao = document.getElementById("menuDescricaoSelecao");

    let indice = 0;

    function menuVisivel() {
        return menu.style.display !== "none" && !game;
    }

    function selecionar(i, moverFoco = false) {
        if (!botoes.length) return;
        indice = (i + botoes.length) % botoes.length;

        botoes.forEach((botao, n) => {
            botao.classList.toggle("menu-selecionado", n === indice);
            botao.setAttribute("aria-current", n === indice ? "true" : "false");
        });

        const texto = botoes[indice].dataset.menuDesc || "";
        if (descricao) descricao.textContent = texto;

        if (moverFoco) botoes[indice].focus({ preventScroll: true });
    }

    function ativarAtual() {
        const botao = botoes[indice];
        if (botao) botao.click();
    }

    botoes.forEach((botao, i) => {
        botao.addEventListener("mouseenter", () => {
            if (!menuVisivel()) return;
            selecionar(i, false);
        });

        botao.addEventListener("focus", () => {
            if (!menuVisivel()) return;
            const pos = botoes.indexOf(botao);
            if (pos >= 0) selecionar(pos, false);
        });
    });

    document.addEventListener("keydown", evento => {
        if (!menuVisivel()) return;

        const alvo = document.activeElement;
        const digitando = alvo && ["INPUT", "TEXTAREA"].includes(alvo.tagName);
        if (digitando) return;

        if (evento.key === "ArrowDown") {
            evento.preventDefault();
            evento.stopPropagation();
            selecionar(indice + 1, true);
            return;
        }

        if (evento.key === "ArrowUp") {
            evento.preventDefault();
            evento.stopPropagation();
            selecionar(indice - 1, true);
            return;
        }

        if (evento.key === "Enter" || evento.key === " ") {
            if (evento.key === " ") evento.preventDefault();
            evento.stopPropagation();
            ativarAtual();
        }
    }, true);

    selecionar(0, false);
})();


/* =========================================================
   V16 — SECUNDÁRIAS COMPLETAS + INVENTÁRIO POR CATEGORIAS
   Camada de compatibilidade sobre a base V15.
========================================================= */
(function(){
  const oldResetPlayer = resetPlayer;
  const oldOpenEvolution = openEvolution;
  const oldApplyEvolution = applyEvolution;

  if(!Array.isArray(player.secondaryHistory)) player.secondaryHistory=[];

  function equipSecondaryV16(opt, keepPrevious=true){
    if(!opt) return false;
    if(keepPrevious && player.secondaryData && player.secondaryData.name!==opt.name){
      if(!Array.isArray(player.secondaryHistory)) player.secondaryHistory=[];
      player.secondaryHistory.push(player.secondaryData.name);
    }
    player.secondary=opt.name;
    player.secondaryData={...opt,cooldown:secondaryCooldown(opt.type),lastUse:0};
    player.secondaryMode=false;
    return true;
  }

  function randomSecondaryV16(excludeName=""){
    const pool=(secondaryCatalog[player.class]||[]).filter(x=>x.name!==excludeName);
    return pool.length ? pool[Math.floor(Math.random()*pool.length)] : null;
  }

  window.squareRPGEquipSecondary=equipSecondaryV16;

  resetPlayer=function(){
    const wanted=player.startingSecondary||null;
    const diff=player.difficulty;
    player.startingSecondary=null;
    oldResetPlayer();
    player.difficulty=diff;
    player.secondaryHistory=[];
    if(wanted){
      equipSecondaryV16(wanted,false);
    }
    /* Difícil também começa com principal + uma secundária aleatória. */
    if(!player.secondaryData){
      const opt=randomSecondaryV16("");
      if(opt) equipSecondaryV16(opt,false);
    }
    if(player.class==="Penguin"){
      player.penguinChill=true;
      player.penguinEasterEgg=true;
    }
  };

  /* Drops de secundária em inimigos. */
  dropLoot=function(e){
    const passChance=e.type==="troll"?.20:e.type==="orc"?.09:.025;
    const activeChance=e.type==="troll"?.13:e.type==="orc"?.05:.012;
    const secondaryChance=e.type==="troll"?.18:e.type==="orc"?.07:e.type==="goblinGuerreiro"?.035:.008;
    if(Math.random()<passChance){
      const id=shuffle(Object.keys(passiveItems))[0];
      floorItems.push({kind:"passive",id,x:e.x+e.size/2,y:e.y+e.size/2,size:20,spin:0});
    }
    if(Math.random()<activeChance){
      const id=shuffle(Object.keys(activeItems))[0];
      floorItems.push({kind:"active",id,x:e.x+e.size/2,y:e.y+e.size/2,size:22,spin:0});
    }
    if(Math.random()<secondaryChance){
      const opt=randomSecondaryV16(player.secondary);
      if(opt) floorItems.push({kind:"secondary",data:opt,x:e.x+e.size/2,y:e.y+e.size/2,size:23,spin:0});
    }
  };

  /* Coleta de secundárias no chão. */
  const baseUpdateItems = updateItems;
  updateItems=function(){
    for(let i=floorItems.length-1;i>=0;i--){
      const it=floorItems[i];
      if(it.kind!=="secondary") continue;
      it.spin=(it.spin||0)+.08;
      const dx=player.x+15-it.x, dy=player.y+15-it.y, d=Math.hypot(dx,dy)||1;
      if(d<110){it.x+=dx/d*1.5;it.y+=dy/d*1.5;}
      if(d<28){
        equipSecondaryV16(it.data,true);
        itemFx(it.x,it.y,it.data.color||"#d7bd74");
        floorItems.splice(i,1);
      }
    }
    baseUpdateItems();
  };

  /* Desenho de secundárias no chão. */
  const baseDrawFloorItems=drawFloorItems;
  drawFloorItems=function(){
    baseDrawFloorItems();
    for(const it of floorItems){
      if(it.kind!=="secondary"||!it.data) continue;
      ctx.save();
      ctx.translate(it.x,it.y);
      ctx.strokeStyle=it.data.color||"#d7bd74";
      ctx.shadowColor=it.data.color||"#d7bd74";
      ctx.shadowBlur=15;
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.arc(0,0,it.size+Math.sin(it.spin||0)*3,0,Math.PI*2);
      ctx.stroke();
      ctx.font="23px Arial";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText(it.data.icon||"⚔️",0,0);
      ctx.restore();
    }
  };

  /* Tesouro: pode oferecer secundária. */
  spawnTreasure=function(){
    transitioningRoom=false;paused=true;
    const choices=[];
    while(choices.length<3){
      const roll=Math.random();
      if(roll<.34){
        const opt=randomSecondaryV16(player.secondary);
        if(opt) choices.push({type:"secondary",data:opt});
      }else if(roll<.67){
        const id=shuffle(Object.keys(activeItems))[0];
        choices.push({type:"active",id});
      }else{
        const id=shuffle(Object.keys(passiveItems))[0];
        choices.push({type:"passive",id});
      }
    }
    document.getElementById("salaTitulo").textContent="💰 Tesouro";
    document.getElementById("salaDescricao").textContent="Escolha uma recompensa. Secundárias encontradas aqui podem substituir a equipada.";
    const box=document.getElementById("salaOpcoes");box.innerHTML="";
    choices.forEach(c=>{
      const data=c.type==="active"?activeItems[c.id]:c.type==="passive"?passiveItems[c.id]:c.data;
      const card=document.createElement("div");card.className="sala-opcao";
      const icon=c.type==="active"?data.icon:c.type==="secondary"?(data.icon||"⚔️"):"🎁";
      const label=c.type==="secondary"?"Arma secundária":c.type==="active"?data.rarity:"Relíquia passiva";
      card.innerHTML=`<strong>${icon} ${data.name}</strong><span>${label}</span><small>${data.desc||"Recompensa da sala."}</small>`;
      card.onclick=()=>{
        if(c.type==="active") player.active=c.id;
        else if(c.type==="secondary") equipSecondaryV16(data,true);
        else {data.apply();player.passives.push(data.name);}
        document.getElementById("salaOverlay").style.display="none";
        paused=false;roomIndex++;nextProceduralRoom();
      };
      box.appendChild(card);
    });
    document.getElementById("salaOverlay").style.display="flex";
  };

  /* Loja: inclui secundárias. */
  openShop=function(){
    transitioningRoom=false;paused=true;shopStock=[];
    for(let i=0;i<5;i++){
      const roll=Math.random();let kind,id,data,base;
      if(roll<.34){
        const opt=randomSecondaryV16(player.secondary);
        if(!opt){i--;continue;}
        kind="secondary";data=opt;
        base={Comum:45,Raro:70,Épico:110,Lendário:150,Secreto:160}[opt.rarity]||70;
      }else if(roll<.67){
        kind="active";id=shuffle(Object.keys(activeItems))[0];data=activeItems[id];base=({Comum:18,Raro:35,Épico:60,Lendário:100}[data.rarity]||45);
      }else{
        kind="passive";id=shuffle(Object.keys(passiveItems))[0];data=passiveItems[id];base=35;
      }
      shopStock.push({kind,id,data,price:Math.max(1,Math.floor((base+roomIndex*3)*(player.class==="Penguin"?.85:1)))});
    }
    renderShop();document.getElementById("lojaOverlay").style.display="flex";
  };

  renderShop=function(){
    const box=document.getElementById("lojaItens");box.innerHTML="";
    shopStock.forEach((item,i)=>{
      const c=document.createElement("div");c.className="loja-item";
      const icon=item.kind==="active"?item.data.icon:item.kind==="secondary"?(item.data.icon||"⚔️"):"🎁";
      const type=item.kind==="secondary"?"Arma secundária":item.kind==="active"?item.data.rarity:"Relíquia passiva";
      c.innerHTML=`<strong>${icon} ${item.data.name}</strong><span>${type}</span><span class="preco">💰 ${item.price}</span><button>${player.gold>=item.price?"Comprar":"Sem ouro"}</button>`;
      c.querySelector("button").onclick=()=>buyShop(i);
      box.appendChild(c);
    });
  };

  buyShop=function(i){
    const item=shopStock[i];
    if(!item||player.gold<item.price)return;
    player.gold-=item.price;
    if(item.kind==="active") player.active=item.id;
    else if(item.kind==="secondary") equipSecondaryV16(item.data,true);
    else {item.data.apply();player.passives.push(item.data.name);}
    shopStock.splice(i,1);renderShop();updateHud(true);
  };

  /* Level up pode oferecer uma nova secundária como uma das três cartas. */
  openEvolution=function(special){
    choiceOpen=true;paused=true;
    document.getElementById("tituloEvolucao").textContent=special?`👑 NÍVEL ${player.level} — EVOLUÇÃO ESPECIAL`:`⭐ NÍVEL ${player.level}`;
    document.getElementById("descricaoEvolucao").textContent="Escolha com o mouse ou pressione 1, 2 ou 3.";
    const box=document.getElementById("opcoesEvolucao");box.innerHTML="";
    let arr=special?specialUpgrades():normalUpgrades();
    if(!special&&Math.random()<.30){
      const opt=randomSecondaryV16(player.secondary);
      if(opt)arr=[{name:`${opt.icon||"⚔️"} ${opt.name}`,desc:`Novo secundário: ${opt.desc}`,effect:"secondaryPick",data:opt},...arr];
    }
    arr=arr.slice(0,3);window._evo=arr;
    arr.forEach((o,i)=>{
      const c=document.createElement("div");c.className="evolucao-card";
      c.innerHTML=`<span class="numero-evolucao">[${i+1}]</span><strong>${o.name}</strong><span>${o.desc}</span>`;
      c.onclick=()=>applyEvolution(o);box.appendChild(c);
    });
    document.getElementById("evolucaoOverlay").style.display="flex";
  };

  applyEvolution=function(o){
    if(o&&o.effect==="secondaryPick"){
      player.evolutions.push(o.name);
      equipSecondaryV16(o.data,true);
      choiceOpen=false;paused=false;
      document.getElementById("evolucaoOverlay").style.display="none";
      if(player.level<65&&player.xp>=player.xpNext){player.xp-=player.xpNext;levelUp();}
      return;
    }
    oldApplyEvolution(o);
  };

  /* Recompensa de chefão: secundária garantida como uma das recompensas implícitas. */
  const oldDefeatBoss=defeatBoss;
  defeatBoss=function(){
    if(!boss)return;
    const b=boss;
    oldDefeatBoss();
    const opt=randomSecondaryV16(player.secondary);
    if(opt && !itensNoChao){ /* proteção de compatibilidade */ }
    if(opt) floorItems.push({kind:"secondary",data:opt,x:canvas.width/2,y:canvas.height/2,size:24,spin:0});
  };

  /* Debug: item <id> também consegue equipar secundária por nome normalizado. */
  const oldTerminalCmd=terminalCmd;
  terminalCmd=function(){
    const text=termInput.value.trim();
    if(/^item\s+/i.test(text)){
      const a=text.split(/\s+/);const key=(a[1]||"").toLowerCase().replace(/\s+/g,"_");
      const opt=(secondaryCatalog[player.class]||[]).find(x=>x.name.toLowerCase().replace(/\s+/g,"_")===key);
      if(opt){
        terminalHist.push(text);termIdx=terminalHist.length;termPrint("> "+text,"terminalComando");termInput.value="";equipSecondaryV16(opt,true);termPrint("Secundária equipada: "+opt.name,"terminalSucesso");return;
      }
    }
    oldTerminalCmd();
  };
})();



/* =========================================================
   V20 — COMBATE REFINADO / HITBOX E I-FRAMES
========================================================= */
player.invulnUntil = player.invulnUntil || 0;
player.lastDamageTime = player.lastDamageTime || 0;
player.critChance = player.critChance || 0.05;
player.critMultiplier = player.critMultiplier || 1.55;
player.attackPulse = player.attackPulse || 0;
player.attackHitCount = player.attackHitCount || 0;

(function V20CombatLayer(){
  const oldReset = resetPlayer;
  resetPlayer = function(){
    oldReset();
    player.invulnUntil=0;
    player.lastDamageTime=0;
    player.critChance=.05;
    player.critMultiplier=1.55;
    player.attackPulse=0;
    player.attackHitCount=0;
  };

  const oldAttack = attack;
  attack = function(){
    const before=player.attackHitCount;
    oldAttack();
    if(player.attackHitCount===before && player.anim.state!=='idle') player.attackHitCount++;
  };

  const originalUpdateEnemies = updateEnemies;
  updateEnemies = function(){
    const hpBefore=player.hp;
    originalUpdateEnemies();
    if(player.hp<hpBefore){
      const now=performance.now();
      player.invulnUntil=now+320;
      player.lastDamageTime=now;
      player.anim.state='hurt';
      player.anim.until=now+180;
      hitFx(player.x+15,player.y+15);
    }
  };

  const originalDamage=damage;
  damage=function(e,n){
    if(!e||e.dead)return;
    let final=n;
    if(Math.random()<player.critChance){
      final*=player.critMultiplier;
      e.criticalHit=10;
    }
    originalDamage(e,final);
  };
})();



/* =========================================================
   V21 — SISTEMA DE ANIMAÇÕES TEMPORÁRIAS POR ARMA
========================================================= */
(function V21AnimationLayer(){
  drawWeaponOverlay = function(cx,cy){
    const activeSecondary=player.secondaryMode&&player.secondaryData;
    const attack=player.anim.state==='attack' || player.anim.state==='secondaryAttack';
    const hurt=player.anim.state==='hurt';
    const t=Math.max(0,Math.min(1,(player.anim.until-performance.now())/320));
    const swing=1-t;
    ctx.save();
    ctx.translate(cx,cy);
    const dx=player.dx,dy=player.dy;
    const ang=Math.atan2(dy,dx);
    ctx.lineCap='round';
    ctx.lineJoin='round';
    if(hurt){
      ctx.strokeStyle='#f0b0a2';ctx.lineWidth=3;ctx.globalAlpha=.8;
      ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.stroke();
      ctx.restore();return;
    }
    if(activeSecondary){
      const d=player.secondaryData;
      ctx.strokeStyle='#9bdff0';ctx.fillStyle='#b9e9f3';ctx.lineWidth=4;
      if(d.type==='shieldBash'){
        ctx.fillStyle='#71899b';ctx.fillRect(dx*16-10,dy*16-11,20,22);
        if(attack){ctx.strokeStyle='#d8f4ff';ctx.beginPath();ctx.arc(dx*(26+14*swing),dy*(26+14*swing),12,-1.2,1.2);ctx.stroke();}
      }else if(d.type==='spear'){
        const l=attack?65:40;ctx.beginPath();ctx.moveTo(dx*8,dy*8);ctx.lineTo(dx*l,dy*l);ctx.stroke();
        ctx.beginPath();ctx.moveTo(dx*l,dy*l);ctx.lineTo(dx*(l-12),dy*(l-5));ctx.moveTo(dx*l,dy*l);ctx.lineTo(dx*(l-12),dy*(l+5));ctx.stroke();
      }else if(d.type==='chain'){
        const r=18+16*swing;ctx.beginPath();ctx.arc(dx*r,dy*r,12,0,Math.PI*1.65);ctx.stroke();
      }else if(d.type==='warHammer'){
        const l=18+22*swing;ctx.strokeStyle='#b6a18d';ctx.beginPath();ctx.moveTo(dx*7,dy*7);ctx.lineTo(dx*l,dy*l);ctx.stroke();ctx.fillStyle='#867466';ctx.fillRect(dx*l-8,dy*l-15,16,12);
        if(attack)explode(cx+dx*l,cy+dy*l,28+24*swing);
      }else if(d.type==='arcanePulse'){
        ctx.strokeStyle='#c89cff';ctx.beginPath();ctx.arc(0,0,18+35*swing,0,Math.PI*2);ctx.stroke();
      }else if(d.type==='magicMirror'){
        ctx.strokeStyle='#b5edf5';ctx.rotate(.35);ctx.strokeRect(-8,-13,16,26);ctx.globalAlpha=.55;ctx.strokeRect(-20,-9,12,18);ctx.strokeRect(8,-9,12,18);
      }else if(d.type==='teleRune'){
        ctx.strokeStyle='#9d8cff';ctx.rotate(.785);ctx.strokeRect(-11,-11,22,22);
      }else if(d.type==='thunderStaff'){
        ctx.strokeStyle='#f2d95f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(dx*7,dy*7);ctx.lineTo(dx*(36+20*swing),dy*(36+20*swing));ctx.stroke();
      }else if(d.type==='trap'){
        ctx.strokeStyle='#cfb18c';ctx.strokeRect(dx*38-10,dy*38-10,20,20);
      }else if(d.type==='boomerang'){
        const a=ang+(swing*1.4);ctx.strokeStyle='#d9a65c';ctx.beginPath();ctx.arc(Math.cos(a)*26,Math.sin(a)*26,13,-1.2,1.2);ctx.stroke();
      }else if(d.type==='hunterBomb'){
        ctx.fillStyle='#e87845';ctx.beginPath();ctx.arc(dx*(28+25*swing),dy*(28+25*swing),9,0,Math.PI*2);ctx.fill();
      }else if(d.type==='hawk'){
        ctx.fillStyle='#d4bd82';ctx.beginPath();ctx.moveTo(dx*34,dy*34);ctx.lineTo(dx*18-10,dy*18+8);ctx.lineTo(dx*18+9,dy*18-10);ctx.closePath();ctx.fill();
      }else if(d.type==='iceDash'){
        ctx.strokeStyle='#a7efff';ctx.beginPath();ctx.moveTo(-dx*8,-dy*8);ctx.lineTo(dx*42,dy*42);ctx.stroke();ctx.beginPath();ctx.arc(dx*30,dy*30,15,0,Math.PI*2);ctx.stroke();
      }else if(d.type==='snowDrum'){
        ctx.strokeStyle='#bcefff';ctx.beginPath();ctx.arc(0,0,24+55*swing,0,Math.PI*2);ctx.stroke();
      }else if(d.type==='fishCannon'){
        ctx.strokeStyle='#f3d47a';ctx.beginPath();ctx.moveTo(dx*8,dy*8);ctx.lineTo(dx*(44+20*swing),dy*(44+20*swing));ctx.stroke();
      }else if(d.type==='polarCube'){
        ctx.strokeStyle='#a6eaff';ctx.strokeRect(dx*40-16,dy*40-16,32,32);
      }
    }else{
      ctx.strokeStyle=player.class==='Mago'?'#c993ff':player.class==='Arqueiro'?'#e2bd70':'#e8c978';
      ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=4;
      if(player.class==='Guerreiro'){
        const len=attack?34+18*swing:28;ctx.beginPath();ctx.moveTo(dx*6,dy*6);ctx.lineTo(dx*len,dy*len);ctx.stroke();
        if(player.weaponCombo===3&&attack){ctx.beginPath();ctx.arc(0,0,40+player.area,-.9,.9);ctx.stroke();}
      }else if(player.class==='Mago'){
        const r=10+18*swing;ctx.beginPath();ctx.arc(dx*16,dy*16,r,0,Math.PI*2);ctx.stroke();
      }else if(player.class==='Arqueiro'){
        ctx.beginPath();ctx.arc(dx*12,dy*12,17,-1.0,1.0);ctx.stroke();ctx.beginPath();ctx.moveTo(dx*8,dy*8);ctx.lineTo(dx*(attack?44:24),dy*(attack?44:24));ctx.stroke();
      }else if(player.class==='Penguin'){
        ctx.strokeStyle='#aeefff';ctx.beginPath();ctx.arc(dx*20,dy*20,13+10*swing,0,Math.PI*2);ctx.stroke();
      }
    }
    if(attack){ctx.globalAlpha=.28+.3*swing;ctx.strokeStyle='#fff1b8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,26+12*swing,ang-.5,ang+.5);ctx.stroke();}
    ctx.restore();
  };
})();



/* =========================================================
   V22 — INVENTÁRIO AVANÇADO / CARTAS / SUBITENS
========================================================= */
(function V22InventoryLayer(){
  const oldReset=resetPlayer;
  resetPlayer=function(){
    oldReset();
    player.cards=[];
    player.subItems=[];
  };
  const oldRender=renderGameInventory;
  renderGameInventory=function(){
    const cat=window.categoriaInventarioJogoAtual || 'resumo';
    if(cat!=='cartas' && cat!=='subitens'){oldRender();return;}
    const box=document.getElementById('inventarioJogoLista'); if(!box)return;
    const card=(title,desc,extra='')=>`<div class="inventario-card"><strong>${title}</strong><span>${desc}</span>${extra?`<small>${extra}</small>`:''}</div>`;
    let html='';
    if(cat==='cartas'){
      if(player.cards?.length){for(const c of player.cards)html+=card('🃏 '+c.name,c.desc,c.rarity+' • Ativa nesta run');}
      else html=card('🃏 Nenhuma carta','Você ainda não encontrou cartas.','Level up, baús, eventos e lojas podem oferecê-las.');
    }
    if(cat==='subitens'){
      if(player.subItems?.length){for(const s of player.subItems)html+=card('🔹 '+s.name,s.desc,s.category+' • Efeito ativo');}
      else html=card('🔹 Nenhum subitem','Anéis, amuletos, materiais e artefatos aparecerão durante a run.','Baús, eventos, elites e lojas podem fornecê-los.');
    }
    box.innerHTML=html;
    document.getElementById('inventarioJogoOuro').textContent=player.gold;
  };
})();



/* =========================================================
   V23 — CARTAS DE HABILIDADE
========================================================= */
const abilityCardsV23={
  bloodEdge:{name:'Lâmina Sanguinária',rarity:'Raro',desc:'Ataques curam 4% do dano causado.',apply(){player.lifeSteal+=.04}},
  echoStrike:{name:'Golpe Ecoante',rarity:'Raro',desc:'Ataques têm 18% de chance de repetir um golpe fraco.',apply(){player.echoStrike=true}},
  ironWill:{name:'Vontade de Ferro',rarity:'Comum',desc:'+12% defesa quando HP está abaixo de 45%.',apply(){player.ironWill=true}},
  arcaneFocus:{name:'Foco Arcano',rarity:'Raro',desc:'+12% dano mágico e +8% alcance.',apply(){player.dmg*=1.12;player.range*=1.08}},
  quickHands:{name:'Mãos Ligeiras',rarity:'Comum',desc:'-10% cooldown.',apply(){player.cd*=.90}},
  hunterEye:{name:'Olho do Caçador',rarity:'Raro',desc:'+10% alcance e +4% crítico.',apply(){player.range*=1.10;player.critChance+=.04}},
  treasureSense:{name:'Sentido do Tesouro',rarity:'Épico',desc:'Aumenta em 35% o ouro coletado.',apply(){player.goldBonus=(player.goldBonus||0)+.35}},
  frostHeart:{name:'Coração Frio',rarity:'Raro',desc:'Ataques têm pequena chance de congelar.',apply(){player.frostOnHit=true}}
};
(function V23Cards(){
  const oldReset=resetPlayer;resetPlayer=function(){oldReset();player.cards=[];player.echoStrike=false;player.ironWill=false;player.goldBonus=0;player.frostOnHit=false};
  const oldOpen=openEvolution;
  openEvolution=function(special){
    choiceOpen=true;paused=true;
    document.getElementById('tituloEvolucao').textContent=special?`👑 NÍVEL ${player.level} — EVOLUÇÃO ESPECIAL`:`⭐ NÍVEL ${player.level}`;
    document.getElementById('descricaoEvolucao').textContent='Escolha uma melhoria, usando o mouse ou 1, 2 ou 3.';
    const box=document.getElementById('opcoesEvolucao');box.innerHTML='';
    let arr=special?specialUpgrades():normalUpgrades();
    if(Math.random()<.22){
      const keys=shuffle(Object.keys(abilityCardsV23));
      const chosen=keys.map(k=>abilityCardsV23[k]).find(c=>!player.cards.some(x=>x.name===c.name));
      if(chosen)arr.unshift({name:'🃏 '+chosen.name,desc:chosen.desc,effect:'abilityCard',data:chosen});
    }
    arr=arr.slice(0,3);window._evo=arr;
    arr.forEach((o,i)=>{const c=document.createElement('div');c.className='evolucao-card';c.innerHTML=`<span class="numero-evolucao">[${i+1}]</span><strong>${o.name}</strong><span>${o.desc}</span>`;c.onclick=()=>applyEvolution(o);box.appendChild(c)});
    document.getElementById('evolucaoOverlay').style.display='flex';
  };
  const oldApply=applyEvolution;
  applyEvolution=function(o){
    if(o?.effect==='abilityCard'){
      o.data.apply();player.cards.push({name:o.data.name,desc:o.data.desc,rarity:o.data.rarity});choiceOpen=false;paused=false;document.getElementById('evolucaoOverlay').style.display='none';renderGameInventory();updateHud(true);return;
    }
    oldApply(o);
  };
  const oldDamage=damage;damage=function(e,n){oldDamage(e,n);if(e&&!e.dead&&player.echoStrike&&Math.random()<.18)oldDamage(e,n*.35);if(e&&!e.dead&&player.frostOnHit&&Math.random()<.12)e.freeze=Math.max(e.freeze||0,70)};
  const oldUpdateEnemies=updateEnemies;updateEnemies=function(){if(player.ironWill&&player.hp<player.hpMax*.45){const old=player.def;player.def+=.12;oldUpdateEnemies();player.def=old}else oldUpdateEnemies()};
})();



/* =========================================================
   V24 — SUBITENS / RELÍQUIAS PEQUENAS
========================================================= */
const subItemsV24=[
 {name:'Anel Rubro',category:'Anel',desc:'+5% dano.',apply(){player.dmg*=1.05}},
 {name:'Anel do Caçador',category:'Anel',desc:'+8% alcance.',apply(){player.range*=1.08}},
 {name:'Amuleto de Vida',category:'Amuleto',desc:'+18 HP máximo.',apply(){player.hpMax+=18;player.hp+=18}},
 {name:'Amuleto Glacial',category:'Amuleto',desc:'+8% resistência e gelo suave.',apply(){player.def+=.08;player.frostOnHit=true}},
 {name:'Pena de Harpia',category:'Material',desc:'+7% velocidade.',apply(){player.speed*=1.07}},
 {name:'Dente de Goblin',category:'Material',desc:'+10% dano contra Goblins.',apply(){player.goblinBonus=(player.goblinBonus||0)+.10}},
 {name:'Olho Místico',category:'Artefato',desc:'Revela melhor a próxima sala no minimapa.',apply(){player.mapSight=true}},
 {name:'Moeda Antiga',category:'Economia',desc:'+20% ouro coletado.',apply(){player.goldBonus=(player.goldBonus||0)+.20}},
 {name:'Vela Sagrada',category:'Exploração',desc:'Aumenta a chance de sala secreta.',apply(){player.secretChance=(player.secretChance||0)+.08}},
 {name:'Cupom do Mercador',category:'Economia',desc:'10% de desconto nas lojas.',apply(){player.shopDiscount=(player.shopDiscount||0)+.10}},
 {name:'Fragmento Arcano',category:'Fragmento',desc:'+7% dano e +4% alcance.',apply(){player.dmg*=1.07;player.range*=1.04}},
 {name:'Osso de Esqueleto',category:'Material',desc:'+12% dano contra mortos-vivos.',apply(){player.undeadBonus=(player.undeadBonus||0)+.12}}
];
(function V24Subitems(){
  const oldReset=resetPlayer;resetPlayer=function(){oldReset();player.subItems=[];player.goblinBonus=0;player.undeadBonus=0;player.mapSight=false;player.secretChance=0;player.shopDiscount=0};
  window.getSubItemV24=function(){const available=subItemsV24.filter(s=>!player.subItems.some(x=>x.name===s.name));return available.length?available[rand(0,available.length-1)]:null};
  const oldDrop=dropLoot;dropLoot=function(e){oldDrop(e);const chance=e.type==='troll'?.16:e.type==='orc'?.08:e.type==='esqueleto'?.05:.018;if(Math.random()<chance&&floorItems.length<CFG.maxFloorItems){const s=getSubItemV24();if(s)floorItems.push({kind:'subitem',data:s,x:e.x+e.size/2,y:e.y+e.size/2,size:18,spin:0})}};
  const oldUpdate=updateItems;updateItems=function(){for(let i=floorItems.length-1;i>=0;i--){const it=floorItems[i];if(it.kind!=='subitem')continue;it.spin=(it.spin||0)+.08;const dx=player.x+15-it.x,dy=player.y+15-it.y,d=Math.hypot(dx,dy)||1;if(d<110){it.x+=dx/d*1.5;it.y+=dy/d*1.5}if(d<28){if(it.data){it.data.apply();player.subItems.push(it.data)}itemFx(it.x,it.y,'#8bb4d5');floorItems.splice(i,1)}}oldUpdate();};
  const oldDraw=drawFloorItems;drawFloorItems=function(){oldDraw();for(const it of floorItems){if(it.kind!=='subitem'||!it.data)continue;ctx.save();ctx.translate(it.x,it.y);ctx.strokeStyle='#91c5e5';ctx.shadowColor='#91c5e5';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,0,it.size+Math.sin(it.spin)*2,0,Math.PI*2);ctx.stroke();ctx.font='18px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🔹',0,0);ctx.restore()}};
})();



/* =========================================================
   V25 — LOJA MASTERIZADA
========================================================= */
(function V25Shop(){
  const stockPool=()=>{
    const out=[];
    const activeKeys=Object.keys(activeItems);const passKeys=Object.keys(passiveItems);const secKeys=(secondaryCatalog[player.class]||[]);
    const cardKeys=Object.values(abilityCardsV23||{});const subPool=subItemsV24||[];
    for(let i=0;i<6;i++){
      const r=Math.random();let kind='active',data,id,base;
      if(r<.22&&secKeys.length){kind='secondary';data=shuffle(secKeys)[0];base={Comum:45,Raro:70,Épico:110,Lendário:150,Secreto:180}[data.rarity]||70}
      else if(r<.42&&cardKeys.length){kind='card';data=shuffle(cardKeys)[0];base={Comum:55,Raro:80,Épico:115,Lendário:150}[data.rarity]||80}
      else if(r<.57&&subPool.length){kind='subitem';data=shuffle(subPool)[0];base=45}
      else if(r<.78){kind='active';id=shuffle(activeKeys)[0];data=activeItems[id];base={Comum:18,Raro:35,Épico:60,Lendário:100}[data.rarity]||45}
      else {kind='passive';id=shuffle(passKeys)[0];data=passiveItems[id];base=35}
      let price=base+roomIndex*3;
      price=Math.floor(price*(1-(player.shopDiscount||0)));
      out.push({kind,id,data,price:Math.max(1,price)})
    }
    return out;
  };
  openShop=function(){transitioningRoom=false;paused=true;shopStock=stockPool();renderShop();document.getElementById('lojaMensagem').textContent=`💰 Seu ouro: ${player.gold} • Faltam ${Math.max(0,6-shopStock.length)} espaços`;document.getElementById('lojaOverlay').style.display='flex'};
  renderShop=function(){const box=document.getElementById('lojaItens');if(!box)return;box.innerHTML='';for(const [i,s] of shopStock.entries()){const c=document.createElement('div');c.className='loja-item';const icon=s.kind==='active'?s.data.icon:s.kind==='secondary'?(s.data.icon||'⚔️'):s.kind==='card'?'🃏':s.kind==='subitem'?'🔹':'🎁';const label=s.kind==='secondary'?'Secundária':s.kind==='active'?s.data.rarity:s.kind==='card'?'Carta '+s.data.rarity:s.kind==='subitem'?s.data.category:'Passivo';const desc=s.data.desc||'';c.innerHTML=`<strong>${icon} ${s.data.name}</strong><span>${label}</span><small>${desc}</small><span class="preco">💰 ${s.price}</span><button>${player.gold>=s.price?'Comprar':'Sem ouro'}</button>`;c.querySelector('button').onclick=()=>buyShop(i);box.appendChild(c)}};
  buyShop=function(i){const s=shopStock[i];if(!s||player.gold<s.price)return;player.gold-=s.price;if(s.kind==='active')player.active=s.id;else if(s.kind==='secondary')equipSecondaryV16(s.data,true);else if(s.kind==='card'){s.data.apply();player.cards.push({name:s.data.name,desc:s.data.desc,rarity:s.data.rarity})}else if(s.kind==='subitem'){s.data.apply();player.subItems.push(s.data)}else{s.data.apply();player.passives.push(s.data.name)}shopStock.splice(i,1);renderShop();updateHud(true)};
  const rr=document.getElementById('lojaReroll');if(rr)rr.onclick=()=>{if(paused&&player.gold>=15){player.gold-=15;shopStock=stockPool();renderShop();updateHud(true)}};
})();



/* =========================================================
   V26 — DUNGEON PROCEDURAL AVANÇADA
========================================================= */
(function V26Dungeon(){
  const oldGenerate=generateRoomType;
  generateRoomType=function(){
    if(roomIndex>1 && roomIndex%8===0){roomHistory.push('boss');return'boss'}
    const r=Math.random();
    let type;
    const secretChance=.015+(player.secretChance||0);
    if(roomIndex>=4 && r<secretChance) type='secret';
    else if(roomIndex>=3 && r<.055+(player.level>=20?.015:0)) type='event';
    else type=oldGenerate();
    lastSpecialRoom=type;roomHistory.push(type);return type;
  };
  roomLabel=function(t){return{combat:'Sala de Combate',elite:'Sala de Elite',treasure:'Sala do Tesouro',shop:'Loja do Mercador',rest:'Santuário de Descanso',event:'Sala de Evento',secret:'Câmara Secreta',boss:'Covil do Chefão'}[t]||t};
  roomIcon=function(t){return{combat:'⚔️',elite:'☠️',treasure:'💰',shop:'🏪',rest:'❤️',event:'🎲',secret:'🔒',boss:'👑'}[t]};
  roomDesc=function(t){return{combat:'Monstros comuns e ouro.',elite:'Inimigos fortes e melhores drops.',treasure:'Recompensas garantidas.',shop:'Compre e troque mercadorias.',rest:'Recupere vida e organize sua build.',event:'Uma escolha inesperada pode alterar sua run.',secret:'Uma câmara escondida com uma recompensa única.',boss:'Enfrente um grande inimigo.'}[t]};
  const oldNext=nextRoom;
  nextRoom=function(type,first=false){
    if(!first && (type==='event'||type==='secret')){
      /* segue o mesmo ciclo de limpeza/seed da sala normal */
      transitioningRoom=false;choiceOpen=false;roomType=type;roomCleared=0;boss=null;bossShots=[];enemiesArr=[];xpDrops=[];goldDrops=[];floorItems=[];effects=[];generateRoomLayout(type==='secret'?'treasure':type);const snapshot={type,seed:roomSeed>>>0,map:roomMap.map(r=>r.slice()),obstacles:roomObstacles.map(o=>({...o}))};roomStates[roomIndex-1]=snapshot;roomHistory[roomIndex-1]=type;player.x=canvas.width/2-player.size/2;player.y=canvas.height/2-player.size/2;exitOpen=false;previousExitOpen=roomIndex>1;document.getElementById('bossHUD').style.display='none';document.getElementById('lojaOverlay').style.display='none';document.getElementById('salaOverlay').style.display='none';document.getElementById('roomBanner').classList.remove('door-open');document.getElementById('roomBanner').textContent=`${roomLabel(type)} • Sala ${roomIndex}`;document.getElementById('roomSeedInfo').textContent=`Seed ${roomSeed>>>0}`;updateMiniMap();spawnProceduralSpecialRoom(type);return;
    }
    oldNext(type,first);
  };
  function spawnProceduralSpecialRoom(type){
    paused=true;
    if(type==='event'){
      const choices=[
        {title:'🎲 Mercador Errante',desc:'Pague 20 moedas e receba um reforço aleatório.',run(){if(player.gold>=20){player.gold-=20;const s=getSubItemV24();if(s){s.apply();player.subItems.push(s)}}}},
        {title:'🗿 Altar do Risco',desc:'Sacrifique 12% do HP máximo por uma carta rara.',run(){if(player.hpMax>35){player.hpMax=Math.max(25,Math.floor(player.hpMax*.88));player.hp=Math.min(player.hp,player.hpMax);const ks=shuffle(Object.values(abilityCardsV23));const c=ks.find(x=>!player.cards.some(y=>y.name===x.name));if(c){c.apply();player.cards.push({name:c.name,desc:c.desc,rarity:c.rarity})}}}},
        {title:'🔥 Fogueira',desc:'Recupere 35% da vida e ganhe 10% de XP do nível.',run(){player.hp=Math.min(player.hpMax,player.hp+player.hpMax*.35);player.xp=Math.min(player.xpNext-1,player.xp+Math.floor(player.xpNext*.10))}}
      ];
      const box=document.getElementById('salaOpcoes');box.innerHTML='';document.getElementById('salaTitulo').textContent='🎲 Evento';document.getElementById('salaDescricao').textContent='A sala foi gerada proceduralmente. Escolha uma oportunidade.';
      shuffle(choices).slice(0,3).forEach(ch=>{const c=document.createElement('div');c.className='sala-opcao';c.innerHTML=`<strong>${ch.title}</strong><span>${ch.desc}</span>`;c.onclick=()=>{ch.run();document.getElementById('salaOverlay').style.display='none';paused=false;openRoomExit();};box.appendChild(c)});document.getElementById('salaOverlay').style.display='flex';
    }else{
      const rewards=[getSubItemV24(),Object.values(abilityCardsV23||{})[rand(0,Object.values(abilityCardsV23||{}).length-1)],shuffle(Object.keys(activeItems)).map(k=>activeItems[k])[0]].filter(Boolean);
      const box=document.getElementById('salaOpcoes');box.innerHTML='';document.getElementById('salaTitulo').textContent='🔒 Câmara Secreta';document.getElementById('salaDescricao').textContent='Você encontrou uma sala fora do caminho comum. Escolha uma relíquia secreta.';
      rewards.slice(0,3).forEach((r,i)=>{const c=document.createElement('div');c.className='sala-opcao';c.innerHTML=`<strong>${r.icon||'🔹'} ${r.name}</strong><span>${r.desc||r.rarity||'Recompensa'}</span>`;c.onclick=()=>{if(r.apply){r.apply();if(r.category)player.subItems.push(r);else if(r.rarity)player.cards.push({name:r.name,desc:r.desc,rarity:r.rarity});else player.active=Object.keys(activeItems).find(k=>activeItems[k]===r)||player.active}document.getElementById('salaOverlay').style.display='none';paused=false;openRoomExit();};box.appendChild(c)});document.getElementById('salaOverlay').style.display='flex';
    }
  }
})();



/* =========================================================
   V27 — CHEFÕES REFINADOS / PADRÕES E HITBOX
========================================================= */
(function V27BossLayer(){
  const oldSpawn=spawnBoss;
  spawnBoss=function(){
    oldSpawn();
    if(!boss)return;
    boss.pattern=0;
    boss.patternTimer=0;
    boss.telegraph=0;
    boss.charge=0;
    boss.enrage=false;
    boss.hitFlash=0;
    boss.lootRoll=Math.random();
  };
  const oldUpdate=updateBoss;
  updateBoss=function(){
    if(!boss){oldUpdate();return}
    const now=performance.now();
    if(boss.hp<=0){oldUpdate();return}
    boss.patternTimer++;
    if(boss.phase>=2 && boss.patternTimer>150){boss.pattern=(boss.pattern+1)%3;boss.patternTimer=0;boss.telegraph=35}
    if(boss.telegraph>0){boss.telegraph--}
    if(boss.phase>=3)boss.enrage=true;
    oldUpdate();
    if(boss&&boss.enrage&&boss.telegraph===1){
      const a=Math.atan2((player.y+15)-(boss.y+45),(player.x+15)-(boss.x+45));
      for(let i=-2;i<=2;i++)projBoss(a+i*.16);
      explode(boss.x+45,boss.y+45,70);
    }
  };
  const oldDraw=drawBoss;
  drawBoss=function(){
    oldDraw();
    if(!boss)return;
    const cx=boss.x+boss.tamanho/2,cy=boss.y+boss.tamanho/2;
    ctx.save();
    if(boss.telegraph>0){ctx.globalAlpha=.65;ctx.strokeStyle=boss.phase>=3?'#f05c55':'#e6c86e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,62+boss.telegraph*.5,0,Math.PI*2);ctx.stroke()}
    if(boss.phase>=2){ctx.strokeStyle='rgba(220,80,70,.35)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,52,0,Math.PI*2);ctx.stroke()}
    ctx.restore();
  };
  const oldDefeat=defeatBoss;
  defeatBoss=function(){
    if(!boss)return;
    const beforeGold=player.gold;
    oldDefeat();
    player.gold+=20;
    const sec=randomSecondaryV16(player.secondary);
    if(sec)floorItems.push({kind:'secondary',data:sec,x:canvas.width/2+35,y:canvas.height/2,size:24,spin:0});
    if(player.cards&&Math.random()<.6){const c=shuffle(Object.values(abilityCardsV23)).find(x=>!player.cards.some(y=>y.name===x.name));if(c){floorItems.push({kind:'bossCard',data:c,x:canvas.width/2-35,y:canvas.height/2,size:22,spin:0})}}
    termPrint?.(`Boss reward: +${player.gold-beforeGold} gold`,'terminalInfo');
  };
})();


/* =========================================================
   V27 MERGED MASTER PATCH — CONSOLIDAÇÃO V25/V26/V27
========================================================= */
(function V27MergedMaster(){
  // A room type is chosen here without mutating roomHistory early.
  // nextRoom() remains the single owner of persisted room history.
  generateRoomType=function(){
    if(roomIndex>1 && roomIndex%8===0){
      lastSpecialRoom='boss';
      return 'boss';
    }
    const r=Math.random();
    let type;
    const secretChance=Math.min(.25,.015+(player.secretChance||0));
    if(roomIndex>=4 && r<secretChance){
      type='secret';
    }else if(roomIndex>=3 && r<secretChance+.055+(player.level>=20?.015:0)){
      type='event';
    }else{
      type=weightedRoomPick();
      let guard=0;
      while(type===lastSpecialRoom && guard++<8) type=weightedRoomPick();
      if(roomIndex<3 && ['shop','rest','treasure'].includes(type)) type='combat';
    }
    lastSpecialRoom=type;
    return type;
  };

  // Safer final boss defeat: rewards stay on the floor until the player leaves.
  defeatBoss=function(){
    if(!boss || boss._defeated) return;
    const defeated=boss;
    boss._defeated=true;
    boss=null;
    bossShots=[];
    document.getElementById('bossHUD').style.display='none';

    for(let i=0;i<12 && xpDrops.length<CFG.maxXPDrops;i++){
      xpDrops.push({
        x:defeated.x+defeated.tamanho/2+(Math.random()-.5)*150,
        y:defeated.y+defeated.tamanho/2+(Math.random()-.5)*150,
        v:100,
        spin:Math.random()*Math.PI*2
      });
    }

    player.gold += rand(25,45)+20;

    const sec=randomSecondaryV16(player.secondary);
    if(sec && floorItems.length<CFG.maxFloorItems){
      floorItems.push({kind:'secondary',data:sec,x:canvas.width/2+38,y:canvas.height/2,size:24,spin:0});
    }

    if(player.cards && Math.random()<.75){
      const card=shuffle(Object.values(abilityCardsV23)).find(c=>!player.cards.some(x=>x.name===c.name));
      if(card && floorItems.length<CFG.maxFloorItems){
        floorItems.push({kind:'bossCard',data:card,x:canvas.width/2-38,y:canvas.height/2,size:22,spin:0});
      }
    }

    if(floorItems.length<CFG.maxFloorItems){
      const activePool=Object.keys(activeItems).filter(k=>k!==player.active);
      if(activePool.length){
        const id=activePool[rand(0,activePool.length-1)];
        floorItems.push({kind:'active',id,x:canvas.width/2,y:canvas.height/2+42,size:22,spin:0});
      }
    }

    localStorage.setItem('squareRPG_boss','true');
    saveAchievements();
    roomCleared=1;
    openRoomExit();
    updateHud(true);
  };

  // Boss reward cards dropped on the floor are collectible as regular cards.
  const oldUpdateItemsMerged=updateItems;
  updateItems=function(){
    for(let i=floorItems.length-1;i>=0;i--){
      const it=floorItems[i];
      if(it.kind!=='bossCard') continue;
      it.spin=(it.spin||0)+.08;
      const dx=player.x+15-it.x,dy=player.y+15-it.y,d=Math.hypot(dx,dy)||1;
      if(d<110){it.x+=dx/d*1.5;it.y+=dy/d*1.5;}
      if(d<28){
        if(it.data){
          it.data.apply();
          player.cards=player.cards||[];
          player.cards.push({name:it.data.name,desc:it.data.desc,rarity:it.data.rarity});
        }
        itemFx(it.x,it.y,'#c88cff');
        floorItems.splice(i,1);
      }
    }
    oldUpdateItemsMerged();
  };

  const oldDrawItemsMerged=drawFloorItems;
  drawFloorItems=function(){
    oldDrawItemsMerged();
    for(const it of floorItems){
      if(it.kind!=='bossCard'||!it.data) continue;
      ctx.save();
      ctx.translate(it.x,it.y);
      ctx.strokeStyle='#c88cff';
      ctx.shadowColor='#c88cff';
      ctx.shadowBlur=14;
      ctx.strokeRect(-11,-14,22,28);
      ctx.font='16px Arial';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText('🃏',0,0);
      ctx.restore();
    }
  };

  // Inventory gets a compact, consistent copy of the currently equipped items.
  const oldRenderGameInventoryMerged=renderGameInventory;
  renderGameInventory=function(){
    oldRenderGameInventoryMerged();
    const active=document.getElementById('inventarioJogoAtivo');
    if(active){
      active.textContent=player.active?
        `🧪 ${activeItems[player.active].icon} ${activeItems[player.active].name}`:
        '🧪 Nenhum item ativo';
    }
  };
})();
