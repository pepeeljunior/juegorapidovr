/**
 * Game.js — Orquestador principal del juego.
 *
 * FIXES PARA META QUEST:
 *  - renderer.compile() envuelto en try/catch (en Quest a veces falla
 *    silenciosamente y trunca el init).
 *  - Llamado a setEyePosition() en cada frame ANTES de cualquier lectura
 *    de cámara para que el rig esté en su lugar desde el frame 1.
 *  - Validación del lookYaw para no propagar NaN al resto del juego.
 *  - Ocultar overlay de pointer-lock si ya entramos a VR.
 *  - Sin esperar al compile() para terminar el loading.
 */
import * as THREE      from 'three';
import { VRButton }    from 'three/addons/webxr/VRButton.js';

import { WORLD }            from './Config.js';
import { AssetLoader }      from './AssetLoader.js';
import { InputManager }     from './InputManager.js';
import { CameraRig }        from './CameraRig.js';
import { bus, EVT }         from './EventBus.js';

import { Terrain }          from '../world/Terrain.js';
import { Vegetation }       from '../world/Vegetation.js';
import { Lighting }         from '../world/Lighting.js';
import { ParticleSystem }   from '../world/ParticleSystem.js';
import { Skybox }           from '../world/Skybox.js';
import { Collectibles }     from '../entities/Collectibles.js';
import { Enemies }          from '../entities/Enemies.js';
import { PlayerController } from '../player/PlayerController.js';
import { AudioSystem }      from '../audio/AudioSystem.js';
import { VRControllers }    from '../vr/VRControllers.js';
import { VRHud }            from '../vr/VRHud.js';
import { HUD }              from '../ui/HUD.js';

export class Game {
    constructor() {
        this.clock = new THREE.Clock();
        this.isVR = false;
    }

    async init() {
        // ── Renderer ────────────────────────────────────────────────────
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.6;
        this.renderer.outputColorSpace    = THREE.SRGBColorSpace;
        this.renderer.xr.enabled = true;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        const vrBtn = VRButton.createButton(this.renderer);
        document.body.appendChild(vrBtn);

        // ── Scene + cámara ──────────────────────────────────────────────
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(WORLD.FOG_COLOR, WORLD.FOG_DENSITY);

        this.cameraRig = new CameraRig(this.renderer);
        this.scene.add(this.cameraRig.rig);

        // ── Sistemas ────────────────────────────────────────────────────
        this.assets    = new AssetLoader('../assets/');
        this.assets.registerExpected(3);
        this.assets.setProgressCallback((pct, label) => {
            const bar = document.getElementById('prog');
            if (bar) bar.style.width = Math.round(pct * 100) + '%';
            const h = document.getElementById('loading-hint');
            if (h && label) h.textContent = label;
        });

        this.input  = new InputManager(this.renderer);
        this.audio  = new AudioSystem(this.assets);
        this.particles = new ParticleSystem(this.scene);

        // ── Mundo ───────────────────────────────────────────────────────
        this.skybox     = new Skybox(this.scene);
        this.terrain    = new Terrain(this.scene, this.assets);
        this.vegetation = new Vegetation(this.scene);
        this.lighting   = new Lighting(this.scene);

        // ── Entidades ───────────────────────────────────────────────────
        this.enemies      = new Enemies(this.scene, this.particles);
        this.collectibles = new Collectibles(this.scene, this.particles);

        // ── VR controllers (ANTES del jugador para poder pasarlos) ──────
        this.vrControllers = new VRControllers(this.scene, this.renderer, this.cameraRig.rig);

        // ── Jugador ─────────────────────────────────────────────────────
        this.player = new PlayerController(
            this.scene, this.assets, this.input, this.audio,
            this.particles, this.vrControllers
        );
        await this.player.init(true);
        this.player.bindEnemies(this.enemies);
        this.player.bindTerrain(this.terrain);

        // Ocultar personaje (estamos en 1ª persona)
        this.player.character.group.visible = false;

        // ── UI ──────────────────────────────────────────────────────────
        this.hud   = new HUD(this.renderer);
        this.vrHud = new VRHud(this.scene, this.renderer);

        // ── Precompilar shaders (PROTEGIDO) ─────────────────────────────
        // En Quest, compile() puede fallar o tardar mucho. Lo envolvemos
        // para que no rompa el init.
        try {
            this.renderer.compile(this.scene, this.cameraRig.camera);
        } catch (e) {
            console.warn('renderer.compile falló (no crítico):', e);
        }

        // ── Eventos ─────────────────────────────────────────────────────
        window.addEventListener('resize', () => this._onResize());
        document.addEventListener('click',    () => this.audio.init(), { once: true });
        document.addEventListener('keydown',  () => this.audio.init(), { once: true });
        document.addEventListener('mousedown', e => {
            if (e.button === 0 && this.cameraRig.controls && this.cameraRig.controls.isLocked) {
                this.input.justPressed.add('Mouse0');
            }
        });
        document.addEventListener('keydown', e => {
            if (e.code === 'KeyM') this.audio.toggleMute();
            if (e.code === 'KeyR') location.reload();
        });

        // ── XR session lifecycle ────────────────────────────────────────
        this.renderer.xr.addEventListener('sessionstart', () => {
            this.isVR = true;
            this.cameraRig.setEnabled(false);
            this.hud.hide();
            this.vrHud.show();
            if (this.cameraRig._lockHint) this.cameraRig._lockHint.style.display = 'none';
            // Inicializar audio en VR (algunas veces no se activa)
            this.audio.init();
        });
        this.renderer.xr.addEventListener('sessionend', () => {
            this.isVR = false;
            this.hud.show();
            this.vrHud.hide();
            if (this.cameraRig._lockHint && this.cameraRig.controls) {
                this.cameraRig._lockHint.style.display = '';
            }
        });

        // ── Loop principal ──────────────────────────────────────────────
        this.renderer.setAnimationLoop(() => this._tick());

        this._finishLoading();
    }

