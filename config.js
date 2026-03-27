export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');
export const UI = {
    playerScore: document.getElementById('player-score'),
    aiScore: document.getElementById('ai-score'),
    startScreen: document.getElementById('start-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    startBtn: document.getElementById('start-btn'),
    restartBtn: document.getElementById('restart-btn'),
    winnerText: document.getElementById('winner-text'),
    finalScoreText: document.getElementById('final-score'),
    scoreSelectBtns: document.querySelectorAll('.select-btn'),
    volumeSlider: document.getElementById('volume-slider'),
    
    mpMenuBtn: document.getElementById('mp-menu-btn'),
    mpScreen: document.getElementById('mp-screen'),
    hostBtn: document.getElementById('host-btn'),
    hostInfo: document.getElementById('host-info'),
    backBtn: document.getElementById('back-btn'),
    
    // 自定义相关
    customizeBtn: document.getElementById('customize-btn'),
    customScreen: document.getElementById('custom-screen'),
    customBackBtn: document.getElementById('custom-back-btn'),
    themeList: document.getElementById('theme-list'),
    playerColorPicker: document.getElementById('player-color-picker'),
    racketColorPicker: document.getElementById('racket-color-picker'),
    statMaxSpeed: document.getElementById('stat-max-speed'),
    statLongestRally: document.getElementById('stat-longest-rally'),
    
    // 音乐播放器
    bgmName: document.getElementById('bgm-name'),
    bgmPrev: document.getElementById('bgm-prev'),
    bgmNext: document.getElementById('bgm-next')
};
export const GameState = {
    state: 'MENU',
    score: { player: 0, ai: 0 },
    winningScore: 11,
    serveTurn: 'player',
    isBallDead: false,
    roundMessage: "",
    volume: UI.volumeSlider ? parseInt(UI.volumeSlider.value) / 100 : 0.4,
    
    // 统计数据
    rallyCount: 0,
    stats: {
        maxSmashSpeed: 0,
        longestRally: 0,
        playerSmashes: 0,
        aiSmashes: 0
    }
};

if (UI.volumeSlider) {
    UI.volumeSlider.addEventListener('input', (e) => {
        GameState.volume = parseInt(e.target.value) / 100;
    });
}

UI.scoreSelectBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        UI.scoreSelectBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        GameState.winningScore = parseInt(e.target.getAttribute('data-score'));
    });
});

export const Physics = {
    PLAYER_GRAVITY: 0.38,
    SHUTTLE_GRAVITY: 0.12, 
    FRICTION: 0.90,
    SHUTTLE_DRAG: 0.988, // 增加阻力，使羽毛球在到达墙壁前自然降速下落
    GROUND_Y: 550,
    NET_X: 550,
    NET_Y: 420,
    NET_WIDTH: 10
};

export const Visuals = {
    shake: 0,
    currentThemeIndex: 0,
    themes: [
        { name: 'Neon Night', bg: '#0f172a', floor: '#1e293b', grid: '#334155', net: '#ffffff', ball: '#ffffff' },
        { name: 'Cyber Sunset', bg: '#2d1b2d', floor: '#4a1d4a', grid: '#ff00ea', net: '#00f3ff', ball: '#ffffff' },
        { name: 'Emerald Arena', bg: '#064e3b', floor: '#065f46', grid: '#34d399', net: '#ffffff', ball: '#fbbf24' },
        { name: 'Void Stadium', bg: '#000000', floor: '#111111', grid: '#444444', net: '#ff0055', ball: '#ffffff' }
    ],
    playerColor: '#00f3ff',
    aiColor: '#ff00ea',
    racketColor: '#ffffff'
};

export const keys = { w: false, a: false, s: false, d: false, space: false, j: false, k: false };
export const remoteKeys = { w: false, a: false, s: false, d: false, space: false, j: false, k: false };

export const MPState = {
    isMultiplayer: false,
    isHost: true
};
