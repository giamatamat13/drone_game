// game.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("FPV NEON: System Initializing...");

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    if (!canvas) {
        console.error("CRITICAL ERROR: Canvas element 'gameCanvas' not found!");
        return;
    }

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
        // מנגנון זיהוי עמידה במקום
        lastHeight: 300,
        heightTimer: 0,
        campThreshold: 180, // ברירת מחדל: 3 שניות ב-60 FPS
        drone: {
            x: 150, y: 300,
            size: 18,
            vx: 0, vy: 0,
            baseAcc: 0.25,
            friction: 0.94
        },
        obstacles: [],
        dust: Array.from({length: 80}, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            z: Math.random() * 3 + 1,
            opacity: Math.random() * 0.5 + 0.2
        }))
    };

    const keys = {};
    window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
    window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

    // פונקציות גלובליות שמופעלות מה-HTML (חייבות להיות מוצמדות ל-window בגלל ה-Scope)
    window.setDifficulty = function(level, btn) {
        difficulty = level;
        document.querySelectorAll('.difficulty-btns .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        console.log("Difficulty set to:", level);
    };

    window.startGame = function() {
        console.log("Arming motors... Mission started.");
        document.getElementById('menu').style.display = 'none';
        document.getElementById('osd').style.display = 'flex';
        
        switch(difficulty) {
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
    };

    function createObstacle(yPos = null) {
        const types = ['rect', 'triangle', 'circle', 'hexagon', 'star', 'diamond', 'ring', 'cross', 'octagon', 'plus', 'arrow', 'capsule', 'zig'];
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

        const currentAcc = d.baseAcc + (elapsedMinutes * 0.04);
        if (keys['w'] || keys['arrowup']) d.vy -= currentAcc;
        if (keys['s'] || keys['arrowdown']) d.vy += currentAcc;
        
        if (keys['d'] || keys['arrowright']) gameState.currentThrust += 0.12;
        else if (keys['a'] || keys['arrowleft']) gameState.currentThrust -= 0.15;

        const dynamicMin = gameState.minThrust + (elapsedMinutes * 0.8);
        const dynamicMax = gameState.maxThrust + (elapsedMinutes * 1.2);
        if (gameState.currentThrust < dynamicMin) gameState.currentThrust = dynamicMin;
        if (gameState.currentThrust > dynamicMax) gameState.currentThrust = dynamicMax;

        d.vy *= d.friction;
        d.y += d.vy;
        const targetX = 120 + (gameState.currentThrust * 10);
        d.x += (targetX - d.x) * 0.05;
        d.y = Math.max(40, Math.min(canvas.height - 40, d.y));

        const heightDiff = Math.abs(d.y - gameState.lastHeight);
        if (heightDiff < 2) {
            gameState.heightTimer++;
        } else {
            gameState.heightTimer = 0;
        }
        gameState.lastHeight = d.y;

        const warningEl = document.getElementById('antiCampWarning');
        const warningLimit = difficulty === 'impossible' ? gameState.campThreshold * 0.3 : gameState.campThreshold * 0.6;
        
        if (gameState.heightTimer > warningLimit) {
            warningEl.style.display = 'block';
        } else {
            warningEl.style.display = 'none';
        }

        if (gameState.heightTimer >= gameState.campThreshold) {
            gameState.obstacles.push(createObstacle(d.y));
            gameState.heightTimer = 0;
        }

        const worldMoveSpeed = 1.5 + (gameState.currentThrust * 1.4);
        const currentSpawnRate = Math.max(15, gameState.spawnRate / (1 + elapsedMinutes * 1.0));

        gameState.dust.forEach(p => {
            p.x -= worldMoveSpeed * p.z * 0.5;
            if (p.x < 0) { p.x = canvas.width; p.y = Math.random() * canvas.height; }
        });

        if (gameState.obstacles.length === 0 || 
            gameState.obstacles[gameState.obstacles.length - 1].x < canvas.width - currentSpawnRate) {
            gameState.obstacles.push(createObstacle());
        }

        gameState.obstacles.forEach((obs, i) => {
            obs.x -= worldMoveSpeed;
            obs.angle += obs.rotSpeed;

            const dx = d.x - obs.x;
            const dy = d.y - obs.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance < d.size + obs.size * 0.4) gameOver();

            if (obs.x < -200) {
                gameState.obstacles.splice(i, 1);
                gameState.score++;
            }
        });

        const kmh = Math.floor(10 + (gameState.currentThrust * 15));
        document.getElementById('score').innerText = gameState.score;
        document.getElementById('speedDisplay').innerText = kmh;
        document.getElementById('altitude').innerText = Math.floor((600 - d.y) / 5);
    }

    function drawShape(obs) {
        const s = obs.size / 2;
        ctx.beginPath();
        switch(obs.type) {
            case 'rect': ctx.strokeRect(-s, -s, obs.size, obs.size); break;
            case 'circle': ctx.arc(0, 0, s, 0, Math.PI*2); break;
            case 'triangle':
                ctx.moveTo(0, -s); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.closePath();
                break;
            case 'hexagon':
                for(let j=0; j<6; j++) {
                    let a = j * Math.PI / 3;
                    ctx.lineTo(Math.cos(a)*s, Math.sin(a)*s);
                }
                ctx.closePath();
                break;
            case 'star':
                for(let i=0; i<10; i++) {
                    let r = i % 2 === 0 ? s : s/2.5;
                    let a = i * Math.PI / 5;
                    ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
                }
                ctx.closePath();
                break;
            case 'diamond':
                ctx.moveTo(0, -s*1.2); ctx.lineTo(s, 0); ctx.lineTo(0, s*1.2); ctx.lineTo(-s, 0); ctx.closePath();
                break;
            case 'ring':
                ctx.arc(0, 0, s, 0, Math.PI*2);
                ctx.moveTo(s*0.7, 0);
                ctx.arc(0, 0, s*0.7, 0, Math.PI*2, true);
                break;
            default: ctx.strokeRect(-s, -s, obs.size, obs.size); break;
        }
        ctx.stroke();
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    function draw() {
        ctx.fillStyle = "rgba(2, 6, 23, 0.3)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        gameState.dust.forEach(p => {
            ctx.strokeStyle = `rgba(0, 255, 0, ${p.opacity})`;
            ctx.lineWidth = p.z / 2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.z * 5, p.y);
            ctx.stroke();
        });

        gameState.obstacles.forEach(obs => {
            ctx.save();
            ctx.translate(obs.x, obs.y);
            ctx.rotate(obs.angle);
            
            let color = `hsl(${obs.hue}, 100%, 60%)`;
            if (difficulty === 'impossible') color = `hsl(${Math.random()*360}, 100%, 70%)`;

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = color;
            
            drawShape(obs);
            ctx.restore();
        });

        drawDrone(gameState.drone.x, gameState.drone.y);
    }

    function drawDrone(x, y) {
        ctx.save();
        ctx.translate(x, y);
        const tilt = gameState.running ? (gameState.drone.vy * 0.05 + (gameState.currentThrust * 0.012)) : 0;
        ctx.rotate(tilt);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00ffcc";
        ctx.strokeStyle = "#00ffcc";
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(-16, -16); ctx.lineTo(16, 16);
        ctx.moveTo(16, -16); ctx.lineTo(-16, 16);
        ctx.stroke();

        const propSpeed = gameState.running ? (0.05 + gameState.currentThrust * 0.03) : 0.15;
        [[-16,-16], [16,-16], [-16,16], [16,16]].forEach(([px, py]) => {
            ctx.fillStyle = "#334155";
            ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI*2); ctx.fill();
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(Date.now() * propSpeed);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 2, 0, 0, Math.PI*2);
            ctx.stroke();
            ctx.restore();
        });

        ctx.fillStyle = "#0f172a";
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;
        ctx.fillRect(-6, -10, 12, 20);
        ctx.strokeRect(-6, -10, 12, 20);
        ctx.fillStyle = "#ff0044";
        ctx.beginPath(); ctx.arc(4, 0, 2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    function gameOver() {
        console.log("Signal lost. Score:", gameState.score);
        gameState.running = false;
        document.getElementById('gameOver').style.display = 'flex';
        document.getElementById('osd').style.display = 'none';
        document.getElementById('antiCampWarning').style.display = 'none';
        document.getElementById('finalScore').innerText = gameState.score;
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    loop();
});