/**
 * PlayerController.js — Núcleo del jugador: movimiento, salto, giro,
 * cambio de arma, ataques, colisión con mundo y enemigos.
 *
 * FIXES aplicados:
 *  - Idle ya no se queda atorado tras saltar (lógica de animación simplificada).
 *  - Personaje pisa el suelo ondulado real (usa terrain.heightAt si está disponible).
 *  - Línea muerta de rotación eliminada.
 */
import * as THREE from 'three';
import { PLAYER, PHYSICS, WORLD, COMBAT } from '../core/Config.js';
import { lerpAngle, clamp, dist2D } from '../utils/MathUtils.js';
import { bus, EVT } from '../core/EventBus.js';
import { PlayerStats } from './PlayerStats.js';
import { PlayerCharacter } from './PlayerCharacter.js';
import { Sword } from '../combat/Sword.js';
import { Bow }   from '../combat/Bow.js';
import { Magic } from '../combat/Magic.js';

const WEAPONS = ['sword', 'bow', 'magic'];

export class PlayerController {
    constructor(scene, assetLoader, input, audio, particles) {
        this.scene = scene;
        this.input = input;
        this.audio = audio;
        this.particles = particles;

        this.character = new PlayerCharacter(scene, assetLoader);
        this.stats     = new PlayerStats();

        this.position  = new THREE.Vector3(0, 0, 0);
        this.velocityY = 0;
        this.grounded  = true;
        this.rotation  = 0;
        this.rotTarget = 0;
        this.turnCD    = 0;
        this._wasInAir = false;
        this._footstepT = 0;
        this._terrain  = null;   // se asigna en bindTerrain()
        this._attackAnimUntil = 0;
        this._jumpAnimUntil   = 0;

        // Armas
        this.sword = new Sword(scene);
        this.bow   = new Bow(scene);
        this.magic = new Magic(scene);
        this.weaponIndex = 0;
        this._equipWeapon(WEAPONS[0]);

        // ── eventos de pickups ──
        bus.on(EVT.ITEM_COLLECTED, ({ type, xp, health, mana, arrows }) => {
            if (xp)     this.stats.addXP(xp);
            if (health) this.stats.heal(health);
            if (mana)   this.stats.restoreMana(mana);
            if (arrows) this.stats.addArrows(arrows);
            if (type === 'gem') this.stats.addGem();
            this.audio.play('pickup', 0.7);
        });

        bus.on(EVT.ENEMY_KILLED, ({ xp }) => {
            this.stats.kills++;
            this.stats.addXP(xp);
        });

        bus.on(EVT.PLAYER_LEVELED, () => {
            this.audio.play('levelUp', 0.8);
            this.particles.emit('heal', this.position.clone().setY(1.2), 40);
        });
    }

    async init(skipFBX = false) {
        await this.character.load(skipFBX);
    }

    /** Inyecta terreno para que el personaje pise ondulación real */
    bindTerrain(terrain) { this._terrain = terrain; }

    _equipWeapon(name) {
        this.sword.equip(name === 'sword');
        this.bow.equip(name === 'bow');
        this.magic.equip(name === 'magic');
        bus.emit(EVT.WEAPON_SWITCHED, { weapon: name });
    }

