/**
 * AudioSystem.js — Sistema de audio sintetizado con Web Audio.
 *
 * NUEVO: si no encuentra los archivos mp3 en assets/sounds/, GENERA los SFX
 * proceduralmente (osciladores + envolventes), así el juego siempre tiene
 * audio sin necesidad de cargar archivos pesados.
 *
 * También sintetiza música de fondo (drone ambient) en loop.
 */
export class AudioSystem {
    constructor(assetLoader) {
        this.assets = assetLoader;
        this.ctx = null;
        this.buffers = {};
        this.masterGain = null;
        this.musicGain  = null;
        this.sfxGain    = null;
        this.muted = false;
        this._musicNodes = [];
    }

    async init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = 1.0;
        this.musicGain  = this.ctx.createGain(); this.musicGain.gain.value  = 0.18;
        this.sfxGain    = this.ctx.createGain(); this.sfxGain.gain.value    = 0.70;

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        // Intentar cargar archivos (opcional)
        const sfxFiles = {
            music: 'music.mp3', footstep: 'footstep.mp3', jump: 'jump.mp3',
            land: 'land.mp3', collide: 'collide.mp3', sword: 'sword.mp3',
            bow: 'bow.mp3', magic: 'magic.mp3', hit: 'hit.mp3',
            enemyHurt: 'enemy_hurt.mp3', enemyDie: 'enemy_die.mp3',
            pickup: 'pickup.mp3', levelUp: 'level_up.mp3', hurt: 'hurt.mp3',
        };
        const promises = Object.entries(sfxFiles).map(async ([k, f]) => {
            const buf = await this.assets.loadAudio(this.ctx, f);
            if (buf) this.buffers[k] = buf;
        });
        await Promise.all(promises);

