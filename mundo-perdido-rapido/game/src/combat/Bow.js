/**
 * Bow.js — Arco con flechas físicas (proyectiles).
 * Las flechas viajan, colisionan con enemigos y desaparecen tras un tiempo.
 */
import * as THREE from 'three';
import { COMBAT, PHYSICS } from '../core/Config.js';
import { dist2D } from '../utils/MathUtils.js';

export class Bow {
    constructor(scene) {
        this.scene = scene;
        this.cooldown = 0;
        this.equipped = false;
        this.mesh = this._buildBow();
        this.mesh.visible = false;
        this.scene.add(this.mesh);

        // Proyectiles activos
        this.arrows = [];     // { mesh, vel, life }
        this.arrowGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5);
        this.arrowMat = new THREE.MeshStandardMaterial({ color: 0xc09060 });
        this.tipGeo  = new THREE.ConeGeometry(0.025, 0.07, 5);
        this.tipMat  = new THREE.MeshStandardMaterial({ color: 0xa0a0a0, metalness: 0.7 });
    }

    _buildBow() {
        const g = new THREE.Group();

        // Curva del arco: dos brazos en arco
        const armMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.7 });
        const upper = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 12, Math.PI * 0.7), armMat);
        upper.rotation.z = Math.PI;
        upper.position.y = 0.35;
        g.add(upper);

        // Cuerda
        const string = new THREE.Mesh(
            new THREE.CylinderGeometry(0.005, 0.005, 0.95, 4),
            new THREE.MeshBasicMaterial({ color: 0xdddddd })
        );
        string.position.set(0, 0.0, 0);
        g.add(string);

        // Empuñadura
        const grip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.15, 6),
            new THREE.MeshStandardMaterial({ color: 0x2a1a0a })
        );
        g.add(grip);

        return g;
    }

    equip(eq) { this.equipped = eq; this.mesh.visible = eq; }

    /** Disparar una flecha hacia `direction` (Vector3 normalizado) */
    shoot(originPos, direction, audio, particles, stamina) {
        if (!this.equipped || this.cooldown > 0 || stamina < COMBAT.BOW.STAMINA) return null;
        this.cooldown = COMBAT.BOW.COOLDOWN;
        audio.play('bow', 0.6);

        // Construir flecha (group con vara + punta)
        const arrow = new THREE.Group();
        const shaft = new THREE.Mesh(this.arrowGeo, this.arrowMat);
        shaft.rotation.x = Math.PI / 2;
        arrow.add(shaft);
        const tip = new THREE.Mesh(this.tipGeo, this.tipMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 0.4;
        arrow.add(tip);

        const fletch = new THREE.Mesh(
            new THREE.PlaneGeometry(0.12, 0.04),
            new THREE.MeshBasicMaterial({ color: 0xe04040, side: THREE.DoubleSide })
        );
        fletch.position.z = -0.3;
        arrow.add(fletch);

        arrow.position.copy(originPos);
        // Orientar flecha hacia direction
        arrow.lookAt(originPos.clone().add(direction));

        this.scene.add(arrow);

        const vel = direction.clone().multiplyScalar(COMBAT.BOW.ARROW_SPEED);
        this.arrows.push({ mesh: arrow, vel, life: 4, stuck: false });

        particles.emit('dust', originPos.clone(), 5);
        return { staminaCost: COMBAT.BOW.STAMINA };
    }

    update(dt, enemies, particles, audio) {
        this.cooldown = Math.max(0, this.cooldown - dt);

        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const a = this.arrows[i];
            if (a.stuck) {
                a.life -= dt;
                if (a.life <= 0) {
                    this.scene.remove(a.mesh);
                    this.arrows.splice(i, 1);
                }
                continue;
            }
            // Avanzar
            a.mesh.position.addScaledVector(a.vel, dt);
            a.vel.y += PHYSICS.GRAVITY * dt * 0.4;     // gravedad menor para flechas
            a.mesh.lookAt(a.mesh.position.clone().add(a.vel));
            a.life -= dt;

            // Piso
            if (a.mesh.position.y <= 0.05) {
                a.mesh.position.y = 0.05;
                a.stuck = true;
                a.life = 5;
                continue;
            }
            // Colisión con enemigos
            for (const e of enemies.list) {
                if (e.state === 'dead') continue;
                if (dist2D(a.mesh.position, e.group.position) < 0.8 &&
                    a.mesh.position.y < 2.2 && a.mesh.position.y > 0.3) {
                    const hitDir = a.vel.clone().normalize();
                    enemies.damage(e, COMBAT.BOW.DAMAGE, hitDir);
                    particles.emit('sparks', a.mesh.position.clone(), 10);
                    audio.play('hit', 0.5);
                    this.scene.remove(a.mesh);
                    this.arrows.splice(i, 1);
                    break;
                }
            }
            if (a.life <= 0) {
                this.scene.remove(a.mesh);
                this.arrows.splice(i, 1);
            }
        }
    }

    updatePose(playerObj) {
        if (!this.equipped) return;
        // Sostenido en la mano izquierda
        const offset = new THREE.Vector3(-0.4, 1.1, 0.2);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerObj.rotation.y);
        this.mesh.position.copy(playerObj.position).add(offset);
        this.mesh.rotation.y = playerObj.rotation.y + Math.PI / 2;
        this.mesh.rotation.z = 0.1;
    }

    updatePoseVR(controllerObj) {
        if (!this.equipped) return;
        this.mesh.position.copy(controllerObj.position);
        this.mesh.quaternion.copy(controllerObj.quaternion);
    }
}
