const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const coinCount = document.querySelector("#coin-count");
const distanceLabel = document.querySelector("#distance");
const message = document.querySelector("#message");
const messageEyebrow = document.querySelector("#message-eyebrow");
const messageTitle = document.querySelector("#message-title");
const messageCopy = document.querySelector("#message-copy");
const startButton = document.querySelector("#start-button");
const musicToggle = document.querySelector("#music-toggle");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_WIDTH = 2500;
const GROUND_Y = 480;
const GRAVITY = 0.62;
const MOVE_SPEED = 4.4;
const JUMP_SPEED = -12.5;

const platforms = [
    { x: 0, y: GROUND_Y, width: 520, height: 80 },
    { x: 520, y: 410, width: 130, height: 18 },
    { x: 620, y: GROUND_Y, width: 480, height: 80 },
    { x: 1080, y: 375, width: 150, height: 18 },
    { x: 1200, y: GROUND_Y, width: 500, height: 80 },
    { x: 1700, y: 400, width: 160, height: 18 },
    { x: 1840, y: GROUND_Y, width: 660, height: 80 },
];

const initialCoins = [
    { x: 245, y: 405 }, { x: 440, y: 385 }, { x: 575, y: 365 },
    { x: 760, y: 405 }, { x: 965, y: 390 }, { x: 1150, y: 330 },
    { x: 1400, y: 405 }, { x: 1620, y: 385 }, { x: 1780, y: 355 },
    { x: 2020, y: 405 }, { x: 2220, y: 390 },
];

const player = { x: 70, y: GROUND_Y - 46, width: 32, height: 46, vx: 0, vy: 0, grounded: true, facing: 1 };
const enemy = { x: 820, y: GROUND_Y - 32, width: 38, height: 32, minX: 720, maxX: 1010, speed: 1.5, alive: true };
const keys = new Set();
let coins = [];
let fireballs = [];
let fireCooldown = 0;
let cameraX = 0;
let playing = false;
let animationFrame = 0;
let audioContext;
let musicTimer;
let musicStep = 0;
let musicEnabled = false;

function resetGame() {
    player.x = 70;
    player.y = GROUND_Y - player.height;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.facing = 1;
    enemy.x = 820;
    enemy.speed = 1.5;
    enemy.alive = true;
    fireballs = [];
    fireCooldown = 0;
    cameraX = 0;
    coins = initialCoins.map((coin) => ({ ...coin, collected: false }));
    updateHud();
}

function updateHud() {
    coinCount.textContent = `${coins.filter((coin) => coin.collected).length}/${coins.length}`;
    distanceLabel.textContent = `${Math.max(0, Math.ceil((WORLD_WIDTH - player.x) / 100))} m`;
}

function showMessage(eyebrow, title, copy, buttonText) {
    messageEyebrow.textContent = eyebrow;
    messageTitle.textContent = title;
    messageCopy.textContent = copy;
    startButton.textContent = buttonText;
    message.hidden = false;
}

function startGame() {
    cancelAnimationFrame(animationFrame);
    resetGame();
    keys.clear();
    playing = true;
    message.hidden = true;
    setMusicEnabled(true);
    animationFrame = requestAnimationFrame(gameLoop);
}

function playMusicStep() {
    if (!musicEnabled || !audioContext) return;

    const stepDuration = 0.28;
    const now = audioContext.currentTime;
    const melody = [0, 4, 7, 8, 7, 4, 1, 4, 0, 4, 7, 10, 8, 7, 4, 1];
    const semitone = melody[musicStep % melody.length];
    const frequency = 220 * 2 ** (semitone / 12);

    const note = audioContext.createOscillator();
    const noteGain = audioContext.createGain();
    const tone = audioContext.createBiquadFilter();
    note.type = "triangle";
    note.frequency.setValueAtTime(frequency, now);
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(1500, now);
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.exponentialRampToValueAtTime(0.12, now + 0.018);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    note.connect(tone);
    tone.connect(noteGain);
    noteGain.connect(audioContext.destination);
    note.start(now);
    note.stop(now + 0.23);

    if (musicStep % 4 === 0) {
        const bass = audioContext.createOscillator();
        const bassGain = audioContext.createGain();
        bass.type = "sine";
        bass.frequency.setValueAtTime(musicStep % 8 === 0 ? 110 : 146.83, now);
        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.exponentialRampToValueAtTime(0.16, now + 0.025);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        bass.connect(bassGain);
        bassGain.connect(audioContext.destination);
        bass.start(now);
        bass.stop(now + 0.31);
    }

    musicStep += 1;
}

