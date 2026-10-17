const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const coinCount = document.querySelector("#coin-count");
const distanceLabel = document.querySelector("#distance");
const message = document.querySelector("#message");
const messageEyebrow = document.querySelector("#message-eyebrow");
const messageTitle = document.querySelector("#message-title");
const messageCopy = document.querySelector("#message-copy");
const startButton = document.querySelector("#start-button");

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
    animationFrame = requestAnimationFrame(gameLoop);
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
    sky.addColorStop(0, "#79c9e5");
    sky.addColorStop(1, "#d4f0dc");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "rgba(255, 239, 166, .9)";
    ctx.beginPath();
    ctx.arc(790 - cameraX * 0.08, 105, 43, 0, Math.PI * 2);
    ctx.fill();

    drawHills("#a7ddcf", 350, 0.18, 90);
    drawHills("#70c5a9", 420, 0.32, 65);
}

function drawHills(color, baseline, speed, height) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let x = -100; x <= WIDTH + 100; x += 100) {
        const worldX = x + cameraX * speed;
        const y = baseline - Math.sin(worldX * 0.009) * height - Math.cos(worldX * 0.004) * height * 0.4;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
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

resetGame();
draw();
showMessage("READY?", "冒険に出発しよう", "コインを集めながら、敵を避けて旗を目指そう。", "ゲームスタート");
