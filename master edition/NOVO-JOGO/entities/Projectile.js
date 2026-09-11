export class Projectile {
  constructor(x, y, target, damage) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.radius = 5;
    this.speed = 520;
    this.alive = true;
  }

  update(dt) {
    if (!this.target || this.target.hp <= 0) {
      this.alive = false;
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy) || 1;
    const step = this.speed * dt;

    if (distance <= step + this.radius + this.target.radius) {
      this.target.takeDamage(this.damage);
      this.alive = false;
      return;
    }

    this.x += (dx / distance) * step;
    this.y += (dy / distance) * step;
  }
}
