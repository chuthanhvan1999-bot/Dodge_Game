
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const levelElement = document.getElementById("level");
const timeElement = document.getElementById("time");
const livesElement = document.getElementById("lives");
const dashElement = document.getElementById("dash");
const bestScoreElement = document.getElementById("bestScore");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const difficultySelect = document.getElementById("difficulty");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

let player;
let obstacles = [];
let particles = [];
let warnings = [];

let score = 0;
let level = 1;
let lives = 3;
let elapsedTime = 0;

let running = false;
let gameOver = false;

let lastTime = 0;
let obstacleTimer = 0;
let animationId;

let dashCooldown = 0;
let dashDuration = 0;
let invincibleTime = 0;

let screenShake = 0;
let flashTime = 0;

let bestScore = Number(localStorage.getItem("dodgeBest")) || 0;

bestScoreElement.textContent = bestScore;

// ================= DIFFICULTY =================

const difficultySettings = {
    easy: {
        speed: 3,
        spawnRate: 950,
        maxObstacles: 7
    },

    normal: {
        speed: 5,
        spawnRate: 700,
        maxObstacles: 10
    },

    hard: {
        speed: 7,
        spawnRate: 500,
        maxObstacles: 14
    }
};

// ================= PLAYER =================

function createPlayer() {
    return {
        x: WIDTH / 2 - 20,
        y: HEIGHT - 90,
        width: 40,
        height: 45,
        speed: 8,
        color: "#61f6ff"
    };
}

// ================= KEYBOARD =================

const keys = {
    left: false,
    right: false
};

document.addEventListener("keydown", function(event) {

    if (
        event.code === "ArrowLeft" ||
        event.code === "ArrowRight" ||
        event.code === "Space"
    ) {
        event.preventDefault();
    }

    if (event.code === "ArrowLeft" || event.code === "KeyA") {
        keys.left = true;
    }

    if (event.code === "ArrowRight" || event.code === "KeyD") {
        keys.right = true;
    }

    // Dash
    if (event.code === "Space" && !event.repeat) {
        useDash();
    }
});

document.addEventListener("keyup", function(event) {

    if (event.code === "ArrowLeft" || event.code === "KeyA") {
        keys.left = false;
    }

    if (event.code === "ArrowRight" || event.code === "KeyD") {
        keys.right = false;
    }
});

window.addEventListener("blur", function() {
    keys.left = false;
    keys.right = false;
});

// ================= DASH =================

function useDash() {
    if (!running) return;
    if (dashCooldown > 0) return;

    dashDuration = 200;
    dashCooldown = 1800;
    invincibleTime = 350;

    let direction = 0;

    if (keys.left) {
        direction = -1;
    } else if (keys.right) {
        direction = 1;
    } else {
        direction = player.x < WIDTH / 2 ? 1 : -1;
    }

    player.x += direction * 140;

    player.x = Math.max(
        0,
        Math.min(WIDTH - player.width, player.x)
    );

    createParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        "#61f6ff",
        15
    );
}

// ================= MOVEMENT =================

function movePlayer(deltaTime) {

    // Nếu dash đang hoạt động thì không di chuyển bình thường
    if (dashDuration > 0) return;

    const moveAmount = player.speed * (deltaTime / 16.67);

    if (keys.left) {
        player.x -= moveAmount;
    }

    if (keys.right) {
        player.x += moveAmount;
    }

    // Giới hạn trong màn hình
    if (player.x < 0) {
        player.x = 0;
    }

    if (player.x + player.width > WIDTH) {
        player.x = WIDTH - player.width;
    }
}

// ================= OBSTACLES =================

function createObstacle() {

    const settings = difficultySettings[difficultySelect.value];

    if (obstacles.length >= settings.maxObstacles + level) {
        return;
    }

    const chance = Math.random();

    let type = "normal";
    let width = 40;
    let height = 40;
    let speed = 1;
    let color = "#ff4d6d";

    if (level >= 4 && chance < 0.25) {
        type = "moving";
        width = 45;
        height = 35;
        color = "#a855f7";
    }
    else if (level >= 7 && chance < 0.45) {
        type = "fast";
        width = 25;
        height = 30;
        speed = 3;
        color = "#ff9f43";
    }
    else if (level >= 10 && chance < 0.60) {
        type = "large";
        width = 75;
        height = 60;
        color = "#ef4444";
    }

    obstacles.push({
        x: Math.random() * (WIDTH - width),
        y: -height,
        width: width,
        height: height,
        speed: speed,
        color: color,
        type: type,
        direction: Math.random() < 0.5 ? -1 : 1,
        moveSpeed: Math.random() * 3 + 2
    });
}

