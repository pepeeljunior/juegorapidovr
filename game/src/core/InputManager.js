/**
 * InputManager.js — Input unificado (teclado + VR controllers + ratón).
 *
 * FIXES VR (Meta Quest 3):
 *  1. Axes: Quest 3 puede reportar axes[0]/axes[1] OR axes[2]/axes[3] según el
 *     firmware. Ahora se prueban ambos y se usa el que tenga magnitud mayor.
 *  2. Trigger: se lee tanto .pressed como .value >= 0.5 (algunos firmwares
 *     solo actualizan .value, no .pressed).
 *  3. Se expone triggerR_held (continuo) además de triggerR_just (edge) para
 *     que PlayerController pueda disparar mientras se mantiene el gatillo.
 */
import { KEYS } from '../core/Config.js';

export class InputManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.keys = {};
        this.justPressed = new Set();
        this.justReleased = new Set();

        // VR — estado completo
        this.vr = {
            leftAxes:  [0, 0],
            rightAxes: [0, 0],

            // Estado continuo (held)
            triggerL: false, triggerR: false,
            gripL:    false, gripR:    false,
            buttonA:  false, buttonB:  false,
            buttonX:  false, buttonY:  false,

            // Edge — solo true el frame en que cambia de false → true
            triggerL_just: false, triggerR_just: false,
            gripL_just:    false, gripR_just:    false,
            aJust: false, bJust: false,
            xJust: false, yJust: false,
            thumbL_just: false, thumbR_just: false,

            _prev: {},
        };

        this._bind();
    }

    _bind() {
        window.addEventListener('keydown', e => {
            if (!this.keys[e.code]) this.justPressed.add(e.code);
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.justReleased.add(e.code);
        });
        window.addEventListener('blur', () => { this.keys = {}; });
    }

    anyHeld(codes)        { return codes.some(c => this.keys[c]); }
    anyJustPressed(codes) { return codes.some(c => this.justPressed.has(c)); }
    isHeld(action)         { return this.anyHeld(KEYS[action] || []); }
    wasJustPressed(action) { return this.anyJustPressed(KEYS[action] || []); }

    getMoveAxis() {
        const x = (this.isHeld('RIGHT')   ? 1 : 0) - (this.isHeld('LEFT')    ? 1 : 0);
        const z = (this.isHeld('BACK')    ? 1 : 0) - (this.isHeld('FORWARD') ? 1 : 0);
        return [x, z];
    }

    // ─────────────────────────────────────────────────────────────────
    // pollVR — leer gamepads cada frame
    // ─────────────────────────────────────────────────────────────────
    pollVR() {
        if (!this.renderer.xr.isPresenting) return;
        const session = this.renderer.xr.getSession();
        if (!session) return;

        const prev = this.vr._prev;

        // Resetear edge-triggers
        this.vr.triggerL_just = false; this.vr.triggerR_just = false;
        this.vr.gripL_just    = false; this.vr.gripR_just    = false;
        this.vr.aJust = false; this.vr.bJust = false;
        this.vr.xJust = false; this.vr.yJust = false;
        this.vr.thumbL_just = false; this.vr.thumbR_just = false;

        for (const src of session.inputSources) {
            const gp = src.gamepad;
            if (!gp) continue;

            const ax  = gp.axes;
            const btn = gp.buttons;

            const isLeft  = src.handedness === 'left';
            const isRight = src.handedness === 'right';

            // ── AXES ──────────────────────────────────────────────────
            // Quest 3 puede usar índices 0-1 o 2-3 para el thumbstick.
            // Elegimos el par con mayor magnitud para ser robusto.
            if (ax.length >= 2) {
                const mag01 = ax.length >= 2 ? Math.hypot(ax[0] || 0, ax[1] || 0) : 0;
                const mag23 = ax.length >= 4 ? Math.hypot(ax[2] || 0, ax[3] || 0) : 0;
                const useAlt = mag23 > mag01;

                const axX = useAlt ? (ax[2] || 0) : (ax[0] || 0);
                const axY = useAlt ? (ax[3] || 0) : (ax[1] || 0);

                // Dead zone
                const DEAD = 0.12;
                const fx = Math.abs(axX) > DEAD ? axX : 0;
                const fy = Math.abs(axY) > DEAD ? axY : 0;

                if (isLeft)  { this.vr.leftAxes[0]  = fx; this.vr.leftAxes[1]  = fy; }
                if (isRight) { this.vr.rightAxes[0] = fx; this.vr.rightAxes[1] = fy; }
            }

            // ── BOTONES ───────────────────────────────────────────────
            // Mapeo estándar Oculus/Quest:
            //   btn[0] = trigger, btn[1] = grip
            //   btn[3] = thumbstick click
            //   btn[4] = A (right) / X (left)
            //   btn[5] = B (right) / Y (left)
            //
            // FIX TRIGGER: algunos firmwares Quest 3 solo actualizan .value,
            //   no .pressed. Consideramos el trigger activo si pressed==true
            //   O si value >= 0.5.
            const _btn = (i) => {
                const b = btn[i];
                if (!b) return false;
                return b.pressed === true || (b.value !== undefined && b.value >= 0.5);
            };

            const t  = _btn(0); // trigger
            const g  = _btn(1); // grip
            const th = _btn(3); // thumbstick click
            const b4 = _btn(4); // A / X
            const b5 = _btn(5); // B / Y

            if (isRight) {
                this.vr.triggerR = t;
                this.vr.gripR    = g;
                this.vr.buttonA  = b4;
                this.vr.buttonB  = b5;

                if (t  && !prev.tR)  this.vr.triggerR_just = true;
                if (g  && !prev.gR)  this.vr.gripR_just    = true;
                if (b4 && !prev.bA)  this.vr.aJust         = true;
                if (b5 && !prev.bB)  this.vr.bJust         = true;
                if (th && !prev.thR) this.vr.thumbR_just   = true;

                prev.tR = t; prev.gR = g; prev.bA = b4; prev.bB = b5; prev.thR = th;

            } else if (isLeft) {
                this.vr.triggerL = t;
                this.vr.gripL    = g;
                this.vr.buttonX  = b4;
                this.vr.buttonY  = b5;

                if (t  && !prev.tL)  this.vr.triggerL_just = true;
                if (g  && !prev.gL)  this.vr.gripL_just    = true;
                if (b4 && !prev.bX)  this.vr.xJust         = true;
                if (b5 && !prev.bY)  this.vr.yJust         = true;
                if (th && !prev.thL) this.vr.thumbL_just   = true;

                prev.tL = t; prev.gL = g; prev.bX = b4; prev.bY = b5; prev.thL = th;
            }
        }
    }

    /** Llamar al FINAL de cada frame para limpiar edge events */
    endFrame() {
        this.justPressed.clear();
        this.justReleased.clear();
    }
}