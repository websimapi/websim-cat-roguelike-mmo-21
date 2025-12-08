import { Input } from './input.js';
import { CONFIG } from './config.js';
import { checkCollision, spawnProjectile } from './physics.js';
import { playSound } from './assets.js';
import { state, localPlayer } from './game.js'; // Changed from './state.js'
import { room } from './game.js'; // Changed from './network.js'
import { interactWithNPC } from './ai.js';

// Helper to update facing based on current mouse position
function updateFacingFromMouse(renderer) {
    if (!Input.mouse.moved || !renderer) return;

    // Player is always rendered at screen center
    const originX_Screen = renderer.canvas.width / 2;
    const originY_Screen = renderer.canvas.height / 2;

    const dx = Input.mouse.x - originX_Screen;
    const dy = Input.mouse.y - originY_Screen;

    localPlayer.aimAngle = Math.atan2(dy, dx); // Update aim angle

    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;

    if (Math.abs(dx) > Math.abs(dy)) {
        localPlayer.facing = dx > 0 ? 'right' : 'left';
    } else {
        localPlayer.facing = dy > 0 ? 'down' : 'up';
    }
}

export function updateLocalPlayer(dt, renderer) {
    // Moved the "frozen" check deeper to allow interaction updates to run
    const isFrozen = localPlayer.talking;

    if (!isFrozen) {
        const move = Input.getMovementVector();
        // Speed is now time-based
        const speed = CONFIG.PLAYER_SPEED * dt;

        let nextX = localPlayer.x + move.x * speed;
        let nextY = localPlayer.y + move.y * speed;

        const margin = 0.3; // Hitbox radius roughly

        const canMoveTo = (x, y) => {
            // Check all 4 corners of the hitbox
            if (checkCollision(x - margin, y - margin)) return false;
            if (checkCollision(x + margin, y + margin)) return false;
            if (checkCollision(x + margin, y - margin)) return false;
            if (checkCollision(x - margin, y + margin)) return false;
            return true;
        };

        if (canMoveTo(nextX, localPlayer.y)) {
            localPlayer.x = nextX;
        }

        if (canMoveTo(localPlayer.x, nextY)) {
            localPlayer.y = nextY;
        }

        if (move.y < 0) {
            localPlayer.facing = 'up';
        } else if (move.x !== 0) {
            localPlayer.facing = move.x > 0 ? 'right' : 'left';
        } else if (move.y > 0) {
            localPlayer.facing = 'down';
        }

        const isMoving = (move.x !== 0 || move.y !== 0);
        localPlayer.isMoving = isMoving; // Store locally for immediate rendering updates

        // Aim behavior:
        if (Input.isShooting()) {
            updateFacingFromMouse(renderer);
        } else if (isMoving) {
            localPlayer.aimAngle = Math.atan2(move.y, move.x);
        } else {
            updateFacingFromMouse(renderer);
        }
    }

    // Network Sync (Throttle to ~20hz)
    const now = Date.now();
    const movingChanged = localPlayer.isMoving !== localPlayer.wasMoving;

    if (now - state.lastUpdate > 50) {
        // Send update if: moving, state changed (stopped/started), or heartbeat needed
        if (localPlayer.isMoving || movingChanged || now - state.lastUpdate > 1000) {
            room.updatePresence({
                x: localPlayer.x,
                y: localPlayer.y,
                facing: localPlayer.facing,
                aimAngle: localPlayer.aimAngle,
                isMoving: localPlayer.isMoving,
                partyId: localPlayer.partyId,
                leaderId: localPlayer.leaderId
            });
            state.lastUpdate = now;
            localPlayer.wasMoving = localPlayer.isMoving;
        }
    }

    // Shooting
    if (!isFrozen && Input.isShooting() && (now/1000) - localPlayer.lastShot > CONFIG.FIRE_RATE) {
        localPlayer.lastShot = now/1000;

        // Use aimAngle for shooting
        const angle = localPlayer.aimAngle;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        // Calculate Muzzle Position
        const offsetDist = 0.5;
        const muzzleX = localPlayer.x + dx * offsetDist;
        const muzzleY = localPlayer.y + dy * offsetDist;

        spawnProjectile(state, muzzleX, muzzleY, dx, dy, state.myId);
        playSound('shoot');

        room.send({
            type: 'shoot',
            x: muzzleX,
            y: muzzleY,
            dx: dx,
            dy: dy,
            ownerId: state.myId
        });
    }

    // Interaction Check
    let nearbyNPC = null;
    state.npcs.forEach(npc => {
        const dist = Math.hypot(npc.x - localPlayer.x, npc.y - localPlayer.y);
        if (dist < 1.5) nearbyNPC = npc;
    });

    const prompt = document.getElementById('interaction-label');
    if (nearbyNPC) {
        // Only show prompt if not currently talking
        if (!localPlayer.talking) {
            prompt.style.display = 'block';
            const screenPos = renderer.gridToScreen(nearbyNPC.x, nearbyNPC.y, localPlayer.x, localPlayer.y);
            prompt.style.left = screenPos.x + 'px';
            prompt.style.top = (screenPos.y - 40) + 'px';

            if (Input.keys['KeyT'] || Input.keys['t']) {
                localPlayer.talking = true;
                Input.keys['KeyT'] = false;
                Input.keys['t'] = false; // consume
                prompt.style.display = 'none';
                interactWithNPC(nearbyNPC, () => {
                    localPlayer.talking = false;
                });
            }
        } else {
            prompt.style.display = 'none';
        }
    } else {
        prompt.style.display = 'none';
    }

    // Mouse click interaction fallback
    if (!localPlayer.talking && Input.mouse.leftDown && nearbyNPC) {
        localPlayer.talking = true;
        Input.mouse.leftDown = false;
        interactWithNPC(nearbyNPC, () => {
             localPlayer.talking = false;
        });
    }
}