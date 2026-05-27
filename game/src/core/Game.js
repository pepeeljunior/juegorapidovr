/**
 * Game.js — Orquestador principal del juego.
 *
 * CAMBIOS para primera persona:
 *  - La cámara va EN la cabeza del jugador (no detrás).
 *  - En PC se usa PointerLockControls (mouse mira).
 *  - En VR el rig sigue al jugador; la rotación viene del visor (mover cabeza).
 *  - El personaje completo NO se renderiza desde primera persona.
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
        this.renderer.toneMappingExposure = 1.6;   // FIX: era 1.0 — subido para escena nocturna
        this.renderer.outputColorSpace    = THREE.SRGBColorSpace;
        this.renderer.xr.enabled = true;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        const vrBtn = VRButton.createButton(this.renderer);
        document.body.appendChild(vrBtn);

        // ── Scene + cámara ──────────────────────────────────────────────
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(WORLD.FOG_COLOR, WORLD.FOG_DENSITY);

        this.cameraRig = new CameraRig(this.renderer);
        this.scene.add(this.cameraRig.rig);   // El rig (que contiene la cámara) va en escena

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

        // HDR removido — el Skybox procedural ya da el ambiente nocturno.

        // ── Entidades ───────────────────────────────────────────────────
        this.enemies      = new Enemies(this.scene, this.particles);
        this.collectibles = new Collectibles(this.scene, this.particles);

        // ── VR controllers (ANTES del jugador para poder pasarlos) ──────
        // FIX: vrControllers se crea aquí, antes de PlayerController.
        // El segundo argumento (playerRig) es el cameraRig.rig, que actúa
        // como el "cuerpo" del jugador en VR.
        this.vrControllers = new VRControllers(this.scene, this.renderer, this.cameraRig.rig);

        // ── Jugador ─────────────────────────────────────────────────────
        // FIX: se pasa vrControllers como último argumento para que
        // PlayerController pueda leer getForwardDir() / getRightDir().
        this.player = new PlayerController(
            this.scene, this.assets, this.input, this.audio,
            this.particles, this.vrControllers
        );
        // skipFBX=true → no carga los 34 MB de modelos (no se renderizan en 1ª persona)
        await this.player.init(true);
        this.player.bindEnemies(this.enemies);
        this.player.bindTerrain(this.terrain);

        // CLAVE: ocultar el personaje en primera persona (la cámara está en su cabeza)
        this.player.character.group.visible = false;

        // ── UI ──────────────────────────────────────────────────────────
        this.hud   = new HUD(this.renderer);
        this.vrHud = new VRHud(this.scene, this.renderer);

        // ── Precompilar shaders ─────────────────────────────────────────
        this.renderer.compile(this.scene, this.cameraRig.camera);

        // ── Eventos ─────────────────────────────────────────────────────
        window.addEventListener('resize', () => this._onResize());
        document.addEventListener('click',    () => this.audio.init(), { once: true });
        document.addEventListener('keydown',  () => this.audio.init(), { once: true });
        document.addEventListener('mousedown', e => {
            if (e.button === 0 && this.cameraRig.controls.isLocked) {
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
            this.cameraRig.setEnabled(false);   // unlock PointerLock en PC
            this.hud.hide();
            this.vrHud.show();
            if (this.cameraRig._lockHint) this.cameraRig._lockHint.style.display = 'none';
        });
        this.renderer.xr.addEventListener('sessionend', () => {
            this.isVR = false;
            this.hud.show();
            this.vrHud.hide();
            if (this.cameraRig._lockHint) this.cameraRig._lockHint.style.display = '';
        });

        // ── Loop principal ──────────────────────────────────────────────
        this.renderer.setAnimationLoop(() => this._tick());

        this._finishLoading();
    }

    _finishLoading() {
        const el = document.getElementById('loading');
        if (!el) return;
        // Asegurar que la barra llegue a 100% visualmente
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

        // En primera persona, la dirección de movimiento es la que está mirando
        // la cámara/cabeza (yaw actual)
        const lookYaw = this.cameraRig.getYaw();

        // ── Jugador ─────────────────────────────────────────────────────
        this.player.update(dt, time, lookYaw, this.enemies, this.vegetation.objects, this.isVR);
        this.player.updateProjectiles(dt, this.enemies);

        // ── Enemigos: pasan el callback de daño ────────────────────────
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
        // VR snap-turn
        if (this.isVR) this.vrControllers.update(dt, this.input.vr);

        // ── Cámara: anclar a la posición del jugador (PRIMERA PERSONA) ──
        this.cameraRig.setEyePosition(this.player.position);

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