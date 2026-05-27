/**
 * VRControllers.js — Maneja los modelos de los controllers en VR.
 *
 * Ya no se añaden rayos largos (no usamos los mandos como punteros).
 * Solo se muestran los modelos de los controllers para que el jugador vea
 * sus "manos" virtuales. Los mandos son los inputs principales para moverse
 * y atacar — la cámara se mueve girando la cabeza física.
 */
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class VRControllers {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.factory = new XRControllerModelFactory();
        this.controllerLeft  = null;
        this.controllerRight = null;
        this._build();
    }

    _build() {
        // Right (índice 0)
        this.controllerRight = this.renderer.xr.getController(0);
        const gripR = this.renderer.xr.getControllerGrip(0);
        gripR.add(this.factory.createControllerModel(gripR));
        this.scene.add(gripR);
        // Mini indicador frontal para saber a dónde apunta cuando atacas
        this._addAimDot(this.controllerRight, 0xffaa33);

        // Left (índice 1)
        this.controllerLeft = this.renderer.xr.getController(1);
        const gripL = this.renderer.xr.getControllerGrip(1);
        gripL.add(this.factory.createControllerModel(gripL));
        this.scene.add(gripL);
        this._addAimDot(this.controllerLeft, 0x4ac8ff);
    }

    _addAimDot(controller, color) {
        // Línea corta para saber a dónde apunta el mando (útil para apuntar
        // con arco/magia en VR). Más sutil que el rayo grande.
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -0.5)
        ]);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
        const line = new THREE.Line(geo, mat);
        controller.add(line);
    }
}