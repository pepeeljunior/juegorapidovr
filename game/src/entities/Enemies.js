/**
 * Enemies.js — Goblins, orcos y espectros con IA básica.
 *
 * FIX — RESPAWN:
 *   Antes los enemigos morían y no volvían. Ahora hay un sistema de cola de
 *   respawn: cuando un enemigo muere se añade a `_respawnQueue` con un
 *   temporizador. Tras RESPAWN_DELAY segundos reaparece en una posición
 *   aleatoria lejos del jugador.
 *
 *   • RESPAWN_DELAY: segundos de espera antes de reaparecer (configurable).
 *   • Se mantiene siempre MIN_ALIVE enemigos vivos como mínimo.
 */
import * as THREE from 'three';
import { ENEMIES, WORLD, COLORS } from '../core/Config.js';
import { randRange, dist2D, lookAngleY, lerpAngle } from '../utils/MathUtils.js';
import { bus, EVT } from '../core/EventBus.js';

const STATES = { IDLE: 'idle', CHASE: 'chase', ATTACK: 'attack', HURT: 'hurt', DEAD: 'dead' };

// ── Configuración de respawn ──────────────────────────────────────────
const RESPAWN_DELAY = 12;      // segundos hasta que reaparece
const MIN_SPAWN_DIST = 14;     // distancia mínima al jugador para reaparecer
const ENEMY_TYPES   = ['goblin', 'goblin', 'orc', 'wraith', 'goblin', 'orc', 'wraith'];

export class Enemies {
    constructor(scene, particles) {
        this.scene     = scene;
        this.particles = particles;
        this.list      = [];
        this._respawnQueue = [];   // [{ type, timer }]
        this._lastPlayerPos = new THREE.Vector3(); // actualizado en update()
        this._spawnAll();
    }

    _spawnAll() {
        for (let i = 0; i < ENEMIES.SPAWN_COUNT; i++) {
            const type = ENEMY_TYPES[i % ENEMY_TYPES.length];
            const pos  = this._randomSpawnPos(new THREE.Vector3(0, 0, 0));
            this._spawn(type, pos.x, pos.z);
        }
    }

    /** Devuelve una posición aleatoria lejos de `avoidPos` */
    _randomSpawnPos(avoidPos) {
        let x, z, tries = 0;
        do {
            x = randRange(-WORLD.HALF_SIZE + 6, WORLD.HALF_SIZE - 6);
            z = randRange(-WORLD.HALF_SIZE + 6, WORLD.HALF_SIZE - 6);
            tries++;
        } while (Math.sqrt((x - avoidPos.x) ** 2 + (z - avoidPos.z) ** 2) < MIN_SPAWN_DIST && tries < 60);
        return { x, z };
    }

