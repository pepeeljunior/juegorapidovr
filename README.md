# Mundo Perdido — VR Explorer

**Práctica 3.7 · Escenarios VR · Graficación**
Three.js r169 · WebXR · Meta Quest 2/3

---

## 🏛️ Arquitectura modular

```
mundo-perdido/
├── assets/
│   ├── models/         # FBX (character + animaciones Mixamo)
│   ├── hdr/            # environment.hdr
│   ├── textures/       # ground_color.jpg, ground_normal.jpg
│   ├── sounds/         # *.mp3
│   └── icons/          # favicon.png
└── game/
    ├── main.js                       ← punto de entrada
    ├── index.html                    ← HUD diegético medieval
    └── src/
        ├── core/
        │   ├── Game.js               ← orquestador principal
        │   ├── Config.js             ← constantes (combate, IA, mundo)
        │   ├── EventBus.js           ← pub/sub entre módulos
        │   ├── AssetLoader.js        ← FBX, HDR, texturas, audio
        │   ├── InputManager.js       ← teclado + VR gamepads
        │   └── CameraRig.js          ← OrbitControls + follow
        ├── world/
        │   ├── Terrain.js            ← plano con altura procedural
        │   ├── Vegetation.js         ← árboles, arbustos, ruinas, rocas
        │   ├── Lighting.js           ← sol, luna, hogueras parpadeantes
        │   └── ParticleSystem.js     ← pool de partículas (sparks/magic/blood/pickup)
        ├── entities/
        │   ├── Enemies.js            ← Goblin / Orco / Espectro con IA
        │   └── Collectibles.js       ← gemas, pociones, flechas
        ├── player/
        │   ├── PlayerController.js   ← movimiento, salto, combate
        │   ├── PlayerStats.js        ← HP, maná, vigor, XP, nivel
        │   └── PlayerCharacter.js    ← FBX + animaciones (con fallback)
        ├── combat/
        │   ├── Sword.js              ← swing con cono de ataque
        │   ├── Bow.js                ← flechas físicas
        │   └── Magic.js              ← orbes con explosión AOE
        ├── ui/
        │   └── HUD.js                ← overlay DOM
        ├── vr/
        │   ├── VRControllers.js      ← modelos + rayos láser
        │   └── VRHud.js              ← HUD canvas flotante
        ├── audio/
        │   └── AudioSystem.js        ← Web Audio (música + SFX espacial)
        └── utils/
            └── MathUtils.js          ← lerpAngle, dist2D, attackCone…
```

---

## 🎮 Controles

### PC
| Acción          | Tecla                       |
|-----------------|-----------------------------|
| Mover           | `W` `A` `S` `D` / flechas   |
| Correr          | `Shift`                     |
| Saltar          | `Space`                     |
| Atacar          | `F` o click izquierdo       |
| Cambiar arma    | `1` espada · `2` arco · `3` magia |
| Bailar          | `B`                         |
| Girar (snap)    | `Q` izquierda · `E` derecha |
| Silenciar       | `M`                         |
| Reiniciar       | `R`                         |

### Meta Quest
| Acción          | Botón                       |
|-----------------|-----------------------------|
| Mover           | Joystick izquierdo          |
| Saltar          | Botón **A**                 |
| Bailar          | Botón **B**                 |
| Atacar          | Trigger derecho             |
| Cambiar arma    | Botón **X**                 |
| Snap-turn       | Joystick derecho izq/der    |

---

## ⚔️ Sistema de combate

- **Espada** (1): 25 daño · arco 120° · alcance 2.2m · 12 vigor
- **Arco** (2): 40 daño · proyectil físico · gasta 1 flecha · 8 vigor
- **Magia** (3): 55 daño · orbe con explosión AOE radio 3m · 25 maná

### Enemigos
- **Goblin**: 50 HP · ágil · daga · da 15 XP
- **Orco**: 120 HP · lento pero fuerte · mazo · 35 XP
- **Espectro**: 80 HP · flota · etéreo · 25 XP

### Subida de nivel
Cada nivel: +20 vida · +15 maná · +10 vigor · restaura todo.

---

## 📦 Assets incluidos en este paquete

Todo ya está en su carpeta. No tienes que mover nada.

**`assets/models/`** (Mixamo, 4 archivos)
- `character.fbx` — personaje base con idle
- `Walking.fbx` `Running.fbx` `Dance.fbx`

**`assets/hdr/`**
- `environment.hdr` — iluminación basada en imagen (cielo)

**`assets/textures/`** (PolyHaven brick_gravel · convertido a JPG 1024×1024)
- `ground_color.jpg` · `ground_normal.jpg` · `ground_roughness.jpg`

**`assets/sounds/`** (vacío — opcional)
Si más adelante quieres añadir audio, los nombres esperados son:
`music.mp3` · `footstep.mp3` · `jump.mp3` · `land.mp3` · `collide.mp3` ·
`sword.mp3` · `bow.mp3` · `magic.mp3` · `hit.mp3` ·
`enemy_hurt.mp3` · `enemy_die.mp3` · `pickup.mp3` · `level_up.mp3` · `hurt.mp3`

> El juego funciona sin sonido. Si falta un archivo, el sistema lo ignora silenciosamente.

---

## 🚀 Cómo ejecutar

```bash
# desde la raíz del proyecto
python3 -m http.server 8000
# abrir http://localhost:8000/game/
```

Para Quest: misma URL pero entrando con el navegador del visor y pulsando **ENTER VR**.

---

## 🛠️ Cómo extender

Añadir un enemigo nuevo:
1. En `Config.js` agrega su entrada bajo `ENEMIES`.
2. En `Enemies.js` añade su builder (`_buildXxx`) e inclúyelo en el array de `_spawnAll`.

Añadir un arma nueva:
1. Crea `src/combat/MiArma.js` con interfaz `{ swing/shoot, updatePose, equip }`.
2. Regístrala en `PlayerController.WEAPONS` y en `_performAttack`.

Comunicación entre módulos: usar `bus.emit(EVT.X, payload)` / `bus.on(EVT.X, fn)`.

---

Hecho con cuidado por tu equipo — Pachuca, 2026.
