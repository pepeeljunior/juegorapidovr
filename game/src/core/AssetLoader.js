/**
 * AssetLoader.js — Carga centralizada con progreso por bytes.
 *
 * Cambios para arranque rápido:
 *  - El progreso se calcula sobre los assets CRÍTICOS (texturas del piso),
 *    no sobre todo (HDR/FBX son opcionales y van en background).
 *  - Timeout en HDR: si tarda > 3s, se omite y el juego sigue.
 */
import * as THREE       from 'three';
import { FBXLoader }    from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader }   from 'three/addons/loaders/RGBELoader.js';

export class AssetLoader {
    constructor(basePath = '../assets/') {
        this.base   = basePath;
        this.tex    = new THREE.TextureLoader();
        this.fbx    = new FBXLoader();
        this.rgbe   = new RGBELoader();
        this.cache  = new Map();

        this.total   = 0;
        this.loaded  = 0;
        this.onProgress = () => {};
    }

    setProgressCallback(fn) { this.onProgress = fn; }

    _tick(label) {
        this.loaded++;
        const pct = this.total > 0 ? this.loaded / this.total : 1;
        this.onProgress(Math.min(pct, 1), label);
    }

    registerExpected(n) { this.total += n; }

    // ── HDR ENVIRONMENT (con timeout) ────────────────────────────────────
    loadHDR(file, onLoad, onFail, timeoutMs = 3000) {
        let resolved = false;
        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                onFail?.();
            }
        }, timeoutMs);

        this.rgbe.setPath(this.base + 'hdr/').load(file,
            tex => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timer);
                tex.mapping = THREE.EquirectangularReflectionMapping;
                onLoad?.(tex);
            },
            undefined,
            () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timer);
                onFail?.();
            }
        );
    }

    // ── TEXTURA (cuenta como progreso crítico) ──────────────────────────
    loadTexture(path, repeat = 1) {
        if (this.cache.has(path)) return this.cache.get(path);
        const tex = this.tex.load(this.base + path,
            t => { this._tick('TEX ' + path); },
            undefined,
            () => { this._tick('TEX (fallback) ' + path); }
        );
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat, repeat);
        tex.colorSpace = path.includes('color') || path.includes('diffuse')
            ? THREE.SRGBColorSpace
            : THREE.NoColorSpace;
        this.cache.set(path, tex);
        return tex;
    }

    // ── FBX (NO cuenta como progreso — se carga en background) ──────────
    loadFBX(file, onLoad, onFail) {
        this.fbx.load(this.base + 'models/' + file,
            obj => { onLoad?.(obj); },
            undefined,
            () => { onFail?.(); }
        );
    }

    // ── AUDIO buffer ─────────────────────────────────────────────────────
    async loadAudio(ctx, file) {
        try {
            const resp = await fetch(this.base + 'sounds/' + file);
            if (!resp.ok) return null;
            const arr = await resp.arrayBuffer();
            const buf = await ctx.decodeAudioData(arr);
            return buf;
        } catch {
            return null;
        }
    }
}
