(function () {
  var C = {
    GAME_WIDTH: 1024,
    GAME_HEIGHT: 600,

    FLOOR_MIN_Y: 360,
    FLOOR_MAX_Y: 550,

    LEVEL_WIDTH: 6000,
    SCROLL_SPEED: 3,

    MAX_PLAYERS: 8,
    PLAYER_SPEED: 4,
    PLAYER_HEALTH: 100,

    PUNCH1_DAMAGE: 8,
    PUNCH2_DAMAGE: 12,
    PUNCH3_DAMAGE: 20,
    KICK_DAMAGE: 14,
    SPECIAL_DAMAGE: 40,
    SPECIAL_COST: 100,
    SPECIAL_GAIN_ON_HIT: 7,
    SPECIAL_GAIN_ON_KILL: 25,

    ATTACK_RANGE: 55,
    KICK_RANGE: 65,
    ATTACK_DURATION: 14,
    KICK_DURATION: 16,
    SPECIAL_DURATION: 60,
    HURT_DURATION: 20,
    COMBO_WINDOW: 22,

    ENEMY_TYPES: {
      goon: { health: 30, speed: 1.6, damage: 8, attackRange: 42, scale: 1.0, color: 0x666666, score: 100 },
      tough: { health: 60, speed: 1.1, damage: 14, attackRange: 48, scale: 1.25, color: 0x884422, score: 250 },
      boss: { health: 300, speed: 0.9, damage: 22, attackRange: 55, scale: 1.6, color: 0x440044, score: 1000 }
    },
    ENEMY_ATTACK_DURATION: 22,
    ENEMY_HURT_DURATION: 14,
    ENEMY_AGGRO_RANGE: 320,

    TICK_RATE: 30,

    PLAYER_COLORS: [
      '#FF4444', '#4488FF', '#44DD44', '#FFDD44',
      '#FF44FF', '#44DDDD', '#FF8844', '#AA44FF'
    ],
    PLAYER_COLOR_HEX: [
      0xFF4444, 0x4488FF, 0x44DD44, 0xFFDD44,
      0xFF44FF, 0x44DDDD, 0xFF8844, 0xAA44FF
    ],
    PLAYER_COLOR_NAMES: [
      'Red', 'Blue', 'Green', 'Yellow',
      'Pink', 'Cyan', 'Orange', 'Purple'
    ]
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = C;
  } else if (typeof window !== 'undefined') {
    window.C = C;
  }
})();
