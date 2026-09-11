"use strict";
/* Square RPG MASTER — integração das melhores ideias das versões anteriores. */
(function(){
  const now=()=>performance.now();
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const state={chain:null,lastUpdate:now(),shake:0,shakePower:0,toastTimer:0};

  // Corrente física: lança -> engata -> puxa gradualmente -> recolhe.
  function startChain(){
    if(typeof player==='undefined'||!player.secondaryData||player.secondaryData.type!=="chain") return false;
    if(state.chain) return true;
    const cx=player.x+player.size/2, cy=player.y+player.size/2;
    const target=typeof nearest==='function'?nearest({x:cx,y:cy,hit:[]}):null;
    if(!target) return true;
    const dx=target.x+target.size/2-cx,dy=target.y+target.size/2-cy;
    const len=Math.hypot(dx,dy)||1;
    state.chain={target,phase:'throw',progress:0,length:Math.min(len,player.range+120),sx:cx,sy:cy,tx:target.x+target.size/2,ty:target.y+target.size/2,hit:false,age:0};
    player.anim.state='secondaryAttack';
    player.anim.until=now()+520;
    return true;
  }
  function chainUpdate(dt){
    const c=state.chain;if(!c)return;
    c.age+=dt;
    if(!c.target || c.target.dead || c.target.hp<=0){state.chain=null;return;}
    c.tx=c.target.x+c.target.size/2;c.ty=c.target.y+c.target.size/2;
    if(c.phase==='throw'){
      c.progress=clamp(c.progress+dt/170,0,1);
      if(c.progress>=1){
        c.phase='hook';c.progress=0;
        if(!c.hit){c.hit=true;if(typeof damage==='function')damage(c.target,player.dmg*1.3);}
      }
    } else if(c.phase==='hook'){
      c.progress=clamp(c.progress+dt/100,0,1);
      if(c.progress>=1)c.phase='pull';
    } else if(c.phase==='pull'){
      const dx=c.sx-c.tx,dy=c.sy-c.ty,d=Math.hypot(dx,dy)||1;
      const speed=Math.min(8,Math.max(2.5,d/14));
      if(d>46){
        c.target.x+=dx/d*speed*(dt/16.67);
        c.target.y+=dy/d*speed*(dt/16.67);
        if(typeof boundEnemy==='function')boundEnemy(c.target);
      }else{c.phase='retract';c.progress=1;}
    } else if(c.phase==='retract'){
      c.progress=clamp(c.progress-dt/190,0,1);
      if(c.progress<=0)state.chain=null;
    }
  }
  function chainTip(){
    const c=state.chain;if(!c)return null;
    if(c.phase==='throw'||c.phase==='hook'){
      const t=c.progress;return {x:c.sx+(c.tx-c.sx)*t,y:c.sy+(c.ty-c.sy)*t};
    }
    return {x:c.tx,y:c.ty};
  }
  function drawChain(ctx){
    const c=state.chain;if(!c)return;
    const tip=chainTip();if(!tip)return;
    const segments=14;
    const dx=tip.x-c.sx,dy=tip.y-c.sy,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.lineWidth=3;ctx.strokeStyle='#8a8c8a';ctx.fillStyle='#c4c6c3';
    ctx.beginPath();ctx.moveTo(c.sx,c.sy);
    for(let i=1;i<=segments;i++){
      const t=i/segments,wig=Math.sin(i*2.4+(c.age/70))*2.1;
      ctx.lineTo(c.sx+dx*t+nx*wig,c.sy+dy*t+ny*wig);
    }
    ctx.stroke();
    for(let i=1;i<segments;i+=2){
      const t=i/segments,wig=Math.sin(i*2.4+(c.age/70))*2.1;
      const x=c.sx+dx*t+nx*wig,y=c.sy+dy*t+ny*wig;
      ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
    }
    ctx.beginPath();ctx.arc(tip.x,tip.y,5,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  // Screen shake pequeno e determinístico para impactos.
  function kickShake(power=2){state.shake=Math.max(state.shake,90);state.shakePower=Math.max(state.shakePower,power);}
  function wrapDraw(){
    const original=window.draw;
    if(typeof original!=='function')return;
    if(original.__masterWrapped)return;
    function wrapped(){
      const canvas=window.canvas,ctx=window.ctx;
      if(!canvas||!ctx){return original();}
      let sx=0,sy=0;
      if(state.shake>0){sx=(Math.random()-.5)*state.shakePower;sy=(Math.random()-.5)*state.shakePower;state.shake*=.82;state.shakePower*=.94;}
      ctx.save();ctx.translate(sx,sy);
      const result=original();
      drawChain(ctx);
      ctx.restore();
      return result;
    }
    wrapped.__masterWrapped=true;window.draw=wrapped;
  }
  function wrapUpdate(){
    const original=window.update;
    if(typeof original!=='function')return;
    if(original.__masterWrapped)return;
    function wrapped(){
      const t=now();let dt=t-state.lastUpdate;state.lastUpdate=t;dt=clamp(dt,0,80);
      const activeBefore=state.chain;
      const result=original();
      if(typeof player!=='undefined' && player.secondaryData?.type==='chain' && player.secondaryMode && !activeBefore){
        const last=player.secondaryData.lastUse||0;
        if(t-last<70)startChain();
      }
      chainUpdate(dt);
      return result;
    }
    wrapped.__masterWrapped=true;window.update=wrapped;
  }
  function wrapSecondary(){
    const original=window.secondaryAttack;
    if(typeof original!=='function')return;
    if(original.__masterWrapped)return;
    function wrapped(){
      const data=window.player?.secondaryData;
      if(data?.type==='chain'){
        const t=now();
        if(t-(data.lastUse||0)<data.cooldown)return;
        data.lastUse=t;startChain();kickShake(1.4);return;
      }
      return original.apply(this,arguments);
    }
    wrapped.__masterWrapped=true;window.secondaryAttack=wrapped;
  }
  function stabilizeSprites(){
    const engine=window.SquareRPGSpriteEngine;
    if(!engine)return;
    if(engine.setRenderScale)engine.setRenderScale(1.15);
    // Quando disponível, pré-carrega cedo para reduzir transições vazias.
    if(engine.preload)engine.preload();
  }
  function addMasterBadge(){
    const b=document.createElement('div');
    b.textContent='MASTER • V28';
    b.style.cssText='position:fixed;left:10px;bottom:10px;z-index:80;padding:4px 7px;border:1px solid rgba(232,201,120,.4);background:rgba(15,12,10,.72);color:#dcc17e;font:10px monospace;pointer-events:none;opacity:.55';
    document.body.appendChild(b);
  }
  function boot(){
    // game-core já foi carregado pela cadeia de scripts do index.
    wrapSecondary();wrapUpdate();wrapDraw();stabilizeSprites();addMasterBadge();
    window.SquareRPGMaster={chainState:state,getChain:()=>state.chain,kickShake};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));
  else setTimeout(boot,0);
})();
