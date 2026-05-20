/**
 * PlayerStats.js — Salud, maná, stamina, XP, nivel y recursos.
 */
import { PLAYER, COMBAT } from '../core/Config.js';
import { bus, EVT } from '../core/EventBus.js';

export class PlayerStats {
    constructor() {
        this.maxHealth  = PLAYER.MAX_HEALTH;
        this.health     = this.maxHealth;
        this.maxMana    = PLAYER.MAX_MANA;
        this.mana       = this.maxMana;
        this.maxStamina = PLAYER.MAX_STAMINA;
        this.stamina    = this.maxStamina;
        this.xp         = 0;
        this.level      = 1;
        this.xpToNext   = 100;
        this.arrows     = 15;
        this.gems       = 0;
        this.kills      = 0;
        this.alive      = true;

        this._lastDamageTime = -10;
    }

    update(dt, time) {
        // Regen stamina (siempre)
        this.stamina = Math.min(this.maxStamina, this.stamina + COMBAT.REGEN.STAMINA_PER_SEC * dt);
        // Regen maná (siempre)
        this.mana    = Math.min(this.maxMana,    this.mana    + COMBAT.REGEN.MANA_PER_SEC * dt);
        // Regen salud (solo fuera de combate, 5s)
        if (time - this._lastDamageTime > 5) {
            this.health = Math.min(this.maxHealth, this.health + COMBAT.REGEN.HEALTH_PER_SEC * dt);
        }
    }

    damage(amount, time) {
        if (!this.alive) return;
        this.health = Math.max(0, this.health - amount);
        this._lastDamageTime = time;
        bus.emit(EVT.PLAYER_DAMAGED, { amount, health: this.health });
        if (this.health <= 0) {
            this.alive = false;
            bus.emit(EVT.PLAYER_DIED);
        }
    }

    heal(amount)         { this.health  = Math.min(this.maxHealth,  this.health  + amount); }
    restoreMana(amount)  { this.mana    = Math.min(this.maxMana,    this.mana    + amount); }
    spendStamina(amount) { this.stamina = Math.max(0, this.stamina - amount); }
    spendMana(amount)    { this.mana    = Math.max(0, this.mana    - amount); }
    addArrows(n)         { this.arrows += n; }
    useArrow()           { if (this.arrows > 0) { this.arrows--; return true; } return false; }

    addXP(n) {
        this.xp += n;
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = Math.floor(this.xpToNext * 1.4);
            // Subir stats al subir nivel
            this.maxHealth  += 20;
            this.maxMana    += 15;
            this.maxStamina += 10;
            this.health  = this.maxHealth;
            this.mana    = this.maxMana;
            this.stamina = this.maxStamina;
            bus.emit(EVT.PLAYER_LEVELED, { level: this.level });
        }
    }

    addGem() { this.gems++; this.addXP(10); }
}
