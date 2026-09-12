// ============================================================
// SWING CAVE GAMES
// AUTHOR : Official Marz57
// Pure Vanilla JS + Canvas — mudah di-tweak
// ============================================================

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const starsEl = document.getElementById('stars');
const bestEl = document.getElementById('best');
const comboEl = document.getElementById('combo');
const startScreen = document.getElementById('start-screen');
const modeScreen = document.getElementById('mode-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const pauseScreen = document.getElementById('pause-screen');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const finalScoreEl = document.getElementById('final-score');
const finalStarsEl = document.getElementById('final-stars');
const modeDescEl = document.getElementById('mode-desc');
const modeDescStartEl = document.getElementById('mode-desc-start');
const modeIndicator = document.getElementById('mode-indicator');
const pauseBtn = document.getElementById('pause-btn');

// Mode Kesulitan
const MODES = {
  easy:   { name: 'Easy',   trapChance: 0.15, label: 'Jebakan 15%' },
  medium: { name: 'Medium', trapChance: 0.20, label: 'Jebakan 20%' },
  hard:   { name: 'Hard',   trapChance: 0.35, label: 'Jebakan 30%' },
  wni:    { name: 'WNI',    trapChance: 0.70, label: 'Jebakan 70% - hidup lebih menantang bila kita WNI 🗿🗿' },
};

let currentMode = localStorage.getItem('swingCaveMode') || 'medium';
if (!MODES[currentMode]) currentMode = 'medium';

// Physics 
const CFG = {
  gravity: 0.50,
  airDrag: 0.92,
  swingDamping: 0.997,
  restitution: 0.65,

  // gameplay
  attachRadius: 42,
  nodeRadius: 14,
  ballRadius: 16,
  starRadius: 11,
  maxRopeLength: 260,
  minRopeLength: 50,
  spawnAhead: 1800,
  nodeSpacingY: 160,
  nodeXVariance: 0.55,
  starChance: 0.55,
  crystalDensity: 0.7,
  bgScrollSpeed: 0.15,
  comboTimeout: 1800,
};

let W, H, dpr;
let running = false;
let score = 0;
let stars = 0;
let best = parseInt(localStorage.getItem('swingCaveBest') || '0', 10);
let combo = 1;
let lastStarTime = 0;
let cameraY = 0;
let time = 0;

// Player
let ball = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  attached: true,
  node: null,
  angle: 0,
  angVel: 0,
  ropeLen: 140,
  face: 'happy',
  trail: []
};

let nodes = [];
let starList = [];
let traps = [];
let particles = [];
let crystals = [];
let nextNodeY = 0;
let nextStarY = 0;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function rand(a, b) { return a + Math.random() * (b - a); }
function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function resetGame() {
  score = 0;
  stars = 0;
  combo = 1;
  cameraY = 0;
  time = 0;
  nodes = [];
  starList = [];
  traps = [];
  particles = [];
  crystals = [];
  nextNodeY = H * 0.35;
  nextStarY = H * 0.4;

  const startNode = {
    x: W * 0.5,
    y: H * 0.28,
    id: 0,
    active: true
  };
  nodes.push(startNode);

  ball.x = startNode.x;
  ball.y = startNode.y + 140;
  ball.vx = 0;
  ball.vy = 0;
  ball.attached = true;
  ball.node = startNode;
  ball.angle = Math.PI * 0.85;
  ball.angVel = 0.035;
  ball.ropeLen = 140;
  ball.face = 'happy';
  ball.trail = [];

  for (let i = 0; i < 12; i++) spawnNode();
  for (let i = 0; i < 40; i++) spawnCrystal();

  updateHUD();
}

