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
const boostLevel = document.querySelector("#boost-level");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_WIDTH = 2500;
const GROUND_Y = 480;
const GRAVITY = 0.62;
const MOVE_SPEED = 4.4;
const BOOST_SPEED = 8.2;
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

const player = { x: 70, y: GROUND_Y - 30, width: 58, height: 30, vx: 0, vy: 0, grounded: true, facing: 1 };
const enemy = { x: 820, y: GROUND_Y - 30, width: 58, height: 30, minX: 720, maxX: 1010, speed: 1.5, alive: true };
const keys = new Set();
let coins = [];
let cameraX = 0;
let playing = false;
let animationFrame = 0;
let audioContext;
let engineOscillator;
let engineGain;
let engineFilter;
let musicTimer;
let musicStep = 0;
let musicEnabled = false;
let boostEnergy = 45;
let boostActive = false;
let collisionCooldown = 0;

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
    boostEnergy = 45;
    boostActive = false;
    collisionCooldown = 0;
    cameraX = 0;
    coins = initialCoins.map((coin) => ({ ...coin, collected: false }));
    updateHud();
}

function updateHud() {
    coinCount.textContent = `${coins.filter((coin) => coin.collected).length}/${coins.length}`;
    distanceLabel.textContent = `${Math.max(0, Math.ceil((WORLD_WIDTH - player.x) / 100))} m`;
    boostLevel.textContent = `${Math.round(boostEnergy)}%`;
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
    if (musicEnabled) setMusicEnabled(true);
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
    musicToggle.textContent = enabled ? "♪ SOUND ON" : "♪ SOUND OFF";
    window.clearInterval(musicTimer);
    musicTimer = undefined;

    if (!enabled) {
        if (audioContext) audioContext.suspend();
        return;
    }

    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
        musicToggle.textContent = "♪ SOUND unavailable";
        musicToggle.setAttribute("aria-pressed", "false");
        musicEnabled = false;
        return;
    }

    audioContext ??= new AudioContextClass();
    audioContext.resume().then(() => {
        if (!musicEnabled || musicTimer) return;
        startEngineSound();
        musicStep = 0;
        playMusicStep();
        musicTimer = window.setInterval(playMusicStep, 280);
    }).catch((error) => {
        musicEnabled = false;
        musicToggle.setAttribute("aria-pressed", "false");
        musicToggle.textContent = "♪ SOUND error";
        console.error("サウンドを再生できませんでした。", error);
    });
}

function startEngineSound() {
    if (!audioContext || engineOscillator) return;

    engineOscillator = audioContext.createOscillator();
    engineGain = audioContext.createGain();
    engineFilter = audioContext.createBiquadFilter();
    engineOscillator.type = "sawtooth";
    engineOscillator.frequency.value = 72;
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 420;
    engineGain.gain.value = 0.035;
    engineOscillator.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audioContext.destination);
    engineOscillator.start();
}

function updateEngineSound() {
    if (!musicEnabled || !engineOscillator || !audioContext) return;
    const speed = Math.abs(player.vx);
    const now = audioContext.currentTime;
    engineOscillator.frequency.setTargetAtTime(58 + speed * 24, now, 0.06);
    engineFilter.frequency.setTargetAtTime(boostActive ? 1500 : 420 + speed * 65, now, 0.08);
    engineGain.gain.setTargetAtTime(boostActive ? 0.075 : 0.025 + speed * 0.003, now, 0.08);
}

function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;
}

function update() {
    const movingLeft = keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("left");
    const movingRight = keys.has("ArrowRight") || keys.has("KeyD") || keys.has("right");
    const accelerating = movingLeft || movingRight;
    boostActive = accelerating && (keys.has("boost") || keys.has("Shift")) && boostEnergy > 0;
    if (boostActive) boostEnergy = Math.max(0, boostEnergy - 0.7);
    const speed = boostActive ? BOOST_SPEED : MOVE_SPEED;
    player.vx = (Number(movingRight) - Number(movingLeft)) * speed;
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

    for (const coin of coins) {
        if (!coin.collected && overlaps(player, { x: coin.x - 11, y: coin.y - 11, width: 22, height: 22 })) {
            coin.collected = true;
            boostEnergy = Math.min(100, boostEnergy + 22);
        }
    }

    if (collisionCooldown > 0) collisionCooldown -= 1;
    if (enemy.alive && collisionCooldown === 0 && overlaps(player, enemy)) {
        player.x = Math.max(0, player.x - 38);
        player.vx = 0;
        boostEnergy = Math.max(0, boostEnergy - 25);
        collisionCooldown = 55;
    }

    if (player.y > HEIGHT + 100) {
        player.x = 70;
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        cameraX = 0;
    }

    cameraX = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, player.x - WIDTH * 0.38));
    updateHud();
    updateEngineSound();

    if (player.x >= WORLD_WIDTH - 100) {
        playing = false;
        showMessage("RACE COMPLETE", "トップでゴール！", `ターボセルを ${coins.filter((coin) => coin.collected).length} 個回収しました。`, "もう一度走る");
    }
}

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#171b49");
    sky.addColorStop(0.55, "#713b83");
    sky.addColorStop(1, "#ff936e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "rgba(255, 117, 183, .2)";
    ctx.beginPath();
    ctx.arc(790 - cameraX * 0.08, 112, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffcf88";
    ctx.beginPath();
    ctx.arc(790 - cameraX * 0.08, 112, 39, 0, Math.PI * 2);
    ctx.fill();

    drawDunes("#493966", 366, 0.12, 43);
    drawCity();
    drawDunes("#272744", 430, 0.3, 48);

    if (boostActive) {
        ctx.strokeStyle = "rgba(125, 240, 255, .48)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 9; i += 1) {
            const y = 175 + ((i * 47 + animationFrame * 9) % 250);
            const x = (i * 137 + animationFrame * 14) % WIDTH;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 36, y);
            ctx.stroke();
        }
    }
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
        ctx.fillStyle = variation === 1 ? "#683f79" : "#51416f";

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

        ctx.fillStyle = "#ff8fce";
        for (const windowX of [x + 35, x + 96, x + 116, x + 167, x + 190]) {
            ctx.beginPath();
            ctx.arc(windowX, baseY - 27, 4, Math.PI, 0);
            ctx.lineTo(windowX + 4, baseY - 16);
            ctx.lineTo(windowX - 4, baseY - 16);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = variation === 1 ? "#683f79" : "#51416f";
    }
    ctx.restore();
}

