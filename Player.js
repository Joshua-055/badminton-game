import { ctx, canvas, Physics, keys, GameState, MPState, remoteKeys, Visuals } from './config.js';
import { createHitEffect, createJumpEffect } from './utils.js';
import { playSwingSound, playJumpSound, playWalkSound } from './audio.js';

export class Player {
    constructor(isAI) {
        this.isAI = isAI;
        this.width = 30;
        this.height = 80;
        this.x = isAI ? 900 - this.width : 200;
        this.y = Physics.GROUND_Y - this.height;
        this.vx = 0;
        this.vy = 0;
        this.speed = 3.8; 
        this.jumpPower = 8.8; 
        this.color = isAI ? Visuals.aiColor : Visuals.playerColor;
        
        this.racketAngle = isAI ? -Math.PI / 4 : -Math.PI * 3 / 4;
        this.racketLength = 60;
        this.isSwinging = false;
        this.swingTimer = 0;
        this.hasHit = false;

        this.lastSwingPower = 'light'; // 记录最近一次的出拍类型 'light' or 'heavy'
        this.stepTimer = 0; // 用于控制走路音效频率

        this.coyoteTime = 0; // 跳跃容错时间
        this.jumpBuffer = 0; // 按键预输入时间
        this.ghosts = []; // 残影特效
    }

    jump() {
        if (GameState.isBallDead) return; // 开球期间禁止起跳
        if (this.y === Physics.GROUND_Y - this.height || this.coyoteTime > 0) {
            this.vy = -9.0;
            this.coyoteTime = 0;
            this.jumpBuffer = 0;
            playJumpSound();
            createJumpEffect(this.x + this.width/2, Physics.GROUND_Y, this.color);
        }
    }

