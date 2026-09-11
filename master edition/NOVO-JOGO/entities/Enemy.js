export class Enemy {
  constructor(x, y, level = 1) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.speed = 72 + level * 5;
    this.maxHp = 30 + level * 5;
    this.hp = this.maxHp;
    this.damage = 8 + Math.floor(level * 0.6);
    this.attackCooldown = 0.9;
    this.attackTimer = Math.random() * this.attackCooldown;
    this.hitFlash = 0;
  }

  update(dt, player) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance > this.radius + player.radius + 4) {
      this.x += (dx / distance) * this.speed * dt;
      this.y += (dy / distance) * this.speed * dt;
    }
  }

  canAttack() {
    return this.attackTimer <= 0;
  }

  startAttack() {
    this.attackTimer = this.attackCooldown;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.08;
    return this.hp <= 0;
  }
}