function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, 0);

    for (const platform of platforms) {
        ctx.fillStyle = platform.y === GROUND_Y ? "#24283b" : "#33334d";
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = "#ff4fa3";
        ctx.fillRect(platform.x, platform.y, platform.width, 5);
        if (platform.y === GROUND_Y) {
            ctx.fillStyle = "rgba(255, 220, 151, .72)";
            for (let x = platform.x + 18; x < platform.x + platform.width; x += 72) {
                ctx.fillRect(x, platform.y + 30, 36, 4);
            }
        } else {
            ctx.fillStyle = "#ffc96d";
            ctx.fillRect(platform.x, platform.y + 8, platform.width, 3);
        }
    }

    for (const coin of coins) {
        if (coin.collected) continue;
        ctx.save();
        ctx.translate(coin.x, coin.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#56efff";
        ctx.beginPath();
        ctx.roundRect(-9, -9, 18, 18, 4);
        ctx.fill();
        ctx.strokeStyle = "#e3ffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fillRect(-2, -5, 4, 10);
        ctx.restore();
    }

    if (enemy.alive) drawEnemy();
    drawPlayer();
    drawGoal();
    ctx.restore();
}

function drawPlayer() {
    const x = player.x;
    const y = player.y + (player.grounded ? Math.sin(animationFrame * 0.35) * 1.2 : 0);
    if (player.facing < 0) {
        ctx.save();
        ctx.translate(x * 2 + player.width, 0);
        ctx.scale(-1, 1);
    }
    if (boostActive) {
        ctx.fillStyle = "rgba(68, 231, 255, .75)";
        ctx.beginPath();
        ctx.moveTo(x - 18, y + 19);
        ctx.lineTo(x + 2, y + 14);
        ctx.lineTo(x + 2, y + 24);
        ctx.closePath();
        ctx.fill();
    }
    ctx.fillStyle = "#ff3d91";
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 18);
    ctx.lineTo(x + 9, y + 8);
    ctx.lineTo(x + 20, y + 5);
    ctx.lineTo(x + 36, y + 5);
    ctx.lineTo(x + 49, y + 12);
    ctx.lineTo(x + 57, y + 16);
    ctx.lineTo(x + 58, y + 24);
    ctx.lineTo(x + 2, y + 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff9dca";
    ctx.beginPath();
    ctx.moveTo(x + 17, y + 8);
    ctx.lineTo(x + 35, y + 8);
    ctx.lineTo(x + 43, y + 14);
    ctx.lineTo(x + 12, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a7f7ff";
    ctx.fillRect(x + 19, y + 9, 12, 4);
    ctx.fillRect(x + 33, y + 9, 7, 4);
    ctx.fillStyle = "#fff4c2";
    ctx.fillRect(x + 52, y + 17, 5, 3);
    ctx.fillStyle = "#202033";
    for (const wheelX of [x + 11, x + 41]) {
        ctx.beginPath();
        ctx.arc(wheelX, y + 24, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b7c8d9";
        ctx.beginPath();
        ctx.arc(wheelX, y + 24, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#202033";
    }
    if (player.facing < 0) ctx.restore();
}

function drawEnemy() {
    ctx.fillStyle = "#704dff";
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y + 19);
    ctx.lineTo(enemy.x + 8, enemy.y + 9);
    ctx.lineTo(enemy.x + 20, enemy.y + 6);
    ctx.lineTo(enemy.x + 38, enemy.y + 6);
    ctx.lineTo(enemy.x + 51, enemy.y + 14);
    ctx.lineTo(enemy.x + 58, enemy.y + 17);
    ctx.lineTo(enemy.x + 58, enemy.y + 24);
    ctx.lineTo(enemy.x, enemy.y + 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c9baff";
    ctx.fillRect(enemy.x + 16, enemy.y + 10, 22, 5);
    ctx.fillStyle = "#ffcf68";
    ctx.fillRect(enemy.x + 2, enemy.y + 17, 5, 3);
}

function drawGoal() {
    const goalX = WORLD_WIDTH - 110;
    ctx.fillStyle = "#dbd6ff";
    ctx.fillRect(goalX, GROUND_Y - 128, 7, 128);
    ctx.fillStyle = "#56efff";
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
    ["Shift", "Shift"],
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
showMessage("READY TO RACE?", "限界まで加速しろ。", "ターボセルを集めてブースト！ライバルをかわして、ネオンハイウェイを駆け抜けよう。", "レーススタート");