    update(shuttle) {

        // ==========================
        // 双人联机模式下的 2P 玩家代理控制
        // ==========================
        if (this.isAI && MPState.isMultiplayer && MPState.isHost) {
             if (remoteKeys.a) this.vx -= 1.5;
             if (remoteKeys.d) this.vx += 1.5;
             
             if (this.vx > this.speed) this.vx = this.speed;
             if (this.vx < -this.speed) this.vx = -this.speed;
             
             if (!remoteKeys.a && !remoteKeys.d) this.vx *= Physics.FRICTION;

             if (remoteKeys.w && this.y === Physics.GROUND_Y - this.height) {
                 this.jump();
             }

             // Handle remote single-tap keys for swinging via edges
             if (remoteKeys.j && !this.remoteJDown) {
                  this.swing(shuttle, 'light');
                  this.remoteJDown = true;
             } else if (!remoteKeys.j) {
                  this.remoteJDown = false;
             }
             
             if (remoteKeys.k && !this.remoteKDown) {
                  this.swing(shuttle, 'heavy');
                  this.remoteKDown = true;
             } else if (!remoteKeys.k) {
                  this.remoteKDown = false;
             }
        }
        else if (this.isAI && GameState.state === 'PLAYING') {
            let targetX = shuttle.x;
            if (GameState.isBallDead) {
                if (GameState.serveTurn === 'ai') {
                    // 发球局：AI 需靠近球
                    targetX = shuttle.x + 20; 
                } else {
                    // 非发球局：AI 回到半场中心预备
                    targetX = 825 - this.width/2;
                }
            }

            if (this.x + this.width / 2 < targetX - 10) {
                this.vx += 1;
            } else if (this.x + this.width / 2 > targetX + 10) {
                this.vx -= 1;
            }

            if (this.vx > this.speed * 0.9) this.vx = this.speed * 0.9;
            if (this.vx < -this.speed * 0.9) this.vx = -this.speed * 0.9;

            // AI 起跳逻辑（增加一点跳杀的概率）
            if (!GameState.isBallDead && shuttle.x > Physics.NET_X && shuttle.y < this.y - 20 && Math.abs(this.x + this.width/2 - shuttle.x) < 80 && this.y === Physics.GROUND_Y - this.height) {
                 if (Math.random() < 0.25) this.jump(); 
            }

            // AI 挥拍战术决策（取消蓄力，直接在合适时机出招）
            if (!GameState.isBallDead && shuttle.x > Physics.NET_X - 20 && Math.abs(this.x + this.width/2 - shuttle.x) < 120 && Math.abs(this.y + this.height/2 - shuttle.y) < 160) {
                 if (!this.isSwinging && shuttle.vx >= -1) {
                      // 根据来球判断打轻球还是重球
                      let swingType = 'light';
                      if (shuttle.y < Physics.NET_Y && Math.random() < 0.6) {
                          swingType = 'heavy'; // 高位更有概率杀球
                      } else if (shuttle.y > this.y + 10) {
                          swingType = 'light'; // 低位必须挑球
                      } else {
                          swingType = Math.random() < 0.5 ? 'heavy' : 'light';
                      }
                      
                      // 满足击打距离立刻挥拍
                      if (Math.abs(this.x + this.width/2 - shuttle.x) < 50) {
                          this.swing(shuttle, swingType);
                      }
                 }
            }
            
            // AI 开球逻辑
            if (GameState.isBallDead && GameState.serveTurn === 'ai') {
                 if (Math.abs(this.x + this.width/2 - shuttle.x) < 80 && !this.isSwinging) {
                      if (Math.random() < 0.05) { // 稍微延迟一下显得拟真
                           this.swing(shuttle, Math.random() < 0.5 ? 'light' : 'heavy');
                      }
                 }
            }
        } // 关闭 AI 控制块

        // ==========================
        // 玩家 (1P) 控制逻辑
        // ==========================
        if (!this.isAI) {
            if (keys.a) this.vx -= 1.8; 
            if (keys.d) this.vx += 1.8;
            
            const onGround = (this.y >= Physics.GROUND_Y - this.height);
            
            if (this.vx > this.speed) this.vx = this.speed;
            if (this.vx < -this.speed) this.vx = -this.speed;
            
            const frict = onGround ? Physics.FRICTION : 0.96;
            if (!keys.a && !keys.d) this.vx *= frict;

            // 挥拍指令
            if (keys.j) this.swing(shuttle, 'light');
            if (keys.k) this.swing(shuttle, 'heavy');

            // 计时器
            if (onGround) {
                this.coyoteTime = 8;
                if (this.jumpBuffer > 0) {
                    this.jump();
                }
            } else {
                this.coyoteTime = Math.max(0, this.coyoteTime - 1);
                this.jumpBuffer = Math.max(0, this.jumpBuffer - 1);
            }
        }
        
        // 核心动态重力：下落时重力翻倍（让跳跃更“干脆”）
        let gravity = (this.vy > 0) ? Physics.PLAYER_GRAVITY * 1.8 : Physics.PLAYER_GRAVITY;
        this.vy += gravity;
        this.x += this.vx;
        this.y += this.vy;

        if (this.y >= Physics.GROUND_Y - this.height) {
            this.y = Physics.GROUND_Y - this.height;
            this.vy = 0;
            
            // 走路音效触发
            if (Math.abs(this.vx) > 0.5) {
                this.stepTimer++;
                if (this.stepTimer > 15) { // 每 15 帧响一次
                    playWalkSound();
                    this.stepTimer = 0;
                }
            } else {
                this.stepTimer = 0;
            }
        }
        
        if (this.isAI) {
            if (this.x < Physics.NET_X + Physics.NET_WIDTH) { this.x = Physics.NET_X + Physics.NET_WIDTH; this.vx = 0; }
            if (this.x > canvas.width - this.width) { this.x = canvas.width - this.width; this.vx = 0; }
        } else {
            if (this.x < 0) { this.x = 0; this.vx = 0; }
            if (this.x > Physics.NET_X - this.width) { this.x = Physics.NET_X - this.width; this.vx = 0; }
        }

        if (this.isSwinging) {
            this.swingTimer++;
            const maxSwing = 22;
            const halfSwing = maxSwing / 2;
            const restAngle = this.isAI ? -Math.PI / 4 : -Math.PI * 3 / 4;

            if (this.swingTimer <= halfSwing) {
                 const p = this.swingTimer / halfSwing;
                 this.racketAngle = this.swingStart + (this.swingEnd - this.swingStart) * p;
            } else {
                 const p = (this.swingTimer - halfSwing) / halfSwing;
                 let diff = restAngle - this.swingEnd;
                 while (diff > Math.PI) diff -= 2 * Math.PI;
                 while (diff < -Math.PI) diff += 2 * Math.PI;
                 this.racketAngle = this.swingEnd + diff * p;
            }

            if (this.swingTimer >= maxSwing) {
                this.isSwinging = false;
                this.swingTimer = 0;
                this.racketAngle = restAngle;
            }
        }
        
        // 运动残影效果：大幅提高触发门槛，只在极速动作时出现
        if (Math.abs(this.vx) > 5.5 || Math.abs(this.vy) > 8 || this.isSwinging) {
             if (GameState.state === 'PLAYING') {
                 this.ghosts.push({ x: this.x, y: this.y, racketAngle: this.racketAngle, alpha: 0.25 });
                 if (this.ghosts.length > 5) this.ghosts.shift();
             }
        } else if (this.ghosts.length > 0) {
             this.ghosts.shift();
        }
    }

