import { drawCharacter } from './character-renderer.js';

export const HUD = {
    ringCanvas: null,
    portraitCanvas: null,
    partyListContainer: null,
    targetContainer: null,
    targetCanvas: null,
    targetName: null,
    
    init() {
        this.ringCanvas = document.getElementById('hud-ring-layer');
        this.portraitCanvas = document.getElementById('hud-portrait-layer');
        this.partyListContainer = document.getElementById('party-list');
        
        this.targetContainer = document.getElementById('target-hud');
        this.targetRingCanvas = document.getElementById('target-ring-canvas');
        this.targetPortraitCanvas = document.getElementById('target-portrait-canvas');
        this.targetName = document.getElementById('target-name');
        this.targetDropdown = document.getElementById('target-dropdown');

        // Dropdown toggle logic
        const portraitContainer = document.getElementById('target-portrait-container');
        if (portraitContainer) {
            portraitContainer.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent re-triggering map tap
                if (this.targetDropdown.style.display === 'flex') {
                    this.targetDropdown.style.display = 'none';
                } else {
                    this.targetDropdown.style.display = 'flex';
                }
            });
        }

        // Hide dropdown when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (this.targetDropdown && this.targetDropdown.style.display === 'flex') {
                if (!e.target.closest('#target-hud')) {
                    this.targetDropdown.style.display = 'none';
                }
            }
        });
        
        // Hide invite button after clicking it (UX)
        const inviteBtn = document.getElementById('btn-invite');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', () => {
                this.targetDropdown.style.display = 'none';
            });
        }
    },

    showTarget(player) {
        if (!this.targetContainer) return;
        this.targetContainer.style.display = 'block'; 
        this.targetName.innerText = player.username || "Cat";
        if (this.targetDropdown) this.targetDropdown.style.display = 'none'; // Reset dropdown
        this.renderTargetHUD(player);
    },

    updateTargetData(player) {
         if (this.targetContainer.style.display !== 'none') {
             this.renderTargetHUD(player);
         }
    },

    hideTarget() {
        if (this.targetContainer) this.targetContainer.style.display = 'none';
        if (this.targetDropdown) this.targetDropdown.style.display = 'none';
    },

    drawHealthRing(canvas, player, strokeWidth = 6) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = (w / 2) - (strokeWidth);

        ctx.clearRect(0, 0, w, h);

        const hp = player.hp !== undefined ? player.hp : 40;
        const maxHpPerRing = 160;

        const prestige = Math.floor(hp / maxHpPerRing);
        const ringProgress = (hp % maxHpPerRing) / maxHpPerRing;

        // Color Palette for Prestige Levels
        const colors = [
             '#e74c3c', // 0: Red (Base)
             '#2ecc71', // 1: Green
             '#3498db', // 2: Blue
             '#9b59b6', // 3: Purple
             '#f1c40f', // 4: Gold
             '#1abc9c'  // 5: Teal
        ];

        const getCol = (i) => colors[i % colors.length];

        const baseColor = prestige > 0 ? getCol(prestige - 1) : 'rgba(0,0,0,0.5)';
        const activeColor = getCol(prestige);

        // Background Ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = baseColor;
        ctx.stroke();

        // Active Progress Ring
        if (ringProgress > 0 || prestige === 0) {
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (Math.PI * 2 * ringProgress);

            if (ringProgress > 0) {
                ctx.beginPath();
                ctx.arc(cx, cy, radius, startAngle, endAngle);
                ctx.lineWidth = strokeWidth;
                ctx.strokeStyle = activeColor;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }

        // Dividers (16 slots)
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2;
        // Adjust divider length based on stroke
        const innerR = radius - (strokeWidth * 0.6);
        const outerR = radius + (strokeWidth * 0.6);
        
        for (let i = 0; i < 16; i++) {
            const angle = -Math.PI / 2 + (Math.PI * 2 * (i / 16));
            const x1 = cx + Math.cos(angle) * innerR;
            const y1 = cy + Math.sin(angle) * innerR;
            const x2 = cx + Math.cos(angle) * outerR;
            const y2 = cy + Math.sin(angle) * outerR;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    },

    renderPassport(canvas, player, size) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const portraitPlayer = {
            ...player,
            x: 0,
            y: 0,
            facing: 'down',
            aimAngle: Math.PI / 2,
            isMoving: false,
            hitAnim: null,
            username: null,
            canTalk: false
        };

        const pSize = size * 0.65; 
        const pX = (canvas.width - pSize) / 2;
        const pY = (canvas.height - pSize) / 2 + 8;
        drawCharacter(ctx, portraitPlayer, pX, pY, pSize, false, false);
    },

    renderTargetHUD(player) {
        // Render Portrait
        this.renderPassport(this.targetPortraitCanvas, player, 70);
        // Render Ring
        this.drawHealthRing(this.targetRingCanvas, player, 6);
    },

    render(player, partyMembers = []) {
        if (!this.ringCanvas || !this.portraitCanvas) return;

        // 1. Render Main Portrait
        this.renderPassport(this.portraitCanvas, player, 70);
        // Render Main Ring
        this.drawHealthRing(this.ringCanvas, player, 6);
        
        // Show/Hide Crown on Self
        const crown = document.getElementById('my-crown');
        if (crown) {
            if (player.partyId && player.leaderId === player.id) {
                crown.style.display = 'block';
            } else {
                crown.style.display = 'none';
            }
        }

        // 2. Render Party Members
        this.updatePartyList(partyMembers);
    },

    updatePartyList(members) {
        if (!this.partyListContainer) return;

        this.partyListContainer.innerHTML = '';

        members.forEach(m => {
            const div = document.createElement('div');
            div.className = 'party-member';
            
            // Container for both canvases
            div.style.position = 'relative';
            div.style.width = '50px';
            div.style.height = '50px';

            // Ring Canvas (Background/Overlay)
            const ringCvs = document.createElement('canvas');
            ringCvs.width = 50;
            ringCvs.height = 50;
            ringCvs.style.position = 'absolute';
            ringCvs.style.top = '0';
            ringCvs.style.left = '0';
            div.appendChild(ringCvs);

            // Portrait Canvas (Clipped circle inside)
            const portCvs = document.createElement('canvas');
            portCvs.width = 36;
            portCvs.height = 36;
            portCvs.style.position = 'absolute';
            portCvs.style.top = '7px';
            portCvs.style.left = '7px';
            portCvs.style.borderRadius = '50%';
            portCvs.style.overflow = 'hidden';
            div.appendChild(portCvs);

            if (m.partyId && m.leaderId === m.id) {
                const crown = document.createElement('div');
                crown.className = 'crown-member';
                crown.innerHTML = '👑';
                crown.style.position = 'absolute';
                crown.style.top = '-10px';
                crown.style.left = '50%';
                crown.style.transform = 'translateX(-50%)';
                crown.style.fontSize = '12px';
                crown.style.textShadow = '0 1px 2px black';
                crown.style.zIndex = '10';
                div.appendChild(crown);
            }

            this.partyListContainer.appendChild(div);

            // Draw member
            this.renderPassport(portCvs, m, 36);
            this.drawHealthRing(ringCvs, m, 4); // Thinner ring for small icons
        });
    }
};