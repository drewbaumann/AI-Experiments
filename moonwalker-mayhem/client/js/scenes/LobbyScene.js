export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  create() {
    const W = this.scale.width;
    this.network = this.registry.get('network');

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a);
    bg.fillRect(0, 0, W, this.scale.height);

    // Room code
    this.add.text(W / 2, 30, 'ROOM CODE', {
      fontSize: '14px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(0.5);

    this.add.text(W / 2, 65, this.network.roomId, {
      fontSize: '52px', fontFamily: 'monospace', color: '#FFD700',
      stroke: '#000', strokeThickness: 4, letterSpacing: 16,
    }).setOrigin(0.5);

    this.add.text(W / 2, 100, 'Share this code with your friends!', {
      fontSize: '13px', fontFamily: 'monospace', color: '#666',
    }).setOrigin(0.5);

    // Player list header
    this.add.text(W / 2, 145, 'PLAYERS', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ccc',
    }).setOrigin(0.5);

    // Player slots
    this.slotTexts = [];
    this.slotDots = [];
    for (let i = 0; i < 8; i++) {
      const y = 185 + i * 38;
      const dot = this.add.graphics();
      dot.x = W / 2 - 130;
      dot.y = y;
      this.slotDots.push(dot);

      const txt = this.add.text(W / 2 - 110, y, (i + 1) + '. waiting...', {
        fontSize: '17px', fontFamily: 'monospace', color: '#333',
      }).setOrigin(0, 0.5);
      this.slotTexts.push(txt);
    }

    // Start button
    this.startBtn = this.add.text(W / 2, 510, '  START GAME  ', {
      fontSize: '26px', fontFamily: 'monospace', color: '#000',
      backgroundColor: '#44DD44', padding: { x: 36, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);

    this.startBtn.on('pointerover', () => this.startBtn.setAlpha(0.85));
    this.startBtn.on('pointerout', () => this.startBtn.setAlpha(1));
    this.startBtn.on('pointerdown', () => this.network.startGame());

    // Controls reference
    const ctrlY = this.scale.height - 55;
    this.add.text(W / 2, ctrlY, 'Controls: Arrows/WASD = Move | Z/J = Punch | X/K = Kick | C/L = SPECIAL', {
      fontSize: '12px', fontFamily: 'monospace', color: '#555',
    }).setOrigin(0.5);
    this.add.text(W / 2, ctrlY + 20, 'Build up your special meter by hitting enemies, then unleash the DANCE ATTACK!', {
      fontSize: '11px', fontFamily: 'monospace', color: '#444',
    }).setOrigin(0.5);

    // Network handlers
    this._onLobby = (msg) => this.updateLobby(msg);
    this._onStart = () => this.scene.start('GameScene');
    this.network.on('lobby_update', this._onLobby);
    this.network.on('game_starting', this._onStart);

    this.events.on('shutdown', () => {
      this.network.off('lobby_update', this._onLobby);
      this.network.off('game_starting', this._onStart);
    });
  }

  updateLobby(msg) {
    const COLORS = window.C.PLAYER_COLORS;
    const HEX = window.C.PLAYER_COLOR_HEX;

    for (let i = 0; i < 8; i++) {
      this.slotDots[i].clear();
      if (i < msg.players.length) {
        const p = msg.players[i];
        const hostTag = p.isHost ? '  [HOST]' : '';
        this.slotTexts[i].setText((i + 1) + '. ' + p.name + hostTag);
        this.slotTexts[i].setColor(COLORS[p.colorIndex]);

        this.slotDots[i].fillStyle(HEX[p.colorIndex]);
        this.slotDots[i].fillCircle(0, 0, 6);
      } else {
        this.slotTexts[i].setText((i + 1) + '. waiting...');
        this.slotTexts[i].setColor('#333');
      }
    }

    const me = msg.players.find(p => p.id === this.network.playerId);
    this.startBtn.setVisible(me && me.isHost);
  }
}
