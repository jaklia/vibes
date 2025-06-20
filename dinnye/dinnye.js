const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = 600;
canvas.height = 700;

const gravity = 0.3;
const friction = 0.98;
const colors = ["#FF0", "#FA0", "#F00", "#A0F", "#0FF", "#0F0", "#08F", "#F8F", "#F88", "#888", "#FFF"];
const radii = Array.from({ length: 11 }, (_, i) => 10 + i ** 1.12 * 6);
let score = 0;
let highScore = parseFloat(localStorage.getItem('highScore') || '0');
let cooldown = 0;
let gameOver = false;

class Fruit {
    constructor(x, y, type, staticFollow = false) {
        this.type = type;
        this.radius = radii[type];
        this.color = colors[type];
        this.pos = { x, y };
        this.prevPos = { x, y: y - 1 };
        this.merged = false;
        this.staticFollow = staticFollow;
    }

    update() {
        let vx = (this.pos.x - this.prevPos.x) * friction;
        let vy = (this.pos.y - this.prevPos.y) * friction + gravity;

        this.prevPos = { ...this.pos };
        this.pos.x += vx;
        this.pos.y += vy;
    }

    constrain(bounds) {
        let r = this.radius;
        if (this.pos.x - r < bounds.left) {
            this.pos.x = bounds.left + r;
        }
        if (this.pos.x + r > bounds.right) {
            this.pos.x = bounds.right - r;
        }
        if (this.pos.y + r > bounds.bottom) {
            this.pos.y = bounds.bottom - r;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    velocityY() {
        return this.pos.y - this.prevPos.y;
    }
}

class FloatingText {
    constructor(text, x, y) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.opacity = 1;
        this.dy = -0.5;
    }

    update() {
        this.y += this.dy;
        this.opacity -= 0.02;
    }

    draw(ctx) {
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = '#FFF';
        ctx.font = '16px sans-serif';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }

    isDone() {
        return this.opacity <= 0;
    }
}

let fruits = [];
let floatingTexts = [];
const bounds = { left: 100, right: 500, top: 100, bottom: 640 };

let nextType = Math.floor(Math.random() * 3);
let previewType = Math.floor(Math.random() * 3);
let currentFruit = new Fruit(canvas.width / 2, 60, nextType, true);

canvas.addEventListener("mousemove", (e) => {
    if (currentFruit && currentFruit.staticFollow) {
        currentFruit.pos.x = Math.max(bounds.left + currentFruit.radius, Math.min(bounds.right - currentFruit.radius, e.offsetX));
        currentFruit.prevPos.x = currentFruit.pos.x;
    }
});

canvas.addEventListener("click", () => {
    if (currentFruit && cooldown === 0 && !gameOver) {
        currentFruit.staticFollow = false;
        fruits.push(currentFruit);
        currentFruit = new Fruit(currentFruit.pos.x, 60, previewType, true);
        nextType = previewType;
        previewType = Math.floor(Math.random() * 5);
        cooldown = 20;
    }
});

function resolveCollisions() {
    for (let i = 0; i < fruits.length; i++) {
        for (let j = i + 1; j < fruits.length; j++) {
            let a = fruits[i];
            let b = fruits[j];
            let dx = b.pos.x - a.pos.x;
            let dy = b.pos.y - a.pos.y;
            let dist = Math.hypot(dx, dy);
            let minDist = a.radius + b.radius;

            if (dist < minDist) {
                if (a.type === b.type && !a.merged && !b.merged) {
                    a.merged = b.merged = true;
                    let pts = ((2 + a.type) * (1 + a.type)) / 2;
                    score += pts;
                    floatingTexts.push(new FloatingText(`+${Math.floor(pts)}`, (a.pos.x + b.pos.x) / 2, (a.pos.y + b.pos.y) / 2));

                    if (a.type < 10) {
                        let newX = (a.pos.x + b.pos.x) / 2;
                        let newY = (a.pos.y + b.pos.y) / 2;

                        let ax = a.pos.x - a.prevPos.x;
                        let ay = a.pos.y - a.prevPos.y;
                        let bx = b.pos.x - b.prevPos.x;
                        let by = b.pos.y - b.prevPos.y;

                        let avgVx = (ax + bx) / 2;
                        let avgVy = (ay + by) / 2;

                        let newFruit = new Fruit(newX, newY, a.type + 1);
                        newFruit.prevPos.x = newX - avgVx;
                        newFruit.prevPos.y = newY - avgVy;
                        fruits.push(newFruit);
                    }

                    fruits.splice(j, 1);
                    fruits.splice(i, 1);
                    i--;
                    break;
                } else {
                    let overlap = minDist - dist;
                    let nx = dx / dist;
                    let ny = dy / dist;

                    let ma = a.radius * a.radius;
                    let mb = b.radius * b.radius;
                    let total = ma + mb;

                    a.pos.x -= nx * overlap * (mb / total);
                    a.pos.y -= ny * overlap * (mb / total);
                    b.pos.x += nx * overlap * (ma / total);
                    b.pos.y += ny * overlap * (ma / total);
                }
            }
        }
    }
}

function drawPreview() {
    const r = radii[previewType];
    const color = colors[previewType];
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(canvas.width - 50, 60, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = '12px sans-serif';
    ctx.fillText("Next", canvas.width - 65, 20);
}

function drawScore() {
    ctx.fillStyle = '#FFF';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Score: ${Math.floor(score)}`, 20, 30);
    ctx.fillText(`High: ${Math.floor(highScore)}`, 20, 50);
}

function checkLoseCondition() {
    if (cooldown > 0) return;
    for (let fruit of fruits) {
        if (!fruit.staticFollow && fruit.pos.y + fruit.radius < bounds.top && fruit.velocityY() < -0.5) {
            gameOver = true;
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('highScore', highScore);
            }
            document.getElementById('game-over-text').innerHTML = `Game Over!<br>Score: ${Math.floor(score)}<br>High Score: ${Math.floor(highScore)}`;
            document.getElementById('game-over').style.display = 'block';
            document.body.classList.add('game-over');
        }
    }
}

function restartGame() {
    fruits = [];
    floatingTexts = [];
    score = 0;
    cooldown = 0;
    gameOver = false;
    currentFruit = new Fruit(canvas.width / 2, 60, Math.floor(Math.random() * 3), true);
    previewType = Math.floor(Math.random() * 3);
    document.getElementById('game-over').style.display = 'none';
    document.body.classList.remove('game-over');
    gameLoop();
}

function gameLoop() {
    if (gameOver) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#444';
    ctx.fillRect(bounds.left - 10, bounds.top, 10, bounds.bottom - bounds.top);
    ctx.fillRect(bounds.right, bounds.top, 10, bounds.bottom - bounds.top);
    ctx.fillRect(bounds.left, bounds.bottom, bounds.right - bounds.left, 20);

    fruits.forEach(fruit => {
        fruit.update();
        fruit.constrain(bounds);
    });

    for (let k = 0; k < 8; k++) resolveCollisions();

    fruits.forEach(fruit => fruit.draw(ctx));
    if (currentFruit) {
        currentFruit.draw(ctx);
    }

    floatingTexts.forEach(text => {
        text.update();
        text.draw(ctx);
    });
    floatingTexts = floatingTexts.filter(t => !t.isDone());

    drawPreview();
    drawScore();

    if (cooldown > 0) cooldown--;
    checkLoseCondition();

    requestAnimationFrame(gameLoop);
}

gameLoop();