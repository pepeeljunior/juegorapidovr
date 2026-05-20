/**
 * Skybox.js — Cielo nocturno con estrellas y luna.
 * Cumple el punto 4.c de la práctica (techo con textura).
 *
 * No usamos textura HDR aquí porque el techo debe verse "como cielo nocturno
 * con estrellas y luna"; lo construimos proceduralmente para que sea ligero
 * y que la luna ilumine consistentemente con la luz direccional fría.
 */
import * as THREE from 'three';

export class Skybox {
    constructor(scene) {
        this.scene = scene;
        this._buildDome();
        this._buildStars();
        this._buildMoon();
    }

    /** Domo gigante con gradiente vertical (degradado nocturno) */
    _buildDome() {
        const geo = new THREE.SphereGeometry(180, 32, 16);
        // Material con gradiente vía vertex colors
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {
                topColor:    { value: new THREE.Color(0x0a0e2a) }, // azul medianoche
                midColor:    { value: new THREE.Color(0x2a2050) }, // violeta
                bottomColor: { value: new THREE.Color(0x4a3a40) }, // horizonte cálido
                offset:      { value: 33 },
                exponent:    { value: 0.6 },
            },
            vertexShader: `
                varying vec3 vWorldPos;
                void main() {
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 midColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPos;
                void main() {
                    float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
                    float t = max(pow(max(h, 0.0), exponent), 0.0);
                    vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.4, t));
                    col = mix(col, topColor, smoothstep(0.4, 1.0, t));
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });

        const dome = new THREE.Mesh(geo, mat);
        this.scene.add(dome);
    }

    /** Estrellas: Points distribuidos en un hemisferio superior */
    _buildStars() {
        const STAR_COUNT = 1500;
        const positions = new Float32Array(STAR_COUNT * 3);
        const sizes = new Float32Array(STAR_COUNT);

        for (let i = 0; i < STAR_COUNT; i++) {
            // Hemisferio superior — distribución esférica uniforme
            const u = Math.random();
            const v = Math.random() * 0.5 + 0.5;     // y arriba (cielo)
            const theta = u * Math.PI * 2;
            const phi = Math.acos(2 * v - 1);
            const r = 165;
            positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
            positions[i*3+1] = r * Math.cos(phi);
            positions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
            sizes[i] = Math.random() * 2 + 0.5;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // PointsMaterial con tamaño variable
        const mat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                time: { value: 0 },
            },
            vertexShader: `
                attribute float size;
                varying float vSize;
                uniform float time;
                void main() {
                    vSize = size;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    // Twinkle: tamaño oscila por estrella
                    float twinkle = 0.7 + 0.3 * sin(time * 2.0 + position.x * 0.1);
                    gl_PointSize = size * twinkle * (300.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: `
                varying float vSize;
                void main() {
                    vec2 c = gl_PointCoord - vec2(0.5);
                    float d = length(c);
                    if (d > 0.5) discard;
                    float alpha = 1.0 - smoothstep(0.0, 0.5, d);
                    gl_FragColor = vec4(vec3(1.0, 0.95, 0.85), alpha);
                }
            `,
        });

        this.stars = new THREE.Points(geo, mat);
        this.starsMat = mat;
        this.scene.add(this.stars);
    }

    /** Luna: esfera grande con textura procedural simple */
    _buildMoon() {
        const moon = new THREE.Mesh(
            new THREE.SphereGeometry(7, 32, 16),
            new THREE.MeshBasicMaterial({
                color: 0xfff0d0,
                fog: false,
            })
        );
        // Posición alta y al noreste
        moon.position.set(-90, 70, -110);
        this.scene.add(moon);

        // Halo alrededor
        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(11, 24, 12),
            new THREE.MeshBasicMaterial({
                color: 0xfff0d0,
                transparent: true,
                opacity: 0.18,
                depthWrite: false,
                fog: false,
            })
        );
        halo.position.copy(moon.position);
        this.scene.add(halo);

        // Halo exterior tenue
        const halo2 = new THREE.Mesh(
            new THREE.SphereGeometry(16, 24, 12),
            new THREE.MeshBasicMaterial({
                color: 0xfff0d0,
                transparent: true,
                opacity: 0.08,
                depthWrite: false,
                fog: false,
            })
        );
        halo2.position.copy(moon.position);
        this.scene.add(halo2);
    }

    update(elapsed) {
        if (this.starsMat) this.starsMat.uniforms.time.value = elapsed;
    }
}
