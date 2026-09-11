export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#161a20';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawGrid(size = 32) {
    const { ctx, canvas } = this;
    ctx.strokeStyle = '#20262e';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += size) {
      ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += size) {
      ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(canvas.width, y + .5); ctx.stroke();
    }
  }

  text(text, x, y, size = 16, align = 'left') {
    this.ctx.font = `600 ${size}px system-ui, sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.fillStyle = '#f4f1e8';
    this.ctx.fillText(text, x, y);
  }
}
