/**
 * EventBus.js — Pub/sub mínimo para desacoplar módulos
 */
class EventBus {
    constructor() { this.listeners = {}; }
    on(evt, fn)   { (this.listeners[evt] ??= []).push(fn); }
    off(evt, fn)  { this.listeners[evt] = (this.listeners[evt] || []).filter(f => f !== fn); }
    emit(evt, ...args) { (this.listeners[evt] || []).forEach(fn => fn(...args)); }
}
export const bus = new EventBus();

// Eventos canónicos (documentación)
export const EVT = {
    PLAYER_DAMAGED:  'player:damaged',
    PLAYER_DIED:     'player:died',
    PLAYER_LEVELED:  'player:leveled',
    ENEMY_DAMAGED:   'enemy:damaged',
    ENEMY_KILLED:    'enemy:killed',
    ITEM_COLLECTED:  'item:collected',
    WEAPON_SWITCHED: 'weapon:switched',
    SOUND_PLAY:      'sound:play',
    HUD_UPDATE:      'hud:update',
};
