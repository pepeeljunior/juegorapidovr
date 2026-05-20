/**
 * Config.js — Constantes globales del juego
 * Mundo Perdido VR — Three.js + WebXR
 */
import * as THREE from 'three';

// ── ESCENARIO ─────────────────────────────────────────────────────────────
export const WORLD = {
    HALF_SIZE:      60,
    GROUND_Y:        0,
    FOG_COLOR:       new THREE.Color(0x2a3050),   // nocturno azulado
    FOG_DENSITY:     0.013,
    SKY_COLOR:       new THREE.Color(0x0a0e2a),   // azul medianoche
};

// ── FÍSICA ────────────────────────────────────────────────────────────────
export const PHYSICS = {
    GRAVITY:        -22,
    CHAR_RADIUS:    0.55,
    OBJ_FRICTION:   0.90,
    AIR_FRICTION:   0.98,
};

// ── PERSONAJE ─────────────────────────────────────────────────────────────
export const PLAYER = {
    WALK_SPEED:     4.8,
    RUN_SPEED:     10.0,
    JUMP_FORCE:     8.2,
    TURN_SPEED:     12,       // suavizado de giro
    SNAP_TURN_DEG:  45,       // VR turn en grados
    CAMERA_OFFSET:  new THREE.Vector3(0, 2.4, 6.0),
    MAX_HEALTH:    100,
    MAX_MANA:      100,
    MAX_STAMINA:   100,
};

// ── COMBATE ───────────────────────────────────────────────────────────────
export const COMBAT = {
    SWORD: {
        DAMAGE:      25,
        RANGE:        2.2,
        COOLDOWN:     0.45,
        STAMINA:     12,
        ARC_DEG:     120,
    },
    BOW: {
        DAMAGE:      40,
        ARROW_SPEED: 35,
        COOLDOWN:    0.6,
        STAMINA:     8,
        MAX_ARROWS:  20,
    },
    MAGIC: {
        DAMAGE:      55,
        PROJ_SPEED:  22,
        COOLDOWN:    0.9,
        MANA_COST:   25,
        AOE_RADIUS:  3.0,
    },
    REGEN: {
        STAMINA_PER_SEC: 18,
        MANA_PER_SEC:    8,
        HEALTH_PER_SEC:  2,   // regen lento fuera de combate
    },
};

// ── ENEMIGOS ──────────────────────────────────────────────────────────────
export const ENEMIES = {
    SPAWN_COUNT:    7,
    DETECT_RANGE:   15,
    ATTACK_RANGE:   1.8,
    GOBLIN: {
        HEALTH:     50,
        SPEED:      3.2,
        DAMAGE:     12,
        ATTACK_CD:  1.5,
        XP:         15,
        COLOR:      0x6a4a2a,
    },
    ORC: {
        HEALTH:    120,
        SPEED:      2.5,
        DAMAGE:     22,
        ATTACK_CD:  2.0,
        XP:         35,
        COLOR:      0x4a5a3a,
    },
    WRAITH: {
        HEALTH:     80,
        SPEED:      4.0,
        DAMAGE:     18,
        ATTACK_CD:  1.8,
        XP:         25,
        COLOR:      0x8a4ac4,
    },
};

// ── COLECCIONABLES ────────────────────────────────────────────────────────
export const ITEMS = {
    GEM_VALUE:      10,
    POTION_HEAL:    40,
    POTION_MANA:    40,
    ARROW_PICKUP:   5,
    SPAWN_COUNT:    15,
};

// ── COLORES TEMÁTICOS ─────────────────────────────────────────────────────
export const COLORS = {
    GOLD:        0xd4a843,
    GOLD_BRIGHT: 0xf0c060,
    DEEP_GREEN:  0x2d4a1a,
    LEAF_GREEN:  0x4a7a30,
    EMBER:       0xff6a20,
    MAGIC_BLUE:  0x4ac8ff,
    BLOOD:       0xa02020,
    BONE:        0xe8d8b0,
    STONE:       0x707070,
    BARK:        0x5a3a1e,
};

// ── INPUT KEYBINDS ────────────────────────────────────────────────────────
export const KEYS = {
    FORWARD:   ['KeyW', 'ArrowUp'],
    BACK:      ['KeyS', 'ArrowDown'],
    LEFT:      ['KeyA', 'ArrowLeft'],
    RIGHT:     ['KeyD', 'ArrowRight'],
    RUN:       ['ShiftLeft', 'ShiftRight'],
    JUMP:      ['Space'],
    DANCE:     ['KeyB'],
    SWORD:     ['Digit1', 'KeyF'],
    BOW:       ['Digit2', 'KeyG'],
    MAGIC:     ['Digit3', 'KeyH'],
    TURN_L:    ['KeyQ'],
    TURN_R:    ['KeyE'],
    MUTE:      ['KeyM'],
    RESET:     ['KeyR'],
    INTERACT:  ['KeyE'],
};
