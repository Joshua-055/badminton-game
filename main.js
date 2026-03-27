import { canvas, ctx, UI, GameState, Physics, keys, MPState, Visuals } from './config.js';
import { toggleBGM, changeTrack, getTrackName } from './audio.js';
import { Player } from './Player.js';
import { Shuttlecock } from './Shuttlecock.js';
import { drawBackground, drawNet, updateDrawParticles, updateDrawPopups, createHitEffect, createFireEffect, createTextPopup, drawObjectShadow } from './utils.js';
import { setupMultiplayer, applyInterpolation } from './multiplayer.js';

export let player = new Player(false);
export let ai = new Player(true);
export let shuttle = new Shuttlecock();

let lastTime = 0;

// 控制输入监听
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true;
    if (e.code === 'Space') keys.space = true;
    if (e.code === 'KeyJ') keys.j = true;
    if (e.code === 'KeyK') keys.k = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = false;
    if (e.code === 'Space') keys.space = false;
    if (e.code === 'KeyJ') keys.j = false;
    if (e.code === 'KeyK') keys.k = false;
});

function checkRacketCollision(p) {
    if (p.isSwinging && !p.hasHit) {
        const pCenterX = p.x + p.width / 2;
        const pCenterY = p.y + p.height / 2;
        const dist = Math.hypot(shuttle.x - pCenterX, shuttle.y - pCenterY);
        
        if (dist <= 220) { // 增大判定圆，保证能勾到地上的球
            const netCenter = Physics.NET_X + Physics.NET_WIDTH / 2;
            if (!p.isAI && shuttle.x > netCenter) return;
            if (p.isAI && shuttle.x < netCenter) return;

            const sideStr = p.isAI ? 'ai' : 'player';
            if (shuttle.lastHitBy === sideStr) return;

            // 增加 y 轴容差，让球在地板上时也能判定成功
            if (shuttle.x - shuttle.radius < p.x + p.width + 10 && shuttle.x + shuttle.radius > p.x - 10 &&
                shuttle.y - 40 < p.y + p.height + 20 && shuttle.y + shuttle.radius > p.y - 20) {
                const speed = shuttle.hit(p); 
                p.hasHit = true; 
                
                if (speed > 160) {
                     createTextPopup(`${Math.round(speed)} km/h`, shuttle.x, shuttle.y - 20, speed > 220 ? '#ff00ea' : '#00f3ff');
                     Visuals.shake = 8;
                }
                createHitEffect(shuttle.x, shuttle.y, p.color);
            }
        }
    }
}

function checkWinCondition() {
    if (GameState.score.player >= GameState.winningScore || GameState.score.ai >= GameState.winningScore) {
        if (Math.abs(GameState.score.player - GameState.score.ai) >= 2 || Math.max(GameState.score.player, GameState.score.ai) >= GameState.winningScore + 4) {
             GameState.state = 'GAMEOVER';
             let won = GameState.score.player > GameState.score.ai;
             
             import('./audio.js').then(({ playWinSound, playLoseSound }) => {
                  if (MPState.isMultiplayer) {
                       if (MPState.isHost) won ? playWinSound() : playLoseSound();
                       else won ? playLoseSound() : playWinSound();
                  } else { won ? playWinSound() : playLoseSound(); }
             });

             UI.winnerText.innerText = (MPState.isHost ? won : !won) ? "你赢了!" : "对手赢了!";
             UI.winnerText.style.background = won ? `linear-gradient(45deg, var(--primary), #00ffaa)` : `linear-gradient(45deg, var(--secondary), #ff5555)`;
             UI.winnerText.style.webkitBackgroundClip = "text";
             UI.winnerText.style.webkitTextFillColor = "transparent";
             UI.winnerText.style.display = "block";
             UI.finalScoreText.innerText = `${GameState.score.player} - ${GameState.score.ai}`;
             UI.statMaxSpeed.innerText = `${GameState.stats.maxSmashSpeed} km/h`;
             UI.statLongestRally.innerText = GameState.stats.longestRally;
             
             setTimeout(() => { toggleBGM(false); UI.gameOverScreen.classList.remove('hidden'); }, 1000);
             return; 
        }
    }
    if (GameState.state === 'PLAYING') {
         setTimeout(() => { if (GameState.state === 'PLAYING') resetRound(); }, 2800);
    }
}

function checkCollisions() {
    if (GameState.isBallDead) return;
    checkRacketCollision(player);
    checkRacketCollision(ai);
}

function handleScore() {
    if (GameState.isBallDead) return;
    GameState.isBallDead = true;
    if (shuttle.x < Physics.NET_X) {
        GameState.score.ai++; GameState.serveTurn = 'ai'; UI.aiScore.innerText = GameState.score.ai;
        createTextPopup("+1", canvas.width * 0.75, shuttle.y, ai.color);
        GameState.roundMessage = "Player 2 Point !";
    } else {
        GameState.score.player++; GameState.serveTurn = 'player'; UI.playerScore.innerText = GameState.score.player;
        createTextPopup("+1", canvas.width * 0.25, shuttle.y, player.color);
        GameState.roundMessage = "Player 1 Point !";
    }
    GameState.rallyCount = 0;
    checkWinCondition();
}

function resetRound() {
    GameState.isBallDead = false;
    GameState.roundMessage = "";
    
    // 每一局位置强制重置到发球位，防止堆在网前的Bug
    player.x = 100;
    ai.x = 900;
    
    shuttle.reset(GameState.serveTurn, player, ai);
    player.vx = 0; player.vy = 0; ai.vx = 0; ai.vy = 0;
    player.y = Physics.GROUND_Y - player.height; ai.y = Physics.GROUND_Y - ai.height;
    player.hasHit = false; ai.hasHit = false;
}

