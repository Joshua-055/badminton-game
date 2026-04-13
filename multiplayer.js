import { GameState, UI, MPState, remoteKeys, keys, Physics } from './config.js';
import { player, ai, shuttle, startGame } from './main.js';

const LOBBY_ID = "BM-LOBBY-REGION-NEON-v2";
let peer = null;
let conn = null;
let lobbyPeer = null;
let activeRooms = new Set();

// 联机优化：插值平滑处理
let targetState = null;
let lastStateTime = 0;

export function setupMultiplayer() {
    if (!UI.mpMenuBtn) return;
    const refreshBtn = document.getElementById('refresh-rooms');
    const hostInfoArea = document.getElementById('host-info-area');
    UI.mpMenuBtn.addEventListener('click', () => { UI.startScreen.classList.add('hidden'); UI.mpScreen.classList.remove('hidden'); fetchRooms(); });
    UI.backBtn.addEventListener('click', () => { UI.mpScreen.classList.add('hidden'); UI.startScreen.classList.remove('hidden'); if (peer) peer.destroy(); if (lobbyPeer) lobbyPeer.destroy(); });
    if (refreshBtn) refreshBtn.addEventListener('click', fetchRooms);
    UI.hostBtn.addEventListener('click', () => {
        if (peer) peer.destroy();
        UI.hostInfo.innerText = "创建中...";
        hostInfoArea.classList.remove('hidden');
        const customId = "ROOM-" + Math.random().toString(36).substr(2, 4).toUpperCase();
        peer = new Peer(customId);
        peer.on('open', (id) => { UI.hostInfo.innerText = id; registerAsHost(id); });
        peer.on('connection', (c) => { if (conn) conn.close(); conn = c; onConnectionEstablished('host'); });
        peer.on('error', (err) => { if (err.type === 'unavailable-id') UI.hostBtn.click(); });
    });
    initLobbyBroker();
}

function initLobbyBroker() {
    lobbyPeer = new Peer(LOBBY_ID);
    lobbyPeer.on('open', () => {
        lobbyPeer.on('connection', (c) => {
            c.on('data', (msg) => {
                if (msg.type === 'register' || msg.type === 'heartbeat') activeRooms.add(msg.roomId);
                else if (msg.type === 'getRooms') c.send({ type: 'rooms', rooms: Array.from(activeRooms) });
            });
        });
        setInterval(() => activeRooms.clear(), 30000); 
    });
    lobbyPeer.on('error', (err) => { if (err.type === 'unavailable-id') lobbyPeer = null; });
}

function registerAsHost(roomId) {
    const heartbeat = () => {
        const p = new Peer();
        p.on('open', () => {
            const lConn = p.connect(LOBBY_ID);
            lConn.on('open', () => { lConn.send({ type: 'register', roomId: roomId }); setTimeout(() => p.destroy(), 15000); });
            lConn.on('error', () => p.destroy());
        });
    };
    heartbeat();
    setInterval(heartbeat, 15000);
}

function fetchRooms() {
    const roomListArea = document.getElementById('room-list');
    if (!roomListArea) return;
    roomListArea.innerHTML = '<div style="text-align:center; padding:10px; color:#aaa;">正在搜索活跃房间...</div>';
    const p = new Peer();
    p.on('open', () => {
        const lConn = p.connect(LOBBY_ID);
        let received = false;
        lConn.on('open', () => { lConn.send({ type: 'getRooms' }); setTimeout(() => { if (!received) { renderRoomList([]); p.destroy(); } }, 3500); });
        lConn.on('data', (msg) => { if (msg.type === 'rooms') { received = true; renderRoomList(msg.rooms); p.destroy(); } });
    });
    p.on('error', () => { renderRoomList([]); p.destroy(); });
}

function renderRoomList(rooms) {
    const roomListArea = document.getElementById('room-list');
    if (!roomListArea) return;
    roomListArea.innerHTML = '';
    if (rooms.length === 0) {
        roomListArea.innerHTML = '<div style="text-align:center; padding:20px; color:rgba(255,255,255,0.4);">暂未发现活跃房间</div>';
        return;
    }
    rooms.forEach(id => {
        const item = document.createElement('div');
        item.style = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); margin-bottom:8px;";
        item.innerHTML = `<div><span style="color:#00ffaa; font-weight:bold; font-family:monospace;">${id}</span></div><button class="join-btn" style="width:auto; height:32px; padding:0 15px; background:#00f3ff; color:#000; font-weight:bold;">加入</button>`;
        item.querySelector('.join-btn').onclick = () => connectToHost(id);
        roomListArea.appendChild(item);
    });
}

function connectToHost(id) {
    if (peer) peer.destroy();
    UI.mpScreen.innerHTML = `<div style="text-align:center; padding:40px;"><h2>正在连接 ${id}...</h2></div>`;
    peer = new Peer();
    peer.on('open', () => {
        conn = peer.connect(id, { reliable: false }); // 使用非可靠传输减少延迟带来的积压
        conn.on('open', () => onConnectionEstablished('guest'));
        conn.on('error', () => location.reload());
    });
}

