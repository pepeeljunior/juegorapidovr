/**
 * Sword.js — Espada melee con detección por cono de ataque.
 */
import * as THREE from 'three';
import { COMBAT } from '../core/Config.js';
import { inAttackCone } from '../utils/MathUtils.js';

export class Sword {
    constructor(scene) {
        this.scene = scene;
        this.cooldown = 0;
        this.swingTime = 0;
        this.swinging = false;
        this.equipped = false;
        this.mesh = this._build();
        this.mesh.visible = false;
        this.scene.add(this.mesh);
    }

    _build() {
        const g = new THREE.Group();
        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 1.2, 0.015),
            new THREE.MeshStandardMaterial({
                color: 0xe0e8ee, metalness: 0.85, roughness: 0.15,
                emissive: 0x202833, emissiveIntensity: 0.2
            })
        );
        blade.position.y = 0.7;
        blade.castShadow = true;
        g.add(blade);

        // Filo brillante (línea emisiva en el borde)
        const edge = new THREE.Mesh(
            new THREE.BoxGeometry(0.005, 1.2, 0.005),
            new THREE.MeshBasicMaterial({ color: 0xfff0c0 })
        );
        edge.position.set(0.03, 0.7, 0);
        g.add(edge);

        // Guarda
        const guard = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.06, 0.06),
            new THREE.MeshStandardMaterial({ color: 0xb88030, metalness: 0.7, roughness: 0.3 })
        );
        guard.position.y = 0.08; g.add(guard);

        // Mango
        const grip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6),
            new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
        );
        grip.position.y = -0.05; g.add(grip);

        // Pomo
        const pommel = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0xc09040, metalness: 0.8 })
        );
        pommel.position.y = -0.17; g.add(pommel);

        return g;
    }

    equip(eq) { this.equipped = eq; this.mesh.visible = eq; }

    /** Intentar swing. Devuelve true si conectó al menos un golpe. */
    swing(playerPos, playerAngleY, enemies, audio, particles, stamina) {
        if (!this.equipped || this.cooldown > 0 || stamina < COMBAT.SWORD.STAMINA) return null;
        this.cooldown = COMBAT.SWORD.COOLDOWN;
        this.swingTime = 0;
        this.swinging = true;
        audio.play('sword', 0.6);

        const hits = [];
        for (const e of enemies.list) {
            if (e.state === 'dead') continue;
            const center = new THREE.Vector3(playerPos.x, 0, playerPos.z);
            if (inAttackCone(center, playerAngleY, e.group.position, COMBAT.SWORD.RANGE, COMBAT.SWORD.ARC_DEG)) {
                const hitDir = new THREE.Vector3().subVectors(e.group.position, playerPos).normalize();
                enemies.damage(e, COMBAT.SWORD.DAMAGE, hitDir);
                hits.push(e);
                particles.emit('sparks', e.group.position.clone().setY(1.2), 8);
            }
        }
        return { hits, staminaCost: COMBAT.SWORD.STAMINA };
    }

    /** Posicionar la espada relativa al personaje (en la mano derecha) */
    updatePose(playerObj, dt) {
        if (!this.equipped) return;
        this.cooldown = Math.max(0, this.cooldown - dt);

        // Anclar relativa al personaje
        const offset = new THREE.Vector3(0.45, 1.1, 0.25);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerObj.rotation.y);
        this.mesh.position.copy(playerObj.position).add(offset);

        // Rotación base
        this.mesh.rotation.y = playerObj.rotation.y;
        this.mesh.rotation.z = -0.3;

        // Animación de swing
        if (this.swinging) {
            this.swingTime += dt;
            const t = this.swingTime / COMBAT.SWORD.COOLDOWN;
            this.mesh.rotation.z = -0.3 + Math.sin(t * Math.PI) * -2.2;
            this.mesh.rotation.x = Math.sin(t * Math.PI) * -0.6;
            if (t >= 1) { this.swinging = false; this.mesh.rotation.x = 0; }
        }
    }

    /** Espada flotando frente al controller VR */
    updatePoseVR(controllerObj, dt) {
        if (!this.equipped) return;
        this.cooldown = Math.max(0, this.cooldown - dt);

        this.mesh.position.copy(controllerObj.position);
        this.mesh.quaternion.copy(controllerObj.quaternion);
        // Apuntar la hoja hacia adelante del controller
        this.mesh.rotateX(-Math.PI / 2);

        if (this.swinging) {
            this.swingTime += dt;
            if (this.swingTime / COMBAT.SWORD.COOLDOWN >= 1) this.swinging = false;
        }
    }
}