    _spawn(type, x, z) {
        const cfg   = ENEMIES[type.toUpperCase()];
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.userData.type = type;

        if (type === 'goblin')     this._buildGoblin(group);
        else if (type === 'orc')   this._buildOrc(group);
        else if (type === 'wraith') this._buildWraith(group);

        const hpBar = this._buildHPBar();
        hpBar.position.y = (type === 'orc' ? 2.6 : 2.0);
        group.add(hpBar);

        this.scene.add(group);

        this.list.push({
            type,
            group,
            cfg:           { ...cfg },
            maxHp:         cfg.HEALTH,
            hp:            cfg.HEALTH,
            state:         STATES.IDLE,
            stateTime:     0,
            attackCooldown: 0,
            rot:           Math.random() * Math.PI * 2,
            hpBar,
            wanderTarget:  null,
            wanderTimer:   0,
            knockback:     new THREE.Vector3(),
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // update
    // ─────────────────────────────────────────────────────────────────
    update(dt, elapsed, playerPos, cameraPos, onDamagePlayer) {
        // Guardar posición del jugador para usarla en respawn
        this._lastPlayerPos.copy(playerPos);

        // ── Procesar cola de respawn ───────────────────────────────
        for (let i = this._respawnQueue.length - 1; i >= 0; i--) {
            const entry = this._respawnQueue[i];
            entry.timer -= dt;
            if (entry.timer <= 0) {
                const pos = this._randomSpawnPos(this._lastPlayerPos);
                this._spawn(entry.type, pos.x, pos.z);
                this._respawnQueue.splice(i, 1);
            }
        }

        // ── Actualizar enemigos activos ────────────────────────────
        for (const e of this.list) {
            if (e.state === STATES.DEAD) continue;

            e.stateTime    += dt;
            e.attackCooldown -= dt;

            const distToPlayer = dist2D(e.group.position, playerPos);

            // HP bar siempre mira a la cámara
            if (e.hp < e.maxHp) {
                e.hpBar.visible = true;
                e.hpBar.lookAt(cameraPos);
                e.hpBar.userData.fg.scale.x     = Math.max(0, e.hp / e.maxHp);
                e.hpBar.userData.fg.position.x  = -(1 - e.hp / e.maxHp) * 0.4;
            }

            // ── HURT ────────────────────────────────────────────────
            if (e.state === STATES.HURT) {
                e.group.position.addScaledVector(e.knockback, dt);
                e.knockback.multiplyScalar(0.85);
                if (e.stateTime > 0.3) {
                    e.state    = STATES.CHASE;
                    e.stateTime = 0;
                }
                continue;
            }

            // ── ATTACK ──────────────────────────────────────────────
            if (e.state === STATES.ATTACK) {
                const angle = lookAngleY(e.group.position, playerPos);
                e.rot = lerpAngle(e.rot, angle, 8 * dt);

                if (e.group.userData.weapon) {
                    e.group.userData.weapon.rotation.x = Math.sin(e.stateTime * 12) * 0.8;
                }

                if (!e._hit && e.stateTime > 0.3 && distToPlayer < ENEMIES.ATTACK_RANGE) {
                    onDamagePlayer(e.cfg.DAMAGE, e.group.position);
                    e._hit = true;
                }

                if (e.stateTime > 0.7) {
                    e.state        = STATES.CHASE;
                    e.stateTime    = 0;
                    e._hit         = false;
                    e.attackCooldown = e.cfg.ATTACK_CD;
                }
                e.group.rotation.y = e.rot;
                continue;
            }

            // ── CHASE / IDLE ─────────────────────────────────────────
            if (distToPlayer < ENEMIES.DETECT_RANGE) {
                e.state = STATES.CHASE;
                const angle = lookAngleY(e.group.position, playerPos);
                e.rot = lerpAngle(e.rot, angle, 5 * dt);

                if (distToPlayer < ENEMIES.ATTACK_RANGE && e.attackCooldown <= 0) {
                    e.state    = STATES.ATTACK;
                    e.stateTime = 0;
                } else if (distToPlayer > ENEMIES.ATTACK_RANGE - 0.2) {
                    const dx = Math.sin(e.rot), dz = Math.cos(e.rot);
                    e.group.position.x += dx * e.cfg.SPEED * dt;
                    e.group.position.z += dz * e.cfg.SPEED * dt;
                }

                if (e.type === 'wraith') {
                    e.group.position.y = 0.3 + Math.sin(elapsed * 2 + e.group.position.x) * 0.15;
                    if (e.group.userData.aura) e.group.userData.aura.rotation.y += dt;
                } else {
                    e.group.position.y = 0;
                }
                e.group.rotation.y = e.rot;

            } else {
                // IDLE / WANDER
                e.state = STATES.IDLE;
                e.wanderTimer -= dt;
                if (e.wanderTimer <= 0 || !e.wanderTarget) {
                    e.wanderTimer  = randRange(2, 5);
                    e.wanderTarget = new THREE.Vector3(
                        e.group.position.x + randRange(-5, 5),
                        0,
                        e.group.position.z + randRange(-5, 5)
                    );
                }
                const dx = e.wanderTarget.x - e.group.position.x;
                const dz = e.wanderTarget.z - e.group.position.z;
                const d  = Math.sqrt(dx * dx + dz * dz);
                if (d > 0.5) {
                    const a = Math.atan2(dx, dz);
                    e.rot = lerpAngle(e.rot, a, 2 * dt);
                    e.group.position.x += Math.sin(e.rot) * e.cfg.SPEED * 0.4 * dt;
                    e.group.position.z += Math.cos(e.rot) * e.cfg.SPEED * 0.4 * dt;
                }
                if (e.type === 'wraith') {
                    e.group.position.y = 0.3 + Math.sin(elapsed * 1.5 + e.group.position.x) * 0.1;
                    if (e.group.userData.aura) e.group.userData.aura.rotation.y += dt * 0.5;
                }
                e.group.rotation.y = e.rot;
            }

            // Limitar al mundo
            const L = WORLD.HALF_SIZE - 2;
            e.group.position.x = Math.max(-L, Math.min(L, e.group.position.x));
            e.group.position.z = Math.max(-L, Math.min(L, e.group.position.z));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // damage / kill
    // ─────────────────────────────────────────────────────────────────
    damage(enemy, amount, hitDir) {
        if (enemy.state === STATES.DEAD) return;
        enemy.hp -= amount;
        this.particles.emit('blood', enemy.group.position.clone().setY(1.2), 14);

        if (enemy.hp <= 0) {
            this._kill(enemy);
        } else {
            enemy.state    = STATES.HURT;
            enemy.stateTime = 0;
            enemy.knockback.set(hitDir.x * 8, 0, hitDir.z * 8);
            bus.emit(EVT.ENEMY_DAMAGED, { enemy, amount });
        }
    }

    _kill(e) {
        e.state = STATES.DEAD;
        this.particles.emit('blood', e.group.position.clone().setY(1.0), 30);

        e.group.rotation.x = Math.PI / 2;
        e.group.position.y -= 0.3;

        // Quitar de la escena tras 1.5s y encolar respawn
        setTimeout(() => {
            this.scene.remove(e.group);
            // Encolar reaparición del mismo tipo con delay
            this._respawnQueue.push({
                type:  e.type,
                timer: RESPAWN_DELAY,
            });
        }, 1500);

        bus.emit(EVT.ENEMY_KILLED, {
            type:     e.type,
            xp:       e.cfg.XP,
            position: e.group.position.clone(),
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // Builders de geometría (sin cambios respecto al original)
    // ─────────────────────────────────────────────────────────────────
    _buildGoblin(g) {
        const skin  = new THREE.MeshStandardMaterial({ color: 0x6a8a4a, roughness: 0.8 });
        const cloth = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 1 });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.6, 8), cloth);
        body.position.y = 0.75; body.castShadow = true; g.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
        head.position.y = 1.3; head.scale.set(1, 1.1, 1.1); head.castShadow = true; g.add(head);

        [-1, 1].forEach(s => {
            const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), skin);
            ear.position.set(s * 0.22, 1.4, 0); ear.rotation.z = -s * Math.PI / 4;
            g.add(ear);
        });
        [-1, 1].forEach(s => {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.04, 6, 4),
                new THREE.MeshBasicMaterial({ color: 0xff2020 })
            );
            eye.position.set(s * 0.09, 1.32, 0.21); g.add(eye);
        });
        [-1, 1].forEach(s => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), skin);
            leg.position.set(s * 0.12, 0.25, 0); g.add(leg);
        });
        [-1, 1].forEach(s => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6), skin);
            arm.position.set(s * 0.32, 0.85, 0); arm.rotation.z = s * 0.3; g.add(arm);
        });
        const dagger = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.3, 0.04),
            new THREE.MeshStandardMaterial({ color: 0xa0a0a0, metalness: 0.7, roughness: 0.3 })
        );
        dagger.position.set(0.38, 0.7, 0);
        g.add(dagger);
        g.userData.weapon = dagger;
    }

    _buildOrc(g) {
        const skin  = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.8 });
        const armor = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.4, metalness: 0.6 });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.9, 10), armor);
        body.position.y = 1.0; body.castShadow = true; g.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
        head.position.y = 1.75; head.castShadow = true; g.add(head);
        [-1, 1].forEach(s => {
            const tusk = new THREE.Mesh(
                new THREE.ConeGeometry(0.04, 0.12, 4),
                new THREE.MeshStandardMaterial({ color: 0xffeebb })
            );
            tusk.position.set(s * 0.1, 1.65, 0.28); tusk.rotation.x = Math.PI; g.add(tusk);
        });
        [-1, 1].forEach(s => {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 6, 4),
                new THREE.MeshBasicMaterial({ color: 0xffcc20 })
            );
            eye.position.set(s * 0.12, 1.78, 0.27); g.add(eye);
        });
        [-1, 1].forEach(s => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 7), skin);
            arm.position.set(s * 0.5, 1.0, 0); arm.rotation.z = s * 0.25; g.add(arm);
        });
        [-1, 1].forEach(s => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 7), armor);
            leg.position.set(s * 0.15, 0.35, 0); g.add(leg);
        });
        const mace  = new THREE.Group();
        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
            new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
        );
        mace.add(handle);
        const head_m = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.12, 0),
            new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.5 })
        );
        head_m.position.y = 0.35; mace.add(head_m);
        mace.position.set(0.55, 1.0, 0);
        g.add(mace);
        g.userData.weapon = mace;
    }

    _buildWraith(g) {
        const mat = new THREE.MeshStandardMaterial({
            color: 0x6a4ac4, emissive: 0x3020a0, emissiveIntensity: 0.6,
            transparent: true, opacity: 0.85, roughness: 0.4
        });
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 8, 1, true), mat);
        body.position.y = 1.0; body.castShadow = true; g.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat.clone());
        head.position.y = 2.0; g.add(head);
        [-1, 1].forEach(s => {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 6, 4),
                new THREE.MeshBasicMaterial({ color: 0x8aeaff })
            );
            eye.position.set(s * 0.1, 2.0, 0.24); g.add(eye);
        });
        [-1, 1].forEach(s => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.9, 5), mat.clone());
            arm.position.set(s * 0.45, 1.3, 0); arm.rotation.z = s * 0.4; g.add(arm);
        });
        const aura = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 12, 8),
            new THREE.MeshBasicMaterial({ color: 0x6a4ac4, transparent: true, opacity: 0.15, depthWrite: false })
        );
        aura.position.y = 1.3; g.add(aura);
        g.userData.aura = aura;
    }

    _buildHPBar() {
        const grp = new THREE.Group();
        const bg  = new THREE.Mesh(
            new THREE.PlaneGeometry(0.8, 0.08),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false })
        );
        grp.add(bg);
        const fg = new THREE.Mesh(
            new THREE.PlaneGeometry(0.8, 0.08),
            new THREE.MeshBasicMaterial({ color: 0xff3030, depthWrite: false })
        );
        fg.position.z = 0.001;
        grp.add(fg);
        grp.userData.fg = fg;
        grp.visible     = false;
        return grp;
    }
}

export { STATES };