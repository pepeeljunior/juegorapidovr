/**
 * main.js — Punto de entrada. Solo instancia y arranca el juego.
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  MUNDO PERDIDO — VR EXPLORER                                        │
 *  │  Three.js r169  ·  WebXR  ·  Meta Quest 3                           │
 *  │  Vista en PRIMERA PERSONA — assets ligeros (~1 MB)                  │
 *  └─────────────────────────────────────────────────────────────────────┘
 */
import { Game } from './src/core/Game.js';

const game = new Game();

// Safety timeout: si tras 15s el loading sigue, mostrar error
const safetyTimeout = setTimeout(() => {
    const hint = document.getElementById('loading-hint');
    if (hint) {
        hint.innerHTML = 'La carga está tardando. <a href="#" onclick="location.reload();return false;" style="color:#d4a843;text-decoration:underline">Reintentar</a>';
    }
}, 15000);

game.init()
    .then(() => clearTimeout(safetyTimeout))
    .catch(err => {
        clearTimeout(safetyTimeout);
        console.error('Error al iniciar Mundo Perdido:', err);
        const hint = document.getElementById('loading-hint');
        if (hint) hint.textContent = 'Error: ' + err.message;
    });

// Exponer para debug en consola
window.game = game;
