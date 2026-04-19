const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const C = require('../shared/constants.js');

const app = express();
app.use(express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

let nextId = 1;
function genId() { return 'p' + (nextId++); }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

// --- Wave Definitions ---
const WAVES = [
  { enemies: [{ type: 'goon', count: 3 }] },
  { enemies: [{ type: 'goon', count: 5 }] },
  { enemies: [{ type: 'goon', count: 4 }, { type: 'tough', count: 1 }] },
  { enemies: [{ type: 'goon', count: 6 }, { type: 'tough', count: 2 }] },
  { enemies: [{ type: 'tough', count: 3 }, { type: 'goon', count: 4 }] },
  { enemies: [{ type: 'goon', count: 8 }] },
  { enemies: [{ type: 'tough', count: 4 }, { type: 'goon', count: 5 }] },
  { enemies: [{ type: 'boss', count: 1 }, { type: 'goon', count: 6 }] },
];

// --- Room Management ---
const rooms = new Map();

class GameRoom {
  constructor(id) {
    this.id = id;
    this.hostWs = null;
    this.players = new Map();
    this.enemies = [];
    this.effects = [];
    this.nextEnemyId = 0;
    this.gameState = 'lobby';
    this.level = {
      scrollX: 0,
      targetScrollX: 0,
      wave: 0,
      waveState: 'waiting',
      clearedTimer: 0,
    };
    this.tickInterval = null;
    this.frameCount = 0;
  }

  get playerCount() { return this.players.size; }
  get alivePlayers() { return [...this.players.values()].filter(p => p.alive); }

  addPlayer(ws, name) {
    if (this.players.size >= C.MAX_PLAYERS) return null;

    const colorIndex = this.findAvailableColor();
    const player = {
      id: genId(),
      name: name || 'Player ' + (colorIndex + 1),
      colorIndex,
      x: 200 + colorIndex * 50,
      y: C.FLOOR_MIN_Y + (C.FLOOR_MAX_Y - C.FLOOR_MIN_Y) / 2,
      facing: 1,
      health: C.PLAYER_HEALTH,
      maxHealth: C.PLAYER_HEALTH,
      special: 0,
      state: 'idle',
      stateTimer: 0,
      comboCount: 0,
      comboWindow: 0,
      score: 0,
      alive: true,
      input: {},
      prevInput: {},
      attackHitIds: new Set(),
    };

    if (this.players.size === 0) this.hostWs = ws;
    this.players.set(ws, player);
    return player;
  }

  findAvailableColor() {
    const used = new Set([...this.players.values()].map(p => p.colorIndex));
    for (let i = 0; i < C.MAX_PLAYERS; i++) {
      if (!used.has(i)) return i;
    }
    return 0;
  }

  removePlayer(ws) {
    this.players.delete(ws);
    if (ws === this.hostWs && this.players.size > 0) {
      this.hostWs = this.players.keys().next().value;
    }
    if (this.players.size === 0) {
      this.stop();
      rooms.delete(this.id);
    }
  }

  start() {
    this.gameState = 'playing';
    this.level.wave = 0;
    this.spawnWave();
    this.tickInterval = setInterval(() => this.tick(), 1000 / C.TICK_RATE);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  tick() {
    this.frameCount++;
    this.updatePlayers();
    this.updateEnemies();
    this.checkCollisions();
    this.updateLevel();
    this.broadcastState();
  }

  updatePlayers() {
    for (const [ws, p] of this.players) {
      if (!p.alive) continue;

      if (p.stateTimer > 0) p.stateTimer--;
      if (p.comboWindow > 0) p.comboWindow--;

      const attacking = ['attack1', 'attack2', 'attack3', 'kick'].includes(p.state);
      if (p.stateTimer === 0 && attacking) {
        p.state = 'idle';
        p.attackHitIds = new Set();
      }
      if (p.stateTimer === 0 && p.state === 'hurt') {
        p.state = 'idle';
      }
      if (p.stateTimer === 0 && p.state === 'special') {
        p.state = 'idle';
        p.attackHitIds = new Set();
      }

      const canAct = p.state === 'idle' || p.state === 'walk';
      const input = p.input || {};
      const prev = p.prevInput || {};

      if (canAct) {
        let dx = 0, dy = 0;
        if (input.left) dx -= C.PLAYER_SPEED;
        if (input.right) dx += C.PLAYER_SPEED;
        if (input.up) dy -= C.PLAYER_SPEED;
        if (input.down) dy += C.PLAYER_SPEED;

        if (dx !== 0 && dy !== 0) {
          dx *= 0.707;
          dy *= 0.707;
        }

        if (dx !== 0 || dy !== 0) {
          if (dx !== 0) p.facing = dx > 0 ? 1 : -1;
          p.x += dx;
          p.y += dy;
          p.y = Math.max(C.FLOOR_MIN_Y, Math.min(C.FLOOR_MAX_Y, p.y));
          p.x = Math.max(this.level.scrollX + 30, Math.min(this.level.scrollX + C.GAME_WIDTH - 30, p.x));
          p.state = 'walk';
        } else if (p.state === 'walk') {
          p.state = 'idle';
        }

        if (input.attack && !prev.attack) {
          if (p.comboWindow > 0 && p.comboCount === 1) {
            p.state = 'attack2';
            p.stateTimer = C.ATTACK_DURATION;
            p.comboCount = 2;
            p.comboWindow = C.COMBO_WINDOW;
          } else if (p.comboWindow > 0 && p.comboCount === 2) {
            p.state = 'attack3';
            p.stateTimer = C.ATTACK_DURATION + 6;
            p.comboCount = 0;
            p.comboWindow = 0;
          } else {
            p.state = 'attack1';
            p.stateTimer = C.ATTACK_DURATION;
            p.comboCount = 1;
            p.comboWindow = C.COMBO_WINDOW;
          }
          p.attackHitIds = new Set();
        }

        if (input.kick && !prev.kick) {
          p.state = 'kick';
          p.stateTimer = C.KICK_DURATION;
          p.comboCount = 0;
          p.comboWindow = 0;
          p.attackHitIds = new Set();
        }

        if (input.special && !prev.special && p.special >= C.SPECIAL_COST) {
          p.state = 'special';
          p.stateTimer = C.SPECIAL_DURATION;
          p.special = 0;
          p.comboCount = 0;
          p.comboWindow = 0;
          p.attackHitIds = new Set();
        }
      }

      p.prevInput = { ...input };
    }
  }

  updateEnemies() {
    const alive = this.alivePlayers;
    if (alive.length === 0) return;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.stateTimer > 0) e.stateTimer--;

      if (e.stateTimer === 0 && e.state === 'hurt') e.state = 'idle';
      if (e.stateTimer === 0 && e.state === 'attack') e.state = 'idle';

      if (e.state === 'idle' || e.state === 'walk') {
        let nearest = null, nearDist = Infinity;
        for (const p of alive) {
          const d = Math.hypot(p.x - e.x, p.y - e.y);
          if (d < nearDist) { nearDist = d; nearest = p; }
        }

        if (!nearest) continue;
        const et = C.ENEMY_TYPES[e.type];

        if (nearDist < et.attackRange && Math.abs(nearest.y - e.y) < 25) {
          e.state = 'attack';
          e.stateTimer = C.ENEMY_ATTACK_DURATION;
          e.facing = nearest.x > e.x ? 1 : -1;
          e.attackHit = false;
        } else if (nearDist < C.ENEMY_AGGRO_RANGE) {
          const dx = nearest.x - e.x;
          const dy = nearest.y - e.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          e.x += (dx / dist) * et.speed;
          e.y += (dy / dist) * et.speed;
          e.y = Math.max(C.FLOOR_MIN_Y, Math.min(C.FLOOR_MAX_Y, e.y));
          e.facing = dx > 0 ? 1 : -1;
          e.state = 'walk';
        } else {
          e.state = 'idle';
        }
      }
    }
  }

  checkCollisions() {
    for (const [ws, p] of this.players) {
      if (!p.alive) continue;
      const isAttacking = ['attack1', 'attack2', 'attack3', 'kick', 'special'].includes(p.state);
      if (!isAttacking) continue;

      let damage, range;
      if (p.state === 'attack1') { damage = C.PUNCH1_DAMAGE; range = C.ATTACK_RANGE; }
      else if (p.state === 'attack2') { damage = C.PUNCH2_DAMAGE; range = C.ATTACK_RANGE; }
      else if (p.state === 'attack3') { damage = C.PUNCH3_DAMAGE; range = C.ATTACK_RANGE + 15; }
      else if (p.state === 'kick') { damage = C.KICK_DAMAGE; range = C.KICK_RANGE; }
      else { damage = C.SPECIAL_DAMAGE; range = 9999; }

      for (const e of this.enemies) {
        if (!e.alive || p.attackHitIds.has(e.id)) continue;

        let inRange = false;
        if (p.state === 'special') {
          inRange = e.x > this.level.scrollX - 50 && e.x < this.level.scrollX + C.GAME_WIDTH + 50;
        } else {
          const dx = e.x - p.x;
          const dy = Math.abs(e.y - p.y);
          inRange = (dx * p.facing >= -15) && Math.abs(dx) < range && dy < 35;
        }

        if (inRange) {
          p.attackHitIds.add(e.id);
          e.health -= damage;
          e.state = 'hurt';
          e.stateTimer = C.ENEMY_HURT_DURATION;
          e.x += p.facing * (p.state === 'attack3' ? 25 : p.state === 'kick' ? 20 : 12);
          p.special = Math.min(C.SPECIAL_COST, p.special + C.SPECIAL_GAIN_ON_HIT);
          this.effects.push({ type: 'hit', x: e.x, y: e.y - 25, timer: 8 });

          if (e.health <= 0) {
            e.alive = false;
            p.score += C.ENEMY_TYPES[e.type].score;
            p.special = Math.min(C.SPECIAL_COST, p.special + C.SPECIAL_GAIN_ON_KILL);
            this.effects.push({ type: 'kill', x: e.x, y: e.y - 20, timer: 18 });
          }
        }
      }
    }

    for (const e of this.enemies) {
      if (!e.alive || e.state !== 'attack') continue;
      if (e.stateTimer !== Math.floor(C.ENEMY_ATTACK_DURATION / 2)) continue;
      if (e.attackHit) continue;

      const et = C.ENEMY_TYPES[e.type];
      for (const [ws, p] of this.players) {
        if (!p.alive || p.state === 'hurt' || p.state === 'special') continue;
        const dx = Math.abs(p.x - e.x);
        const dy = Math.abs(p.y - e.y);
        if (dx < et.attackRange + 10 && dy < 30) {
          p.health -= et.damage;
          p.state = 'hurt';
          p.stateTimer = C.HURT_DURATION;
          p.comboCount = 0;
          p.comboWindow = 0;
          e.attackHit = true;
          this.effects.push({ type: 'playerHit', x: p.x, y: p.y - 25, timer: 10 });

          if (p.health <= 0) {
            p.health = 0;
            p.alive = false;
            p.state = 'dead';
          }
          break;
        }
      }
    }

    this.effects = this.effects.filter(e => { e.timer--; return e.timer > 0; });
  }

  updateLevel() {
    const aliveEnemies = this.enemies.filter(e => e.alive);

    if (this.level.waveState === 'fighting' && aliveEnemies.length === 0) {
      this.level.waveState = 'cleared';
      this.level.clearedTimer = 60;
      this.effects.push({
        type: 'waveClear',
        x: this.level.scrollX + C.GAME_WIDTH / 2,
        y: 200,
        timer: 60,
        wave: this.level.wave,
      });
    }

    if (this.level.waveState === 'cleared') {
      if (this.level.clearedTimer > 0) {
        this.level.clearedTimer--;
        return;
      }
      this.level.wave++;
      if (this.level.wave >= WAVES.length) {
        this.level.waveState = 'complete';
        this.gameState = 'victory';
        this.broadcast({ type: 'game_over', result: 'victory', scores: this.getScores() });
        this.stop();
        return;
      }
      this.level.targetScrollX = this.level.scrollX + C.GAME_WIDTH * 0.5;
      this.level.waveState = 'scrolling';
    }

    if (this.level.waveState === 'scrolling') {
      if (this.level.scrollX < this.level.targetScrollX) {
        this.level.scrollX = Math.min(this.level.scrollX + C.SCROLL_SPEED, this.level.targetScrollX);
      } else {
        this.level.waveState = 'spawning';
        setTimeout(() => {
          if (this.gameState === 'playing') {
            this.spawnWave();
          }
        }, 800);
      }
    }

    if (this.alivePlayers.length === 0 && this.gameState === 'playing') {
      this.gameState = 'gameover';
      this.broadcast({ type: 'game_over', result: 'defeat', scores: this.getScores() });
      this.stop();
    }
  }

  spawnWave() {
    if (this.level.wave >= WAVES.length) return;
    const wave = WAVES[this.level.wave];

    for (const spawn of wave.enemies) {
      const et = C.ENEMY_TYPES[spawn.type];
      for (let i = 0; i < spawn.count; i++) {
        const fromRight = Math.random() > 0.25;
        this.enemies.push({
          id: 'e' + (this.nextEnemyId++),
          type: spawn.type,
          x: fromRight
            ? this.level.scrollX + C.GAME_WIDTH + 40 + Math.random() * 180
            : this.level.scrollX - 40 - Math.random() * 180,
          y: C.FLOOR_MIN_Y + Math.random() * (C.FLOOR_MAX_Y - C.FLOOR_MIN_Y),
          health: et.health,
          maxHealth: et.health,
          facing: fromRight ? -1 : 1,
          state: 'walk',
          stateTimer: 0,
          alive: true,
          attackHit: false,
        });
      }
    }
    this.level.waveState = 'fighting';
  }

  getScores() {
    return [...this.players.values()]
      .map(p => ({ name: p.name, score: p.score, colorIndex: p.colorIndex }))
      .sort((a, b) => b.score - a.score);
  }

  getState() {
    return {
      type: 'state',
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, colorIndex: p.colorIndex,
        x: Math.round(p.x), y: Math.round(p.y), facing: p.facing,
        health: p.health, maxHealth: p.maxHealth, special: p.special,
        state: p.state, stateTimer: p.stateTimer,
        score: p.score, alive: p.alive,
      })),
      enemies: this.enemies.filter(e => e.alive).map(e => ({
        id: e.id, type: e.type,
        x: Math.round(e.x), y: Math.round(e.y), facing: e.facing,
        health: e.health, maxHealth: e.maxHealth,
        state: e.state, stateTimer: e.stateTimer,
      })),
      effects: this.effects,
      level: {
        scrollX: Math.round(this.level.scrollX),
        wave: this.level.wave,
        waveState: this.level.waveState,
      },
      frame: this.frameCount,
    };
  }

  broadcastState() {
    const msg = JSON.stringify(this.getState());
    for (const [ws] of this.players) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }

  broadcast(msg) {
    const str = JSON.stringify(msg);
    for (const [ws] of this.players) {
      if (ws.readyState === 1) ws.send(str);
    }
  }

  getLobbyInfo() {
    const hostPlayer = this.hostWs ? this.players.get(this.hostWs) : null;
    return {
      type: 'lobby_update',
      roomId: this.id,
      players: [...this.players.values()].map(p => ({
        id: p.id,
        name: p.name,
        colorIndex: p.colorIndex,
        isHost: hostPlayer && p.id === hostPlayer.id,
      })),
      gameState: this.gameState,
    };
  }
}

