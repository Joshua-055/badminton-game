import { GameState } from './config.js';
//testing 
let audioCtx;
const tracks = [
    { name: "Sport BGM 1", url: "music1.mp3" },
    { name: "Sport BGM 2", url: "music2.mp3" },
    { name: "Sport BGM 3", url: "music3.mp3" }
];
let currentTrackIdx = 0;
let bgmAudio = null;
let noiseBuffer = null;

function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    const bufferSize = audioCtx.sampleRate * 0.5;
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

export function playTone(freq, type, dur, baseVol) {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    // 确保在播放音效前恢复上下文
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const vol = baseVol * GameState.volume;
    if (vol <= 0.001) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, dur / 5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
}

// ==========================
// 🚀 音效系统 (保持合成器)
// ==========================

export function playWalkSound() { playTone(150 + Math.random() * 50, 'sine', 0.05, 0.04); }
export function playJumpSound() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const vol = 0.3 * GameState.volume;
    if (vol <= 0.001) return;

    const now = audioCtx.currentTime;
    
    // 1. 低频“咚”声 (Thud)
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(now + 0.15);

    // 2. 高频摩擦声 (Friction)
    const source = audioCtx.createBufferSource();
    source.buffer = getNoiseBuffer();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1000, now);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    source.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    source.start(now);
    source.stop(now + 0.05);
}

export function playSwingSound(isHeavy = false) {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const vol = (isHeavy ? 0.4 : 0.25) * GameState.volume;
    if (vol <= 0.001) return;

    const now = audioCtx.currentTime;
    const source = audioCtx.createBufferSource();
    source.buffer = getNoiseBuffer();

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    // 挥拍模拟：从高频到低频的快速扫频（Whoosh）
    filter.frequency.setValueAtTime(isHeavy ? 1500 : 2500, now);
    filter.frequency.exponentialRampToValueAtTime(isHeavy ? 400 : 800, now + 0.15);
    filter.Q.setValueAtTime(1.0, now);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.25 : 0.18));

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    source.start(now);
    source.stop(now + 0.25);
}

export function playHitSound(isHeavy = false) {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const vol = (isHeavy ? 0.4 : 0.25) * GameState.volume;
    if (vol <= 0.001) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = isHeavy ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(isHeavy ? 150 : 600, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// ==========================
// 🎵 BGM 系统 (切换为 MP3 模式)
// ==========================

export function toggleBGM(play) {
    if (!audioCtx) initAudio();
    if (!bgmAudio) {
        bgmAudio = new Audio(tracks[currentTrackIdx].url);
        bgmAudio.loop = true;
        bgmAudio.crossOrigin = "anonymous";
    }

    if (play) {
        bgmAudio.volume = GameState.volume * 0.8;
        // 在播放 BGM 时也尝试恢复一次 AudioContext 权限
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        bgmAudio.play().catch(e => console.log("BGM Play failed:", e));
    } else {
        bgmAudio.pause();
    }
}

// 同步音量
window.addEventListener('input', () => {
    if (bgmAudio) bgmAudio.volume = GameState.volume * 0.8;
});

export function changeTrack(delta) {
    currentTrackIdx = (currentTrackIdx + delta + tracks.length) % tracks.length;
    const wasPlaying = bgmAudio && !bgmAudio.paused;
    
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.src = tracks[currentTrackIdx].url;
        bgmAudio.load(); // 强制重新加载，提高兼容性
        if (wasPlaying) {
             bgmAudio.play().catch(e => console.log("Switch play failed:", e));
        }
    }
    return currentTrackIdx;
}

export function getTrackName() { return tracks[currentTrackIdx].name; }

export function playWinSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const notesArr = [523.25, 659.25, 783.99, 1046.50];
    notesArr.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.15 * GameState.volume, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.5);
    });
}

export function playLoseSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const notesArr = [392.00, 349.23, 311.13, 261.63];
    notesArr.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gain.gain.setValueAtTime(0.15 * GameState.volume, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.15 + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.8);
    });
}
