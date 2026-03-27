import { ctx, canvas, Physics, GameState, Visuals } from './config.js';
import { playHitSound } from './audio.js';
import { createHitEffect, createFireEffect } from './utils.js';

export class Shuttlecock {
    constructor() {
        this.x = 200; this.y = 200;
        this.vx = 0; this.vy = 0;
        this.radius = 8; this.rotation = 0;
        this.lastHitBy = null;
        this.hasBeenHit = false; // 初始状态球未被击打
    }

    reset(side, player, ai) {
        this.vx = 0; this.vy = 0;
        this.y = Physics.GROUND_Y - this.radius; // 放回地面发球（配合hasBeenHit逻辑）
        this.rotation = side === 'player' ? Math.PI/2 : -Math.PI/2;
        this.lastHitBy = null;
        this.hasBeenHit = false; // 重置发球状态
        this.trail = []; // 每轮重置拖尾
        if (side === 'player') {
            this.x = player.x + player.width + 30;
        } else {
            this.x = ai.x - 30;
        }
    }

    hit(p, isServe = false) {
        let dx = p.isAI ? -1 : 1;
        const powerType = p.lastSwingPower || 'light';
        this.lastHitBy = p.isAI ? 'ai' : 'player';

        // 播放击球音效
        playHitSound(powerType === 'heavy');

        let basePowerX = 3;     
        let basePowerY = -5;  
        
        // 1. 计算跳跃加成
        const groundY = Physics.GROUND_Y - p.height;
        const jumpHeight = Math.max(0, groundY - p.y);
        const jumpBonus = Math.min(1.0, jumpHeight / 40); 
        
        // 2. 动态距离比例 (0 = 网前, 1 = 底线)
        const distFromNet = Math.abs(p.x - (Physics.NET_X - (p.isAI ? -20 : 20)));
        const distRatio = Math.min(1.0, distFromNet / 450); 
        
        if (isServe) {
            // 【开球逻辑新策略】
            if (powerType === 'heavy') {
                // K 键发球：长距离高远发球，直逼对方底线
                basePowerX = 10.5;
                basePowerY = -14.0;
            } else {
                // J 键发球：短距发球，落在靠近球网的前半场
                basePowerX = 6.2;
                basePowerY = -8.0;
            }
        } else {
            if (powerType === 'light') {
                // 【J 键：轻打 / 挑球】
                if (distRatio < 0.4) {
                    // 前半场：挑球
                    basePowerX = 6.0 + (0.4 - distRatio) * 5.0; 
                    basePowerY = -9.0;
                } else {
                    // 后半场：高远球（确保能过网）
                    basePowerX = 11.5; // 从3.8大幅增加到11.5，确保过网
                    basePowerY = -12.0; 
                }
            } else {
                // 【K 键：重击 / 核心战术键】
                if (jumpHeight < 15) {
                    // 地面击球：高远球 (High Clear) — 仅比普通打球 (J) 快一点点
                    basePowerX = 6.8 + distRatio * 3.2; // 调整为更接近 J 的水平速度 (之前 5 + 6)
                    basePowerY = -12.5; 
                    import('./config.js').then(({ Visuals }) => { Visuals.shake = 4; });
                } else {
                    // 空中击球：触发“扣杀 (Smash)”
                    // 【距离线性关联】：距离网越远，球飞得越远 (增加水平补偿 X，减小下压分量 Y)
                    basePowerX = 8.5 + jumpBonus * 4.0 + distRatio * 8.0; 
                    
                    // 扣杀过网逻辑：
                    // 后半段 (distRatio > 0.5) 必须有足够的起跳高度才能压得下去并过网
                    if (distRatio > 0.5) {
                        const minJumpYForClear = Physics.NET_Y - 45; 
                        if (p.y > minJumpYForClear) {
                            basePowerY = 4.2 + jumpBonus * 1.8;
                        } else {
                            // 深度补偿：距离越远，下压分量越小，使球飞得更远、更久
                            basePowerY = 0.5 + jumpBonus * 1.2; 
                        }
                    } else {
                        // 前半段：角度更犀利、更陡峭 (直撞地板)
                        basePowerY = 2.5 + jumpBonus * 3.5;
                    }
                    createFireEffect(this.x, this.y); // 杀球火焰特效
                    import('./config.js').then(({ Visuals }) => { Visuals.shake = 6 + jumpBonus * 6; });
                }
            }
        }
        
        let pVx = isNaN(p.vx) ? 0 : p.vx;
        let pVy = isNaN(p.vy) ? 0 : p.vy;
        
        this.vx = dx * basePowerX + pVx * 0.15;
        this.vy = basePowerY + (pVy < 0 ? pVy * 0.2 : 0);
        
        if (isNaN(this.vx)) this.vx = dx * 2;
        if (isNaN(this.vy)) this.vy = -5;

        // Min capping for float dynamics
        if (p.isAI && this.vx > -1.0) this.vx = -1.0;
        if (!p.isAI && this.vx < 1.0) this.vx = 1.0;
        
        this.y -= 5;
        this.hasBeenHit = true; // 球已被发击出
        
        // 统计扣杀与时速
        const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        const kph = Math.floor(speed * 9.5); // 约略换算为时速
        if (kph > 140) {
            GameState.stats.maxSmashSpeed = Math.max(GameState.stats.maxSmashSpeed, kph);
            if (p.isAI) GameState.stats.aiSmashes++;
            else GameState.stats.playerSmashes++;
        }
        
        // 增加回合数
        GameState.rallyCount++;
        GameState.stats.longestRally = Math.max(GameState.stats.longestRally, GameState.rallyCount);
        
        return kph;
    }
    update() {
        if (GameState.isBallDead) return;

        this.vy += Physics.SHUTTLE_GRAVITY;
        this.vx *= Physics.SHUTTLE_DRAG; 
        
        this.x += this.vx;
        this.y += this.vy;

        // 拖尾逻辑
        if (!this.trail) this.trail = [];
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 8) this.trail.shift();

