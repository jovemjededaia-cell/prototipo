"use strict";
(function(){
  const cache=new Map();
  let renderScale=1;
  const profiles=window.SQUARE_RPG_ART || {};
  const state={player:new Map(), enemies:new Map(), lastState:new WeakMap()};
  function load(key,url){
    if(!url)return null;
    if(cache.has(key))return cache.get(key);
    const img=new Image(); img.decoding='async'; img.src=url; cache.set(key,img); return img;
  }
  function dir(dx,dy){
    if(Math.abs(dx)>Math.abs(dy)) return dx<0?'left':'right';
    if(dy<0) return 'up';
    return 'down';
  }
  function stateFor(actor){
    if(actor.dead || actor.hp<=0) return 'death';
    if(actor.hit>0) return 'hurt';
    if(actor.anim && actor.anim.state==='attack') return 'attack';
    if(actor.vx || actor.vy || actor.dx || actor.dy){
      if(actor.speed && actor.vx===undefined){ /* player uses keys */ }
    }
    return 'idle';
  }
  function resetOnChange(actor,next){
    const prev=state.lastState.get(actor);
    if(prev!==next){state.lastState.set(actor,next); return true;}
    return false;
  }
  function drawURL(ctx,url,x,y,w,h,opts={}){
    const img=load(url,url); if(!img || !img.complete || !img.naturalWidth)return false;
    ctx.save(); ctx.imageSmoothingEnabled=false;
    if(opts.flip){ctx.translate(x+w,y);ctx.scale(-1,1);x=0;y=0}
    if(opts.src){ctx.drawImage(img,opts.src.sx,opts.src.sy,opts.src.sw,opts.src.sh,x,y,w,h)}
    else ctx.drawImage(img,x,y,w,h);
    ctx.restore(); return true;
  }
  function drawPlayer(ctx,p){
    const cfg=profiles.player?.[p.class]; if(!cfg) return false;
    const d=dir(p.dx,p.dy), s=stateFor(p);
    const url=(cfg[s]&&cfg[s][d])||cfg[s]?.down||cfg.idle?.[d]||cfg.idle?.down;
    if(!url)return false;
    const w=56*renderScale,h=76*renderScale;
    const flip=d==='left' && !!cfg.canFlipSide;
    return drawURL(ctx,url,p.x-(w-p.size)/2,p.y-(h-p.size),w,h,{flip});
  }
  function drawEnemy(ctx,e){
    const cfg=profiles.enemies?.[e.type]; if(!cfg)return false;
    const d=dir(e.dx??0,e.dy??0), s=stateFor(e);
    const url=(cfg[s]&&cfg[s][d])||cfg[s]?.down||cfg.idle?.[d];
    if(!url)return false;
    const n=Math.max(e.size,34);
    return drawURL(ctx,url,e.x-(n-e.size)/2,e.y-(n-e.size),n,n,{flip:d==='left' && !!cfg.canFlipSide});
  }
  window.SquareRPGSpriteEngine={drawPlayer,drawEnemy,setRenderScale(v){if(Number.isFinite(v))renderScale=Math.max(.5,Math.min(2,v))},preload(){Object.values(profiles.player||{}).forEach(x=>Object.values(x||{}).forEach(y=>Object.values(y||{}).forEach(u=>u&&load(u,u))));Object.values(profiles.enemies||{}).forEach(x=>Object.values(x||{}).forEach(y=>Object.values(y||{}).forEach(u=>u&&load(u,u))))}};
})();
