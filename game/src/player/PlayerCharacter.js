/**
 * PlayerCharacter.js — Carga FBX de Mixamo o construye fallback.
 * Maneja animaciones: idle, walk, run, dance (jump y attack son procedurales).
 *
 * IMPORTANTE: para que las animaciones de Mixamo (Walking.fbx, Running.fbx,
 * Salsa Dancing.fbx) funcionen sobre character.fbx, los clips de animación
 * se REMAPEAN al esqueleto del character.fbx — es lo que evita los frames
 * "saltones" que se ven cuando solo se hace clipAction sin reasignar.
 */
import * as THREE from 'three';

export class PlayerCharacter {
    constructor(scene, assetLoader) {
        this.scene = scene;
        this.assets = assetLoader;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.currentName = '';
        this._procTime = 0;
        this._isProcedural = false;
        this._procParts = null;
        this._charModel = null;   // referencia al FBX cargado (para remapear)
    }

    /**
     * Carga NO BLOQUEANTE.
     * Resuelve inmediatamente con el fallback procedural; el FBX se carga
     * en background. Como el juego es en primera persona y el personaje
     * está oculto, esto es seguro y elimina ~34 MB del tiempo de arranque.
     *
     * @param {boolean} skipFBX — Si es true, ni siquiera intenta cargar los FBX.
     *                           Útil cuando el personaje está oculto (1ª persona).
     */
    async load(skipFBX = false) {
        // 1) Crear fallback inmediato (no cuesta nada)
        this._buildFallback();
        // 2) Cargar FBX en background SOLO si se va a renderizar
        if (!skipFBX) {
            this._loadFBXInBackground();
        }
        // 3) Resolver YA: el juego puede arrancar
        return Promise.resolve();
    }

    _loadFBXInBackground() {
        this.assets.loadFBX('character.fbx',
            fbx => {
                // Cuando termine, reemplazar el fallback por el modelo real
                this._upgradeToFBX(fbx);
            },
            () => { /* sin FBX, nos quedamos con el fallback procedural */ }
        );
    }

    _upgradeToFBX(fbx) {
        // Limpiar fallback
        if (this._isProcedural) {
            // Quitar todos los meshes del grupo excepto referencias internas
            while (this.group.children.length > 0) {
                this.group.remove(this.group.children[0]);
            }
            this._isProcedural = false;
            this._procParts = null;
        }
        this._setupFBX(fbx);
    }

    _setupFBX(fbx) {
        fbx.scale.setScalar(0.012);
        fbx.traverse(o => {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.isMesh && o.material) {
                const apply = m => { m.metalness = 0.05; m.roughness = 0.7; };
                Array.isArray(o.material) ? o.material.forEach(apply) : apply(o.material);
            }
        });
        this.group.add(fbx);
        this._charModel = fbx;
        this.mixer = new THREE.AnimationMixer(fbx);

        if (fbx.animations?.length) {
            const idleClip = fbx.animations[0];
            idleClip.name = 'idle';
            this.actions.idle = this.mixer.clipAction(idleClip);
        }

        const animFiles = {
            walk:  'Walking.fbx',
            run:   'Running.fbx',
            dance: 'Dance.fbx',
        };

        // Cargar animaciones en paralelo — también en background
        Object.entries(animFiles).forEach(([name, file]) => {
            this.assets.loadFBX(file, animFBX => {
                if (animFBX.animations?.length) {
                    const srcClip = animFBX.animations[0];
                    const clip = this._retargetClip(srcClip, fbx);
                    clip.name = name;
                    const act = this.mixer.clipAction(clip);
                    act.setEffectiveWeight(1.0);
                    act.setEffectiveTimeScale(1.0);
                    this.actions[name] = act;
                }
            }, () => {});
        });