    swing(shuttle, powerType = 'light') {
        if (!this.isSwinging) {
            this.isSwinging = true;
            this.swingTimer = 0;
            this.hasHit = false;
            this.lastSwingPower = powerType;

            const isHigh = shuttle.y < this.y + this.height / 3;
            this.swingType = isHigh ? 'overhand' : 'underhand';

            const PI = Math.PI;
            if (!this.isAI) {
                if (this.swingType === 'overhand') {
                    this.swingStart = -PI * 3 / 4;
                    this.swingEnd = PI / 4;
                } else {
                    this.swingStart = PI * 3 / 4;
                    this.swingEnd = -PI / 4;
                }
            } else {
                if (this.swingType === 'overhand') {
                    this.swingStart = -PI / 4;
                    this.swingEnd = -PI * 5 / 4;
                } else {
                    this.swingStart = PI / 4;
                    this.swingEnd = PI * 5 / 4;
                }
            }
            this.racketAngle = this.swingStart;
            
            // 播放挥拍音效
            playSwingSound(powerType === 'heavy');

            if (GameState.isBallDead && GameState.roundMessage === "") { 
                 if ((GameState.serveTurn === 'player' && !this.isAI) || (GameState.serveTurn === 'ai' && this.isAI)) {
                      GameState.isBallDead = false;
                      
                      // Teleport shuttle to racket location to guarantee hit
                      shuttle.x = this.x + (this.isAI ? -this.width : this.width) + 15;
                      shuttle.y = this.y + this.height/2;

                      shuttle.hit(this, true); 
                      this.hasHit = true;
                      createHitEffect(shuttle.x, shuttle.y, '#fff');
                 }
            }
        }
    }

    draw(targetX = null, targetY = null, targetAngle = null) {
        const x = targetX !== null ? targetX : this.x;
        const y = targetY !== null ? targetY : this.y;
        const angle = targetAngle !== null ? targetAngle : this.racketAngle;
        
        const cx = x + this.width / 2;
        const headY = y - 8;
        const shoulderY = y + 16;
        const pelvisY = y + 48;
        const groundY = y + this.height;

        // 优化：移除昂贵的 shadowBlur
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 行走与跳跃状态解析
        const isJumping = this.y < Physics.GROUND_Y - this.height;
        let strideLeft = 0, strideRight = 0;
        let kneeLY = groundY, kneeRY = groundY;
        
        if (isJumping) {
            strideLeft = -20;
            strideRight = 15;
            kneeLY = groundY - 25; 
            kneeRY = groundY - 10;
        } else {
            const walkPhase = this.x * 0.15;
            const wSpd = Math.abs(this.vx);
            const amplitude = wSpd > 0.5 ? 20 : 0;
            strideLeft = Math.sin(walkPhase) * amplitude;
            // 倒影式交叉步
            strideRight = -Math.sin(walkPhase) * amplitude;
            // 细微的上下弹跳步幅
            kneeLY = groundY - Math.max(0, -Math.sin(walkPhase)*6);
            kneeRY = groundY - Math.max(0, Math.sin(walkPhase)*6);
        }

        ctx.beginPath();
        // 脊柱
        ctx.moveTo(cx, shoulderY);
        ctx.lineTo(cx, pelvisY);
        // 左腿
        ctx.moveTo(cx, pelvisY);
        ctx.lineTo(cx + strideLeft, kneeLY);
        // 右腿
        ctx.moveTo(cx, pelvisY);
        ctx.lineTo(cx + strideRight, kneeRY);
        ctx.stroke();

        // 闲置状态的左臂（跑步摆臂自然摇晃）
        ctx.beginPath();
        ctx.moveTo(cx, shoulderY);
        if (isJumping) {
            ctx.lineTo(cx + (this.isAI ? 20 : -20), shoulderY - 25); 
        } else {
            ctx.lineTo(cx + strideRight * 0.8, pelvisY - 5); 
        }
        ctx.stroke();

        // 右臂（持拍手：绑定在肩部，受真实球拍动画角度控制！）
        const pivotX = cx;
        const pivotY = shoulderY;

        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(angle);

        const armLength = 25;
        ctx.beginPath();
        // 手臂
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -armLength);
        ctx.stroke();

        const wristY = -armLength;

        // 手持球拍把手
        ctx.strokeStyle = Visuals.racketColor === '#ffffff' ? '#ffffff' : '#444'; 
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, wristY);
        ctx.lineTo(0, wristY - this.racketLength * 0.4);
        ctx.stroke();

        // 球拍拍框
        ctx.strokeStyle = Visuals.racketColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, wristY - this.racketLength * 0.8, 14, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0; // 内侧网格关掉发光提升性能
        for(let i=-8; i<=8; i+=4) {
            ctx.beginPath(); ctx.moveTo(-12, wristY - this.racketLength*0.8 + i*1.5); ctx.lineTo(12, wristY - this.racketLength*0.8 + i*1.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, wristY - this.racketLength*0.8 - 20); ctx.lineTo(i, wristY - this.racketLength*0.8 + 20); ctx.stroke();
        }

        ctx.restore();

        // 绘制赛博朋克风头部
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(cx, headY, 14, 0, Math.PI * 2);
        ctx.fill();

        // 发光护目镜
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        if (this.isAI) {
             ctx.moveTo(cx - 14, headY - 2);
             ctx.lineTo(cx - 2, headY);
        } else {
             ctx.moveTo(cx + 14, headY - 2);
             ctx.lineTo(cx + 2, headY);
        }
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.lineCap = 'round'; // 重置供下一次渲染使用
    }
}
