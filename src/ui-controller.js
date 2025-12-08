import { state, localPlayer } from './state.js';
import { room } from './network.js';
import { HUD } from './hud.js';
import { CONFIG } from './config.js';

export function initUI() {
    // UI Event Listeners
    
    // Self Profile Dropdown (Leave/Disband)
    const portraitContainer = document.getElementById('hud-portrait-container');
    if (portraitContainer) {
        portraitContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!localPlayer.partyId) return; // Only show if in party

            const selfDropdown = document.getElementById('self-dropdown');
            const isHidden = selfDropdown.style.display === 'none' || !selfDropdown.style.display;
            selfDropdown.style.display = isHidden ? 'flex' : 'none';

            const btnLeave = document.getElementById('btn-leave');
            const btnDisband = document.getElementById('btn-disband');

            if (localPlayer.leaderId === state.myId) {
                btnLeave.style.display = 'none';
                btnDisband.style.display = 'block';
            } else {
                btnLeave.style.display = 'block';
                btnDisband.style.display = 'none';
            }
        });
    }

    // Close self dropdown on click outside
    document.addEventListener('click', (e) => {
        const selfDropdown = document.getElementById('self-dropdown');
        if (selfDropdown && selfDropdown.style.display === 'flex') {
            if (!e.target.closest('#hud-portrait-container')) {
                selfDropdown.style.display = 'none';
            }
        }
    });

    document.getElementById('btn-leave').addEventListener('click', () => {
        if (localPlayer.partyId) {
            localPlayer.partyId = null;
            localPlayer.leaderId = null;
            room.updatePresence({ partyId: null, leaderId: null });
            document.getElementById('self-dropdown').style.display = 'none';
        }
    });

    document.getElementById('btn-disband').addEventListener('click', () => {
        if (localPlayer.partyId && localPlayer.leaderId === state.myId) {
            room.send({ type: 'party_disbanded', partyId: localPlayer.partyId });
            localPlayer.partyId = null;
            localPlayer.leaderId = null;
            room.updatePresence({ partyId: null, leaderId: null });
            document.getElementById('self-dropdown').style.display = 'none';
        }
    });

    document.getElementById('btn-invite').addEventListener('click', () => {
        if (!state.selectedPlayerId) return;
        
        const now = Date.now();
        if (now - localPlayer.lastInviteTime < 15000) {
            const rem = Math.ceil((15000 - (now - localPlayer.lastInviteTime)) / 1000);
            alert(`Invite cooldown: ${rem}s`);
            return;
        }

        localPlayer.lastInviteTime = now;
        
        let invitePartyId = localPlayer.partyId;
        if (!invitePartyId) {
            invitePartyId = state.myId + '_' + now;
        } else {
            if (localPlayer.leaderId !== state.myId) {
                alert("Only the party leader can invite!");
                return;
            }
        }

        room.send({
            type: 'invite_request',
            to: state.selectedPlayerId,
            from: state.myId,
            partyId: invitePartyId
        });
        
        alert("Invite sent!");
    });

    const modal = document.getElementById('invite-modal');
    let currentInvite = null;

    // Listen for invitations from network
    window.addEventListener('party-invite', (e) => {
        const msg = e.detail;
        currentInvite = msg;
        const inviterName = state.players[msg.from]?.username || "A Cat";
        document.getElementById('invite-msg').innerText = `${inviterName} invited you to party!`;
        modal.style.display = 'block';
    });

    document.getElementById('btn-accept').addEventListener('click', () => {
        if (currentInvite) {
            // Join Party
            localPlayer.partyId = currentInvite.partyId;
            localPlayer.leaderId = currentInvite.from;
            modal.style.display = 'none';
            
            // Notify inviter
            room.send({
                type: 'invite_accepted',
                to: currentInvite.from,
                partyId: localPlayer.partyId
            });

            // Sync
            room.updatePresence({ partyId: localPlayer.partyId, leaderId: localPlayer.leaderId });
            currentInvite = null;
        }
    });

    document.getElementById('btn-decline').addEventListener('click', () => {
        modal.style.display = 'none';
        currentInvite = null;
    });
}

export function handleTap(screenX, screenY, renderer) {
    const tileSize = CONFIG.TILE_SIZE * CONFIG.SCALE;
    const cx = renderer.canvas.width / 2;
    const cy = renderer.canvas.height / 2;
    
    // Convert screen to grid relative to local player
    const gx = (screenX - cx) / tileSize + localPlayer.x;
    const gy = (screenY - cy) / tileSize + localPlayer.y;

    // Check for clicks on players
    let closestDist = 1.0; // Click radius in tiles
    let clickedId = null;

    // Check peers
    for (const id in state.players) {
        if (id === state.myId) continue;
        const p = state.players[id];
        const dist = Math.hypot(p.x - gx, p.y - gy);
        if (dist < closestDist) {
            closestDist = dist;
            clickedId = id;
        }
    }
    
    if (clickedId) {
        state.selectedPlayerId = clickedId;
        HUD.showTarget(state.players[clickedId]);
        
        const btnInvite = document.getElementById('btn-invite');
        if (!localPlayer.partyId || localPlayer.leaderId === state.myId) {
            btnInvite.style.display = 'block';
        } else {
            btnInvite.style.display = 'none';
        }
    } else {
        state.selectedPlayerId = null; 
        HUD.hideTarget();
    }
}