/**
 * Magic.js — Orbes mágicos como proyectiles con daño en área al impactar.
 *
 * FIX freeze: usamos un POOL de orbes preconstruidos (incluyendo PointLight)
 * para que cast() no haga allocations grandes en el momento del disparo.
 * Antes: cada cast creaba Group + 2 Mesh + 2 SphereGeometry + PointLight,
 * y la primera PointLight fuerza compilación de shaders → spike de ~1 frame.
 */
import * as THREE from 'three';
import { COMBAT } from '../core/Config.js';
import { dist2D } from '../utils/MathUtils.js';

const POOL_SIZE = 6;   // máximo de orbes simultáneos en vuelo

export class Magic {
    constructor(scene) {
        this.scene = scene;
        this.cooldown = 0;
        this.equipped = false;
        this.orbs = [];        // orbes activos (en vuelo)
        this.pool = [];        // orbes inactivos (precreados)

        this.mesh = this._buildHandOrb();
        this.mesh.visible = false;
        this.scene.add(this.mesh);

        this._buildPool();
    }

    _buildHandOrb() {
        const g = new THREE.Group();
        const core = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0x80e8ff, transparent: true, opacity: 0.95 })
        );
        g.add(core);
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 12, 8),
            new THREE.MeshBasicMaterial({ color: 0x4ac8ff, transparent: true, opacity: 0.35, depthWrite: false })
        );
        g.add(glow);
        const light = new THREE.PointLight(0x4ac8ff, 1.5, 4);
        g.add(light);
        return g;
    }

    /** Preconstruye orbes para evitar allocations en runtime */
    _buildPool() {
        // Geometrías y materiales COMPARTIDOS (todos los orbes los reusan)
        this._orbCoreGeo = new THREE.SphereGeometry(0.18, 14, 10);
        this._orbGlowGeo = new THREE.SphereGeometry(0.32, 12, 8);
        this._orbCoreMat = new THREE.MeshBasicMaterial({ color: 0xaaf0ff });
        this._orbGlowMat = new THREE.MeshBasicMaterial({
            color: 0x4ac8ff, transparent: true, opacity: 0.5, depthWrite: false
        });

        for (let i = 0; i < POOL_SIZE; i++) {
            const orb = new THREE.Group();
            const core = new THREE.Mesh(this._orbCoreGeo, this._orbCoreMat);
            const glow = new THREE.Mesh(this._orbGlowGeo, this._orbGlowMat);
            const light = new THREE.PointLight(0x4ac8ff, 3, 6);
            orb.add(core); orb.add(glow); orb.add(light);
            orb.userData.light = light;
            orb.visible = false;
            this.scene.add(orb);             // ya está en escena (key: precompilación)
            this.pool.push(orb);
        }
    }

    /** Toma un orbe libre del pool */
    _acquireOrb() {
        for (const o of this.pool) {
            if (!o.visible) return o;
        }
        return null;   // pool agotado: no disparar (limitación intencional)
    }

    _releaseOrb(orb) {
        orb.visible = false;
    }

    equip(eq) { this.equipped = eq; this.mesh.visible = eq; }

    cast(originPos, direction, audio, particles, mana) {
        if (!this.equipped || this.cooldown > 0 || mana < COMBAT.MAGIC.MANA_COST) return null;

        const orb = this._acquireOrb();
        if (!orb) return null;   // sin orbes disponibles

        this.cooldown = COMBAT.MAGIC.COOLDOWN;
        audio.play('magic', 0.55);

        orb.position.copy(originPos);
        orb.visible = true;

        this.orbs.push({
            mesh: orb,
            vel: direction.clone().multiplyScalar(COMBAT.MAGIC.PROJ_SPEED),
            life: 3.0,
            phase: 0,
        });

        particles.emit('magic', originPos.clone(), 10);
        return { manaCost: COMBAT.MAGIC.MANA_COST };
    }

    update(dt, enemies, particles, audio) {
        this.cooldown = Math.max(0, this.cooldown - dt);

        // Animar orbe de mano
        if (this.equipped) {
            const sc = 1 + Math.sin(performance.now() * 0.006) * 0.15;
            this.mesh.scale.setScalar(sc);
            this.mesh.rotation.y += dt * 2;
        }

        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const o = this.orbs[i];
            o.life -= dt;
            o.phase += dt;
            o.mesh.position.addScaledVector(o.vel, dt);
            o.mesh.rotation.y += dt * 5;
            o.mesh.scale.setScalar(1 + Math.sin(o.phase * 12) * 0.1);

            let exploded = false;
            for (const e of enemies.list) {
                if (e.state === 'dead') continue;
                if (dist2D(o.mesh.position, e.group.position) < 0.8 &&
                    Math.abs(o.mesh.position.y - 1.0) < 1.5) {
                    this._explode(o.mesh.position, enemies, particles, audio);
                    exploded = true;
                    break;
                }
            }
            if (exploded || o.life <= 0 || o.mesh.position.y < 0.1) {
                if ((o.life <= 0 || o.mesh.position.y < 0.1) && !exploded) {
                    this._explode(o.mesh.position, enemies, particles, audio);
                }
                this._releaseOrb(o.mesh);
                this.orbs.splice(i, 1);
            }
        }
    }

    _explode(pos, enemies, particles, audio) {
        audio.play('hit', 0.6);
        particles.emit('magic', pos.clone(), 40);
        for (const e of enemies.list) {
            if (e.state === 'dead') continue;
            const d = dist2D(pos, e.group.position);
            if (d < COMBAT.MAGIC.AOE_RADIUS) {
                const fall = 1 - (d / COMBAT.MAGIC.AOE_RADIUS);
                const hitDir = new THREE.Vector3().subVectors(e.group.position, pos).normalize();
                enemies.damage(e, COMBAT.MAGIC.DAMAGE * fall, hitDir);
            }
        }
    }

    updatePose(playerObj) {
        if (!this.equipped) return;
        const offset = new THREE.Vector3(0.4, 1.1, 0.3);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerObj.rotation.y);
        this.mesh.position.copy(playerObj.position).add(offset);
    }

    updatePoseVR(controllerObj) {
        if (!this.equipped) return;
        const fwd = new THREE.Vector3(0, 0, -0.1).applyQuaternion(controllerObj.quaternion);
        this.mesh.position.copy(controllerObj.position).add(fwd);
    }
}
