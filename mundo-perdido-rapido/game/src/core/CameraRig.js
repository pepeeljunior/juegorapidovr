/**
 * CameraRig.js — Cámara en PRIMERA PERSONA.
 *
 * MODO PC: PointerLockControls. Hacer clic en el canvas bloquea el puntero;
 *          mover el ratón rota la vista (mirar arriba/abajo y girar el cuerpo).
 *          ESC desbloquea.
 *
 * MODO VR: la cámara XR se ancla a la posición del jugador (altura cabeza).
 *          La rotación viene del propio Quest (mover la cabeza física),
 *          no hay snap-turn por defecto. El joystick izquierdo solo mueve.
 */
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE_HEIGHT = 1.65;   // metros — altura de los ojos del jugador

export class CameraRig {
    constructor(renderer) {
        this.renderer = renderer;
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 350);

        // Rig: un Object3D que mueve al jugador; la cámara cuelga de él
        this.rig = new THREE.Group();
        this.rig.add(this.camera);

        this.controls = new PointerLockControls(this.camera, renderer.domElement);

        this._yaw = 0;
        this._pitch = 0;

        // Listener UI: prompt de "click para jugar"
        this._lockHint = null;
        this._setupHint();

        // Cuando el usuario hace clic en el canvas, bloquear el puntero
        renderer.domElement.addEventListener('click', () => {
            if (!this.renderer.xr.isPresenting) this.controls.lock();
        });
        this.controls.addEventListener('lock', () => {
            if (this._lockHint) this._lockHint.style.display = 'none';
        });
        this.controls.addEventListener('unlock', () => {
            if (this._lockHint) this._lockHint.style.display = '';
        });
    }

    _setupHint() {
        const el = document.createElement('div');
        el.id = 'pointer-lock-hint';
        el.innerHTML = '<div class="plh-inner">CLIC PARA JUGAR<br><span>presiona ESC para liberar el cursor</span></div>';
        el.style.cssText = `
            position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
            background:rgba(8,17,10,0.55);z-index:50;color:#d4a843;
            font-family:'Cormorant Garamond',serif;letter-spacing:6px;
            font-size:24px;cursor:pointer;pointer-events:none;
            backdrop-filter:blur(2px);
        `;
        el.querySelector('.plh-inner').style.cssText = `
            text-align:center;border:1px solid #d4a843;padding:30px 60px;background:rgba(8,17,10,0.7);
        `;
        const span = el.querySelector('span');
        if (span) {
            span.style.cssText = 'font-size:11px;color:rgba(212,168,67,0.55);letter-spacing:3px;display:block;margin-top:12px';
        }
        document.body.appendChild(el);
        this._lockHint = el;
    }

    /** Yaw actual de la cámara (en PC) o de la cabeza XR (en VR) */
    getYaw() {
        if (this.renderer.xr.isPresenting) {
            const xrCam = this.renderer.xr.getCamera();
            return Math.atan2(
                xrCam.matrixWorld.elements[8],   // forwardX
                xrCam.matrixWorld.elements[10]   // forwardZ
            ) + Math.PI;   // ajuste de signo para que coincida con WASD
        }
        // En PC, PointerLockControls maneja la rotación interna de this.camera
        // El yaw es la rotación Y del objeto cámara
        const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
        return e.y;
    }

    /** En modo PC, montar la cámara a la altura de los ojos */
    setEyePosition(playerPos) {
        if (this.renderer.xr.isPresenting) {
            // En VR, mover el rig (NO la cámara — XR la controla)
            this.rig.position.set(playerPos.x, playerPos.y, playerPos.z);
        } else {
            this.camera.position.set(playerPos.x, playerPos.y + EYE_HEIGHT, playerPos.z);
        }
    }

    setEnabled(b) {
        if (!b && this.controls.isLocked) this.controls.unlock();
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    getEyeHeight() { return EYE_HEIGHT; }
}