function onConnectionEstablished(role) {
    MPState.isMultiplayer = true;
    MPState.isHost = role === 'host';
    UI.mpScreen.classList.add('hidden');
    conn.on('data', (data) => {
        if (MPState.isHost && data.type === 'input') Object.assign(remoteKeys, data.keys);
        else if (!MPState.isHost && data.type === 'state') {
            targetState = data.state;
            lastStateTime = Date.now();
        }
        else if (data.type === 'start') { GameState.winningScore = data.winningScore; if (!MPState.isHost) startGame(true); }
        else if (data.type === 'ping') conn.send({ type: 'pong' });
    });
    conn.on('close', () => location.reload());
    if (MPState.isHost) {
        startGame(); 
        conn.send({ type: 'start', winningScore: GameState.winningScore });
        setInterval(() => {
             if (GameState.state === 'PLAYING' || GameState.state === 'GAMEOVER') {
                  conn.send({ type: 'state', state: {
                       player: {x: player.x, y: player.y, vx: player.vx, vy: player.vy, racketAngle: player.racketAngle, hasHit: player.hasHit, isSwinging: player.isSwinging },
                       ai: {x: ai.x, y: ai.y, vx: ai.vx, vy: ai.vy, racketAngle: ai.racketAngle, hasHit: ai.hasHit, isSwinging: ai.isSwinging },
                       shuttle: {x: shuttle.x, y: shuttle.y, vx: shuttle.vx, vy: shuttle.vy, rotation: shuttle.rotation, hasBeenHit: shuttle.hasBeenHit },
                       score: GameState.score, isBallDead: GameState.isBallDead, serveTurn: GameState.serveTurn, roundMessage: GameState.roundMessage, gameState: GameState.state, stats: GameState.stats
                  }});
             } else { if (conn && conn.open) conn.send({ type: 'ping' }); }
        }, 32); 
    } else {
        setInterval(() => { if (GameState.state === 'PLAYING' && conn && conn.open) conn.send({ type: 'input', keys: keys }); }, 16); // 提高输入发送频率至 60Hz
    }
}

// 在 main.js 的循环中调用这个函数实现平滑插值/外推
export function applyInterpolation() {
    if (!targetState || MPState.isHost) return;
    
    // 平滑参数优化：玩家使用适中插值，羽毛球使用极高插值
    const pFactor = 0.55;
    const sFactor = 0.85; 
    
    player.x += (targetState.player.x - player.x) * pFactor;
    player.y += (targetState.player.y - player.y) * pFactor;
    player.vx = targetState.player.vx; 
    player.vy = targetState.player.vy;
    player.racketAngle += (targetState.player.racketAngle - player.racketAngle) * pFactor;
    player.hasHit = targetState.player.hasHit;
    player.isSwinging = targetState.player.isSwinging;
    
    ai.x += (targetState.ai.x - ai.x) * pFactor;
    ai.y += (targetState.ai.y - ai.y) * pFactor;
    ai.vx = targetState.ai.vx; 
    ai.vy = targetState.ai.vy;
    ai.racketAngle += (targetState.ai.racketAngle - ai.racketAngle) * pFactor;
    ai.hasHit = targetState.ai.hasHit;
    ai.isSwinging = targetState.ai.isSwinging;
    
    // 羽毛球：如果误差过大直接闪现，否则高频平滑
    const dist = Math.hypot(targetState.shuttle.x - shuttle.x, targetState.shuttle.y - shuttle.y);
    if (dist > 150) {
        shuttle.x = targetState.shuttle.x;
        shuttle.y = targetState.shuttle.y;
    } else {
        shuttle.x += (targetState.shuttle.x - shuttle.x) * sFactor;
        shuttle.y += (targetState.shuttle.y - shuttle.y) * sFactor;
    }
    
    shuttle.vx = targetState.shuttle.vx;
    shuttle.vy = targetState.shuttle.vy;
    shuttle.rotation = targetState.shuttle.rotation;
    shuttle.hasBeenHit = targetState.shuttle.hasBeenHit;

    // 客户端基础预测逻辑：在等待下一个包时，让球继续飞行
    if (shuttle.hasBeenHit && !GameState.isBallDead) {
        shuttle.vy += Physics.SHUTTLE_GRAVITY;
        shuttle.vx *= Physics.SHUTTLE_DRAG;
        shuttle.x += shuttle.vx;
        shuttle.y += shuttle.vy;
    }
    
    GameState.score.player = targetState.score.player;
    GameState.score.ai = targetState.score.ai;
    GameState.isBallDead = targetState.isBallDead;
    GameState.serveTurn = targetState.serveTurn;
    GameState.roundMessage = targetState.roundMessage;
    GameState.stats = targetState.stats; 
    
    if (targetState.gameState === 'GAMEOVER' && GameState.state !== 'GAMEOVER') {
         const won = GameState.score.ai > GameState.score.player;
         import('./audio.js').then(({ playWinSound, playLoseSound }) => { won ? playWinSound() : playLoseSound(); });
         UI.winnerText.innerText = won ? "你赢了!" : "对手赢了!";
         UI.winnerText.style.display = "block";
         UI.finalScoreText.innerText = `${GameState.score.player} - ${GameState.score.ai}`;
         UI.statMaxSpeed.innerText = `${GameState.stats.maxSmashSpeed} km/h`;
         UI.statLongestRally.innerText = GameState.stats.longestRally;
         setTimeout(() => UI.gameOverScreen.classList.remove('hidden'), 1000);
    }

    if (targetState.gameState === 'PLAYING' && GameState.state === 'MENU') {
         UI.startScreen.classList.add('hidden');
         UI.gameOverScreen.classList.add('hidden');
         UI.mpScreen.classList.add('hidden');
         UI.customScreen.classList.add('hidden');
         import('./audio.js').then(({ toggleBGM }) => toggleBGM(true));
    }

    GameState.state = targetState.gameState;
    UI.playerScore.innerText = GameState.score.player;
    UI.aiScore.innerText = GameState.score.ai;
}