function spawnNode() {
  const y = nextNodeY;
  const lane = Math.random();
  let x;
  if (lane < 0.22) {
    x = rand(45, W * 0.28);
  } else if (lane > 0.78) {
    x = rand(W * 0.72, W - 45);
  } else {
    x = rand(W * 0.25, W * 0.75);
  }
  const clampedX = clamp(x, 40, W - 40);

  const trapChance = MODES[currentMode].trapChance;
  if (Math.random() < trapChance && nodes.length > 3) {
    traps.push({
      x: clampedX,
      y,
      r: 18,
      pulse: Math.random() * Math.PI * 2
    });
  } else {
    nodes.push({
      x: clampedX,
      y,
      id: nodes.length,
      active: true
    });

    if (Math.random() < CFG.starChance) {
      starList.push({
        x: clamp(clampedX + rand(-60, 60), 40, W - 40),
        y: y + rand(-50, 80),
        collected: false,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  if (Math.random() < 0.28 && nodes.length > 5) {
    const sideTrapX = clampedX < W * 0.5
      ? rand(W * 0.65, W - 45)
      : rand(45, W * 0.35);
    traps.push({
      x: sideTrapX,
      y: y + rand(-40, 50),
      r: 16,
      pulse: Math.random() * Math.PI * 2
    });
  }

  nextNodeY += rand(CFG.nodeSpacingY * 0.7, CFG.nodeSpacingY * 1.2);
}

function spawnCrystal() {
  const side = Math.random() > 0.5 ? 0 : 1;
  crystals.push({
    side,
    y: nextNodeY + rand(-200, 600),
    h: rand(40, 110),
    w: rand(18, 38),
    offset: rand(0, 30),
    hue: rand(250, 280)
  });
}

let isHolding = false;

function findNearestNode(fromX, fromY, maxDist = 9999) {
  let closest = null;
  let closestD = maxDist;
  for (const n of nodes) {
    const d = dist(fromX, fromY, n.x, n.y);
    if (d < closestD) {
      closestD = d;
      closest = n;
    }
  }
  return closest;
}

function attachToNode(node) {
  if (!node) return;
  ball.attached = true;
  ball.node = node;

  const dx = ball.x - node.x;
  const dy = ball.y - node.y;
  let len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) len = CFG.minRopeLength;
  ball.ropeLen = clamp(len, CFG.minRopeLength, CFG.maxRopeLength);

  ball.angle = Math.atan2(dx, dy);
  
  const θ = ball.angle;
  const tangentX = Math.cos(θ);
  const tangentY = -Math.sin(θ);
  const tangentSpeed = ball.vx * tangentX + ball.vy * tangentY;
  ball.angVel = tangentSpeed / ball.ropeLen;
  ball.vx = 0;
  ball.vy = 0;
  ball.face = 'happy';
}

function detach() {
  if (!ball.attached || !ball.node) return;
  const L = ball.ropeLen;
  const θ = ball.angle;
  const ω = ball.angVel;

  ball.vx = L * ω * Math.cos(θ);
  ball.vy = -L * ω * Math.sin(θ);

  ball.attached = false;
  ball.node = null;
  ball.face = 'wow';
}

function onPointerDown(e) {
  e.preventDefault();
  if (!running) return;

  isHolding = true;

  const nearest = findNearestNode(ball.x, ball.y, 320);
  if (nearest) {
    attachToNode(nearest);
  }
}

function onPointerUp(e) {
  e.preventDefault();
  if (!running) return;

  isHolding = false;
  detach();
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);
canvas.addEventListener('pointerleave', onPointerUp);

function setMode(mode) {
  if (!MODES[mode]) return;
  currentMode = mode;
  localStorage.setItem('swingCaveMode', mode);

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const label = MODES[mode].label;
  if (modeDescEl) modeDescEl.textContent = label;
  if (modeDescStartEl) modeDescStartEl.textContent = label;

  if (modeIndicator) {
    modeIndicator.textContent = MODES[mode].name.toUpperCase();
    modeIndicator.className = '';
    modeIndicator.id = 'mode-indicator';
    modeIndicator.classList.add(mode);
  }
}

function initModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const pick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mode = btn.getAttribute('data-mode');
      if (mode) setMode(mode);
    };
    btn.addEventListener('touchend', pick, { passive: false });
    btn.addEventListener('click', pick);
  });

  setMode(currentMode);
}

let paused = false;
let countdownActive = false;

function pauseGame() {
  if (!running || paused || countdownActive) return;
  paused = true;
  pauseScreen.classList.remove('hidden');
}