function setMusicEnabled(enabled) {
    musicEnabled = enabled;
    musicToggle.setAttribute("aria-pressed", String(enabled));
    musicToggle.textContent = enabled ? "♪ BGM ON" : "♪ BGM OFF";
    window.clearInterval(musicTimer);
    musicTimer = undefined;

    if (!enabled) {
        if (audioContext) audioContext.suspend();
        return;
    }

    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
        musicToggle.textContent = "♪ BGM unavailable";
        musicToggle.setAttribute("aria-pressed", "false");
        musicEnabled = false;
        return;
    }

    audioContext ??= new AudioContextClass();
    audioContext.resume().then(() => {
        if (!musicEnabled || musicTimer) return;
        musicStep = 0;
        playMusicStep();
        musicTimer = window.setInterval(playMusicStep, 280);
    }).catch((error) => {
        musicEnabled = false;
        musicToggle.setAttribute("aria-pressed", "false");
        musicToggle.textContent = "♪ BGM error";
        console.error("BGMを再生できませんでした。", error);
    });
}

function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;
}

function update() {
    const movingLeft = keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("left");
    const movingRight = keys.has("ArrowRight") || keys.has("KeyD") || keys.has("right");
    player.vx = (Number(movingRight) - Number(movingLeft)) * MOVE_SPEED;
    if (player.vx !== 0) player.facing = Math.sign(player.vx);
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x + player.vx));

    player.vy += GRAVITY;
    const previousBottom = player.y + player.height;
    player.y += player.vy;
    player.grounded = false;

    if (player.vy >= 0) {
        for (const platform of platforms) {
            const crossedTop = previousBottom <= platform.y && player.y + player.height >= platform.y;
            const overlapsPlatform = player.x + player.width > platform.x && player.x < platform.x + platform.width;
            if (crossedTop && overlapsPlatform) {
                player.y = platform.y - player.height;
                player.vy = 0;
                player.grounded = true;
                break;
            }
        }
    }

    const jumping = keys.has("Space") || keys.has("ArrowUp") || keys.has("KeyW") || keys.has("jump");
    if (jumping && player.grounded) {
        player.vy = JUMP_SPEED;
        player.grounded = false;
    }

    if (enemy.alive) {
        enemy.x += enemy.speed;
        if (enemy.x < enemy.minX || enemy.x + enemy.width > enemy.maxX) {
            enemy.speed *= -1;
            enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.width, enemy.x));
        }
    }

    if (fireCooldown > 0) fireCooldown -= 1;
    if (keys.has("fire") && fireCooldown === 0) {
        const radius = 9;
        fireballs.push({
            x: player.facing > 0 ? player.x + player.width + radius : player.x - radius,
            y: player.y + player.height / 2,
            vx: player.facing * 8,
            radius,
        });
        fireCooldown = 18;
    }

    for (const fireball of fireballs) {
        fireball.x += fireball.vx;
        const hitbox = {
            x: fireball.x - fireball.radius,
            y: fireball.y - fireball.radius,
            width: fireball.radius * 2,
            height: fireball.radius * 2,
        };
        if (enemy.alive && overlaps(hitbox, enemy)) {
            enemy.alive = false;
        }
    }
    fireballs = fireballs.filter((fireball) => fireball.x > 0 && fireball.x < WORLD_WIDTH);

    for (const coin of coins) {
        if (!coin.collected && overlaps(player, { x: coin.x - 11, y: coin.y - 11, width: 22, height: 22 })) {
            coin.collected = true;
        }
    }

    if (enemy.alive && overlaps(player, enemy)) {
        player.x = 70;
        player.y = GROUND_Y - player.height;
        player.vx = 0;
        player.vy = 0;
        cameraX = 0;
    }

    if (player.y > HEIGHT + 100) {
        player.x = 70;
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        cameraX = 0;
    }

    cameraX = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, player.x - WIDTH * 0.38));
    updateHud();

    if (player.x >= WORLD_WIDTH - 100) {
        playing = false;
        showMessage("LEVEL COMPLETE", "ゴール！", `フルーツを ${coins.filter((coin) => coin.collected).length} 個集めました。`, "もう一度遊ぶ");
    }
}

