/* V28.2 POLISH LAYER
 * Non-destructive polish: feedback, stability, accessibility and small UX improvements.
 */
(function V28Polish(){
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = (fn, fallback) => { try { return fn(); } catch(e){ console.warn('[V28]', e); return fallback; } };

  // ---------- Runtime feedback ----------
  const feedback = { shake:0, flash:0, flashText:'', flashKind:'', lastHp:0, lastKills:0 };
  function ensureToast(){
    if($('v28Toast')) return $('v28Toast');
    const el=document.createElement('div'); el.id='v28Toast'; el.className='v28-toast'; document.body.appendChild(el); return el;
  }
  function toast(text,kind='info',ms=1100){
    const el=ensureToast(); el.textContent=text; el.dataset.kind=kind; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),ms);
  }
  window.v28Toast=toast;

  // ---------- Small persistent player state polish ----------
  function clampPlayer(){
    if(typeof player==='undefined') return;
    player.x=Math.max(12,Math.min(canvas.width-player.size-12,Number.isFinite(player.x)?player.x:400));
    player.y=Math.max(12,Math.min(canvas.height-player.size-12,Number.isFinite(player.y)?player.y:250));
    if(!Number.isFinite(player.hp)) player.hp=player.hpMax||100;
  }

  // ---------- Better status / item feedback ----------
  const baseUpdateHud = window.updateHud;
  if(typeof baseUpdateHud==='function'){
    window.updateHud=function(force){
      baseUpdateHud(force);
      safe(()=>{
        const active=$('inventarioAtivo');
        if(active){
          if(player.secondaryMode && player.secondary) active.textContent=`⚔️ F: ${player.secondary}`;
          else if(player.active && activeItems[player.active]) active.textContent=`🧪 R: ${activeItems[player.active].name}`;
          else active.textContent='⚔️ Setas: atacar • F: alternar';
        }
      });
    };
  }

  // ---------- More readable combat feedback ----------
  function spawnFloating(text,x,y,kind='damage'){
    if(typeof effects==='undefined') return;
    if(effects.length>=CFG.maxEffects) return;
    effects.push({t:'text',text:String(text),x,y,time:34,max:34,kind});
  }
  const baseDamage = window.damage;
  if(typeof baseDamage==='function'){
    window.damage=function(target,amount){
      const before=target?.hp ?? 0;
      const r=baseDamage(target,amount);
      const dealt=Math.max(0,before-(target?.hp??0));
      if(dealt>0) spawnFloating(`-${Math.round(dealt)}`,target.x+(target.size||24)/2,target.y,'damage');
      feedback.shake=Math.max(feedback.shake,Math.min(7,2+dealt*.08));
      return r;
    };
  }

  // ---------- Stable enemy motion metadata for sprite directions ----------
  const baseUpdateEnemies = window.updateEnemies;
  if(typeof baseUpdateEnemies==='function'){
    window.updateEnemies=function(){
      const snap = typeof enemiesArr!=='undefined' ? enemiesArr.map(e=>({e,vx:e.vx||0,vy:e.vy||0,x:e.x,y:e.y})) : [];
      baseUpdateEnemies();
      for(const s of snap){
        const e=s.e; if(!e) continue;
        e.vx=e.x-s.x; e.vy=e.y-s.y;
        if(Math.abs(e.vx)+Math.abs(e.vy)<0.02){ e.vx=e.dx||0; e.vy=e.dy||0; }
      }
    };
  }

  // ---------- Player movement metadata ----------
  const baseUpdatePlayer = window.updatePlayer;
  if(typeof baseUpdatePlayer==='function'){
    window.updatePlayer=function(){
      const bx=player.x, by=player.y; baseUpdatePlayer();
      player.vx=player.x-bx; player.vy=player.y-by;
      if(Math.abs(player.vx)+Math.abs(player.vy)>0.01){
        player.dx=Math.abs(player.vx)>Math.abs(player.vy)?Math.sign(player.vx):0;
        player.dy=Math.abs(player.vy)>=Math.abs(player.vx)?Math.sign(player.vy):0;
      }
      clampPlayer();
    };
  }

  // ---------- Draw polish: vignette, hit flash, floating numbers, shake ----------
  const baseDraw = window.draw;
  if(typeof baseDraw==='function'){
    window.draw=function(){
      ctx.save();
      if(feedback.shake>0){
        const s=feedback.shake; ctx.translate((Math.random()-.5)*s,(Math.random()-.5)*s);
      }
      baseDraw();
      // HUD vignette / combat atmosphere over canvas
      const g=ctx.createRadialGradient(canvas.width/2,canvas.height/2,80,canvas.width/2,canvas.height/2,470);
      g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(12,8,5,.34)');
      ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
      // room edge glow when exit is open
      if(typeof exitOpen!=='undefined' && exitOpen){
        ctx.strokeStyle='rgba(216,187,106,.55)'; ctx.lineWidth=2; ctx.strokeRect(3,3,canvas.width-6,canvas.height-6);
      }
      // floating texts
      if(typeof effects!=='undefined') for(const f of effects){
        if(f.t!=='text') continue;
        const q=f.time/f.max; ctx.save(); ctx.globalAlpha=Math.max(0,q); ctx.font='bold 13px monospace'; ctx.textAlign='center';
        ctx.strokeStyle='rgba(20,10,6,.9)'; ctx.lineWidth=4; ctx.strokeText(f.text,f.x,f.y-(1-q)*24); ctx.fillStyle=f.kind==='heal'?'#94e9a2':'#ffe08a'; ctx.fillText(f.text,f.x,f.y-(1-q)*24); ctx.restore();
      }
      ctx.restore();
      feedback.shake*=.76; if(feedback.shake<.05) feedback.shake=0;
    };
  }

  // ---------- Screen FX based on player HP / kills ----------
  const baseUpdate = window.update;
  if(typeof baseUpdate==='function'){
    window.update=function(){
      const hpBefore=player.hp, killsBefore=player.kills; baseUpdate();
      if(player.hp<hpBefore-0.01){ feedback.shake=Math.max(feedback.shake,4); }
      if(player.kills>killsBefore){
        toast(`⚔️ ${player.kills} ${player.kills===1?'inimigo derrotado':'inimigos derrotados'}`,'combat',800);
        if(player.kills%10===0) toast(`🔥 Sequência: ${player.kills}`,'success',1000);
      }
      if(player.level>1 && player._v28LevelSeen!==player.level){ player._v28LevelSeen=player.level; toast(`⭐ Nível ${player.level}`,'level',1200); }
    };
  }

  // ---------- Improve inventory/menu readability without replacing structure ----------
  safe(()=>{
    const style=document.createElement('style');
    style.textContent=`
      .v28-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%) translateY(-12px);opacity:0;z-index:9999;padding:8px 14px;border:2px solid #d6bd7a;background:rgba(24,15,9,.94);box-shadow:0 6px 24px rgba(0,0,0,.4);font:700 13px monospace;letter-spacing:.4px;pointer-events:none;transition:opacity .12s,transform .12s;color:#f7e7bf}
      .v28-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .v28-toast[data-kind="success"]{border-color:#75bf73}.v28-toast[data-kind="combat"]{border-color:#d96f58}.v28-toast[data-kind="level"]{border-color:#7da9d8}
      canvas{image-rendering:pixelated;image-rendering:crisp-edges}
      button:focus-visible{outline:2px solid #f3dc86;outline-offset:2px}
      .mini-mapa-legenda{line-height:1.4}
      .inventario-card{transition:transform .12s,filter .12s}.inventario-card:hover{transform:translateY(-2px);filter:brightness(1.08)}
    `;
    document.head.appendChild(style);
  });

  // ---------- Keep sprite engine ready before the first room ----------
  safe(()=>{ if(window.SquareRPGSpriteEngine?.preload) window.SquareRPGSpriteEngine.preload(); });

  // ---------- Developer diagnostics ----------
  window.V28Health={
    run(){
      const checks={canvas:!!canvas,player:typeof player!=='undefined',enemies:typeof enemiesArr!=='undefined',spriteEngine:!!window.SquareRPGSpriteEngine,inventory:!!$('inventarioOverlay'),minimap:!!$('miniMapa')};
      console.table(checks); return checks;
    }
  };

  setTimeout(()=>toast('V28 • Arena pronta','success',900),350);
})();
