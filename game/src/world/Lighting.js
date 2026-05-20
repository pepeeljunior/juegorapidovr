/**
 * Lighting.js — Sol direccional, relleno hemisférico y hogueras.
 */
import * as THREE from 'three';
import { COLORS } from '../core/Config.js';

export class Lighting {
    constructor(scene) {
        this.scene = scene;
        this.campfires = [];
        this.flames = [];
        this._build();
    }

    _build() {
        // ── Ambiental sutil ─────────────────────────────────────────────
        const ambient = new THREE.AmbientLight(0x4a5a78, 0.35);
        this.scene.add(ambient);

        // ── Sol tenue cálido (último resplandor del horizonte) ──────────
        const sun = new THREE.DirectionalLight(0xffb878, 0.6);
        sun.position.set(40, 30, 25);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far  = 220;
        const SHADOW_RANGE = 60;
        sun.shadow.camera.left   = -SHADOW_RANGE;
        sun.shadow.camera.right  =  SHADOW_RANGE;
        sun.shadow.camera.top    =  SHADOW_RANGE;
        sun.shadow.camera.bottom = -SHADOW_RANGE;
        sun.shadow.bias = -0.0008;
        sun.shadow.normalBias = 0.04;
        this.scene.add(sun);

        // ── Hemisférico nocturno (sky bounce) ───────────────────────────
        const hemi = new THREE.HemisphereLight(0x4060a0, 0x2a2a30, 0.45);
        this.scene.add(hemi);

        // ── Luna FUERTE (luz principal nocturna) ────────────────────────
        const moon = new THREE.DirectionalLight(0xb8c8ff, 1.4);
        moon.position.set(-90, 70, -110);
        this.scene.add(moon);

        // ── Hogueras (puntos cálidos con parpadeo) ──────────────────────
        this._spawnCampfire(-12, -10);
        this._spawnCampfire( 16, 14);
        this._spawnCampfire( -2, 22);
    }

    _spawnCampfire(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Aro de piedras
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6055, roughness: 1 });
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const stone = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.18, 0),
                stoneMat
            );
            stone.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
            stone.rotation.set(Math.random(), Math.random(), Math.random());
            stone.castShadow = true;
            group.add(stone);
        }

        // Troncos cruzados
        const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 1 });
        [0, Math.PI/3, -Math.PI/3].forEach(rot => {
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 8), logMat);
            log.position.y = 0.15;
            log.rotation.set(Math.PI / 2, rot, 0);
            log.castShadow = true;
            group.add(log);
        });

        // Llama (cono translúcido)
        const flameMat = new THREE.MeshBasicMaterial({
            color: 0xff7a20, transparent: true, opacity: 0.85, depthWrite: false
        });
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 8), flameMat);
        flame.position.y = 0.7;
        group.add(flame);

        // Llama interior (amarilla)
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xffe040, transparent: true, opacity: 0.95, depthWrite: false
        });
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 8), innerMat);
        inner.position.y = 0.55;
        group.add(inner);

        // Luz puntual
        const light = new THREE.PointLight(0xff8844, 4.5, 16, 2);
        light.position.set(0, 1, 0);
        light.castShadow = true;
        light.shadow.mapSize.set(512, 512);
        group.add(light);

        this.scene.add(group);

        this.campfires.push({ light, baseIntensity: 4.5, phase: Math.random() * 10 });
        this.flames.push({ outer: flame, inner: inner, phase: Math.random() * 10 });
    }

    update(elapsed) {
        this.campfires.forEach(c => {
            c.phase += 0.12;
            const f = 1 + Math.sin(c.phase * 7.3) * 0.18 + Math.sin(c.phase * 13.1) * 0.1;
            c.light.intensity = c.baseIntensity * f;
        });
        this.flames.forEach(f => {
            f.outer.scale.y = 0.85 + Math.sin(elapsed * 8 + f.phase) * 0.25;
            f.outer.scale.x = 0.9 + Math.sin(elapsed * 6.3 + f.phase) * 0.15;
            f.inner.scale.y = 0.85 + Math.sin(elapsed * 11 + f.phase) * 0.3;
            f.outer.rotation.y += 0.05;
            f.inner.rotation.y -= 0.07;
        });
    }
}
