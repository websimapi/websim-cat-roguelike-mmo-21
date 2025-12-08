import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { CONFIG } from './config.js';
import { ASSETS, loadAssets, playSound } from './assets.js';
import { updateProjectiles } from './physics.js';
import { updateNPCs } from './npc-controller.js';
import { HUD } from './hud.js';

// New Modules
import { state, localPlayer } from './state.js';
import { initNetwork, room } from './network.js';
import { initUI, handleTap } from './ui-controller.js';
import { updateLocalPlayer } from './player-controller.js';

let renderer;
let animationFrame;
let lastTime = 0;

// Load external game settings (e.g. time of day)
async function loadSettings() {
    try {
        const res = await fetch('settings.json', { cache: 'no-cache' });
        if (!res.ok) return;
        const json = await res.json();

        if (typeof json.timeOfDaySeconds === 'number') {
            state.time = json.timeOfDaySeconds;
        }
    } catch (e) {
        console.warn('Failed to load settings.json, using defaults:', e);
    }
}

async function init() {
    const canvas = document.getElementById('gameCanvas');
    renderer = new Renderer(canvas);
    Input.init(canvas);
    HUD.init();
    
    // Initialize UI Handlers
    initUI(renderer);

    // Tap handler for selecting players
    Input.onTap = (screenX, screenY) => {
        handleTap(screenX, screenY, renderer);
    };

    await loadAssets();
    await loadSettings();
    await initNetwork(); // Moved network init logic here

    document.getElementById('loading').style.display = 'none';

    requestAnimationFrame(gameLoop);
}

function updatePeers() {
    // Smoothly interpolate other players
    for (const id in state.players) {
        const p = state.players[id];
        if (p.targetX !== undefined) {
            p.x += (p.targetX - p.x) * 0.2;
            p.y += (p.targetY - p.y) * 0.2;
        }
    }
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    updateLocalPlayer(dt, renderer);
    updatePeers(); 
    
    updateNPCs(state, dt, localPlayer);
    updateProjectiles(state, dt, localPlayer);

    // Sync local player to state for rendering
    state.players[state.myId] = {
        ...localPlayer, 
        id: state.myId, 
        username: room.peers[state.myId]?.username || 'Me' 
    };

    renderer.render(state, state.myId, state.time);
    
    // HUD Rendering
    // Gather party members
    const partyMembers = [];
    if (localPlayer.partyId) {
        for (const id in state.players) {
            if (id === state.myId) continue;
            const p = state.players[id];
            if (p.partyId === localPlayer.partyId) {
                partyMembers.push(p);
            }
        }
    }
    
    HUD.render(state.players[state.myId], partyMembers);

    // Update Target HUD if selection updated
    if (state.selectedPlayerId && state.players[state.selectedPlayerId]) {
        HUD.updateTargetData(state.players[state.selectedPlayerId]);
    } else {
        HUD.hideTarget();
    }

    animationFrame = requestAnimationFrame(gameLoop);
}

// Start
init();