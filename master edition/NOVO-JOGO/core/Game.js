import { GameState } from './GameState.js';
import { Input } from './Input.js';
import { Renderer } from './Renderer.js';
import { GameLoop } from './GameLoop.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = new GameState();
    this.input = new Input();
    this.input.attachCanvas(canvas);
    this.renderer = new Renderer(canvas);
    this.collision = new CollisionSystem();
    this.combat = new CombatSystem(this.state, this.collision);
    this.loop = new GameLoop((dt) => this.update(dt), () => this.render());
    this.spawnClock = 0;
    this.spawnInterval = 1.4;
    this.reset();
  }

  reset() {
    this.state.reset();
    this.state.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
    this.spawnClock = 0;
    this.spawnEnemy();
  }

  start() {
    this.loop.start();
  }

  spawnEnemy() {
    const margin = 36;
    const side = Math.floor(Math.random() * 4);
    const x = side === 0 ? margin : side === 1 ? this.canvas.width - margin : Math.random() * this.canvas.width;
    const y = side === 2 ? margin : side === 3 ? this.canvas.height - margin : Math.random() * this.canvas.height;
    this.state.enemies.push(new Enemy(x, y, this.state.wave));
  }

  update(dt) {
    if (this.input.down('r') && this.state.gameOver) {
      this.reset();
      return;
    }

    if (this.state.gameOver) return;

    this.state.time += dt;
    this.state.spawnTimer += dt;
    this.spawnClock += dt;

    const player = this.state.player;
    player.update(dt, this.input, this.canvas);
    this.combat.tryPlayerAttack(this.input);
    this.combat.updateEnemies(dt);
    this.combat.updateProjectiles(dt);
    this.combat.cleanupDefeatedEnemies();

    if (this.spawnClock >= this.spawnInterval) {
      this.spawnClock = 0;
      this.spawnEnemy();
      this.state.wave = 1 + Math.floor(this.state.score / 8);
      this.spawnInterval = Math.max(0.55, 1.4 - this.state.wave * 0.08);
    }

    if (player.hp <= 0) {
      this.state.gameOver = true;
      this.state.running = false;
    }
  }

  render() {
    const { ctx } = this.renderer;
    const { width, height } = this.canvas;
    this.renderer.clear();
    this.renderer.drawGrid();

    // Projectiles
    for (const projectile of this.state.projectiles) {
      ctx.fillStyle = '#f6d365';
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Enemies
    for (const enemy of this.state.enemies) {
      ctx.fillStyle = enemy.hitFlash > 0 ? '#fff4df' : '#d84a4a';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#311216';
      ctx.fillRect(enemy.x - 16, enemy.y - 23, 32, 4);
      ctx.fillStyle = '#66d17a';
      ctx.fillRect(enemy.x - 16, enemy.y - 23, 32 * (enemy.hp / enemy.maxHp), 4);
    }

    // Player
    const player = this.state.player;
    ctx.globalAlpha = player.invulnerability > 0 && Math.floor(player.invulnerability * 30) % 2 === 0 ? .45 : 1;
    ctx.fillStyle = '#4da3ff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = 'rgba(8, 10, 14, .82)';
    ctx.fillRect(14, 14, 250, 74);
    this.renderer.text(`HP ${Math.ceil(player.hp)} / ${player.maxHp}`, 26, 38, 16);
    ctx.fillStyle = '#252b35';
    ctx.fillRect(26, 48, 210, 10);
    ctx.fillStyle = '#5bd17a';
    ctx.fillRect(26, 48, 210 * (player.hp / player.maxHp), 10);
    this.renderer.text(`Derrotados: ${this.state.score}  •  Onda: ${this.state.wave}`, 26, 78, 13);

    if (this.state.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, .68)';
      ctx.fillRect(0, 0, width, height);
      this.renderer.text('DERROTA', width / 2, height / 2 - 12, 36, 'center');
      this.renderer.text(`Você derrotou ${this.state.score} inimigos`, width / 2, height / 2 + 20, 16, 'center');
      this.renderer.text('Pressione R para recomeçar', width / 2, height / 2 + 52, 14, 'center');
    }
  }
}
