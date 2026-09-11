import { Projectile } from '../entities/Projectile.js';

export class CombatSystem {
  constructor(state, collision) {
    this.state = state;
    this.collision = collision;
  }

  tryPlayerAttack(input) {
    const player = this.state.player;
    if (!player || !player.canAttack()) return;

    const wantsAttack = input.down(' ', 'j') || input.mouse.down;
    if (!wantsAttack) return;

    let target = null;
    let bestDistance = Infinity;

    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) continue;
      const distance = this.collision.distance(player, enemy);
      if (distance <= player.attackRange && distance < bestDistance) {
        target = enemy;
        bestDistance = distance;
      }
    }

    if (!target) return;

    player.startAttack();
    this.state.projectiles.push(new Projectile(player.x, player.y, target, player.damage));
  }

  updateEnemies(dt) {
    const player = this.state.player;
    for (const enemy of this.state.enemies) {
      enemy.update(dt, player);
      if (enemy.canAttack() && this.collision.overlaps(enemy, player, 3)) {
        enemy.startAttack();
        player.takeDamage(enemy.damage);
      }
    }
  }

  updateProjectiles(dt) {
    for (const projectile of this.state.projectiles) projectile.update(dt);
    this.state.projectiles = this.state.projectiles.filter((projectile) => projectile.alive);
  }

  cleanupDefeatedEnemies() {
    const defeated = this.state.enemies.filter((enemy) => enemy.hp <= 0).length;
    if (defeated) this.state.score += defeated;
    this.state.enemies = this.state.enemies.filter((enemy) => enemy.hp > 0);
  }
}