    _finishLoading() {
        const el = document.getElementById('loading');
        if (!el) return;
        const bar = document.getElementById('prog');
        if (bar) bar.style.width = '100%';
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.6s';
        setTimeout(() => el.remove(), 700);
    }

    _tick() {
        const dt = Math.min(this.clock.getDelta(), 0.05);
        const time = this.clock.elapsedTime;

        this.input.pollVR();

        // FIX: Posicionar el rig PRIMERO, antes de leer la cámara
        // Esto asegura que en el frame 1 de XR, la cámara ya esté en su lugar
        this.cameraRig.setEyePosition(this.player.position);

        // Yaw seguro — validar NaN
        let lookYaw = this.cameraRig.getYaw();
        if (isNaN(lookYaw)) lookYaw = 0;

        // ── Jugador ─────────────────────────────────────────────────────
        this.player.update(dt, time, lookYaw, this.enemies, this.vegetation.objects, this.isVR);
        this.player.updateProjectiles(dt, this.enemies);

        // ── Enemigos ────────────────────────────────────────────────────
        const camPos = this.isVR
            ? this.renderer.xr.getCamera().position
            : this.cameraRig.camera.position;
        this.enemies.update(dt, time, this.player.position, camPos, (dmg, srcPos) => {
            this.player.onDamageTaken(dmg, srcPos, time);
        });

        // ── Coleccionables ──────────────────────────────────────────────
        this.collectibles.update(dt, time, this.player.position);

        // ── Partículas & luces ──────────────────────────────────────────
        this.particles.update(dt);
        this.lighting.update(time);
        this.skybox.update(time);

        if (this.isVR && this.vrControllers.update) {
            this.vrControllers.update(dt, this.input.vr);
        }

        // ── UI ──────────────────────────────────────────────────────────
        this.hud.update(this.player.stats);
        if (this.isVR) this.vrHud.update(this.player.stats, this.player.currentWeapon(), dt);

        // ── Render ──────────────────────────────────────────────────────
        this.renderer.render(this.scene, this.cameraRig.camera);

        this.input.endFrame();
    }

    _onResize() {
        this.cameraRig.onResize();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}