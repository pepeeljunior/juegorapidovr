/**
 * HUD.js — Overlay DOM con barras de salud/maná/vigor + info de arma.
 * Se actualiza por frame.
 */
import { bus, EVT } from '../core/EventBus.js';

export class HUD {
    constructor() {
        this.root = document.getElementById('hud-overlay');
        if (!this.root) return;
        this.els = {
            health:        document.getElementById('hp-fill'),
            mana:          document.getElementById('mana-fill'),
            stamina:       document.getElementById('stamina-fill'),
            xp:            document.getElementById('xp-fill'),
            level:         document.getElementById('lvl-num'),
            arrows:        document.getElementById('stat-arrows'),
            gems:          document.getElementById('stat-gems'),
            kills:         document.getElementById('stat-kills'),
            weaponName:    document.getElementById('weapon-name'),
            weaponIcon:    document.getElementById('weapon-icon'),
            toast:         document.getElementById('toast'),
            damageFlash:   document.getElementById('damage-flash'),
            xpToNext:      document.getElementById('xp-to-next'),
            xpCurrent:     document.getElementById('xp-current'),
        };

        bus.on(EVT.PLAYER_DAMAGED, () => this._flashDamage());
        bus.on(EVT.PLAYER_LEVELED, ({ level }) => this._toast(`¡SUBIDA DE NIVEL!  ·  NIVEL ${level}`, '#d4a843'));
        bus.on(EVT.ENEMY_KILLED, ({ type, xp }) => this._toast(`${type.toUpperCase()} ELIMINADO  +${xp} XP`, '#80e060'));
        bus.on(EVT.ITEM_COLLECTED, ({ type }) => {
            const labels = {
                gem: '💎 GEMA RECOLECTADA',
                health: '❤️ POCIÓN DE VIDA',
                mana:   '🔷 POCIÓN DE MANÁ',
                arrows: '🏹 +5 FLECHAS',
            };
            this._toast(labels[type] || 'OBJETO RECOLECTADO', '#4ac8ff');
        });
        bus.on(EVT.WEAPON_SWITCHED, ({ weapon }) => {
            const map = {
                sword: { name: 'ESPADA',  icon: '⚔' },
                bow:   { name: 'ARCO',    icon: '🏹' },
                magic: { name: 'MAGIA',   icon: '✦' },
            };
            const m = map[weapon];
            if (m && this.els.weaponName) this.els.weaponName.textContent = m.name;
            if (m && this.els.weaponIcon) this.els.weaponIcon.textContent = m.icon;
        });
        bus.on(EVT.PLAYER_DIED, () => this._showGameOver());
    }

    update(stats) {
        if (!this.root) return;
        const set = (el, frac) => { if (el) el.style.width = (Math.max(0, Math.min(1, frac)) * 100) + '%'; };
        set(this.els.health,  stats.health  / stats.maxHealth);
        set(this.els.mana,    stats.mana    / stats.maxMana);
        set(this.els.stamina, stats.stamina / stats.maxStamina);
        set(this.els.xp,      stats.xp      / stats.xpToNext);
        if (this.els.level)     this.els.level.textContent = stats.level;
        if (this.els.arrows)    this.els.arrows.textContent = stats.arrows;
        if (this.els.gems)      this.els.gems.textContent   = stats.gems;
        if (this.els.kills)     this.els.kills.textContent  = stats.kills;
        if (this.els.xpCurrent) this.els.xpCurrent.textContent = Math.floor(stats.xp);
        if (this.els.xpToNext)  this.els.xpToNext.textContent  = stats.xpToNext;
    }

    hide() { if (this.root) this.root.style.display = 'none'; }
    show() { if (this.root) this.root.style.display = ''; }

    _flashDamage() {
        if (!this.els.damageFlash) return;
        this.els.damageFlash.classList.remove('flash');
        // Force reflow para reiniciar animación
        void this.els.damageFlash.offsetWidth;
        this.els.damageFlash.classList.add('flash');
    }

    _toast(msg, color = '#d4a843') {
        if (!this.els.toast) return;
        this.els.toast.textContent = msg;
        this.els.toast.style.borderColor = color;
        this.els.toast.style.color = color;
        this.els.toast.classList.remove('show');
        void this.els.toast.offsetWidth;
        this.els.toast.classList.add('show');
    }

    _showGameOver() {
        const el = document.getElementById('game-over');
        if (el) el.classList.add('visible');
    }
}