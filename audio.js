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

export function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

export function playTone(freq, type, dur, baseVol) {
    if (!audioCtx) return;
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
    if (!audioCtx) return;
    const vol = 0.1 * GameState.volume;
    if (vol <= 0.001) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

export function playSwingSound(isHeavy = false) {
    if (!audioCtx) return;
    const vol = (isHeavy ? 0.15 : 0.1) * GameState.volume;
    if (vol <= 0.001) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHeavy ? 400 : 800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

export function playHitSound(isHeavy = false) {
    if (!audioCtx) return;
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
