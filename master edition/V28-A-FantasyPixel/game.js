"use strict";
(function(){
  const scripts=["systems/combat-system.js","systems/collision-system.js","systems/inventory-system.js","systems/item-system.js","systems/card-system.js","systems/dungeon-system.js","systems/minimap-system.js","systems/shop-system.js","systems/boss-system.js","systems/debug-system.js","systems/game-core.js","systems/v28-polish.js","systems/master-integration.js"];
  let i=0;function next(){if(i>=scripts.length)return;const s=document.createElement("script");s.src=scripts[i++];s.onload=next;s.onerror=()=>console.error("Falha ao carregar",s.src);document.head.appendChild(s);}next();
})();
