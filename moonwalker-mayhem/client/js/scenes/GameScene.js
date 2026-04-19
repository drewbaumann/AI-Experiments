const CC = window.C;

function darken(color, amount) {
  const f = amount || 0.6;
  const r = ((color >> 16) & 0xFF) * f;
  const g = ((color >> 8) & 0xFF) * f;
  const b = (color & 0xFF) * f;
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

function lighten(color, amount) {
  const f = amount || 1.35;
  const r = Math.min(255, ((color >> 16) & 0xFF) * f);
  const g = Math.min(255, ((color >> 8) & 0xFF) * f);
  const b = Math.min(255, (color & 0xFF) * f);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.network = this.registry.get('network');

    this.gameState = {
      players: [], enemies: [], effects: [],
      level: { scrollX: 0, wave: 0, waveState: 'fighting' },
    };

    // Rendering layers (order matters for depth)
    this.bgLayer = this.add.container(0, 0);
    this.entityLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);

    this.createBackground();

    this.playerSprites = new Map();
    this.enemySprites = new Map();
    this.effectSprites = [];

    // HUD (fixed on screen, not in scrolling containers)
    this.createHUD();

    // Input keys
    this.keys = {
      up: this.input.keyboard.addKey('UP'),
      down: this.input.keyboard.addKey('DOWN'),
      left: this.input.keyboard.addKey('LEFT'),
      right: this.input.keyboard.addKey('RIGHT'),
      w: this.input.keyboard.addKey('W'),
      a: this.input.keyboard.addKey('A'),
      s: this.input.keyboard.addKey('S'),
      d: this.input.keyboard.addKey('D'),
      attack: this.input.keyboard.addKey('Z'),
      attackAlt: this.input.keyboard.addKey('J'),
      kick: this.input.keyboard.addKey('X'),
      kickAlt: this.input.keyboard.addKey('K'),
      special: this.input.keyboard.addKey('C'),
      specialAlt: this.input.keyboard.addKey('L'),
    };

    // Network
    this._onState = (s) => { this.gameState = s; };
    this._onGameOver = (msg) => this.showGameOver(msg);
    this.network.on('state', this._onState);
    this.network.on('game_over', this._onGameOver);

    this.events.on('shutdown', () => {
      this.network.off('state', this._onState);
      this.network.off('game_over', this._onGameOver);
    });

    this.lastWave = -1;
    this.gameOver = false;

    // "GO!" arrow
    this.goText = this.add.text(CC.GAME_WIDTH - 80, CC.GAME_HEIGHT / 2, 'GO >>>',{
      fontSize: '28px', fontFamily: 'monospace', color: '#FFD700',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(150).setAlpha(0);
  }

  update() {
    if (this.gameOver) return;

    this.network.sendInput({
      up: this.keys.up.isDown || this.keys.w.isDown,
      down: this.keys.down.isDown || this.keys.s.isDown,
      left: this.keys.left.isDown || this.keys.a.isDown,
      right: this.keys.right.isDown || this.keys.d.isDown,
      attack: this.keys.attack.isDown || this.keys.attackAlt.isDown,
      kick: this.keys.kick.isDown || this.keys.kickAlt.isDown,
      special: this.keys.special.isDown || this.keys.specialAlt.isDown,
    });

    this.renderState();
  }

  // ---- Background ----

  createBackground() {
    const gfx = this.add.graphics();
    const totalW = CC.LEVEL_WIDTH + CC.GAME_WIDTH;

    // Night sky
    gfx.fillStyle(0x0a0a1e);
    gfx.fillRect(0, 0, totalW, CC.GAME_HEIGHT);

    // Stars
    const rng = this.mulberry32(42);
    for (let i = 0; i < 200; i++) {
      gfx.fillStyle(0xffffff, rng() * 0.7 + 0.1);
      gfx.fillCircle(rng() * totalW, rng() * 250, rng() * 1.2 + 0.3);
    }

    // Moon
    gfx.fillStyle(0xFFFFCC, 0.9);
    gfx.fillCircle(400, 80, 45);
    gfx.fillStyle(0x0a0a1e);
    gfx.fillCircle(420, 70, 40);

    // Far buildings (dark silhouettes)
    for (let x = 0; x < totalW; x += 90 + rng() * 70) {
      const h = 60 + rng() * 120;
      const w = 40 + rng() * 50;
      gfx.fillStyle(0x111122);
      gfx.fillRect(x, 280 - h, w, h + 80);
    }

    // Near buildings
    for (let x = 0; x < totalW; x += 100 + rng() * 60) {
      const h = 80 + rng() * 140;
      const w = 50 + rng() * 45;
      gfx.fillStyle(0x1a1a2e);
      gfx.fillRect(x, 310 - h, w, h + 60);

      // Windows
      for (let wy = 320 - h; wy < 350; wy += 18) {
        for (let wx = x + 6; wx < x + w - 10; wx += 14) {
          const lit = rng() > 0.4;
          gfx.fillStyle(lit ? 0xFFDD77 : 0x222244, lit ? 0.7 : 0.3);
          gfx.fillRect(wx, wy, 7, 10);
        }
      }
    }

    // Sidewalk
    gfx.fillStyle(0x333340);
    gfx.fillRect(0, CC.FLOOR_MIN_Y - 15, totalW, CC.GAME_HEIGHT - CC.FLOOR_MIN_Y + 15);

    // Road surface
    gfx.fillStyle(0x2a2a35);
    gfx.fillRect(0, CC.FLOOR_MIN_Y - 15, totalW, 6);

    // Lane stripes
    gfx.fillStyle(0x555560);
    for (let x = 0; x < totalW; x += 80) {
      gfx.fillRect(x, CC.FLOOR_MAX_Y + 15, 40, 3);
    }

    // Curb detail
    gfx.fillStyle(0x444450);
    gfx.fillRect(0, CC.FLOOR_MAX_Y + 25, totalW, 2);

    this.bgLayer.add(gfx);
  }

  mulberry32(seed) {
    let t = seed;
    return function() {
      t = (t + 0x6D2B79F5) | 0;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- Players ----

  renderPlayers(players) {
    if (!players) return;
    const activeIds = new Set();

    for (const p of players) {
      activeIds.add(p.id);
      let sp = this.playerSprites.get(p.id);
      if (!sp) {
        sp = this.createPlayerSprite(p);
        this.playerSprites.set(p.id, sp);
        this.entityLayer.add(sp.container);
      }
      this.updatePlayerSprite(sp, p);
    }

    for (const [id, sp] of this.playerSprites) {
      if (!activeIds.has(id)) {
        sp.container.destroy();
        this.playerSprites.delete(id);
      }
    }
  }

  createPlayerSprite(p) {
    const container = this.add.container(p.x, p.y);
    const gfx = this.add.graphics();
    container.add(gfx);

    const nameTag = this.add.text(0, -62, p.name, {
      fontSize: '10px', fontFamily: 'monospace',
      color: CC.PLAYER_COLORS[p.colorIndex],
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(nameTag);

    const hpBg = this.add.graphics();
    container.add(hpBg);
    const hpBar = this.add.graphics();
    container.add(hpBar);
    const spBar = this.add.graphics();
    container.add(spBar);

    return { container, gfx, nameTag, hpBg, hpBar, spBar, colorIndex: p.colorIndex };
  }

  updatePlayerSprite(sp, p) {
    sp.container.x = p.x;
    sp.container.y = p.y;

    const { gfx, hpBar, hpBg, spBar } = sp;
    const color = CC.PLAYER_COLOR_HEX[p.colorIndex];
    const now = this.time.now;
    gfx.clear();

    if (!p.alive) {
      // Dead: lying flat
      gfx.fillStyle(color, 0.4);
      gfx.fillRoundedRect(-22, -8, 44, 12, 4);
      hpBar.clear(); hpBg.clear(); spBar.clear();
      return;
    }

    const flash = p.state === 'hurt' && Math.floor(now / 80) % 2;
    const dc = flash ? 0xFFFFFF : color;
    const f = p.facing;

    // Special glow aura
    if (p.state === 'special') {
      const pulse = Math.sin(now / 60) * 0.15 + 0.35;
      gfx.fillStyle(0xFFFF00, pulse);
      gfx.fillCircle(0, -22, 38);
      gfx.fillStyle(0xFFFFFF, pulse * 0.5);
      gfx.fillCircle(0, -22, 28);
    }

    // Shadow
    gfx.fillStyle(0x000000, 0.25);
    gfx.fillEllipse(0, 2, 30, 8);

    // Legs
    const walkBob = p.state === 'walk' ? Math.sin(now / 80) * 4 : 0;
    gfx.fillStyle(darken(dc, 0.55));
    if (p.state === 'kick') {
      gfx.fillRect(-7, -10, 6, 12);
      gfx.fillRect(f * 8, -8, f * 28, 7);
      gfx.fillStyle(lighten(dc, 1.1));
      gfx.fillRect(f * 30, -10, f * 8, 5); // shoe
    } else {
      gfx.fillRect(-8, -10 + walkBob, 6, 12);
      gfx.fillRect(3, -10 - walkBob, 6, 12);
    }

    // Body
    gfx.fillStyle(dc);
    gfx.fillRoundedRect(-13, -38, 26, 30, 3);

    // Belt
    gfx.fillStyle(darken(dc, 0.4));
    gfx.fillRect(-13, -12, 26, 3);

    // Arms
    gfx.fillStyle(dc);
    if (p.state === 'attack1' || p.state === 'attack2' || p.state === 'attack3') {
      const reach = p.state === 'attack3' ? 32 : p.state === 'attack2' ? 26 : 20;
      // Punching arm
      gfx.fillRect(f * 13, -34, f * reach, 7);
      // Fist
      gfx.fillStyle(lighten(dc));
      gfx.fillRect(f * (13 + reach - 2), -36, f > 0 ? 8 : -8, 10);
      // Other arm
      gfx.fillStyle(dc);
      gfx.fillRect(-f * 17, -32, 6, 15);
    } else if (p.state === 'special') {
      // Arms up in dance pose
      gfx.fillRect(-20, -50, 7, 20);
      gfx.fillRect(13, -50, 7, 20);
      // Hands
      gfx.fillStyle(lighten(dc));
      gfx.fillCircle(-16, -52, 4);
      gfx.fillCircle(17, -52, 4);
    } else {
      gfx.fillRect(-17, -33, 5, 16);
      gfx.fillRect(12, -33, 5, 16);
    }

    // Head
    gfx.fillStyle(lighten(dc, 1.2));
    gfx.fillCircle(0, -46, 10);

    // Hair
    gfx.fillStyle(darken(dc, 0.35));
    gfx.fillArc(0, -46, 10, -Math.PI, -0.2);
    gfx.fillRect(-6, -56, 12, 4);

    // Eyes
    gfx.fillStyle(0xFFFFFF);
    gfx.fillCircle(f * 2 - 3, -47, 2.5);
    gfx.fillCircle(f * 2 + 4, -47, 2.5);
    gfx.fillStyle(0x000000);
    gfx.fillCircle(f * 3 - 3, -47, 1.2);
    gfx.fillCircle(f * 3 + 4, -47, 1.2);

    // Mouth
    if (p.state === 'special') {
      gfx.fillStyle(0x000000);
      gfx.fillCircle(f * 1, -41, 2.5);
    } else if (p.state === 'hurt') {
      gfx.lineStyle(1.5, 0x000000);
      gfx.beginPath();
      gfx.moveTo(-3, -40);
      gfx.lineTo(3, -42);
      gfx.strokePath();
    }

    // Health bar
    hpBg.clear();
    hpBg.fillStyle(0x222222);
    hpBg.fillRect(-22, -55, 44, 5);
    hpBg.lineStyle(1, 0x000000);
    hpBg.strokeRect(-22, -55, 44, 5);

    hpBar.clear();
    const hpPct = Math.max(0, p.health / p.maxHealth);
    const hpColor = hpPct > 0.5 ? 0x44DD44 : hpPct > 0.25 ? 0xFFDD44 : 0xFF4444;
    hpBar.fillStyle(hpColor);
    hpBar.fillRect(-22, -55, 44 * hpPct, 5);

    // Special bar
    spBar.clear();
    const spPct = (p.special || 0) / CC.SPECIAL_COST;
    spBar.fillStyle(0x222222);
    spBar.fillRect(-22, -49, 44, 3);
    if (spPct > 0) {
      const spColor = spPct >= 1.0 ? 0xFFD700 : 0x4488FF;
      spBar.fillStyle(spColor);
      spBar.fillRect(-22, -49, 44 * spPct, 3);
    }
  }

  // ---- Enemies ----

  renderEnemies(enemies) {
    if (!enemies) return;
    const activeIds = new Set();

    for (const e of enemies) {
      activeIds.add(e.id);
      let sp = this.enemySprites.get(e.id);
      if (!sp) {
        sp = this.createEnemySprite(e);
        this.enemySprites.set(e.id, sp);
        this.entityLayer.add(sp.container);
      }
      this.updateEnemySprite(sp, e);
    }

    for (const [id, sp] of this.enemySprites) {
      if (!activeIds.has(id)) {
        sp.container.destroy();
        this.enemySprites.delete(id);
      }
    }
  }

  createEnemySprite(e) {
    const container = this.add.container(e.x, e.y);
    const gfx = this.add.graphics();
    container.add(gfx);

    const hpBg = this.add.graphics();
    container.add(hpBg);
    const hpBar = this.add.graphics();
    container.add(hpBar);

    if (e.type === 'boss') {
      const label = this.add.text(0, -75, 'BOSS', {
        fontSize: '11px', fontFamily: 'monospace', color: '#FF4444',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      container.add(label);
    }

    return { container, gfx, hpBg, hpBar };
  }

  updateEnemySprite(sp, e) {
    sp.container.x = e.x;
    sp.container.y = e.y;

    const { gfx, hpBar, hpBg } = sp;
    const et = CC.ENEMY_TYPES[e.type];
    const color = et.color;
    const sc = et.scale;
    const now = this.time.now;

    gfx.clear();

    const flash = e.state === 'hurt' && Math.floor(now / 70) % 2;
    const dc = flash ? 0xFFFFFF : color;
    const f = e.facing;

    // Shadow
    gfx.fillStyle(0x000000, 0.25);
    gfx.fillEllipse(0, 2, 26 * sc, 7 * sc);

    // Legs
    const walkBob = e.state === 'walk' ? Math.sin(now / 100) * 3 : 0;
    gfx.fillStyle(darken(dc, 0.5));
    gfx.fillRect(-7 * sc, -8 * sc + walkBob, 6 * sc, 10 * sc);
    gfx.fillRect(2 * sc, -8 * sc - walkBob, 6 * sc, 10 * sc);

    // Body
    gfx.fillStyle(dc);
    gfx.fillRoundedRect(-11 * sc, -34 * sc, 22 * sc, 28 * sc, 2);

    // Arms
    if (e.state === 'attack') {
      gfx.fillRect(f * 11 * sc, -30 * sc, f * 22 * sc, 7 * sc);
      gfx.fillStyle(lighten(dc));
      gfx.fillCircle(f * (11 + 22) * sc, -27 * sc, 4 * sc);
    } else {
      gfx.fillRect(-14 * sc, -30 * sc, 5 * sc, 14 * sc);
      gfx.fillRect(9 * sc, -30 * sc, 5 * sc, 14 * sc);
    }

    // Head
    gfx.fillStyle(lighten(dc, 1.15));
    gfx.fillCircle(0, -40 * sc, 9 * sc);

    // Angry eyes
    gfx.fillStyle(0xFF2200);
    gfx.fillCircle(f * 2 - 2, -42 * sc, 2 * sc);
    gfx.fillCircle(f * 2 + 4, -42 * sc, 2 * sc);
    // Eyebrows
    gfx.lineStyle(1.5, 0x000000);
    gfx.beginPath();
    gfx.moveTo(-5, -45 * sc);
    gfx.lineTo(-1, -44 * sc);
    gfx.moveTo(2, -44 * sc);
    gfx.lineTo(6, -45 * sc);
    gfx.strokePath();

    // Health bar
    const barW = 28 * sc;
    const barY = -50 * sc;
    hpBg.clear();
    hpBg.fillStyle(0x222222);
    hpBg.fillRect(-barW / 2, barY, barW, 4);

    hpBar.clear();
    const hpPct = Math.max(0, e.health / e.maxHealth);
    hpBar.fillStyle(0xFF4444);
    hpBar.fillRect(-barW / 2, barY, barW * hpPct, 4);
  }

  // ---- Effects ----

  renderEffects(effects) {
    for (const s of this.effectSprites) s.destroy();
    this.effectSprites = [];
    if (!effects) return;

    for (const e of effects) {
      const gfx = this.add.graphics();
      gfx.x = e.x;
      gfx.y = e.y;

      if (e.type === 'hit') {
        const count = 5;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + (e.timer * 0.3);
          const len = 6 + e.timer * 0.8;
          gfx.fillStyle(0xFFFF00);
          gfx.fillRect(Math.cos(angle) * len - 2, Math.sin(angle) * len - 2, 4, 4);
        }
      } else if (e.type === 'playerHit') {
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const len = 5 + e.timer;
          gfx.fillStyle(0xFF3333);
          gfx.fillRect(Math.cos(angle) * len - 2, Math.sin(angle) * len - 2, 4, 4);
        }
      } else if (e.type === 'kill') {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const len = 10 + e.timer * 1.2;
          gfx.fillStyle(i % 2 === 0 ? 0xFF8800 : 0xFFCC00);
          gfx.fillStar(Math.cos(angle) * len, Math.sin(angle) * len, 4, 2, 4);
        }
      }

      this.fxLayer.add(gfx);
      this.effectSprites.push(gfx);
    }
  }

  // ---- HUD ----

  createHUD() {
    this.scoreText = this.add.text(10, 8, 'Score: 0', {
      fontSize: '16px', fontFamily: 'monospace', color: '#fff',
      stroke: '#000', strokeThickness: 4,
    }).setDepth(200);

    this.waveText = this.add.text(CC.GAME_WIDTH / 2, 8, 'Wave 1', {
      fontSize: '16px', fontFamily: 'monospace', color: '#FFD700',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(200);

    this.aliveText = this.add.text(CC.GAME_WIDTH - 10, 8, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaa',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(200);

    // Big center announcement text
    this.announceText = this.add.text(CC.GAME_WIDTH / 2, CC.GAME_HEIGHT / 2 - 40, '', {
      fontSize: '40px', fontFamily: 'monospace', color: '#FFD700',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(250).setAlpha(0);

    // Mini player status bar at bottom
    this.playerStatusTexts = [];
    for (let i = 0; i < 8; i++) {
      const x = 10 + i * 127;
      const st = this.add.text(x, CC.GAME_HEIGHT - 22, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#888',
        stroke: '#000', strokeThickness: 2,
      }).setDepth(200);
      this.playerStatusTexts.push(st);
    }
  }

  updateHUD(players, level) {
    if (!players) return;

    const me = players.find(p => p.id === this.network.playerId);
    if (me) {
      this.scoreText.setText('Score: ' + me.score);
    }

    const wave = (level?.wave ?? 0) + 1;
    this.waveText.setText('Wave ' + wave + ' / ' + 8);

    const alive = players.filter(p => p.alive).length;
    this.aliveText.setText(alive + '/' + players.length + ' alive');

    // Wave announcements
    if (level && level.wave !== this.lastWave) {
      this.lastWave = level.wave;
      this.showAnnouncement('WAVE ' + (level.wave + 1));
    }

    if (level && level.waveState === 'scrolling') {
      this.goText.setAlpha(Math.sin(this.time.now / 200) * 0.4 + 0.6);
    } else {
      this.goText.setAlpha(0);
    }

    // Mini status
    for (let i = 0; i < 8; i++) {
      if (i < players.length) {
        const p = players[i];
        const hp = Math.ceil(p.health);
        const sp = Math.floor((p.special / CC.SPECIAL_COST) * 100);
        const status = p.alive ? hp + 'HP' : 'KO';
        this.playerStatusTexts[i].setText(p.name + ' ' + status);
        this.playerStatusTexts[i].setColor(p.alive ? CC.PLAYER_COLORS[p.colorIndex] : '#444');
      } else {
        this.playerStatusTexts[i].setText('');
      }
    }
  }

  showAnnouncement(text) {
    this.announceText.setText(text).setAlpha(1);
    this.tweens.add({
      targets: this.announceText,
      alpha: 0,
      y: CC.GAME_HEIGHT / 2 - 70,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        this.announceText.y = CC.GAME_HEIGHT / 2 - 40;
      }
    });
  }

  // ---- Main Render Loop ----

  renderState() {
    const state = this.gameState;
    const scrollX = state.level?.scrollX || 0;

    // Scroll layers
    this.bgLayer.x = -scrollX;
    this.entityLayer.x = -scrollX;
    this.fxLayer.x = -scrollX;

    this.renderPlayers(state.players);
    this.renderEnemies(state.enemies);
    this.renderEffects(state.effects);
    this.updateHUD(state.players, state.level);

    // Depth sort entities by y
    this.entityLayer.sort('y');
  }

  // ---- Game Over ----

  showGameOver(msg) {
    this.gameOver = true;
    const W = CC.GAME_WIDTH;
    const H = CC.GAME_HEIGHT;

    // Dim overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, W, H);
    overlay.setDepth(300);

    const isVictory = msg.result === 'victory';
    const title = isVictory ? 'VICTORY!' : 'GAME OVER';
    const color = isVictory ? '#FFD700' : '#FF4444';

    this.add.text(W / 2, H / 2 - 80, title, {
      fontSize: '56px', fontFamily: 'monospace', color,
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(310);

    if (msg.scores) {
      this.add.text(W / 2, H / 2 - 20, 'SCOREBOARD', {
        fontSize: '18px', fontFamily: 'monospace', color: '#aaa',
      }).setOrigin(0.5).setDepth(310);

      let y = H / 2 + 15;
      for (let i = 0; i < msg.scores.length; i++) {
        const s = msg.scores[i];
        const medal = i === 0 ? ' ★' : '';
        this.add.text(W / 2, y, s.name + ': ' + s.score + medal, {
          fontSize: '20px', fontFamily: 'monospace',
          color: CC.PLAYER_COLORS[s.colorIndex],
          stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(310);
        y += 30;
      }
    }

    this.add.text(W / 2, H - 40, 'Refresh to play again', {
      fontSize: '14px', fontFamily: 'monospace', color: '#666',
    }).setOrigin(0.5).setDepth(310);
  }
}