    switchWeapon(idx) {
        idx = ((idx % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
        this.weaponIndex = idx;
        this._equipWeapon(WEAPONS[idx]);
    }

    currentWeapon() { return WEAPONS[this.weaponIndex]; }

    update(dt, time, lookYaw, enemies, worldObstacles, isVR) {
        if (!this.stats.alive) return;

        // ── INPUT ───────────────────────────────────────────────────────
        // En primera persona usamos el yaw de la cámara para todo
        const [moveX, moveZ] = this.input.getMoveAxis();
        const running = this.input.isHeld('RUN');

        // VR joystick izquierdo
        let vrX = 0, vrZ = 0;
        if (isVR) {
            const dz = 0.18;
            vrX = Math.abs(this.input.vr.leftAxes[0]) > dz ? this.input.vr.leftAxes[0] : 0;
            vrZ = Math.abs(this.input.vr.leftAxes[1]) > dz ? this.input.vr.leftAxes[1] : 0;
        }
        const tX = moveX + vrX;
        const tZ = moveZ + vrZ;
        const moving = Math.abs(tX) + Math.abs(tZ) > 0.05;

        // ── Cambio de arma ──────────────────────────────────────────────
        if (this.input.justPressed.has('Digit1')) this.switchWeapon(0);
        if (this.input.justPressed.has('Digit2')) this.switchWeapon(1);
        if (this.input.justPressed.has('Digit3')) this.switchWeapon(2);
        if (isVR && this.input.vr.xJust) this.switchWeapon(this.weaponIndex + 1);

        // ── Saltar ─────────────────────────────────────────────────────
        if ((this.input.wasJustPressed('JUMP') || (isVR && this.input.vr.aJust)) && this.grounded) {
            this.velocityY = PLAYER.JUMP_FORCE;
            this.grounded = false;
            this.audio.play('jump', 0.6);
            this._jumpAnimUntil = time + 0.6;
        }

        // ── Bailar (solo si modelo visible) ─────────────────────────────
        if (this.input.wasJustPressed('DANCE') || (isVR && this.input.vr.bJust)) {
            if (this.character.currentName === 'dance') {
                this.character.play('idle');
            } else {
                this.character.play('dance');
            }
        }

        // ── Atacar ────────────────────────────────────────────────────
        const attackPressed = this.input.justPressed.has('Mouse0') ||
                              this.input.justPressed.has('KeyF') ||
                              (isVR && this.input.vr.triggerR_just);
        if (attackPressed) {
            this._performAttack(isVR, time, lookYaw);
        }

        // ── Snap turn DESACTIVADO en VR (la cabeza gira por sí sola) ────
        // Solo Q/E en PC siguen funcionando como atajos opcionales
        this.turnCD = Math.max(0, this.turnCD - dt);

        // ── MOVIMIENTO (relativo a hacia dónde mira la cabeza) ──────────
        const speed = running ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
        if (moving) {
            // Vector (tX, tZ) en coordenadas locales de la cámara:
            //   tX = derecha+/izquierda-,  tZ = atrás+/adelante-
            // Convertimos a mundo rotando por lookYaw
            const len = Math.hypot(tX, tZ);
            const nx = tX / len, nz = tZ / len;
            const cosA = Math.cos(lookYaw), sinA = Math.sin(lookYaw);
            // Adelante (-Z local) → en mundo: (-sin(yaw), -cos(yaw))
            // Derecha (+X local) → en mundo: (cos(yaw), -sin(yaw))
            const dx =  nx * cosA - nz * sinA;
            const dz = -nx * sinA - nz * cosA;

            this.position.x += dx * speed * dt;
            this.position.z += dz * speed * dt;

            // Apuntar personaje hacia movimiento (solo afecta al modelo oculto)
            const targetAngle = Math.atan2(dx, dz);
            this.rotation = lerpAngle(this.rotation, targetAngle, PLAYER.TURN_SPEED * dt);

            // Footsteps
            this._footstepT -= dt;
            if (this._footstepT <= 0 && this.grounded) {
                this.audio.play('footstep', 0.35);
                this._footstepT = running ? 0.32 : 0.5;
            }
        }

        // ── Gravedad y altura del suelo (ondulado) ─────────────────────
        const groundY = this._terrain ? this._terrain.heightAt(this.position.x, this.position.z) : WORLD.GROUND_Y;
        this.velocityY += PHYSICS.GRAVITY * dt;
        this.position.y += this.velocityY * dt;
        if (this.position.y <= groundY) {
            this.position.y = groundY;
            this.velocityY = 0;
            if (!this.grounded) {
                this.audio.play('land', 0.45);
                this._wasInAir = false;
            }
            this.grounded = true;
        } else {
            this.grounded = false;
            this._wasInAir = true;
        }

        // ── Colisión con obstáculos del mundo ───────────────────────────
        for (const obs of worldObstacles) {
            const d = dist2D(this.position, obs.position);
            const minD = PHYSICS.CHAR_RADIUS + obs.radius;
            if (d < minD && d > 0.001) {
                const overlap = minD - d;
                const nx = (this.position.x - obs.position.x) / d;
                const nz = (this.position.z - obs.position.z) / d;
                this.position.x += nx * overlap;
                this.position.z += nz * overlap;
            }
        }

        // ── Colisión con enemigos ───────────────────────────────────────
        for (const e of enemies.list) {
            if (e.state === 'dead') continue;
            const d = dist2D(this.position, e.group.position);
            const minD = PHYSICS.CHAR_RADIUS + 0.5;
            if (d < minD && d > 0.001) {
                const overlap = minD - d;
                const nx = (this.position.x - e.group.position.x) / d;
                const nz = (this.position.z - e.group.position.z) / d;
                this.position.x += nx * overlap * 0.6;
                this.position.z += nz * overlap * 0.6;
            }
        }

        // ── Límites del mundo ──────────────────────────────────────────
        const L = WORLD.HALF_SIZE - 1.5;
        this.position.x = clamp(this.position.x, -L, L);
        this.position.z = clamp(this.position.z, -L, L);

        // ── Lógica de animación SIMPLE ─────────────────────────────────
        // Prioridad: dance > attack > jump > run/walk > idle
        const isDancing  = this.character.currentName === 'dance';
        const isAttacking = time < this._attackAnimUntil;
        const isJumping   = !this.grounded || time < this._jumpAnimUntil;

        if (!isDancing) {
            if (isAttacking) {
                this.character.play('attack');
            } else if (isJumping) {
                this.character.play('jump');
            } else if (moving) {
                this.character.play(running ? 'run' : 'walk');
            } else {
                this.character.play('idle');
            }
        }

        // ── Aplicar al personaje visual ────────────────────────────────
        this.character.setPosition(this.position);
        this.character.setRotationY(this.rotation);
        this.character.update(dt);

        // ── Actualizar armas (pose y cooldown) ──────────────────────────
        if (this.sword.equipped) this.sword.updatePose(this.character.group, dt);
        if (this.bow.equipped)   this.bow.updatePose(this.character.group);
        if (this.magic.equipped) this.magic.updatePose(this.character.group);

        // ── Stats ──────────────────────────────────────────────────────
        this.stats.update(dt, time);
    }

    _performAttack(isVR, time, lookYaw) {
        const w = this.currentWeapon();
        // Disparar HACIA donde mira la cámara (no el modelo)
        const aim = (lookYaw !== undefined) ? lookYaw : this.rotation;
        // En 1ª persona: adelante = -sin(yaw), -cos(yaw)
        const fwd = new THREE.Vector3(-Math.sin(aim), 0, -Math.cos(aim));
        const origin = this.position.clone().setY(1.5).add(fwd.clone().multiplyScalar(0.5));
        const dir    = fwd.clone();

        if (w === 'sword') {
            const r = this.sword.swing(this.position, aim, this._enemiesRef, this.audio, this.particles, this.stats.stamina);
            if (r) {
                this.stats.spendStamina(r.staminaCost);
                this._attackAnimUntil = time + 0.45;
            }
        } else if (w === 'bow') {
            if (this.stats.useArrow()) {
                const r = this.bow.shoot(origin, dir, this.audio, this.particles, this.stats.stamina);
                if (r) {
                    this.stats.spendStamina(r.staminaCost);
                    this._attackAnimUntil = time + 0.3;
                }
            }
        } else if (w === 'magic') {
            const r = this.magic.cast(origin, dir, this.audio, this.particles, this.stats.mana);
            if (r) {
                this.stats.spendMana(r.manaCost);
                this._attackAnimUntil = time + 0.3;
            }
        }
    }

    bindEnemies(enemies) { this._enemiesRef = enemies; }

    updateProjectiles(dt, enemies) {
        this.bow.update(dt, enemies, this.particles, this.audio);
        this.magic.update(dt, enemies, this.particles, this.audio);
    }

    onDamageTaken(amount, sourcePos, time) {
        this.stats.damage(amount, time);
        this.audio.play('hurt', 0.5);
        this.particles.emit('blood', this.position.clone().setY(1.2), 12);
    }
}
