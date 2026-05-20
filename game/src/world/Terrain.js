/**
 * Terrain.js — Piso ondulado con textura y campo de altura procedural.
 */
import * as THREE from 'three';
import { WORLD, COLORS } from '../core/Config.js';

export class Terrain {
    constructor(scene, assetLoader) {
        this.scene = scene;
        this.assets = assetLoader;
        this.mesh = null;
        this.heightField = [];   // para queries de altura (opcional)
        this._build();
    }

    /** Función de altura procedural (la misma que deforma la malla) */
    heightAt(x, z) {
        return Math.sin(x * 0.14) * 0.45 +
               Math.sin(z * 0.18) * 0.35 +
               Math.sin((x + z) * 0.08) * 0.25;
    }

    _build() {
        const SIZE = WORLD.HALF_SIZE * 2;
        const SEG  = 80;

        const groundColor  = this.assets.loadTexture('textures/ground_color.jpg', 24);
        const groundNormal = this.assets.loadTexture('textures/ground_normal.jpg', 24);
        const groundRough  = this.assets.loadTexture('textures/ground_roughness.jpg', 24);

        const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
        const mat = new THREE.MeshStandardMaterial({
            map:          groundColor,
            normalMap:    groundNormal,
            roughnessMap: groundRough,
            normalScale:  new THREE.Vector2(1.2, 1.2),
            roughness:    1.0,
            metalness:    0.0,
        });

        // Aplicar campo de altura
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i); // plano XY antes de rotar
            pos.setZ(i, this.heightAt(x, y));
        }
        geo.computeVertexNormals();

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        // Mancha de pasto especial (claro de luna)
        const patch = new THREE.Mesh(
            new THREE.CircleGeometry(7, 40),
            new THREE.MeshStandardMaterial({ color: 0x2d6a20, roughness: 0.95 })
        );
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(10, 0.02, -10);
        patch.receiveShadow = true;
        this.scene.add(patch);
    }
}
