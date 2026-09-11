"use strict";
class SpriteAnimator {
  constructor(fps=8){this.fps=fps;this.state="idle";this.frame=0;this.elapsed=0;this.loop=true;}
  set(state,{restart=false,loop=true}={}){if(restart||this.state!==state){this.state=state;this.frame=0;this.elapsed=0;}this.loop=loop;}
  update(dt,count=1){this.elapsed+=Math.max(0,dt);const step=1000/this.fps;while(this.elapsed>=step){this.elapsed-=step;if(this.frame<count-1)this.frame++;else if(this.loop)this.frame=0;}}
}
window.SpriteAnimator=SpriteAnimator;