function drawBackground() {
    const canopy = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    canopy.addColorStop(0, "#153f32");
    canopy.addColorStop(0.48, "#34734b");
    canopy.addColorStop(1, "#a6b85d");
    ctx.fillStyle = canopy;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "rgba(250, 222, 126, .16)";
    ctx.beginPath();
    ctx.arc(770 - cameraX * 0.06, 155, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 235, 157, .62)";
    ctx.beginPath();
    ctx.arc(770 - cameraX * 0.06, 155, 46, 0, Math.PI * 2);
    ctx.fill();

    drawJungleLayer("#285b42", 0.12, 0.72, 190, 90);
    drawJungleLayer("#1d4938", 0.25, 0.82, 235, 112);
    drawJungleLayer("#173b2e", 0.42, 0.91, 285, 132);
    drawCanopyVines();
}

function drawJungleLayer(color, parallax, baseline, spacing, canopySize) {
    const offset = cameraX * parallax;
    const startX = Math.floor(offset / spacing) * spacing - spacing;
    const baselineY = baseline * HEIGHT;
    ctx.save();
    ctx.translate(-offset, 0);
    ctx.fillStyle = color;
    for (let x = startX; x < offset + WIDTH + spacing; x += spacing) {
        const variation = Math.abs(Math.floor(x / spacing)) % 3;
        const trunkWidth = 18 + variation * 7;
        const top = baselineY - canopySize * (0.72 + variation * 0.08);
        ctx.fillRect(x + spacing * 0.48, top + canopySize * 0.55, trunkWidth, HEIGHT - top);
        ctx.beginPath();
        ctx.ellipse(x + spacing * 0.48, top + canopySize * 0.27, canopySize * 0.38, canopySize * 0.37, 0, 0, Math.PI * 2);
        ctx.ellipse(x + spacing * 0.25, top + canopySize * 0.42, canopySize * 0.28, canopySize * 0.26, 0, 0, Math.PI * 2);
        ctx.ellipse(x + spacing * 0.7, top + canopySize * 0.43, canopySize * 0.3, canopySize * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawCanopyVines() {
    const offset = cameraX * 0.58;
    const startX = Math.floor(offset / 180) * 180 - 180;
    ctx.save();
    ctx.translate(-offset, 0);
    ctx.strokeStyle = "#86a94e";
    ctx.lineWidth = 5;
    for (let x = startX; x < offset + WIDTH + 180; x += 180) {
        ctx.beginPath();
        ctx.moveTo(x + 25, 0);
        ctx.bezierCurveTo(x + 20, 42, x + 54, 50, x + 42, 92);
        ctx.stroke();
        ctx.fillStyle = "#a3c957";
        ctx.beginPath();
        ctx.ellipse(x + 42, 83, 7, 15, -0.55, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, 0);

    for (const platform of platforms) {
        ctx.fillStyle = platform.y === GROUND_Y ? "#65472d" : "#765434";
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = "#68a64c";
        ctx.fillRect(platform.x, platform.y, platform.width, 10);
        ctx.fillStyle = "#a0cc5a";
        for (let x = platform.x + 8; x < platform.x + platform.width; x += 24) {
            ctx.beginPath();
            ctx.ellipse(x, platform.y + 2, 8, 3, -0.35, 0, Math.PI * 2);
            ctx.fill();
        }
        if (platform.y === GROUND_Y) {
            ctx.fillStyle = "rgba(42, 30, 20, .3)";
            for (let x = platform.x + 18; x < platform.x + platform.width; x += 38) {
                ctx.fillRect(x, platform.y + 27, 18, 5);
            }
        }
    }

    for (const coin of coins) {
        if (coin.collected) continue;
        ctx.fillStyle = "#ef6545";
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffd26b";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#6b9e3c";
        ctx.fillRect(coin.x - 2, coin.y - 14, 4, 6);
    }

    for (const fireball of fireballs) drawFireball(fireball);
    if (enemy.alive) drawEnemy();
    drawPlayer();
    drawGoal();
    ctx.restore();
}

function drawFireball(fireball) {
    ctx.fillStyle = "rgba(255, 112, 50, .32)";
    ctx.beginPath();
    ctx.arc(fireball.x, fireball.y, fireball.radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff713d";
    ctx.beginPath();
    ctx.arc(fireball.x, fireball.y, fireball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe68a";
    ctx.beginPath();
    ctx.arc(fireball.x, fireball.y, fireball.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlayer() {
    ctx.fillStyle = "#9a5635";
    ctx.fillRect(player.x + 3, player.y + 11, player.width - 6, player.height - 11);
    ctx.fillStyle = "#f2c78b";
    ctx.fillRect(player.x + 6, player.y + 2, player.width - 12, 15);
    ctx.fillStyle = "#4d7b3d";
    ctx.fillRect(player.x + 2, player.y, player.width - 4, 7);
    ctx.fillRect(player.x - 1, player.y + 5, player.width + 2, 4);
    ctx.fillStyle = "#263b2d";
    ctx.fillRect(player.x + 19, player.y + 6, 4, 5);
    ctx.fillStyle = "#d7a64f";
    ctx.fillRect(player.x + 4, player.y + 21, 24, 5);
    ctx.fillStyle = "#513a29";
    ctx.fillRect(player.x + 4, player.y + player.height - 5, 10, 5);
    ctx.fillRect(player.x + 19, player.y + player.height - 5, 10, 5);
}

function drawEnemy() {
    ctx.fillStyle = "#8d633b";
    ctx.beginPath();
    ctx.roundRect(enemy.x, enemy.y + 5, enemy.width, enemy.height - 5, 9);
    ctx.fill();
    ctx.fillStyle = "#b78853";
    ctx.beginPath();
    ctx.moveTo(enemy.x + 6, enemy.y + 9);
    ctx.lineTo(enemy.x + 7, enemy.y - 1);
    ctx.lineTo(enemy.x + 15, enemy.y + 8);
    ctx.moveTo(enemy.x + 24, enemy.y + 8);
    ctx.lineTo(enemy.x + 32, enemy.y - 1);
    ctx.lineTo(enemy.x + 32, enemy.y + 12);
    ctx.fill();
    ctx.fillStyle = "#fff1d2";
    ctx.fillRect(enemy.x + 9, enemy.y + 12, 5, 7);
    ctx.fillRect(enemy.x + 25, enemy.y + 12, 5, 7);
    ctx.fillStyle = "#35271c";
    ctx.fillRect(enemy.x + 11, enemy.y + 14, 2, 4);
    ctx.fillRect(enemy.x + 27, enemy.y + 14, 2, 4);
    ctx.fillStyle = "#e0a277";
    ctx.fillRect(enemy.x + 15, enemy.y + 23, 9, 6);
}

function drawGoal() {
    const goalX = WORLD_WIDTH - 110;
    ctx.fillStyle = "#bd9a5a";
    ctx.fillRect(goalX, GROUND_Y - 128, 8, 128);
    ctx.fillStyle = "#9e7440";
    ctx.fillRect(goalX - 15, GROUND_Y - 4, 38, 5);
    ctx.fillStyle = "#e2bc59";
    ctx.beginPath();
    ctx.moveTo(goalX + 7, GROUND_Y - 128);
    ctx.lineTo(goalX + 64, GROUND_Y - 110);
    ctx.lineTo(goalX + 7, GROUND_Y - 91);
    ctx.closePath();
    ctx.fill();
}

function draw() {
    drawBackground();
    drawWorld();
}

function gameLoop() {
    if (!playing) return;
    update();
    draw();
    if (playing) animationFrame = requestAnimationFrame(gameLoop);
}

const keyMap = new Map([
    ["ArrowLeft", "ArrowLeft"], ["ArrowRight", "ArrowRight"],
    ["ArrowUp", "ArrowUp"], [" ", "Space"], ["Spacebar", "Space"],
    ["a", "KeyA"], ["A", "KeyA"], ["d", "KeyD"], ["D", "KeyD"],
    ["w", "KeyW"], ["W", "KeyW"],
    ["f", "fire"], ["F", "fire"],
]);

window.addEventListener("keydown", (event) => {
    const key = keyMap.get(event.key);
    if (key) {
        event.preventDefault();
        keys.add(key);
    }
});

window.addEventListener("keyup", (event) => {
    const key = keyMap.get(event.key);
    if (key) keys.delete(key);
});

window.addEventListener("blur", () => keys.clear());

document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        keys.add(control);
    });
    const release = () => keys.delete(control);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
});

startButton.addEventListener("click", startGame);
musicToggle.addEventListener("click", () => setMusicEnabled(!musicEnabled));

resetGame();
draw();
showMessage("READY?", "ジャングルへ出発！", "フルーツを集め、動物を避けながら奥の遺跡を目指そう。", "ゲームスタート");
