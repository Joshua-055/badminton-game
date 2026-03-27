import { ctx, canvas, Physics, Visuals, MPState } from './config.js';

let bgCache = null;
let bgCacheTheme = -1;

export const particles = [];
export const popups = [];

export function createHitEffect(x, y, color) {
    for (let i=0; i<15; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            life: 1.0, color: color,
            size: Math.random() * 3 + 1,
            type: 'hit'
        });
    }
}

export function createFireEffect(x, y) {
    const colors = ['#ff4500', '#ff8c00', '#ffd700', '#fff'];
    const count = (MPState.isMultiplayer) ? 12 : 25; // 联机模式下减半粒子数量以优化性能
    for (let i=0; i<count; i++) {
        particles.push({
            x: x + (Math.random()-0.5)*20,
            y: y + (Math.random()-0.5)*20,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 1.0) * 8, 
            life: 1.0, 
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 5 + 2,
            type: 'fire'
        });
    }
}

export function createJumpEffect(x, y, color) {
    for (let i=0; i<10; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 2,
            life: 0.8, color: color,
            size: Math.random() * 4 + 1,
            type: 'jump'
        });
    }
}

export function updateDrawParticles() {
    // 批量渲染：同色同类型粒子尽量减少状态切换
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        if (p.type === 'fire') {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.size *= 0.92;
        } else {
            p.x += p.vx;
            p.y += p.vy;
        }

        p.life -= (p.type === 'fire' ? 0.05 : 0.04);
        
        if (p.life <= 0 || (p.type === 'fire' && p.size < 0.5)) {
            particles.splice(i, 1);
        } else {
            // 优化点：移除昂贵的 shadowBlur，改用简单的透明度叠加
            ctx.globalAlpha = p.life * 0.8;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0;
}

export function createTextPopup(text, x, y, color) {
    popups.push({ text, x, y, life: 1.0, color });
}

export function updateDrawPopups() {
    for (let i = popups.length - 1; i >= 0; i--) {
        let p = popups[i];
        p.y -= 1;
        p.life -= 0.02;
        if (p.life <= 0) {
            popups.splice(i, 1);
        } else {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(p.text, p.x, p.y);
        }
    }
    ctx.globalAlpha = 1.0;
}

export function drawNet() {
    const theme = Visuals.themes[Visuals.currentThemeIndex];
    ctx.fillStyle = '#555';
    ctx.fillRect(Physics.NET_X + Physics.NET_WIDTH/2 - 3, Physics.NET_Y, 6, Physics.GROUND_Y - Physics.NET_Y);
    ctx.shadowColor = theme.net;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = theme.net + '66'; // 40% alpha
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<=70; i+=10) {
        ctx.moveTo(Physics.NET_X, Physics.NET_Y + i); ctx.lineTo(Physics.NET_X + Physics.NET_WIDTH, Physics.NET_Y + i);
    }
    for(let i=0; i<=Physics.NET_WIDTH; i+=5) {
        ctx.moveTo(Physics.NET_X + i, Physics.NET_Y); ctx.lineTo(Physics.NET_X + i, Physics.NET_Y + 70);
    }
    ctx.stroke();
    ctx.fillStyle = theme.net;
    ctx.fillRect(Physics.NET_X - 2, Physics.NET_Y - 4, Physics.NET_WIDTH + 4, 8);
    ctx.shadowBlur = 0;
}

export function drawBackground() {
    const theme = Visuals.themes[Visuals.currentThemeIndex];
    
    // 如果主题没变且已有缓存，直接绘制离屏 Canvas
    if (bgCache && bgCacheTheme === Visuals.currentThemeIndex) {
        ctx.drawImage(bgCache, 0, 0);
        return;
    }

    // 初始化/更新缓存
    if (!bgCache) bgCache = document.createElement('canvas');
    bgCache.width = canvas.width;
    bgCache.height = canvas.height;
    const bctx = bgCache.getContext('2d');
    bgCacheTheme = Visuals.currentThemeIndex;

    // 绘制复杂背景逻辑到缓存中
    bctx.fillStyle = theme.bg;
    bctx.fillRect(0, 0, canvas.width, canvas.height);
    bctx.fillStyle = theme.floor;
    bctx.fillRect(0, Physics.GROUND_Y, canvas.width, canvas.height - Physics.GROUND_Y);

    bctx.strokeStyle = theme.grid;
    bctx.lineWidth = 1;
    bctx.beginPath();
    for(let i= -400; i < canvas.width + 400; i += 100) {
        bctx.moveTo(i, Physics.GROUND_Y); 
        bctx.lineTo(i + (i - canvas.width/2) * 2, canvas.height);
    }
    for(let y = Physics.GROUND_Y; y < canvas.height; y += 30) {
        bctx.moveTo(0, y);
        bctx.lineTo(canvas.width, y);
    }
    bctx.stroke();

    bctx.strokeStyle = theme.net;
    bctx.lineWidth = 3;
    bctx.beginPath();
    bctx.moveTo(Physics.NET_X + Physics.NET_WIDTH/2, Physics.GROUND_Y);
    bctx.lineTo(Physics.NET_X + Physics.NET_WIDTH/2, canvas.height);
    bctx.stroke();

    ctx.drawImage(bgCache, 0, 0);
}

export function drawObjectShadow(x, y, radius, color) {
    const groundDistance = Physics.GROUND_Y - y;
    const shadowAlpha = Math.max(0, 0.3 - groundDistance * 0.001);
    const shadowSize = Math.max(5, radius * 2.5 - groundDistance * 0.05);

    ctx.save();
    ctx.translate(x, Physics.GROUND_Y);
    ctx.scale(1, 0.3);
    ctx.fillStyle = `rgba(0,0,0, ${shadowAlpha})`;
    // 优化：移除阴影发光，改用简单的半透明黑色椭圆
    ctx.beginPath();
    ctx.arc(0, 0, shadowSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