export function startGame(isGuest = false) {
    GameState.state = 'PLAYING';
    GameState.score = { player: 0, ai: 0 };
    GameState.isBallDead = false;
    GameState.serveTurn = 'player';
    GameState.rallyCount = 0;
    GameState.stats = { maxSmashSpeed: 0, longestRally: 0, playerSmashes: 0, aiSmashes: 0 };
    
    UI.playerScore.innerText = "0";
    UI.aiScore.innerText = "0";
    UI.startScreen.classList.add('hidden');
    UI.gameOverScreen.classList.add('hidden');
    UI.mpScreen.classList.add('hidden');
    UI.customScreen.classList.add('hidden');
    
    toggleBGM(true);
    if (!isGuest) resetRound();
    UI.startBtn.blur(); UI.restartBtn.blur();
}

UI.startBtn.addEventListener('click', () => { MPState.isMultiplayer = false; MPState.isHost = true; startGame(); });
UI.restartBtn.addEventListener('click', () => { if (MPState.isMultiplayer && !MPState.isHost) return; startGame(); });

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (Visuals.shake > 0) {
        ctx.save();
        ctx.translate((Math.random()-0.5)*Visuals.shake, (Math.random()-0.5)*Visuals.shake);
        Visuals.shake *= 0.9;
        if (Visuals.shake < 0.1) Visuals.shake = 0;
    }

    drawBackground();
    const time = Date.now() * 0.001;
    ctx.strokeStyle = `hsla(${(time * 40) % 360}, 70%, 50%, 0.1)`; // 从0.15降为0.1
    ctx.lineWidth = 1.5;
    for (let i=0; i<canvas.width; i+=150) {
         ctx.beginPath(); ctx.moveTo(i + Math.sin(time + i/100) * 15, 0); ctx.lineTo(i + Math.sin(time + i/100 + 1) * 15, canvas.height); ctx.stroke();
    }
    drawNet();

    if (GameState.state !== 'MENU') {
        drawObjectShadow(player.x + player.width/2, player.y + player.height, 20, player.color);
        drawObjectShadow(ai.x + ai.width/2, ai.y + ai.height, 20, ai.color);
        if (!GameState.isBallDead) drawObjectShadow(shuttle.x, shuttle.y, 10, '#fff');
    }

    [player, ai].forEach(p => {
        p.ghosts.forEach(g => {
            ctx.save(); ctx.globalAlpha = g.alpha;
            p.draw(g.x, g.y, g.racketAngle);
            ctx.restore();
        });
    });

    if (GameState.state === 'PLAYING' || GameState.state === 'GAMEOVER') {
        if (GameState.state === 'PLAYING') {
            if (!(MPState.isMultiplayer && !MPState.isHost)) {
                player.update(shuttle); ai.update(shuttle); shuttle.update();
                checkCollisions();
                if (!GameState.isBallDead) {
                    // 仅在球被开出后（hasBeenHit为true）才进行落地判分，防止闪烁Bug
                    if (shuttle.hasBeenHit && shuttle.y >= Physics.GROUND_Y - shuttle.radius) handleScore();
                    if (shuttle.x < -100 || shuttle.x > canvas.width + 100) handleScore();
                }
            } else {
                applyInterpolation();
                if (Math.abs(shuttle.vx) > 12 && Math.random() < 0.4) createFireEffect(shuttle.x, shuttle.y);
            }
        }
        player.draw(); ai.draw(); shuttle.draw();
        
        if (GameState.isBallDead && GameState.state === 'PLAYING') {
             if (GameState.roundMessage !== "") {
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(0, canvas.height/2 - 60, canvas.width, 120);
                  ctx.fillStyle = '#fff'; ctx.font = 'bold 50px Arial'; ctx.textAlign = 'center';
                  ctx.shadowColor = GameState.roundMessage.includes("1") ? player.color : ai.color;
                  ctx.shadowBlur = 15;
                  ctx.fillText(GameState.roundMessage, canvas.width/2, canvas.height/2 + 20);
                  ctx.shadowBlur = 0;
             }
        }
    } else {
        player.draw(); ai.draw(); shuttle.draw();
    }

    updateDrawParticles(ctx); updateDrawPopups(ctx);
    if (Visuals.shake > 0) ctx.restore();
    requestAnimationFrame(gameLoop);
}

// GUI for customization
function initCustomization() {
    const list = UI.themeList;
    Visuals.themes.forEach((theme, index) => {
        const item = document.createElement('div');
        item.className = `theme-item ${index === Visuals.currentThemeIndex ? 'active' : ''}`;
        item.innerHTML = `<div class="theme-preview" style="background:${theme.bg}; border-color:${theme.grid}"></div><span>${theme.name}</span>`;
        item.onclick = () => {
            Visuals.currentThemeIndex = index;
            document.querySelectorAll('.theme-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        };
        list.appendChild(item);
    });

    UI.customizeBtn.onclick = () => { UI.startScreen.classList.add('hidden'); UI.customScreen.classList.remove('hidden'); };
    UI.customBackBtn.onclick = () => {
        UI.customScreen.classList.add('hidden'); UI.startScreen.classList.remove('hidden');
        player.color = UI.playerColorPicker.value;
        Visuals.racketColor = UI.racketColorPicker.value;
    };
}

UI.bgmPrev.onclick = () => { UI.bgmName.innerText = "⏳ Loading..."; changeTrack(-1); UI.bgmName.innerText = getTrackName(); };
UI.bgmNext.onclick = () => { UI.bgmName.innerText = "⏳ Loading..."; changeTrack(1); UI.bgmName.innerText = getTrackName(); };

setupMultiplayer();
initCustomization();
gameLoop();
