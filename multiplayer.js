import { GameState, UI, MPState, remoteKeys, keys } from './config.js';
import { player, ai, shuttle, startGame } from './main.js';

const LOBBY_ID = "BM-LOBBY-REGION-NEON-v2";
let peer = null;
let conn = null;
let lobbyPeer = null;
let activeRooms = new Set();

// 联机优化：插值平滑处理
let targetState = null;

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
            lConn.on('open', () => { lConn.send({ type: 'register', roomId: roomId }); setTimeout(() => p.destroy(), 1500); });
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
        conn = peer.connect(id, { reliable: true });
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
        else if (!MPState.isHost && data.type === 'state') targetState = data.state;
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
                      player: {x: player.x, y: player.y, racketAngle: player.racketAngle, hasHit: player.hasHit, isSwinging: player.isSwinging },
                      ai: {x: ai.x, y: ai.y, racketAngle: ai.racketAngle, hasHit: ai.hasHit, isSwinging: ai.isSwinging },
                      shuttle: {x: shuttle.x, y: shuttle.y, vx: shuttle.vx, vy: shuttle.vy, rotation: shuttle.rotation},
                      score: GameState.score, isBallDead: GameState.isBallDead, serveTurn: GameState.serveTurn, roundMessage: GameState.roundMessage, gameState: GameState.state, stats: GameState.stats
                 }});
             } else { if (conn && conn.open) conn.send({ type: 'ping' }); }
        }, 32); 
    } else {
        setInterval(() => { if (GameState.state === 'PLAYING' && conn && conn.open) conn.send({ type: 'input', keys: keys }); }, 20);
    }
}

// 在 main.js 的循环中调用这个函数实现平滑插值
export function applyInterpolation() {
    if (!targetState || MPState.isHost) return;
    
    // 平滑参数 (越小越平滑，但延迟越高)
    const factor = 0.45;
    
    player.x += (targetState.player.x - player.x) * factor;
    player.y += (targetState.player.y - player.y) * factor;
    player.racketAngle += (targetState.player.racketAngle - player.racketAngle) * factor;
    player.hasHit = targetState.player.hasHit;
    player.isSwinging = targetState.player.isSwinging;
    
    ai.x += (targetState.ai.x - ai.x) * factor;
    ai.y += (targetState.ai.y - ai.y) * factor;
    ai.racketAngle += (targetState.ai.racketAngle - ai.racketAngle) * factor;
    ai.hasHit = targetState.ai.hasHit;
    ai.isSwinging = targetState.ai.isSwinging;
    
    shuttle.x += (targetState.shuttle.x - shuttle.x) * factor;
    shuttle.y += (targetState.shuttle.y - shuttle.y) * factor;
    shuttle.vx = targetState.shuttle.vx;
    shuttle.vy = targetState.shuttle.vy;
    shuttle.rotation = targetState.shuttle.rotation;
    
    GameState.score.player = targetState.score.player;
    GameState.score.ai = targetState.score.ai;
    GameState.isBallDead = targetState.isBallDead;
    GameState.serveTurn = targetState.serveTurn;
    GameState.roundMessage = targetState.roundMessage;
    GameState.stats = targetState.stats; 
    
    if (targetState.gameState === 'GAMEOVER' && GameState.state !== 'GAMEOVER') {
         // 处理 GameOver 显示
         const won = GameState.score.ai > GameState.score.player;
         import('./audio.js').then(({ playWinSound, playLoseSound }) => { won ? playWinSound() : playLoseSound(); });
         UI.winnerText.innerText = won ? "你赢了!" : "对手赢了!";
         UI.winnerText.style.background = won ? `linear-gradient(45deg, var(--primary), #00ffaa)` : `linear-gradient(45deg, var(--secondary), #ff5555)`;
         UI.winnerText.style.webkitBackgroundClip = "text";
         UI.winnerText.style.webkitTextFillColor = "transparent";
         UI.winnerText.style.display = "block";
         UI.finalScoreText.innerText = `${GameState.score.player} - ${GameState.score.ai}`;
         UI.statMaxSpeed.innerText = `${GameState.stats.maxSmashSpeed} km/h`;
         UI.statLongestRally.innerText = GameState.stats.longestRally;
         setTimeout(() => UI.gameOverScreen.classList.remove('hidden'), 1000);
    }
    GameState.state = targetState.gameState;
    UI.playerScore.innerText = GameState.score.player;
    UI.aiScore.innerText = GameState.score.ai;
}
