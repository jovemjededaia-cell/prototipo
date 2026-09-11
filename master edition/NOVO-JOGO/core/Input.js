export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };

    target.addEventListener('keydown', (event) => {
      this.keys.add(event.key.toLowerCase());
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    });

    target.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
  }

  attachCanvas(canvas) {
    const updateMouse = (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
    };

    canvas.addEventListener('pointermove', updateMouse);
    canvas.addEventListener('pointerdown', (event) => {
      updateMouse(event);
      this.mouse.down = true;
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointerup', (event) => {
      updateMouse(event);
      this.mouse.down = false;
    });
    canvas.addEventListener('pointerleave', () => {
      this.mouse.down = false;
    });
  }

  down(...keys) {
    return keys.some((key) => this.keys.has(key.toLowerCase()));
  }

  movement() {
    let x = 0;
    let y = 0;
    if (this.down('a', 'arrowleft')) x -= 1;
    if (this.down('d', 'arrowright')) x += 1;
    if (this.down('w', 'arrowup')) y -= 1;
    if (this.down('s', 'arrowdown')) y += 1;

    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }
}