        // Música: si hay archivo lo usa, si no, sintetiza ambient drone
        if (this.buffers.music) {
            const node = this.ctx.createBufferSource();
            node.buffer = this.buffers.music;
            node.loop = true;
            node.connect(this.musicGain);
            node.start();
            this._musicNodes.push(node);
        } else {
            this._startAmbientMusic();
        }
    }

    /** Música ambient sintetizada — drone con armónicos lentos */
    _startAmbientMusic() {
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Drone base (A2 = 110 Hz)
        const freqs = [110, 165, 220, 330];   // raíz, quinta, octava, octava+quinta
        freqs.forEach((f, i) => {
            const osc = ctx.createOscillator();
            osc.type = i === 0 ? 'sawtooth' : 'sine';
            osc.frequency.value = f;

            // LFO sutil para que no sea estático
            const lfo = ctx.createOscillator();
            lfo.frequency.value = 0.08 + i * 0.05;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = f * 0.005;
            lfo.connect(lfoGain).connect(osc.frequency);
            lfo.start();

            // Filtro pasa-bajos suave
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 600 + i * 200;
            filter.Q.value = 2;

            const gain = ctx.createGain();
            gain.gain.value = 0;
            gain.gain.setTargetAtTime(0.18 / freqs.length, now, 6);

            osc.connect(filter).connect(gain).connect(this.musicGain);
            osc.start();
            this._musicNodes.push(osc, lfo);
        });
    }

    // ─────────── PLAY genérico ───────────
    play(name, vol = 1) {
        if (!this.ctx) return;
        // Si tenemos buffer, reproducir
        if (this.buffers[name]) {
            const src = this.ctx.createBufferSource();
            src.buffer = this.buffers[name];
            const g = this.ctx.createGain(); g.gain.value = vol;
            src.connect(g).connect(this.sfxGain);
            src.start();
            return;
        }
        // Si no, sintetizar
        this._synth(name, vol);
    }

    playAt(name, position, listenerPos, vol = 1, maxDist = 20) {
        const dx = position.x - listenerPos.x;
        const dz = position.z - listenerPos.z;
        const d  = Math.sqrt(dx*dx + dz*dz);
        const att = Math.max(0, 1 - d / maxDist);
        if (att <= 0) return;
        this.play(name, vol * att);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : 1;
    }

    // ═══════════════════════════════════════════════════════
    //   SÍNTESIS — genera SFX al vuelo (sin archivos)
    // ═══════════════════════════════════════════════════════
    _synth(name, vol = 1) {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const dest = this.sfxGain;

        switch (name) {
            case 'footstep': {
                // Thump corto, ruido de banda baja
                const noise = this._noiseSource(0.08);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 350;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.35 * vol, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                noise.connect(filter).connect(g).connect(dest);
                noise.start(now);
                break;
            }
            case 'jump': {
                // Whoosh ascendente
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(500, now + 0.2);
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.3 * vol, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.connect(g).connect(dest);
                osc.start(now); osc.stop(now + 0.25);
                break;
            }
            case 'land': {
                // Thud grave
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(120, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.45 * vol, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.connect(g).connect(dest);
                osc.start(now); osc.stop(now + 0.25);
                break;
            }
            case 'sword': {
                // Whoosh de aire metálico
                const noise = this._noiseSource(0.18);
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1800, now);
                filter.frequency.exponentialRampToValueAtTime(600, now + 0.18);
                filter.Q.value = 4;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.4 * vol, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                noise.connect(filter).connect(g).connect(dest);
                noise.start(now);
                break;
            }
            case 'bow': {
                // Click + cuerda
                const noise = this._noiseSource(0.04);
                const filter = ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 800;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.5 * vol, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                noise.connect(filter).connect(g).connect(dest);
                noise.start(now);
                // Tono twang
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
                const g2 = ctx.createGain();
                g2.gain.setValueAtTime(0.25 * vol, now);
                g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(g2).connect(dest);
                osc.start(now); osc.stop(now + 0.18);
                break;
            }
            case 'magic': {
                // Brillante: sweep ascendente con armónicos
                const osc1 = ctx.createOscillator();
                osc1.type = 'triangle';
                osc1.frequency.setValueAtTime(400, now);
                osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
                const osc2 = ctx.createOscillator();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(800, now);
                osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.4);
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.0, now);
                g.gain.linearRampToValueAtTime(0.35 * vol, now + 0.05);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                osc1.connect(g);
                osc2.connect(g);
                g.connect(dest);
                osc1.start(now); osc1.stop(now + 0.5);
                osc2.start(now); osc2.stop(now + 0.5);
                break;
            }
            case 'hit': {
                // Crunch corto
                const noise = this._noiseSource(0.1);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 1200;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.55 * vol, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                noise.connect(filter).connect(g).connect(dest);
                noise.start(now);
                // Punch grave
                const osc = ctx.createOscillator();
                osc.type = 'square';
                osc.frequency.setValueAtTime(140, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
                const g2 = ctx.createGain();
                g2.gain.setValueAtTime(0.4 * vol, now);
                g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.connect(g2).connect(dest);
                osc.start(now); osc.stop(now + 0.15);
                break;
            }
            case 'hurt':
            case 'enemyHurt': {
                // Quejido descendente
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 1000;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.35 * vol, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.connect(filter).connect(g).connect(dest);
                osc.start(now); osc.stop(now + 0.22);
                break;
            }
            case 'enemyDie': {
                // Quejido + crunch largo
                this._synth('hit', vol);
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.4 * vol, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
                osc.connect(g).connect(dest);
                osc.start(now); osc.stop(now + 0.6);
                break;
            }
            case 'pickup': {
                // Chime brillante: dos tonos
                [880, 1320].forEach((f, i) => {
                    const osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.value = f;
                    const g = ctx.createGain();
                    const t = now + i * 0.05;
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.25 * vol, t + 0.01);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    osc.connect(g).connect(dest);
                    osc.start(t); osc.stop(t + 0.32);
                });
                break;
            }
            case 'levelUp': {
                // Arpegio ascendente celebratorio
                [523, 659, 784, 1047].forEach((f, i) => {
                    const osc = ctx.createOscillator();
                    osc.type = 'triangle';
                    osc.frequency.value = f;
                    const g = ctx.createGain();
                    const t = now + i * 0.09;
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.3 * vol, t + 0.02);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                    osc.connect(g).connect(dest);
                    osc.start(t); osc.stop(t + 0.42);
                });
                break;
            }
            case 'collide': {
                // Bump suave
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = 80;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.3 * vol, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(g).connect(dest);
                osc.start(now); osc.stop(now + 0.1);
                break;
            }
        }
    }

    /** Crea un BufferSource con ruido blanco de duración d (segundos) */
    _noiseSource(d) {
        const ctx = this.ctx;
        const len = Math.floor(ctx.sampleRate * d);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        return src;
    }
}
