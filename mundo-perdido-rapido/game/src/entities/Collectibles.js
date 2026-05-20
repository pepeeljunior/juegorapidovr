/**
 * Collectibles.js — Gemas, pociones de salud/maná, flechas.
 * Flotantes con rotación; al ser tocadas otorgan recurso al jugador.
 */
import * as THREE from 'three';
import { WORLD, ITEMS, COLORS } from '../core/Config.js';
import { randRange, dist2D } from '../utils/MathUtils.js';
import { bus, EVT } from '../core/EventBus.js';

const TYPES = ['gem', 'gem', 'gem', 'health', 'mana', 'arrows'];  // pesos por repetición

export class Collectibles {
    constructor(scene, particles) {
        this.scene = scene;
        this.particles = particles;
        this.items = [];
        this._spawnAll();
    }

    _spawnAll() {
        for (let i = 0; i < ITEMS.SPAWN_COUNT; i++) {
            const x = randRange(-WORLD.HALF_SIZE + 5, WORLD.HALF_SIZE - 5);
            const z = randRange(-WORLD.HALF_SIZE + 5, WORLD.HALF_SIZE - 5);
            if (Math.sqrt(x*x + z*z) < 5) { i--; continue; }
            const type = TYPES[Math.floor(Math.random() * TYPES.length)];
            this._spawn(type, x, 1.0, z);
        }
    }

    _spawn(type, x, y, z) {
        let mesh;
        if (type === 'gem') {
            mesh = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.22, 0),
                new THREE.MeshStandardMaterial({
                    color: 0x4ac8ff, emissive: 0x2080a0, emissiveIntensity: 1.2,
                    metalness: 0.6, roughness: 0.2
                })
            );
        } else if (type === 'health') {
            const g = new THREE.Group();
            const bottle = new THREE.Mesh(
                new THREE.SphereGeometry(0.22, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0x802020, emissiveIntensity: 0.8, roughness: 0.3 })
            );
            g.add(bottle);
            const neck = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.08, 0.15, 6),
                new THREE.MeshStandardMaterial({ color: 0x444444 })
            );
            neck.position.y = 0.25; g.add(neck);
            mesh = g;
        } else if (type === 'mana') {
            const g = new THREE.Group();
            const bottle = new THREE.Mesh(
                new THREE.SphereGeometry(0.22, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0x3060ff, emissive: 0x2040a0, emissiveIntensity: 0.9, roughness: 0.3 })
            );
            g.add(bottle);
            const neck = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.08, 0.15, 6),
                new THREE.MeshStandardMaterial({ color: 0x444444 })
            );
            neck.position.y = 0.25; g.add(neck);
            mesh = g;
        } else if (type === 'arrows') {
            const g = new THREE.Group();
            for (let i = 0; i < 3; i++) {
                const a = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.015, 0.015, 0.55, 5),
                    new THREE.MeshStandardMaterial({ color: 0x8a5a30 })
                );
                a.position.set((i - 1) * 0.04, 0, 0);
                a.rotation.x = Math.PI / 2;
                g.add(a);
                // Punta
                const tip = new THREE.Mesh(
                    new THREE.ConeGeometry(0.025, 0.06, 4),
                    new THREE.MeshStandardMaterial({ color: 0xa0a0a0, metalness: 0.8 })
                );
                tip.position.set((i - 1) * 0.04, 0, 0.28);
                tip.rotation.x = Math.PI / 2;
                g.add(tip);
            }
            mesh = g;
        }
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        this.scene.add(mesh);

        // Anillo luminoso debajo
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.3, 0.45, 16),
            new THREE.MeshBasicMaterial({
                color: type === 'gem' ? 0x4ac8ff : type === 'health' ? 0xff4444 : type === 'mana' ? 0x4488ff : 0xffaa44,
                transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false
            })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.02, z);
        this.scene.add(ring);

        this.items.push({
            type, mesh, ring,
            position: mesh.position,
            phase: Math.random() * Math.PI * 2,
            collected: false,
        });
    }

    update(dt, elapsed, playerPos) {
        for (const it of this.items) {
            if (it.collected) continue;

            // Flotación + rotación
            it.mesh.position.y = 1.0 + Math.sin(elapsed * 2 + it.phase) * 0.15;
            it.mesh.rotation.y += dt * 1.5;
            it.ring.material.opacity = 0.3 + Math.sin(elapsed * 3 + it.phase) * 0.15;

            // ¿Recogido?
            if (dist2D(playerPos, it.position) < 1.1) {
                this._collect(it);
            }
        }
    }

    _collect(it) {
        it.collected = true;
        it.mesh.visible = false;
        it.ring.visible = false;
        this.particles.emit('pickup', it.mesh.position, 18);

        let payload;
        if (it.type === 'gem')        payload = { xp: ITEMS.GEM_VALUE };
        else if (it.type === 'health') payload = { health: ITEMS.POTION_HEAL };
        else if (it.type === 'mana')   payload = { mana:   ITEMS.POTION_MANA };
        else if (it.type === 'arrows') payload = { arrows: ITEMS.ARROW_PICKUP };
        bus.emit(EVT.ITEM_COLLECTED, { type: it.type, ...payload, position: it.position.clone() });
    }
}