// --- WebSocket ---
wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerState = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'create_room': {
        const roomId = generateRoomCode();
        const room = new GameRoom(roomId);
        rooms.set(roomId, room);
        currentRoom = room;
        playerState = room.addPlayer(ws, msg.name);
        ws.send(JSON.stringify({ type: 'room_created', roomId, playerId: playerState.id }));
        room.broadcast(room.getLobbyInfo());
        break;
      }

      case 'join_room': {
        const room = rooms.get((msg.roomId || '').toUpperCase());
        if (!room) { ws.send(JSON.stringify({ type: 'error', message: 'Room not found' })); return; }
        if (room.gameState !== 'lobby') { ws.send(JSON.stringify({ type: 'error', message: 'Game already in progress' })); return; }
        if (room.playerCount >= C.MAX_PLAYERS) { ws.send(JSON.stringify({ type: 'error', message: 'Room is full (max 8)' })); return; }
        currentRoom = room;
        playerState = room.addPlayer(ws, msg.name);
        ws.send(JSON.stringify({ type: 'room_joined', roomId: room.id, playerId: playerState.id }));
        room.broadcast(room.getLobbyInfo());
        break;
      }

      case 'start_game': {
        if (!currentRoom || ws !== currentRoom.hostWs) return;
        if (currentRoom.playerCount < 1) return;
        currentRoom.broadcast({ type: 'game_starting' });
        currentRoom.start();
        break;
      }

      case 'input': {
        if (!playerState) return;
        playerState.input = msg.keys || {};
        break;
      }

      case 'chat': {
        if (!currentRoom || !playerState) return;
        currentRoom.broadcast({
          type: 'chat',
          name: playerState.name,
          colorIndex: playerState.colorIndex,
          message: (msg.message || '').slice(0, 200),
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentRoom) {
      const wasHost = ws === currentRoom.hostWs;
      currentRoom.removePlayer(ws);
      if (currentRoom.players.size > 0) {
        currentRoom.broadcast(currentRoom.getLobbyInfo());
      }
    }
  });
});

server.listen(PORT, () => {
  console.log('Moonwalker Mayhem server running on http://localhost:' + PORT);
  console.log('Share this URL with friends on your network to play together!');
});
