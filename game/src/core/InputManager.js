/**
 * InputManager.js — Input unificado (teclado + VR controllers + ratón).
 * Expone un estado simple y eventos "justPressed" para acciones puntuales.
 */
import { KEYS } from '../core/Config.js';

export class InputManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.keys = {};
        this.justPressed = new Set();
        this.justReleased = new Set();

        // VR
        this.vr = {
            leftAxes:    [0, 0],
            rightAxes:   [0, 0],
            // botones (justPressed semantic)
            triggerL: false,  triggerR: false,
            gripL:    false,  gripR:    false,
            buttonA:  false,  buttonB:  false,
            buttonX:  false,  buttonY:  false,
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
        // Limpiar el focus loss
        window.addEventListener('blur', () => { this.keys = {}; });
    }

    /** Verifica si CUALQUIERA de los codes está presionado */
    anyHeld(codes) { return codes.some(c => this.keys[c]); }
    anyJustPressed(codes) { return codes.some(c => this.justPressed.has(c)); }

    isHeld(action)        { return this.anyHeld(KEYS[action] || []); }
    wasJustPressed(action) { return this.anyJustPressed(KEYS[action] || []); }

    /** Eje WASD/flechas → vec2 (x: derecha, y: adelante) */
    getMoveAxis() {
        const x = (this.isHeld('RIGHT') ? 1 : 0) - (this.isHeld('LEFT')   ? 1 : 0);
        const z = (this.isHeld('BACK')  ? 1 : 0) - (this.isHeld('FORWARD') ? 1 : 0);
        return [x, z];
    }

    /** Leer gamepads VR cada frame */
    pollVR() {
        if (!this.renderer.xr.isPresenting) return;
        const session = this.renderer.xr.getSession();
        if (!session) return;

        const prev = this.vr._prev;
        // resetear edge-triggers
        this.vr.triggerL_just = false; this.vr.triggerR_just = false;
        this.vr.gripL_just    = false; this.vr.gripR_just    = false;
        this.vr.aJust = false; this.vr.bJust = false;
        this.vr.xJust = false; this.vr.yJust = false;
        this.vr.thumbL_just = false; this.vr.thumbR_just = false;

        for (const src of session.inputSources) {
            const gp = src.gamepad;
            if (!gp) continue;
            const ax = gp.axes, btn = gp.buttons;

            const isLeft  = src.handedness === 'left';
            const isRight = src.handedness === 'right';

            if (isLeft && ax.length >= 4) {
                this.vr.leftAxes[0] = ax[2];
                this.vr.leftAxes[1] = ax[3];
            }
            if (isRight && ax.length >= 4) {
                this.vr.rightAxes[0] = ax[2];
                this.vr.rightAxes[1] = ax[3];
            }

            // Mapeo estándar Oculus/Quest:
            //  0 trigger, 1 grip, 3 thumbstick, 4 = A/X, 5 = B/Y
            const t = btn[0]?.pressed || false;
            const g = btn[1]?.pressed || false;
            const th= btn[3]?.pressed || false;
            const b4 = btn[4]?.pressed || false;
            const b5 = btn[5]?.pressed || false;

            if (isRight) {
                this.vr.triggerR = t;
                this.vr.gripR    = g;
                this.vr.buttonA  = b4;
                this.vr.buttonB  = b5;
                if (t && !prev.tR) this.vr.triggerR_just = true;
                if (g && !prev.gR) this.vr.gripR_just    = true;
                if (b4 && !prev.bA) this.vr.aJust = true;
                if (b5 && !prev.bB) this.vr.bJust = true;
                if (th && !prev.thR) this.vr.thumbR_just = true;
                prev.tR = t; prev.gR = g; prev.bA = b4; prev.bB = b5; prev.thR = th;
            } else if (isLeft) {
                this.vr.triggerL = t;
                this.vr.gripL    = g;
                this.vr.buttonX  = b4;
                this.vr.buttonY  = b5;
                if (t && !prev.tL) this.vr.triggerL_just = true;
                if (g && !prev.gL) this.vr.gripL_just    = true;
                if (b4 && !prev.bX) this.vr.xJust = true;
                if (b5 && !prev.bY) this.vr.yJust = true;
                if (th && !prev.thL) this.vr.thumbL_just = true;
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