function updateObstacles(deltaTime) {

    const settings = difficultySettings[difficultySelect.value];

    obstacleTimer += deltaTime;

    const spawnRate = Math.max(
        180,
        settings.spawnRate - level * 40
    );

    if (obstacleTimer >= spawnRate) {
        createObstacle();
        obstacleTimer = 0;

        if (level >= 8 && Math.random() < 0.15) {
            createWarning();
        }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {

        const o = obstacles[i];

        const movement =
            (settings.speed + level * 0.35 + o.speed)
            * deltaTime / 16.67;

        o.y += movement;

        // Vật cản di chuyển ngang
        if (o.type === "moving") {

            o.x += o.direction * o.moveSpeed * deltaTime / 16.67;

            if (o.x <= 0) {
                o.x = 0;
                o.direction = 1;
            }

            if (o.x + o.width >= WIDTH) {
                o.x = WIDTH - o.width;
                o.direction = -1;
            }
        }

        // Xóa vật cản ra khỏi màn hình
        if (o.y > HEIGHT) {
            obstacles.splice(i, 1);
            score += 15;
        }
    }
}

// ================= WARNING =================

function createWarning() {

    warnings.push({
        x: Math.random() * (WIDTH - 80),
        width: 80,
        timer: 700
    });
}

function updateWarnings(deltaTime) {

    for (let i = warnings.length - 1; i >= 0; i--) {

        warnings[i].timer -= deltaTime;

        if (warnings[i].timer <= 0) {

            const w = warnings[i];

            for (let j = 0; j < 4; j++) {

                obstacles.push({
                    x: w.x + Math.random() * w.width,
                    y: -Math.random() * 150,
                    width: 25,
                    height: 30,
                    speed: 4,
                    color: "#ff355e",
                    type: "fast",
                    direction: 1,
                    moveSpeed: 0
                });
            }

            warnings.splice(i, 1);
        }
    }
}

// ================= COLLISION =================

function checkCollision(a, b) {

    return (
        a.x + 5 < b.x + b.width - 5 &&
        a.x + a.width - 5 > b.x + 5 &&
        a.y + 5 < b.y + b.height - 5 &&
        a.y + a.height - 5 > b.y + 5
    );
}

function checkGameCollision() {

    if (invincibleTime > 0) return;

    for (let i = obstacles.length - 1; i >= 0; i--) {

        if (checkCollision(player, obstacles[i])) {

            obstacles.splice(i, 1);

            lives--;

            screenShake = 15;
            flashTime = 150;
            invincibleTime = 1200;

            createParticles(
                player.x + player.width / 2,
                player.y + player.height / 2,
                "#ff4d6d",
                30
            );

            if (lives <= 0) {
                endGame();
            }

            break;
        }
    }
}

// ================= PARTICLES =================

function createParticles(x, y, color, amount) {

    for (let i = 0; i < amount; i++) {

        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            size: Math.random() * 5 + 2,
            life: 1,
            color: color
        });
    }
}

