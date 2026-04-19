import { Network } from './Network.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';

const network = new Network();

const config = {
  type: Phaser.AUTO,
  width: window.C.GAME_WIDTH,
  height: window.C.GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#000000',
  scene: [MenuScene, LobbyScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

const game = new Phaser.Game(config);
game.registry.set('network', network);
