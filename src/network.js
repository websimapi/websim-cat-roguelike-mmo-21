import { state, localPlayer } from './state.js';
import { spawnProjectile } from './physics.js';
import { playSound } from './assets.js';

export const room = new WebsimSocket();

export async function initNetwork() {
    await room.initialize();
    state.myId = room.clientId;

    // Initial spawn presence
    room.updatePresence({
        x: localPlayer.x,
        y: localPlayer.y,
        facing: localPlayer.facing,
        aimAngle: localPlayer.aimAngle,
        isMoving: false,
        partyId: localPlayer.partyId,
        leaderId: localPlayer.leaderId,
        lastSeq: 0
    });

    // Subscribe to updates
    room.subscribePresence((presence) => {
        // Sync other players
        for (const id in presence) {
            if (id === state.myId) continue;
            const p = presence[id];

            // Simple interpolation target setup
            if (!state.players[id]) {
                state.players[id] = { ...p, id, username: room.peers[id]?.username || "Cat" };
            } else {
                // Update target values
                state.players[id].targetX = p.x;
                state.players[id].targetY = p.y;
                state.players[id].facing = p.facing;
                state.players[id].aimAngle = p.aimAngle || 0; // Sync aim
                state.players[id].isMoving = p.isMoving;
                // Sync Party Data
                state.players[id].partyId = p.partyId;
                state.players[id].leaderId = p.leaderId;
            }
        }

        // Remove disconnected
        for (const id in state.players) {
            if (!presence[id]) delete state.players[id];
        }
    });

    // Handle messages
    room.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'shoot') {
            if (msg.ownerId === state.myId) return;
            spawnProjectile(state, msg.x, msg.y, msg.dx, msg.dy, msg.ownerId);
            playSound('shoot', 0.3); 
        }
        else if (msg.type === 'invite_request') {
            if (msg.to === state.myId) {
                // Dispatch event to UI controller
                window.dispatchEvent(new CustomEvent('party-invite', { detail: msg }));
            }
        }
        else if (msg.type === 'invite_accepted') {
             if (msg.to === state.myId) {
                 // Invitee accepted!
                 if (!localPlayer.partyId) {
                     localPlayer.partyId = msg.partyId;
                     localPlayer.leaderId = state.myId;
                     room.updatePresence({ partyId: localPlayer.partyId, leaderId: localPlayer.leaderId });
                 }
             }
        }
        else if (msg.type === 'party_disbanded') {
             if (localPlayer.partyId === msg.partyId) {
                 localPlayer.partyId = null;
                 localPlayer.leaderId = null;
                 room.updatePresence({ partyId: null, leaderId: null });
                 alert("Party disbanded by leader.");
             }
        }
    };
}