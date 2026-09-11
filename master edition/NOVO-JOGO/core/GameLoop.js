export class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.last = 0;
    this.running = false;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }

  frame(now) {
    if (!this.running) return;
    const delta = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.update(delta);
    this.render();
    requestAnimationFrame(this.frame);
  }
}
