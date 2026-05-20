/**
 * ParticleSystem.js — Pool de partículas para efectos:
 *   sparks, magic, blood, pickup, dust.
 * Uso: emit(type, position, n)
 */
import * as THREE from 'three';

const COLOR_BY_TYPE = {
    sparks: 0xffaa44,
    magic:  0x4ac8ff,
    blood:  0xa01818,
    pickup: 0xffe070,
    dust:   0xc8b890,
    heal:   0x60ff80,
};

export class ParticleSystem {
    constructor(scene, max = 400) {
        this.scene = scene;
        this.max = max;
        this.active = [];

        const geo = new THREE.SphereGeometry(0.08, 5, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
        this.pool = [];
        for (let i = 0; i < max; i++) {
            const m = new THREE.Mesh(geo, mat.clone());
            m.visible = false;
            scene.add(m);
            this.pool.push(m);
        }
    }

    _take() {
        for (const p of this.pool) if (!p.visible) return p;
        return null;
    }

    emit(type, position, count = 12) {
        const color = COLOR_BY_TYPE[type] || 0xffffff;
        for (let i = 0; i < count; i++) {
            const p = this._take();
            if (!p) return;
            p.visible = true;
            p.position.copy(position);
            p.material.color.setHex(color);
            p.material.opacity = 1;

            const speed = type === 'pickup' ? 1.5 : (type === 'magic' ? 3 : 4);
            const upBoost = type === 'pickup' ? 4 : (type === 'heal' ? 3 : 2);
            const data = {
                mesh: p,
                vel: new THREE.Vector3(
                    (Math.random() - 0.5) * speed * 2,
                    Math.random() * upBoost + 1,
                    (Math.random() - 0.5) * speed * 2
                ),
                life: 0.8 + Math.random() * 0.5,
                age:  0,
                type,
            };
            this.active.push(data);
        }
    }

    update(dt) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            p.age += dt;
            if (p.age >= p.life) {
                p.mesh.visible = false;
                this.active.splice(i, 1);
                continue;
            }
            p.vel.y -= 8 * dt;             // gravedad
            p.mesh.position.addScaledVector(p.vel, dt);
            const t = p.age / p.life;
            p.mesh.material.opacity = 1 - t;
            const s = p.type === 'magic' ? (1 + t * 1.5) : (1 - t * 0.5);
            p.mesh.scale.setScalar(s);
        }
    }
}