function resumeWithCountdown() {
  if (countdownActive) return;
  pauseScreen.classList.add('hidden');
  countdownActive = true;
  countdownOverlay.classList.remove('hidden');

  let count = 3;
  countdownNumber.textContent = count;
  countdownNumber.style.animation = 'none';
  void countdownNumber.offsetWidth;
  countdownNumber.style.animation = '';

  const tick = () => {
    count--;
    if (count > 0) {
      countdownNumber.textContent = count;
      countdownNumber.style.animation = 'none';
      void countdownNumber.offsetWidth;
      countdownNumber.style.animation = '';
      setTimeout(tick, 900);
    } else {
      countdownOverlay.classList.add('hidden');
      lastTime = performance.now();
      countdownActive = false;
      paused = false;
    }
  };
  setTimeout(tick, 900);
}

document.getElementById('start-btn').addEventListener('click', () => {
  startScreen.classList.add('hidden');
  modeScreen.classList.remove('hidden');
  setMode(currentMode);
});
document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('back-btn').addEventListener('click', () => {
  modeScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
});
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('menu-btn').addEventListener('click', () => {
  gameoverScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  modeScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  running = false;
  paused = false;
});

document.getElementById('pause-menu-btn').addEventListener('click', () => {
  pauseScreen.classList.add('hidden');
  modeScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  running = false;
  paused = false;
});

pauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (running && !paused) pauseGame();
});

document.getElementById('resume-btn').addEventListener('click', () => {
  resumeWithCountdown();
});