function updateParticles(deltaTime) {

    for (let i = particles.length - 1; i >= 0; i--) {

        const p = particles[i];

        p.x += p.vx * deltaTime / 16.67;
        p.y += p.vy * deltaTime / 16.67;

        p.life -= deltaTime / 600;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {

    for (const p of particles) {

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

// ================= BACKGROUND =================

function drawBackground() {

    ctx.fillStyle = "#0a1020";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(50, 100, 160, 0.12)";
    ctx.lineWidth = 1;

    for (let x = 0; x < WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
    }

    for (let y = 0; y < HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }
}

// ================= PLAYER DRAW =================

function drawPlayer() {

    ctx.save();

    if (
        invincibleTime > 0 &&
        Math.floor(invincibleTime / 100) % 2 === 0
    ) {
        ctx.globalAlpha = 0.35;
    }

    ctx.shadowBlur = 25;
    ctx.shadowColor = player.color;

    ctx.fillStyle = player.color;

    ctx.beginPath();

    ctx.roundRect(
        player.x,
        player.y,
        player.width,
        player.height,
        10
    );

    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#07111d";

    ctx.fillRect(player.x + 8, player.y + 10, 7, 7);
    ctx.fillRect(player.x + 25, player.y + 10, 7, 7);
    ctx.fillRect(player.x + 13, player.y + 28, 14, 4);

    if (dashDuration > 0) {

        ctx.fillStyle = "#ffffff";

        ctx.fillRect(
            player.x - 15,
            player.y + 10,
            8,
            25
        );
    }

    ctx.restore();
}

// ================= OBSTACLE DRAW =================

function drawObstacles() {

    for (const o of obstacles) {

        ctx.save();

        ctx.shadowBlur = 18;
        ctx.shadowColor = o.color;
        ctx.fillStyle = o.color;

        ctx.beginPath();
        ctx.roundRect(o.x, o.y, o.width, o.height, 7);
        ctx.fill();

        ctx.restore();
    }
}

// ================= WARNING DRAW =================

function drawWarnings() {

    for (const w of warnings) {

        ctx.fillStyle = "#ff355e";

        ctx.globalAlpha =
            Math.sin(performance.now() / 70) * 0.5 + 0.5;

        ctx.fillRect(w.x, 0, w.width, 8);
    }

    ctx.globalAlpha = 1;
}

// ================= UI =================

function updateUI() {

    scoreElement.textContent = score;
    levelElement.textContent = level;
    timeElement.textContent = Math.floor(elapsedTime) + "s";
    livesElement.textContent = lives;

    if (dashCooldown <= 0) {

        dashElement.textContent = "READY";
        dashElement.style.color = "#61f6ff";

    } else {

        dashElement.textContent =
            (dashCooldown / 1000).toFixed(1) + "s";

        dashElement.style.color = "#ff9f43";
    }
}

// ================= DRAW =================

function draw() {

    ctx.save();

    if (screenShake > 0) {

        ctx.translate(
            (Math.random() - 0.5) * screenShake,
            (Math.random() - 0.5) * screenShake
        );
    }

    drawBackground();
    drawWarnings();
    drawObstacles();

    if (player) {
        drawPlayer();
    }

    drawParticles();

    ctx.restore();

    if (flashTime > 0) {

        ctx.fillStyle = "rgba(255, 50, 80, 0.15)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
}

// ================= GAME OVER =================

function endGame() {

    if (gameOver) return;

    running = false;
    gameOver = true;

    keys.left = false;
    keys.right = false;

    createParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        "#ff4d6d",
        40
    );

    draw();

    if (score > bestScore) {

        bestScore = score;

        localStorage.setItem("dodgeBest", bestScore);
        bestScoreElement.textContent = bestScore;
    }

    overlay.style.display = "flex";

    overlayTitle.textContent = "GAME OVER";

    overlayText.innerHTML =
        "Điểm: <strong>" + score + "</strong><br>" +
        "Thời gian: " + Math.floor(elapsedTime) + " giây<br>" +
        "Level: " + level + "<br>" +
        "Mạng còn: " + lives;

    startBtn.textContent = "CHƠI LẠI";
}

// ================= START =================

function startGame() {

    cancelAnimationFrame(animationId);

    player = createPlayer();

    obstacles = [];
    particles = [];
    warnings = [];

    keys.left = false;
    keys.right = false;

    score = 0;
    level = 1;
    lives = 3;
    elapsedTime = 0;

    obstacleTimer = 0;

    dashCooldown = 0;
    dashDuration = 0;
    invincibleTime = 0;

    screenShake = 0;
    flashTime = 0;

    running = true;
    gameOver = false;

    overlay.style.display = "none";

    lastTime = performance.now();

    updateUI();

    animationId = requestAnimationFrame(gameLoop);
}

// ================= LOOP =================

function gameLoop(currentTime) {

    if (!running) return;

    const deltaTime = Math.min(currentTime - lastTime, 50);

    lastTime = currentTime;

    elapsedTime += deltaTime / 1000;

    level = Math.floor(elapsedTime / 10) + 1;

    score += Math.floor(deltaTime / 100);

    // Cập nhật di chuyển
    movePlayer(deltaTime);

    // Cập nhật vật cản
    updateObstacles(deltaTime);
    updateWarnings(deltaTime);
    updateParticles(deltaTime);

    // Hồi dash
    dashCooldown = Math.max(0, dashCooldown - deltaTime);
    dashDuration = Math.max(0, dashDuration - deltaTime);

    // Thời gian bất tử
    invincibleTime = Math.max(0, invincibleTime - deltaTime);

    // Hiệu ứng
    screenShake = Math.max(0, screenShake - deltaTime * 0.05);
    flashTime = Math.max(0, flashTime - deltaTime);

    // Va chạm
    checkGameCollision();

    updateUI();
    draw();

    if (running) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

// ================= BUTTON =================

startBtn.addEventListener("click", startGame);

// ================= INITIAL =================

player = createPlayer();
draw();