        if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
             this.rotation = Math.atan2(this.vy, this.vx);
        }

        if (this.x + this.radius > Physics.NET_X && this.x - this.radius < Physics.NET_X + Physics.NET_WIDTH) {
            if (this.y + this.radius > Physics.NET_Y) {
                this.vx = -this.vx * 0.4;
                if (this.vx > 0) this.x = Physics.NET_X + Physics.NET_WIDTH + this.radius;
                else this.x = Physics.NET_X - this.radius;
            }
        }

        if (Math.abs(this.vx) > 12) {
            if (Math.random() < 0.4) createFireEffect(this.x, this.y); 
        }

        if (this.x < this.radius) { 
            this.x = this.radius; 
            this.vx = 0; // 撞墙后不再反弹，而是直接垂直落下 (出界逻辑)
        }
        if (this.x > canvas.width - this.radius) { 
            this.x = canvas.width - this.radius; 
            this.vx = 0; 
        }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -0.1; } // 撞天花板也同理，几乎不反弹

        if (this.y >= Physics.GROUND_Y - this.radius) {
            this.y = Physics.GROUND_Y - this.radius;
            this.vy = 0;
            this.vx = 0;
            document.dispatchEvent(new Event('shuttleGrounded'));
        }
    }

    draw() {
        // 绘制拖尾
        if (this.trail && this.trail.length > 0) {
            this.trail.forEach((t, i) => {
                const alpha = (i / this.trail.length) * 0.3;
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(t.x, t.y, this.radius * (0.5 + i/16), 0, Math.PI * 2);
                ctx.fill();
            });
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        const theme = Visuals.themes[Visuals.currentThemeIndex];
        ctx.fillStyle = theme.ball || '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(0, this.radius - 2);
        ctx.lineTo(-24, this.radius + 10);
        ctx.lineTo(-28, 0);
        ctx.lineTo(-24, -this.radius - 10);
        ctx.lineTo(0, -this.radius + 2);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-26, 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-26, -8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-10, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-20, -13); ctx.lineTo(-20, 13); ctx.stroke();

        ctx.restore();
    }
}