function startGame() {
  startScreen.classList.add('hidden');
  modeScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  countdownOverlay.classList.add('hidden');
  resetGame();
  running = true;
  paused = false;
  countdownActive = false;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

initModeButtons();

function update(dt) {
  time += dt;
  const now = performance.now();

  while (nextNodeY < cameraY + H + CFG.spawnAhead) {
    spawnNode();
    if (Math.random() < 0.4) spawnCrystal();
  }

  nodes = nodes.filter(n => n.y > cameraY - 300);
  starList = starList.filter(s => !s.collected && s.y > cameraY - 200);
  traps = traps.filter(t => t.y > cameraY - 300);
  crystals = crystals.filter(c => c.y > cameraY - 400);

  if (ball.attached && ball.node) {
    const g = CFG.gravity;
    const L = ball.ropeLen;
    const angAcc = -(g / L) * Math.sin(ball.angle);
    ball.angVel += angAcc;
    ball.angVel *= CFG.swingDamping;
    ball.angle += ball.angVel;
    ball.x = ball.node.x + Math.sin(ball.angle) * L;
    ball.y = ball.node.y + Math.cos(ball.angle) * L;
    const margin = CFG.ballRadius + 2;
    if (ball.x < margin) {
      ball.x = margin;
      ball.angVel = Math.abs(ball.angVel) * CFG.restitution;
      const dx = ball.x - ball.node.x;
      const dy = ball.y - ball.node.y;
      ball.angle = Math.atan2(dx, dy);
    } else if (ball.x > W - margin) {
      ball.x = W - margin;
      ball.angVel = -Math.abs(ball.angVel) * CFG.restitution;
      const dx = ball.x - ball.node.x;
      const dy = ball.y - ball.node.y;
      ball.angle = Math.atan2(dx, dy);
    }
  } else {
    ball.vy += CFG.gravity;
    ball.vx *= CFG.airDrag;
    ball.vy *= CFG.airDrag;

    ball.x += ball.vx;
    ball.y += ball.vy;


    const margin = CFG.ballRadius + 2;
    if (ball.x < margin) {
      ball.x = margin;
      ball.vx = Math.abs(ball.vx) * CFG.restitution;
    } else if (ball.x > W - margin) {
      ball.x = W - margin;
      ball.vx = -Math.abs(ball.vx) * CFG.restitution;
    }
  }

  for (const t of traps) {
    if (dist(ball.x, ball.y, t.x, t.y) < CFG.ballRadius + t.r) {
      
      for (let i = 0; i < 14; i++) {
        particles.push({
          x: ball.x, y: ball.y,
          vx: rand(-5, 5),
          vy: rand(-6, 2),
          life: 1,
          color: `hsl(${rand(0, 20)}, 100%, 55%)`
        });
      }
      gameOver();
      return;
    }
  }

  ball.trail.unshift({ x: ball.x, y: ball.y });
  if (ball.trail.length > 12) ball.trail.pop();

  for (const s of starList) {
    if (s.collected) continue;
    if (dist(ball.x, ball.y, s.x, s.y) < CFG.ballRadius + CFG.starRadius + 6) {
      s.collected = true;
      stars++;
      
      if (now - lastStarTime < CFG.comboTimeout) {
        combo = Math.min(combo + 1, 8);
      } else {
        combo = 1;
      }
      lastStarTime = now;
      score += 15 * combo;

      for (let i = 0; i < 10; i++) {
        particles.push({
          x: s.x, y: s.y,
          vx: rand(-3, 3),
          vy: rand(-4, 1),
          life: 1,
          color: `hsl(${rand(45, 55)}, 100%, 60%)`
        });
      }
      showCombo();
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= 0.03;
    if (p.life <= 0) particles.splice(i, 1);
  }

  const targetCam = ball.y - H * 0.38;
  cameraY += (targetCam - cameraY) * 0.12;

  const depthScore = Math.floor((ball.y - H * 0.3) / 8);
  if (depthScore > score) score = depthScore;

  if (ball.y > cameraY + H + 200) {
    gameOver();
  }

  if (!ball.attached) ball.face = 'wow';
  else if (Math.abs(ball.angVel) < 0.01) ball.face = 'sleepy';
  else ball.face = 'happy';

  updateHUD();
}

function showCombo() {
  if (combo >= 2) {
    comboEl.textContent = `COMBO x${combo} (${(1 + (combo - 1) * 0.1).toFixed(1)}x)`;
    comboEl.classList.add('show');
    clearTimeout(showCombo._t);
    showCombo._t = setTimeout(() => comboEl.classList.remove('show'), 900);
  }
}

function updateHUD() {
  scoreEl.textContent = String(Math.floor(score)).padStart(4, '0');
  starsEl.textContent = stars;
  bestEl.textContent = best;
}

function gameOver() {
  running = false;
  paused = false;
  countdownActive = false;
  pauseScreen.classList.add('hidden');
  countdownOverlay.classList.add('hidden');
  if (score > best) {
    best = Math.floor(score);
    localStorage.setItem('swingCaveBest', best);
  }
  finalScoreEl.textContent = Math.floor(score);
  finalStarsEl.textContent = stars;
  gameoverScreen.classList.remove('hidden');
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0f2a');
  grad.addColorStop(0.5, '#0d1535');
  grad.addColorStop(1, '#080c20');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(100,180,255,0.15)';
  for (let i = 0; i < 25; i++) {
    const px = (i * 97 + time * 8) % W;
    const py = (i * 53 + cameraY * 0.3 + time * 12) % H;
    ctx.beginPath();
    ctx.arc(px, py, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const c of crystals) {
    const screenY = c.y - cameraY;
    if (screenY < -150 || screenY > H + 150) continue;
    const baseX = c.side === 0 ? c.offset : W - c.offset - c.w;
    drawCrystal(baseX, screenY, c.w, c.h, c.hue, c.side);
  }

  for (const n of nodes) {
    const sy = n.y - cameraY;
    if (sy < -60 || sy > H + 60) continue;
    drawNode(n.x, sy);
  }

  for (const t of traps) {
    const sy = t.y - cameraY;
    if (sy < -60 || sy > H + 60) continue;
    t.pulse += 0.1;
    drawTrap(t.x, sy, t.r, t.pulse);
  }

  for (const s of starList) {
    if (s.collected) continue;
    const sy = s.y - cameraY;
    if (sy < -40 || sy > H + 40) continue;
    s.pulse += 0.08;
    drawStar(s.x, sy, CFG.starRadius + Math.sin(s.pulse) * 1.5);
  }

  if (ball.attached && ball.node) {
    const ny = ball.node.y - cameraY;
    const by = ball.y - cameraY;
    drawRope(ball.node.x, ny, ball.x, by);
  }

  if (ball.trail.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,230,255,0.25)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const ty = t.y - cameraY;
      if (i === 0) ctx.moveTo(t.x, ty);
      else ctx.lineTo(t.x, ty);
    }
    ctx.stroke();
  }
  
  drawBall(ball.x, ball.y - cameraY);

  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - cameraY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawNode(x, y) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, 28);
  g.addColorStop(0, 'rgba(0,220,255,0.35)');
  g.addColorStop(1, 'rgba(0,180,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, CFG.nodeRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#a0f0ff';
  ctx.fill();
}

function drawTrap(x, y, r, pulse) {
  const pulseScale = 1 + Math.sin(pulse) * 0.12;

  const g = ctx.createRadialGradient(x, y, 0, x, y, 34);
  g.addColorStop(0, 'rgba(255,40,40,0.45)');
  g.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 34 * pulseScale, 0, Math.PI * 2);
  ctx.fill();


  ctx.beginPath();
  ctx.arc(x, y, r * pulseScale, 0, Math.PI * 2);
  ctx.strokeStyle = '#ff3030';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ff6666';
  ctx.fill();

  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + pulse * 0.3;
    const x1 = x + Math.cos(a) * (r - 2);
    const y1 = y + Math.sin(a) * (r - 2);
    const x2 = x + Math.cos(a) * (r + 7);
    const y2 = y + Math.sin(a) * (r + 7);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function drawRope(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'rgba(0,230,255,0.9)';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = '#e0ffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawBall(x, y) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, 32);
  g.addColorStop(0, 'rgba(180,240,255,0.45)');
  g.addColorStop(1, 'rgba(0,180,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, CFG.ballRadius, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, CFG.ballRadius);
  bodyGrad.addColorStop(0, '#e8ffff');
  bodyGrad.addColorStop(0.7, '#80e0ff');
  bodyGrad.addColorStop(1, '#2090c0');
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = '#00d0ff';
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#1a3a50';
  if (ball.face === 'sleepy') {
    ctx.beginPath();
    ctx.ellipse(x - 5, y - 2, 3.5, 1.2, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 5, y - 2, 3.5, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y + 5, 2.5, 0, Math.PI);
    ctx.strokeStyle = '#1a3a50';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (ball.face === 'wow') {
    ctx.beginPath();
    ctx.arc(x - 5, y - 2, 3.2, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 2, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y + 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x - 5, y - 2, 2.8, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 2, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y + 3, 5, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = '#1a3a50';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
}

function drawStar(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 0.03);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const r1 = i === 0 ? r : r;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    const a2 = a + (2 * Math.PI) / 10;
    ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawCrystal(x, y, w, h, hue, side) {
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.beginPath();
  if (side === 0) {
    ctx.moveTo(-w * 0.3, -h * 0.5);
    ctx.lineTo(w * 0.5, -h * 0.15);
    ctx.lineTo(w * 0.2, h * 0.5);
    ctx.lineTo(-w * 0.4, h * 0.25);
  } else {
    ctx.moveTo(w * 0.3, -h * 0.5);
    ctx.lineTo(-w * 0.5, -h * 0.15);
    ctx.lineTo(-w * 0.2, h * 0.5);
    ctx.lineTo(w * 0.4, h * 0.25);
  }
  ctx.closePath();
  const cg = ctx.createLinearGradient(-w, -h, w, h);
  cg.addColorStop(0, `hsla(${hue}, 70%, 55%, 0.75)`);
  cg.addColorStop(1, `hsla(${hue + 20}, 60%, 30%, 0.5)`);
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.strokeStyle = `hsla(${hue}, 80%, 75%, 0.4)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

let lastTime = performance.now();
function loop(now) {
  if (!running) return;
  if (paused || countdownActive) {
    lastTime = now;
    draw();
    requestAnimationFrame(loop);
    return;
  }
  const dt = Math.min((now - lastTime) / 16.666, 2.5);
  lastTime = now;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

bestEl.textContent = best;

resetGame();
draw();