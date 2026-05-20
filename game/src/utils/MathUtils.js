/**
 * MathUtils.js — Helpers matemáticos
 */
import * as THREE from 'three';

/** Interpolación angular tomando la ruta más corta */
export function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * Math.min(1, t);
}

export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
    return a + (b - a) * Math.min(1, Math.max(0, t));
}

export function randRange(min, max) {
    return min + Math.random() * (max - min);
}

export function randIntRange(min, max) {
    return Math.floor(randRange(min, max + 1));
}

/** Distancia 2D (xz) entre dos Vector3 */
export function dist2D(a, b) {
    const dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

/** Devuelve ángulo Y para que un objeto en `from` mire a `to` */
export function lookAngleY(from, to) {
    return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Picks aleatorio de un array */
export function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Cono de ataque: ¿target está dentro del arco de origin mirando angleY? */
export function inAttackCone(origin, angleY, target, range, arcDeg) {
    const dx = target.x - origin.x;
    const dz = target.z - origin.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > range) return false;
    const angleToTarget = Math.atan2(dx, dz);
    let diff = angleToTarget - angleY;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < (arcDeg * Math.PI / 180) / 2;
}
