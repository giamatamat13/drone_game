const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

let difficulty = 'normal';

let gameState = {
    running: false,
    score: 0,
    startTime: 0,
    minThrust: 1,
    maxThrust: 12,
    currentThrust: 2,
    spawnRate: 150,
    lastHeight: 300,
    heightTimer: 0,
    campThreshold: 180,
    drone: {
        x: 150, y: 300,
        size: 18,
        vx: 0, vy: 0,
        baseAcc: 0.25,
        friction: 0.94
    },
    obstacles: [],
    dust: Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2
    }))
};

const keys = {};
window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

function setDifficulty(level, btn) {
    difficulty = level;
    document.querySelectorAll('.difficulty-btns .btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function startGame() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('osd').style.display = 'flex';

    switch (difficulty) {
        case 'easy':
            gameState.minThrust = 1; gameState.maxThrust = 4;
            gameState.spawnRate = 160; gameState.drone.baseAcc = 0.2;
            gameState.campThreshold = 240;
            break;
        case 'normal':
            gameState.minThrust = 2; gameState.maxThrust = 7;
            gameState.spawnRate = 100; gameState.drone.baseAcc = 0.35;
            gameState.campThreshold = 180;
            break;
        case 'hard':
            gameState.minThrust = 3; gameState.maxThrust = 10;
            gameState.spawnRate = 60; gameState.drone.baseAcc = 0.5;
            gameState.campThreshold = 120;
            break;
        case 'impossible':
            gameState.minThrust = 5; gameState.maxThrust = 15;
            gameState.spawnRate = 30; gameState.drone.baseAcc = 0.7;
            gameState.campThreshold = 60;
            break;
    }

    gameState.currentThrust = gameState.minThrust + 1;
    gameState.running = true;
    gameState.startTime = Date.now();
}

function createObstacle(yPos = null) {
    const types = ['rect', 'triangle', 'circle', 'hexagon', 'star', 'diamond', 'ring'];
    return {
        type: types[Math.floor(Math.random() * types.length)],
        x: canvas.width + 200,
        y: yPos !== null ? yPos : Math.random() * (canvas.height - 150) + 75,
        size: 35 + Math.random() * 55,
        angle: 0,
        rotSpeed: (Math.random() - 0.5) * 0.1,
        hue: Math.random() * 60 + 100
    };
}

function update() {
    if (!gameState.running) return;

    const elapsedMinutes = (Date.now() - gameState.startTime) / 60000;
    const d = gameState.drone;

    // בקרת גובה
    const currentAcc = d.baseAcc + (elapsedMinutes * 0.04);
    if (keys['w'] || keys['arrowup']) d.vy -= currentAcc;
    if (keys['s'] || keys['arrowdown']) d.vy += currentAcc;

    // בקרת מהירות
    if (keys['d'] || keys['arrowright']) gameState.currentThrust += 0.12;
    else if (keys['a'] || keys['arrowleft']) gameState.currentThrust -= 0.15;

    const dynamicMin = gameState.minThrust + (elapsedMinutes * 0.8);
    const dynamicMax = gameState.maxThrust + (elapsedMinutes * 1.2);
    gameState.currentThrust = Math.max(dynamicMin, Math.min(dynamicMax, gameState.currentThrust));

    d.vy *= d.friction;
    d.y += d.vy;
    d.x += ( (120 + (gameState.currentThrust * 10)) - d.x ) * 0.05;
    d.y = Math.max(40, Math.min(canvas.height - 40, d.y));

    // Anti-Camp Logic
    if (Math.abs(d.y - gameState.lastHeight) < 2) gameState.heightTimer++;
    else gameState.heightTimer = 0;
    gameState.lastHeight = d.y;

    const warningEl = document.getElementById('antiCampWarning');
    const warningLimit = difficulty === 'impossible' ? gameState.campThreshold * 0.3 : gameState.campThreshold * 0.6;
    warningEl.style.display = (gameState.heightTimer > warningLimit) ? 'block' : 'none';

    if (gameState.heightTimer >= gameState.campThreshold) {
        gameState.obstacles.push(createObstacle(d.y));
        gameState.heightTimer = 0;
    }

    const worldMoveSpeed = 1.5 + (gameState.currentThrust * 1.4);
    
    // Update Dust & Obstacles
    gameState.dust.forEach(p => {
        p.x -= worldMoveSpeed * p.z * 0.5;
        if (p.x < 0) { p.x = canvas.width; p.y = Math.random() * canvas.height; }
    });

    const currentSpawnRate = Math.max(15, gameState.spawnRate / (1 + elapsedMinutes * 1.0));
    if (gameState.obstacles.length === 0 || gameState.obstacles[gameState.obstacles.length - 1].x < canvas.width - currentSpawnRate) {
        gameState.obstacles.push(createObstacle());
    }

    gameState.obstacles.forEach((obs, i) => {
        obs.x -= worldMoveSpeed;
        obs.angle += obs.rotSpeed;
        const dx = d.x - obs.x;
        const dy = d.y - obs.y;
        if (Math.sqrt(dx*dx + dy*dy) < d.size + obs.size * 0.4) gameOver();
        if (obs.x < -200) { gameState.obstacles.splice(i, 1); gameState.score++; }
    });

    // Update OSD
    document.getElementById('score').innerText = gameState.score;
    document.getElementById('speedDisplay').innerText = Math.floor(10 + (gameState.currentThrust * 15));
    document.getElementById('altitude').innerText = Math.floor((600 - d.y) / 5);
}

function draw() {
    ctx.fillStyle = "rgba(2, 6, 23, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    gameState.dust.forEach(p => {
        ctx.strokeStyle = `rgba(0, 255, 0, ${p.opacity})`;
        ctx.lineWidth = p.z / 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.z * 5, p.y); ctx.stroke();
    });

    gameState.obstacles.forEach(obs => {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.angle);
        let color = difficulty === 'impossible' ? `hsl(${Math.random()*360}, 100%, 70%)` : `hsl(${obs.hue}, 100%, 60%)`;
        ctx.strokeStyle = color; ctx.shadowBlur = 15; ctx.shadowColor = color; ctx.lineWidth = 3;
        drawShape(obs);
        ctx.restore();
    });

    drawDrone(gameState.drone.x, gameState.drone.y);
}

function drawShape(obs) {
    const s = obs.size / 2;
    ctx.beginPath();
    if (obs.type === 'rect') ctx.strokeRect(-s, -s, obs.size, obs.size);
    else if (obs.type === 'circle') ctx.arc(0, 0, s, 0, Math.PI * 2);
    else if (obs.type === 'triangle') { ctx.moveTo(0, -s); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.closePath(); }
    ctx.stroke();
}

function drawDrone(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(gameState.running ? (gameState.drone.vy * 0.05 + (gameState.currentThrust * 0.012)) : 0);
    ctx.strokeStyle = "#00ffcc"; ctx.shadowBlur = 15; ctx.shadowColor = "#00ffcc"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-16, -16); ctx.lineTo(16, 16); ctx.moveTo(16, -16); ctx.lineTo(-16, 16); ctx.stroke();
    ctx.restore();
}

function gameOver() {
    gameState.running = false;
    document.getElementById('gameOver').style.display = 'flex';
    document.getElementById('osd').style.display = 'none';
    document.getElementById('finalScore').innerText = gameState.score;
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();