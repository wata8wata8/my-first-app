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

const player = { x: 70, y: GROUND_Y - 46, width: 32, height: 46, vx: 0, vy: 0, grounded: true };
const enemy = { x: 820, y: GROUND_Y - 32, width: 38, height: 32, minX: 720, maxX: 1010, speed: 1.5 };
const keys = new Set();
let coins = [];
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
    enemy.x = 820;
    enemy.speed = 1.5;
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

    enemy.x += enemy.speed;
    if (enemy.x < enemy.minX || enemy.x + enemy.width > enemy.maxX) {
        enemy.speed *= -1;
        enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.width, enemy.x));
    }

    for (const coin of coins) {
        if (!coin.collected && overlaps(player, { x: coin.x - 11, y: coin.y - 11, width: 22, height: 22 })) {
            coin.collected = true;
        }
    }

    if (overlaps(player, enemy)) {
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
        showMessage("LEVEL COMPLETE", "ゴール！", `コインを ${coins.filter((coin) => coin.collected).length} 枚集めました。`, "もう一度遊ぶ");
    }
}

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#43c5d5");
    sky.addColorStop(0.62, "#83d9d1");
    sky.addColorStop(1, "#ffd3a0");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "rgba(255, 218, 126, .24)";
    ctx.beginPath();
    ctx.arc(790 - cameraX * 0.08, 112, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffcf68";
    ctx.beginPath();
    ctx.arc(790 - cameraX * 0.08, 112, 39, 0, Math.PI * 2);
    ctx.fill();

    drawDunes("#f5b878", 366, 0.12, 43);
    drawCity();
    drawDunes("#f5a86e", 430, 0.3, 48);
}

function drawDunes(color, baseline, speed, height) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let x = -100; x <= WIDTH + 100; x += 80) {
        const worldX = x + cameraX * speed;
        const y = baseline - Math.sin(worldX * 0.005) * height - Math.cos(worldX * 0.0025) * height * 0.45;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
}

function drawCity() {
    const parallax = cameraX * 0.2;
    ctx.save();
    ctx.translate(-parallax, 0);
    const startX = Math.floor(parallax / 260) * 260 - 260;

    for (let x = startX; x < parallax + WIDTH + 260; x += 260) {
        const variation = Math.floor(x / 260) % 3;
        const baseY = 414;
        ctx.fillStyle = variation === 1 ? "#c97d9a" : "#b9789c";

        ctx.fillRect(x + 22, baseY - 58, 47, 58);
        ctx.fillRect(x + 82, baseY - 83, 54, 83);
        ctx.fillRect(x + 151, baseY - 48, 62, 48);

        ctx.beginPath();
        ctx.moveTo(x + 82, baseY - 83);
        ctx.quadraticCurveTo(x + 109, baseY - 128, x + 136, baseY - 83);
        ctx.closePath();
        ctx.fill();

        ctx.fillRect(x + 99, baseY - 139, 20, 56);
        ctx.beginPath();
        ctx.moveTo(x + 99, baseY - 139);
        ctx.lineTo(x + 109, baseY - 156);
        ctx.lineTo(x + 119, baseY - 139);
        ctx.closePath();
        ctx.fill();

        ctx.fillRect(x + 171, baseY - 91, 13, 43);
        ctx.beginPath();
        ctx.moveTo(x + 171, baseY - 91);
        ctx.quadraticCurveTo(x + 177.5, baseY - 111, x + 184, baseY - 91);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffe0a0";
        for (const windowX of [x + 35, x + 96, x + 116, x + 167, x + 190]) {
            ctx.beginPath();
            ctx.arc(windowX, baseY - 27, 4, Math.PI, 0);
            ctx.lineTo(windowX + 4, baseY - 16);
            ctx.lineTo(windowX - 4, baseY - 16);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = variation === 1 ? "#c97d9a" : "#b9789c";
    }
    ctx.restore();
}

function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, 0);

    for (const platform of platforms) {
        ctx.fillStyle = platform.y === GROUND_Y ? "#285b52" : "#367d69";
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = "#83d48c";
        ctx.fillRect(platform.x, platform.y, platform.width, 8);
        if (platform.y === GROUND_Y) {
            ctx.fillStyle = "rgba(15, 50, 54, .28)";
            for (let x = platform.x + 18; x < platform.x + platform.width; x += 38) {
                ctx.fillRect(x, platform.y + 23, 18, 5);
            }
        }
    }

    for (const coin of coins) {
        if (coin.collected) continue;
        ctx.fillStyle = "#ffcf59";
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff0a5";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#fff5ce";
        ctx.fillRect(coin.x - 1, coin.y - 6, 2, 12);
    }

    drawEnemy();
    drawPlayer();
    drawGoal();
    ctx.restore();
}

function drawPlayer() {
    ctx.fillStyle = "#ed6b55";
    ctx.fillRect(player.x, player.y + 8, player.width, player.height - 8);
    ctx.fillStyle = "#ffc4a8";
    ctx.fillRect(player.x + 5, player.y, player.width - 10, 17);
    ctx.fillStyle = "#183347";
    ctx.fillRect(player.x + 19, player.y + 6, 4, 5);
    ctx.fillStyle = "#fff0bd";
    ctx.fillRect(player.x + 4, player.y + player.height - 5, 10, 5);
    ctx.fillRect(player.x + 19, player.y + player.height - 5, 10, 5);
}

function drawEnemy() {
    ctx.fillStyle = "#6b4ca0";
    ctx.beginPath();
    ctx.roundRect(enemy.x, enemy.y + 5, enemy.width, enemy.height - 5, 9);
    ctx.fill();
    ctx.fillStyle = "#f7eaff";
    ctx.fillRect(enemy.x + 8, enemy.y + 12, 5, 7);
    ctx.fillRect(enemy.x + 25, enemy.y + 12, 5, 7);
    ctx.fillStyle = "#30234b";
    ctx.fillRect(enemy.x + 10, enemy.y + 14, 2, 4);
    ctx.fillRect(enemy.x + 27, enemy.y + 14, 2, 4);
}

function drawGoal() {
    const goalX = WORLD_WIDTH - 110;
    ctx.fillStyle = "#f2f5ee";
    ctx.fillRect(goalX, GROUND_Y - 128, 7, 128);
    ctx.fillStyle = "#ffcf59";
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
showMessage("READY?", "冒険に出発しよう", "コインを集めながら、敵を避けて旗を目指そう。", "ゲームスタート");