        // Si la animación actual es idle, reactivarla con el FBX nuevo
        if (this.actions.idle && this.currentName === 'idle') {
            this.actions.idle.reset().fadeIn(0.2).play();
            this.currentAction = this.actions.idle;
        }
    }

    /**
     * Asegura que las tracks del clip apunten a nodos que SÍ existen en el
     * modelo destino. Los clips de Mixamo usan nombres como "mixamorigHips";
     * el character.fbx también, así que normalmente coinciden — pero filtramos
     * tracks rotas para evitar pops/saltos.
     */
    _retargetClip(srcClip, targetModel) {
        const targetBones = new Set();
        targetModel.traverse(o => {
            if (o.isBone || o.isObject3D) targetBones.add(o.name);
        });

        const validTracks = srcClip.tracks.filter(track => {
            const boneName = track.name.split('.')[0];
            return targetBones.has(boneName);
        });

        // Si no quedan tracks (modelos muy distintos), devolver clip original
        if (validTracks.length === 0) return srcClip;
        return new THREE.AnimationClip(srcClip.name, srcClip.duration, validTracks);
    }

    _buildFallback() {
        this._isProcedural = true;
        const bodyMat  = new THREE.MeshStandardMaterial({ color: 0x4060a8, roughness: 0.6 });
        const armorMat = new THREE.MeshStandardMaterial({ color: 0x8a6a30, roughness: 0.4, metalness: 0.6 });
        const skinMat  = new THREE.MeshStandardMaterial({ color: 0xe8c0a0, roughness: 0.7 });
        const hairMat  = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9 });
        const bootMat  = new THREE.MeshStandardMaterial({ color: 0x2a1a0a });

        const parts = {};
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.6, 10), armorMat);
        torso.position.y = 1.0; torso.castShadow = true; this.group.add(torso); parts.torso = torso;

        const belt = new THREE.Mesh(
            new THREE.CylinderGeometry(0.27, 0.27, 0.08, 10),
            new THREE.MeshStandardMaterial({ color: 0x3a2010 })
        );
        belt.position.y = 0.72; this.group.add(belt);

        [-1, 1].forEach(s => {
            const pad = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI), armorMat);
            pad.position.set(s * 0.27, 1.2, 0); pad.rotation.z = s * Math.PI / 2;
            pad.castShadow = true; this.group.add(pad);
        });

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skinMat);
        head.position.y = 1.55; head.castShadow = true; this.group.add(head); parts.head = head;

        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8), hairMat);
        hair.position.y = 1.62; hair.scale.y = 0.7;
        hair.castShadow = true; this.group.add(hair);

        [-1, 1].forEach(s => {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.025, 6, 4),
                new THREE.MeshBasicMaterial({ color: 0x101820 })
            );
            eye.position.set(s * 0.07, 1.55, 0.19); this.group.add(eye);
        });

        [-1, 1].forEach(s => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.55, 7), bodyMat);
            leg.position.set(s * 0.12, 0.42, 0); leg.castShadow = true; this.group.add(leg);
            parts['leg' + s] = leg;
            const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.24), bootMat);
            boot.position.set(s * 0.12, 0.1, 0.03); boot.castShadow = true; this.group.add(boot);
        });

        [-1, 1].forEach(s => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 7), bodyMat);
            arm.position.set(s * 0.33, 0.95, 0); arm.rotation.z = -s * 0.2;
            arm.castShadow = true; this.group.add(arm);
            parts['arm' + s] = arm;
        });

        parts.headBase = 1.55;
        parts.torsoBase = 1.0;
        this._procParts = parts;
    }

    play(name) {
        // Misma animación -> no hacer nada
        if (this.currentName === name) return;
        const next = this.actions[name];

        // Si no hay acción para este nombre Y no somos procedurales, no cambiar
        if (!next && !this._isProcedural) {
            // Pero sí actualizamos currentName para que el fallback procedural pinte
            // la animación correcta
            this.currentName = name;
            return;
        }

        // Fade out de la actual
        if (this.currentAction && this.currentAction.isRunning?.()) {
            this.currentAction.fadeOut(0.18);
        }

        if (next) {
            next.reset().fadeIn(0.18).play();
            this.currentAction = next;
        } else {
            this.currentAction = null;
        }
        this.currentName = name;
    }

    setPosition(v) { this.group.position.copy(v); }
    setRotationY(a) { this.group.rotation.y = a; }

    update(dt) {
        if (this.mixer) this.mixer.update(dt);
        if (this._isProcedural) this._updateProcedural(dt);
    }

    _updateProcedural(dt) {
        this._procTime += dt;
        const t = this._procTime;
        const parts = this._procParts;
        if (!parts) return;
        const name = this.currentName;

        if (name === 'walk' || name === 'run') {
            const spd = name === 'run' ? 9 : 5.5;
            const amp = name === 'run' ? 0.7 : 0.45;
            const bob = Math.abs(Math.sin(t * spd)) * 0.05;
            parts.torso.position.y = parts.torsoBase + bob;
            parts.head.position.y  = parts.headBase  + bob;
            parts['arm-1'].rotation.x =  Math.sin(t * spd) * amp;
            parts['arm1'].rotation.x  = -Math.sin(t * spd) * amp;
            parts['leg-1'].rotation.x = -Math.sin(t * spd) * amp * 0.8;
            parts['leg1'].rotation.x  =  Math.sin(t * spd) * amp * 0.8;
        } else if (name === 'dance') {
            const a = Math.sin(t * 6) * 0.5;
            parts['arm-1'].rotation.z = -0.2 - a;
            parts['arm1'].rotation.z  =  0.2 + a;
            parts['arm-1'].rotation.x = -1.0;
            parts['arm1'].rotation.x  = -1.0;
            parts.head.rotation.y     = Math.sin(t * 5) * 0.6;
            const bob = Math.abs(Math.sin(t * 6)) * 0.1;
            parts.torso.position.y = parts.torsoBase + bob;
            parts.head.position.y  = parts.headBase  + bob;
        } else if (name === 'attack') {
            const k = Math.min(1, (t % 0.5) / 0.5);
            parts['arm1'].rotation.x = -Math.sin(k * Math.PI) * 2.5;
        } else if (name === 'jump') {
            parts['arm-1'].rotation.x = -0.8;
            parts['arm1'].rotation.x  = -0.8;
            parts['leg-1'].rotation.x = -0.3;
            parts['leg1'].rotation.x  = -0.3;
        } else {
            // idle: respiración + brazos relajados
            const bob = Math.sin(t * 1.5) * 0.015;
            parts.torso.position.y = parts.torsoBase + bob;
            parts.head.position.y  = parts.headBase  + bob;
            parts['arm-1'].rotation.x = 0; parts['arm1'].rotation.x = 0;
            parts['leg-1'].rotation.x = 0; parts['leg1'].rotation.x = 0;
            parts['arm-1'].rotation.z = -0.2; parts['arm1'].rotation.z = 0.2;
            parts.head.rotation.y = Math.sin(t * 0.7) * 0.15;
        }
    }
}
