/**
 * VRHud.js — HUD canvas flotante anclado a la cámara XR.
 *
 * FIXES:
 *  1. POSICIÓN: el HUD original era demasiado grande y estorbaba la vista.
 *     Ahora es más pequeño (PlaneGeometry 0.7 × 0.14) y se ancla abajo-centro
 *     de la vista, no en el centro. Así la vista libre queda despejada.
 *
 *  2. SEGUIMIENTO SUAVE: en lugar de teletransportarse al instante a la
 *     posición de la cámara, usa un lerp suave para que el HUD "flote"
 *     sin bailar con cada movimiento de cabeza.
 *
 *  3. CANVAS más pequeño y denso (512×96) para mejor rendimiento en Quest.
 *
 *  4. Solo muestra los datos críticos (vida, arma, gemas, kills).
 *     La barra de XP y nivel quedan como texto compacto.
 */
import * as THREE from 'three';

const LERP_SPEED = 4.5;   // velocidad de seguimiento suave (más bajo = más lag)

export class VRHud {
    constructor(scene, renderer) {
        this.scene    = scene;
        this.renderer = renderer;

        // Canvas más pequeño → mejor rendimiento en Quest
        this.canvas        = document.createElement('canvas');
        this.canvas.width  = 512;
        this.canvas.height = 96;
        this.ctx           = this.canvas.getContext('2d');
        this.texture       = new THREE.CanvasTexture(this.canvas);

        // Plano más pequeño: 0.7m × 0.13m
        // Se colocará bajo el centro de visión, no en el medio
        const geo = new THREE.PlaneGeometry(0.72, 0.135);
        const mat = new THREE.MeshBasicMaterial({
            map:         this.texture,
            transparent: true,
            depthWrite:  false,
            depthTest:   false,        // siempre visible, nunca tapado por geometría
            side:        THREE.DoubleSide,
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.renderOrder = 999;   // se dibuja encima de todo
        this.mesh.visible     = false;
        scene.add(this.mesh);

        // Posición objetivo (usada para el lerp)
        this._targetPos = new THREE.Vector3();
        this._targetQuat = new THREE.Quaternion();
    }

    show() { this.mesh.visible = true; }
    hide() { this.mesh.visible = false; }

    // ─────────────────────────────────────────────────────────────────
    // update — llamar cada frame con los stats del jugador
    // ─────────────────────────────────────────────────────────────────
    update(stats, weapon, dt) {
        if (!this.mesh.visible) return;

        const xrCam = this.renderer.xr.getCamera();

        // Calcular posición objetivo: abajo-centro de la vista
        // offset: 0 en X, -0.28 en Y (hacia abajo), -0.9 en Z (hacia adelante)
        const offset = new THREE.Vector3(0, -0.28, -0.9);
        offset.applyQuaternion(xrCam.quaternion);

        this._targetPos.copy(xrCam.position).add(offset);
        this._targetQuat.copy(xrCam.quaternion);

        // Lerp suave para evitar que el HUD baile con cada micro-movimiento
        const lerpFactor = 1 - Math.exp(-LERP_SPEED * (dt || 0.016));
        this.mesh.position.lerp(this._targetPos, lerpFactor);
        this.mesh.quaternion.slerp(this._targetQuat, lerpFactor);

        this._draw(stats, weapon);
    }

    // ─────────────────────────────────────────────────────────────────
    // _draw — dibuja el HUD compacto en el canvas
    // ─────────────────────────────────────────────────────────────────
    _draw(s, weapon) {
        const c = this.ctx;
        const W = 512, H = 96;
        c.clearRect(0, 0, W, H);

        // Fondo semitransparente
        c.fillStyle = 'rgba(6, 10, 4, 0.72)';
        this._roundRect(c, 4, 4, W - 8, H - 8, 10);
        c.fill();
        c.strokeStyle = 'rgba(212,168,67,0.45)';
        c.lineWidth = 1.5;
        this._roundRect(c, 4, 4, W - 8, H - 8, 10);
        c.stroke();

        // ── Columna izquierda: barras de vida/maná ────────────────
        this._miniBar(c, 14, 14, 160, 12, s.health  / s.maxHealth,  '#c03030', '❤');
        this._miniBar(c, 14, 34, 160, 12, s.mana    / s.maxMana,    '#3090d0', '✦');
        this._miniBar(c, 14, 54, 160, 12, s.stamina / s.maxStamina, '#50c040', '⚡');

        // XP compacto
        c.fillStyle = 'rgba(212,168,67,0.8)';
        c.font = 'bold 11px monospace';
        c.textAlign = 'left';
        c.fillText(`LV ${s.level}  XP ${Math.floor(s.xp)}/${s.xpToNext}`, 14, 78);

        // ── Separador vertical ────────────────────────────────────
        c.strokeStyle = 'rgba(212,168,67,0.2)';
        c.lineWidth   = 1;
        c.beginPath();
        c.moveTo(190, 12); c.lineTo(190, H - 12);
        c.stroke();

        // ── Columna derecha: arma + stats ─────────────────────────
        const wIcon = { sword: '⚔', bow: '🏹', magic: '✦' }[weapon] || '·';
        c.fillStyle = '#f0c060';
        c.font      = 'bold 18px serif';
        c.textAlign = 'left';
        c.fillText(`${wIcon} ${weapon?.toUpperCase() || ''}`, 200, 32);

        c.fillStyle = '#c8dfe8';
        c.font      = '12px monospace';
        c.fillText(`🏹 ${s.arrows}   💎 ${s.gems}   ☠ ${s.kills}`, 200, 56);

        // Si quedan pocas flechas, alertar en rojo
        if (weapon === 'bow' && s.arrows <= 3) {
            c.fillStyle = '#ff4040';
            c.font      = 'bold 11px monospace';
            c.fillText('¡SIN FLECHAS!', 200, 74);
        }

        this.texture.needsUpdate = true;
    }

    _miniBar(c, x, y, w, h, v, color, icon) {
        v = Math.max(0, Math.min(1, v));
        // Fondo
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(x + 18, y, w, h);
        // Relleno
        c.fillStyle = color;
        c.fillRect(x + 18, y, w * v, h);
        // Borde
        c.strokeStyle = 'rgba(255,255,255,0.15)';
        c.lineWidth   = 1;
        c.strokeRect(x + 18, y, w, h);
        // Ícono
        c.fillStyle   = '#fff';
        c.font        = '11px serif';
        c.textAlign   = 'left';
        c.fillText(icon, x, y + h - 1);
    }

    _roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y,     x + w, y + h, r);
        c.arcTo(x + w, y + h, x,     y + h, r);
        c.arcTo(x,     y + h, x,     y,     r);
        c.arcTo(x,     y,     x + w, y,     r);
        c.closePath();
    }
}