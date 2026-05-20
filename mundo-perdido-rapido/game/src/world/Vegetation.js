/**
 * Vegetation.js — Árboles, arbustos, flores, ruinas y rocas decorativas.
 */
import * as THREE from 'three';
import { WORLD, COLORS } from '../core/Config.js';
import { randRange } from '../utils/MathUtils.js';

export class Vegetation {
    constructor(scene) {
        this.scene = scene;
        this.objects = [];   // colisionables (tronco, ruinas)
        this._build();
    }

    _build() {
        this._buildTrees();
        this._buildBushes();
        this._buildFlowers();
        this._buildRuins();
        this._buildBigRocks();
    }

    // ── ÁRBOLES con tres "ramos" de copa para volumen orgánico ───────────
    _buildTrees() {
        const TRUNK_MAT = new THREE.MeshStandardMaterial({ color: COLORS.BARK, roughness: 1 });
        const LEAF_MATS = [
            new THREE.MeshStandardMaterial({ color: 0x2d7a2d, roughness: 0.9 }),
            new THREE.MeshStandardMaterial({ color: 0x3d8a35, roughness: 0.9 }),
            new THREE.MeshStandardMaterial({ color: 0x255e22, roughness: 0.9 }),
        ];

        // Distribución pseudoaleatoria, evita centro (zona de juego)
        const treeCount = 32;
        for (let i = 0; i < treeCount; i++) {
            let x, z, ok = false, tries = 0;
            while (!ok && tries++ < 30) {
                x = randRange(-WORLD.HALF_SIZE + 4, WORLD.HALF_SIZE - 4);
                z = randRange(-WORLD.HALF_SIZE + 4, WORLD.HALF_SIZE - 4);
                if (Math.sqrt(x*x + z*z) > 6) ok = true;
            }
            this._spawnTree(x, z, TRUNK_MAT, LEAF_MATS);
        }
    }

    _spawnTree(x, z, trunkMat, leafMats) {
        const group = new THREE.Group();
        const trunkH = randRange(2.8, 4.5);
        const trunkR = randRange(0.18, 0.32);

        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 10),
            trunkMat
        );
        trunk.position.y = trunkH / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        const leafMat = leafMats[Math.floor(Math.random() * leafMats.length)];
        // 3-4 esferas solapadas
        const blobCount = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < blobCount; i++) {
            const r = randRange(1.0, 1.9);
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), leafMat);
            leaf.position.set(
                randRange(-0.8, 0.8),
                trunkH + randRange(0.2, 1.5),
                randRange(-0.8, 0.8)
            );
            leaf.castShadow = true;
            group.add(leaf);
        }

        group.position.set(x, 0, z);
        group.rotation.y = Math.random() * Math.PI * 2;
        group.scale.setScalar(randRange(0.85, 1.25));
        this.scene.add(group);

        // Tronco como obstáculo de colisión (cilindro lógico)
        this.objects.push({
            type: 'tree',
            position: new THREE.Vector3(x, 0, z),
            radius: trunkR * 1.3,
        });
    }

    // ── ARBUSTOS de baja poli ────────────────────────────────────────────
    _buildBushes() {
        const mat = new THREE.MeshStandardMaterial({ color: 0x1e5c1e, roughness: 1 });
        const matAlt = new THREE.MeshStandardMaterial({ color: 0x2a6a28, roughness: 1 });

        for (let i = 0; i < 40; i++) {
            const x = randRange(-WORLD.HALF_SIZE + 2, WORLD.HALF_SIZE - 2);
            const z = randRange(-WORLD.HALF_SIZE + 2, WORLD.HALF_SIZE - 2);
            if (Math.sqrt(x*x + z*z) < 4) continue;
            const s = randRange(0.4, 0.9);
            const bush = new THREE.Mesh(
                new THREE.SphereGeometry(s, 8, 6),
                Math.random() > 0.5 ? mat : matAlt
            );
            bush.position.set(x, s * 0.55, z);
            bush.scale.y = randRange(0.7, 1.1);
            bush.castShadow = true;
            this.scene.add(bush);
        }
    }

    // ── FLORES decorativas (pequeños conos coloreados) ───────────────────
    _buildFlowers() {
        const colors = [0xff6688, 0xffeb3b, 0x9c27b0, 0xffffff, 0xff5722];
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a });

        for (let i = 0; i < 60; i++) {
            const x = randRange(-WORLD.HALF_SIZE + 2, WORLD.HALF_SIZE - 2);
            const z = randRange(-WORLD.HALF_SIZE + 2, WORLD.HALF_SIZE - 2);
            if (Math.sqrt(x*x + z*z) < 4) continue;
            const g = new THREE.Group();
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), stemMat);
            stem.position.y = 0.15; g.add(stem);
            const petals = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 6, 4),
                new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], emissive: 0x111111 })
            );
            petals.position.y = 0.3; g.add(petals);
            g.position.set(x, 0, z);
            this.scene.add(g);
        }
    }

    // ── RUINAS ANTIGUAS (3 grupos de pilares rotos) ──────────────────────
    _buildRuins() {
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.95 });
        const sites = [[18, 14], [-22, -8], [-5, 20]];

        sites.forEach(([cx, cz]) => {
            // Pilares
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const r = 3;
                const px = cx + Math.cos(angle) * r;
                const pz = cz + Math.sin(angle) * r;
                const h = randRange(1.5, 3.5);
                const pillar = new THREE.Mesh(
                    new THREE.BoxGeometry(0.6, h, 0.6),
                    stoneMat
                );
                pillar.position.set(px, h / 2, pz);
                pillar.rotation.y = randRange(-0.2, 0.2);
                pillar.castShadow = true;
                pillar.receiveShadow = true;
                this.scene.add(pillar);

                this.objects.push({
                    type: 'pillar',
                    position: new THREE.Vector3(px, 0, pz),
                    radius: 0.5,
                });
            }
            // Base (plataforma circular baja)
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(4, 4, 0.3, 16),
                stoneMat
            );
            base.position.set(cx, 0.15, cz);
            base.receiveShadow = true;
            this.scene.add(base);
        });
    }

    // ── ROCAS GRANDES decorativas ────────────────────────────────────────
    _buildBigRocks() {
        const mat = new THREE.MeshStandardMaterial({ color: 0x808078, roughness: 0.95 });
        for (let i = 0; i < 15; i++) {
            const x = randRange(-WORLD.HALF_SIZE + 4, WORLD.HALF_SIZE - 4);
            const z = randRange(-WORLD.HALF_SIZE + 4, WORLD.HALF_SIZE - 4);
            if (Math.sqrt(x*x + z*z) < 5) continue;

            const r = randRange(0.8, 1.6);
            const geo = new THREE.DodecahedronGeometry(r, 0);
            const verts = geo.attributes.position;
            for (let j = 0; j < verts.count; j++) {
                verts.setX(j, verts.getX(j) * (0.8 + Math.random() * 0.4));
                verts.setY(j, verts.getY(j) * (0.7 + Math.random() * 0.3));
                verts.setZ(j, verts.getZ(j) * (0.8 + Math.random() * 0.4));
            }
            geo.computeVertexNormals();

            const rock = new THREE.Mesh(geo, mat);
            rock.position.set(x, r * 0.5, z);
            rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);

            this.objects.push({
                type: 'rock',
                position: new THREE.Vector3(x, 0, z),
                radius: r * 1.1,
            });
        }
    }
}
