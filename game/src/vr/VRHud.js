/**
 * VRHud.js — HUD canvas flotante anclado a la cámara XR.
 */
import * as THREE from 'three';

export class VRHud {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 768;
        this.canvas.height = 200;
        this.ctx = this.canvas.getContext('2d');
        this.texture = new THREE.CanvasTexture(this.canvas);

        const geo = new THREE.PlaneGeometry(1.0, 0.26);
        const mat = new THREE.MeshBasicMaterial({
            map: this.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.visible = false;
        scene.add(this.mesh);
    }

    show() { this.mesh.visible = true; }
    hide() { this.mesh.visible = false; }

    update(stats, weapon) {
        if (!this.mesh.visible) return;
        const xrCam = this.renderer.xr.getCamera();
        const offset = new THREE.Vector3(0, -0.35, -1.0);
        offset.applyQuaternion(xrCam.quaternion);
        this.mesh.position.copy(xrCam.position).add(offset);
        this.mesh.quaternion.copy(xrCam.quaternion);

        this._draw(stats, weapon);
    }

    _draw(s, weapon) {
        const c = this.ctx, w = 768, h = 200;
        c.clearRect(0, 0, w, h);

        // Fondo
        c.fillStyle = 'rgba(8,12,6,0.78)';
        this._roundRect(c, 10, 10, w - 20, h - 20, 14); c.fill();
        c.strokeStyle = 'rgba(212,168,67,0.5)'; c.lineWidth = 2;
        this._roundRect(c, 10, 10, w - 20, h - 20, 14); c.stroke();

        // Título / nivel
        c.fillStyle = '#d4a843';
        c.font = 'bold 22px serif'; c.textAlign = 'left';
        c.fillText('MUNDO PERDIDO  ·  NIVEL ' + s.level, 32, 46);

        // Barras
        this._bar(c, 32,  62, 340, 14, s.health / s.maxHealth,  '#d04040', 'VIDA');
        this._bar(c, 32,  92, 340, 14, s.mana    / s.maxMana,   '#4ac8ff', 'MANÁ');
        this._bar(c, 32, 122, 340, 14, s.stamina / s.maxStamina,'#80e060', 'VIGOR');

        // XP
        const pct = s.xp / s.xpToNext;
        c.fillStyle = 'rgba(212,168,67,0.7)';
        c.font = '13px serif'; c.textAlign = 'left';
        c.fillText(`XP ${Math.floor(s.xp)} / ${s.xpToNext}`, 32, 158);
        c.fillStyle = 'rgba(212,168,67,0.15)';
        c.fillRect(32, 163, 340, 6);
        c.fillStyle = '#d4a843';
        c.fillRect(32, 163, 340 * pct, 6);

        // Stats lado derecho
        c.fillStyle = '#e8dfc0'; c.font = '15px serif'; c.textAlign = 'right';
        const wIcon = { sword: '⚔', bow: '🏹', magic: '✦' }[weapon] || '·';
        c.fillText(`ARMA: ${wIcon}  ${weapon.toUpperCase()}`, w - 32, 50);
        c.fillText(`FLECHAS: ${s.arrows}`,  w - 32, 78);
        c.fillText(`GEMAS: ${s.gems}`,      w - 32, 102);
        c.fillText(`ENEMIGOS: ${s.kills}`,  w - 32, 126);

        this.texture.needsUpdate = true;
    }

    _bar(c, x, y, w, h, v, color, label) {
        v = Math.max(0, Math.min(1, v));
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(x, y, w, h);
        c.fillStyle = color;
        c.fillRect(x, y, w * v, h);
        c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
        c.strokeRect(x, y, w, h);
        c.fillStyle = '#fff';
        c.font = 'bold 11px serif'; c.textAlign = 'left';
        c.fillText(label, x + 4, y + 11);
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
