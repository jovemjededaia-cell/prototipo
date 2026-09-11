import { Game } from './core/Game.js';
import { GAME_VERSION } from './data/game-version.js';

const canvas = document.querySelector('#game');
const game = new Game(canvas);

window.FantasyPixelGame = game;
window.FantasyPixelVersion = GAME_VERSION;

game.start();
