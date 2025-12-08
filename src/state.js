export const state = {
    players: {}, // Stores interpolated player states
    npcs: [
        { 
            id: 'npc_shop', 
            x: 4.5, 
            y: 4.5, 
            canTalk: true, 
            facing: 'down',
            // AI State
            aiState: 'idle',
            aiTimer: 0,
            targetX: 4.5,
            targetY: 4.5,
            patrolBounds: { x1: 2.5, x2: 6.5, y1: 4.5, y2: 6.5 }
        }
    ],
    projectiles: [],
    myId: null,
    lastUpdate: 0,
    // Default fixed time: 3 minutes into the day (in seconds).
    // This can be overridden via settings.json -> timeOfDaySeconds.
    time: 180,
    selectedPlayerId: null
};

// Logic for local player
export const localPlayer = {
    x: 10.5,
    y: 5.5,
    vx: 0,
    vy: 0,
    facing: 'right',
    aimAngle: 0, // precise aiming
    lastShot: 0,
    talking: false,
    hitAnim: null,
    isMoving: false,
    wasMoving: false,
    hp: 40, // Starting HP (4/16ths of ring)
    partyId: null,
    leaderId: null,
    lastInviteTime: 0
};