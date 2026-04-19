export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.network = this.registry.get('network');

    // Starry background
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a);
    bg.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) {
      bg.fillStyle(0xffffff, Math.random() * 0.6 + 0.2);
      bg.fillCircle(Math.random() * W, Math.random() * H, Math.random() + 0.5);
    }

    // Title
    this.add.text(W / 2, 70, 'MOONWALKER', {
      fontSize: '56px', fontFamily: 'monospace', color: '#FFD700',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(W / 2, 130, 'M A Y H E M', {
      fontSize: '36px', fontFamily: 'monospace', color: '#FF6644',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(W / 2, 175, '8-Player Online Co-op Beat-em-up', {
      fontSize: '15px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(0.5);

    // Name input
    this.add.text(W / 2, 230, 'YOUR NAME', {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0.5);

    this.playerName = '';
    this.nameDisplay = this.add.text(W / 2, 260, '_', {
      fontSize: '26px', fontFamily: 'monospace', color: '#FFD700',
      backgroundColor: '#1a1a2e', padding: { x: 80, y: 8 },
    }).setOrigin(0.5);

    // Create room button
    this.createBtn = this.makeButton(W / 2, 330, '  CREATE ROOM  ', 0x44BB44, () => this.doCreate());

    // Divider
    this.add.text(W / 2, 385, '- or join an existing room -', {
      fontSize: '13px', fontFamily: 'monospace', color: '#555',
    }).setOrigin(0.5);

    // Room code input
    this.add.text(W / 2, 425, 'ROOM CODE', {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0.5);

    this.roomCode = '';
    this.codeDisplay = this.add.text(W / 2, 455, '_ _ _ _', {
      fontSize: '30px', fontFamily: 'monospace', color: '#4488FF',
      backgroundColor: '#1a1a2e', padding: { x: 50, y: 8 },
    }).setOrigin(0.5);

    this.joinBtn = this.makeButton(W / 2, 520, '   JOIN ROOM   ', 0x4488FF, () => this.doJoin());

    // Error
    this.errorText = this.add.text(W / 2, H - 30, '', {
      fontSize: '15px', fontFamily: 'monospace', color: '#FF4444',
    }).setOrigin(0.5);

    // Input focus
    this.inputFocus = 'name';

    // Highlight boxes
    this.nameHighlight = this.add.graphics();
    this.codeHighlight = this.add.graphics();
    this.drawFocus();

    // Make text areas clickable
    this.nameDisplay.setInteractive().on('pointerdown', () => {
      this.inputFocus = 'name';
      this.drawFocus();
    });
    this.codeDisplay.setInteractive().on('pointerdown', () => {
      this.inputFocus = 'code';
      this.drawFocus();
    });

    // Keyboard
    this.input.keyboard.on('keydown', (ev) => this.handleKey(ev));

    // Network handlers
    this._onCreated = (msg) => {
      this.network.playerId = msg.playerId;
      this.network.roomId = msg.roomId;
      this.scene.start('LobbyScene');
    };
    this._onJoined = (msg) => {
      this.network.playerId = msg.playerId;
      this.network.roomId = msg.roomId;
      this.scene.start('LobbyScene');
    };
    this._onError = (msg) => {
      this.errorText.setText(msg.message);
    };
    this.network.on('room_created', this._onCreated);
    this.network.on('room_joined', this._onJoined);
    this.network.on('error', this._onError);

    this.events.on('shutdown', () => {
      this.network.off('room_created', this._onCreated);
      this.network.off('room_joined', this._onJoined);
      this.network.off('error', this._onError);
    });

    // Blink cursor
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => { this.cursorVisible = !this.cursorVisible; this.updateDisplays(); },
    });
    this.cursorVisible = true;
  }

  drawFocus() {
    this.nameHighlight.clear();
    this.codeHighlight.clear();

    const target = this.inputFocus === 'name' ? this.nameDisplay : this.codeDisplay;
    const gfx = this.inputFocus === 'name' ? this.nameHighlight : this.codeHighlight;
    const color = this.inputFocus === 'name' ? 0xFFD700 : 0x4488FF;

    gfx.lineStyle(2, color, 0.8);
    gfx.strokeRect(
      target.x - target.width / 2 - 4,
      target.y - target.height / 2 - 4,
      target.width + 8,
      target.height + 8
    );
  }

  handleKey(ev) {
    if (ev.key === 'Tab') {
      ev.preventDefault();
      this.inputFocus = this.inputFocus === 'name' ? 'code' : 'name';
      this.drawFocus();
      return;
    }
    if (ev.key === 'Enter') {
      if (this.inputFocus === 'code' && this.roomCode.length === 4) this.doJoin();
      else this.doCreate();
      return;
    }

    if (this.inputFocus === 'name') {
      if (ev.key === 'Backspace') {
        this.playerName = this.playerName.slice(0, -1);
      } else if (ev.key.length === 1 && this.playerName.length < 12) {
        this.playerName += ev.key;
      }
    } else {
      if (ev.key === 'Backspace') {
        this.roomCode = this.roomCode.slice(0, -1);
      } else if (ev.key.length === 1 && this.roomCode.length < 4) {
        this.roomCode += ev.key.toUpperCase();
      }
    }
    this.updateDisplays();
    this.drawFocus();
  }

  updateDisplays() {
    const cursor = this.cursorVisible ? '_' : ' ';
    this.nameDisplay.setText((this.playerName || '') + (this.inputFocus === 'name' ? cursor : ''));
    const code = this.roomCode.padEnd(4, ' ').split('').join(' ');
    this.codeDisplay.setText(code + (this.inputFocus === 'code' && this.roomCode.length < 4 ? cursor : ''));
  }

  makeButton(x, y, label, color, callback) {
    const hex = '#' + color.toString(16).padStart(6, '0');
    const btn = this.add.text(x, y, label, {
      fontSize: '20px', fontFamily: 'monospace', color: '#000',
      backgroundColor: hex, padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setAlpha(0.85));
    btn.on('pointerout', () => btn.setAlpha(1));
    btn.on('pointerdown', callback);
    return btn;
  }

  async doCreate() {
    const name = this.playerName.trim();
    if (!name) { this.errorText.setText('Enter a name first!'); return; }
    try {
      if (!this.network.connected) await this.network.connect();
      this.network.createRoom(name);
    } catch {
      this.errorText.setText('Could not connect to server');
    }
  }

  async doJoin() {
    const name = this.playerName.trim();
    if (!name) { this.errorText.setText('Enter a name first!'); return; }
    if (this.roomCode.length !== 4) { this.errorText.setText('Enter a 4-letter room code'); return; }
    try {
      if (!this.network.connected) await this.network.connect();
      this.network.joinRoom(this.roomCode, name);
    } catch {
      this.errorText.setText('Could not connect to server');
    }
  }
}
