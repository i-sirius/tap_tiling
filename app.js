
// ------------ Константи/стан ------------
const CELL = 100;           // px
const BOTTOM_PAD = 60;      // місце під полем для тексту всередині канваса
let rows = 3, cols = 4;     // дефолтна сітка

const COLORS = {
  on:  '#40e0d0', // змінюється пікером / темою
  off: '#ffffff', // змінюється пікером / темою
  grid:'#000000',
  text:'#000000'
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const shuffleInfo = document.getElementById('shuffleInfo');
const stepsInfo   = document.getElementById('stepsInfo');
const timeInfo    = document.getElementById('timeInfo');
const hintLine1   = document.getElementById('hintLine1');
const hintLine2   = document.getElementById('hintLine2');

const toolbar     = document.getElementById('toolbar');
const btnRestart  = document.getElementById('btnRestart');
const btnHint     = document.getElementById('btnHint');

const inputColorOn   = document.getElementById('colorOn');
const inputColorOff  = document.getElementById('colorOff');
const btnColorsReset = document.getElementById('btnColorsReset');
const btnRandomTheme = document.getElementById('btnRandomTheme');

let grid = [];           // true = бірюзова, false = біла
let stepCount = 0;
let startTime = 0;
let timerId = null;
let gameWon = false;
let winTime = 0;

let shuffleHistory = [];  // історія натискань під час заплутування
let solutionHint = [];    // обернений список (підказка до розв'язання)
let hintIndex = 0;        // вказівник на наступний крок підказки

// ------------ Утиліти ------------
function resizeCanvas() {
  canvas.width  = cols * CELL;
  canvas.height = rows * CELL + BOTTOM_PAD;
}

function cellIndex(r, c) {
  // нумерація клітинок: 1..(rows*cols), рядок за рядком
  return r * cols + c + 1;
}

function indexToRC(idx1) {
  // з номера 1..N до (r, c)
  const z = idx1 - 1;
  return { r: Math.floor(z / cols), c: z % cols };
}

function toggleNeighbors(r, c) {
  const dirs = [[0,0],[0,1],[0,-1],[1,0],[-1,0]];
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      grid[nr][nc] = !grid[nr][nc];
    }
  }
}

function allSameColor() {
  const first = grid[0][0];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== first) return false;
    }
  }
  return true;
}

function startTimer() {
  stopTimer();
  startTime = performance.now();
  timerId = setInterval(updatePanel, 200);
}
function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function randInt(a, b) { // включно [a, b]
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

// ---- Колірні утиліти + збереження ----
function saveColors() {
  localStorage.setItem('colorOn',  COLORS.on);
  localStorage.setItem('colorOff', COLORS.off);
}
function loadColors() {
  const on  = localStorage.getItem('colorOn');
  const off = localStorage.getItem('colorOff');
  if (on)  COLORS.on  = on;
  if (off) COLORS.off = off;
  if (inputColorOn)  inputColorOn.value  = COLORS.on;
  if (inputColorOff) inputColorOff.value = COLORS.off;
}
function resetColorsToDefault() {
  COLORS.on  = '#40e0d0';
  COLORS.off = '#ffffff';
  saveColors();
  if (inputColorOn)  inputColorOn.value  = COLORS.on;
  if (inputColorOff) inputColorOff.value = COLORS.off;
  draw();
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return {r:0,g:0,b:0};
  return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
}
function isDarkColor(hex) {
  const {r,g,b} = hexToRgb(hex);
  const yiq = (r*299 + g*587 + b*114) / 1000;
  return yiq < 128;
}
function randomPastelOrVivid() {
  // згенеруємо яскравий, але не токсичний колір (HSL → HEX спрощено)
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(60 + Math.random()*30); // 60..90%
  const l = Math.floor(45 + Math.random()*15); // 45..60%
  // конвертнемо у hex
  function hslToRgb(h, s, l){
    s/=100; l/=100;
    const k = n => (n + h/30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n),1)));
    return [Math.round(255*f(0)), Math.round(255*f(8)), Math.round(255*f(4))];
  }
  const [r,g,b] = hslToRgb(h,s,l);
  const toHex = v => v.toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function generateRandomTheme() {
  // Підбираємо "on" довільно, "off" робимо світлим або темним для контрасту
  const on = randomPastelOrVivid();
  let off = '#ffffff';
  // якщо on занадто світлий, зробимо off темним
  if (!isDarkColor(on)) {
    off = '#111111';
  }
  // але якщо off занадто схожий — примусово ставимо чорний/білий
  const onRgb = hexToRgb(on), offRgb = hexToRgb(off);
  const dist = Math.sqrt((onRgb.r-offRgb.r)**2 + (onRgb.g-offRgb.g)**2 + (onRgb.b-offRgb.b)**2);
  if (dist < 120) off = isDarkColor(on) ? '#ffffff' : '#111111';

  COLORS.on = on;
  COLORS.off = off;
  saveColors();
  if (inputColorOn)  inputColorOn.value  = COLORS.on;
  if (inputColorOff) inputColorOff.value = COLORS.off;
  draw();
}

// ------------ Генерація розв’язної позиції ------------
function generateSolvablePosition() {
  // 1) всі клітинки ON
  grid = Array.from({length: rows}, () => Array.from({length: cols}, () => true));

  // 2) випадкове "заплутування"
  const numMoves = randInt(5, 14);
  shuffleHistory = [];
  for (let i = 0; i < numMoves; i++) {
    const r = randInt(0, rows - 1);
    const c = randInt(0, cols - 1);
    toggleNeighbors(r, c);
    shuffleHistory.push(cellIndex(r, c));
  }

  // 3) Підказка — це обернений порядок заплутування
  solutionHint = [...shuffleHistory].reverse();
  hintIndex = 0; // скидаємо лічильник підказок

  // Оновити панель
  shuffleInfo.textContent = `Заплутано за ${numMoves} кроків`;
  renderHints();
}

function renderHints() {
  // залишок підказок, починаючи з поточного кроку
  const remaining = solutionHint.slice(hintIndex);
  if (remaining.length > 7) {
    hintLine1.textContent = remaining.slice(0, 7).join(' > ');
    hintLine2.textContent = remaining.slice(7).join(' > ');
  } else {
    hintLine1.textContent = remaining.join(' > ');
    hintLine2.textContent = '';
  }
}

// ------------ Рендер ------------
function drawOutlinedText(text, x, y) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function draw() {
  // фон поля
  ctx.fillStyle = '#dcdcdc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // клітинки
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '16px Verdana';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // фон клітинки
      const bg = grid[r][c] ? COLORS.on : COLORS.off;
      ctx.fillStyle = bg;
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);

      // рамка
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 2;
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);

      // номер клітинки з контрастним до фону кольором
      ctx.fillStyle = isDarkColor(bg) ? '#ffffff' : '#000000';
      const num = cellIndex(r, c);
      ctx.fillText(String(num), c * CELL + CELL / 2, r * CELL + CELL / 2);
    }
  }

  // повідомлення про перемогу під полем (по центру відносно поля)
  if (gameWon) {
    const msg = `Перемога! Час: ${winTime} с`;
    ctx.font = '20px Verdana';
    drawOutlinedText(msg, (cols * CELL) / 2, rows * CELL + 20);
  }
}

function updatePanel() {
  // кроки
  stepsInfo.textContent = `Кроки: ${stepCount}`;
  // час
  const sec = gameWon ? winTime : Math.floor((performance.now() - startTime) / 1000);
  timeInfo.textContent = `Час: ${sec} с`;

  draw();
}

// ------------ Взаємодія: Pointer Events ------------
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.style.touchAction = 'manipulation';

function canvasPosToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (y > rows * CELL) return null; // ігноруємо кліки під полем
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  return { r, c };
}

function handleTapEvent(e) {
  if (gameWon) return;
  const cell = canvasPosToCell(e.clientX, e.clientY);
  if (!cell) return;

  toggleNeighbors(cell.r, cell.c);
  stepCount++;

  if (allSameColor()) {
    gameWon = true;
    winTime = Math.floor((performance.now() - startTime) / 1000);
    stopTimer();
  }
  renderHints(); // при ручних кліках підказка показує залишок оригінальної послідовності
  updatePanel();
}

canvas.addEventListener('pointerdown', (e) => {
  // лише первинна кнопка (ліва миша) або дотик
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault(); // блокує синтетичний click після touch
  handleTapEvent(e);
});

// ------------ Кнопки у тулбарі (Pointer Events) ------------
toolbar.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  e.preventDefault();

  if (btn.id === 'btnRestart') {
    newGame(rows, cols);
    return;
  }

  if (btn.id === 'btnHint') {
    performHintStep();
    return;
  }

  if (btn.classList.contains('btnGrid')) {
    const r = parseInt(btn.dataset.rows, 10);
    const c = parseInt(btn.dataset.cols, 10);
    newGame(r, c);
    updateActiveGridButtons(r, c);
    return;
  }
});

function performHintStep() {
  if (gameWon) return;
  if (hintIndex >= solutionHint.length) return; // підказки закінчились

  const nextIdx = solutionHint[hintIndex]; // номер клітинки (1..N)
  const { r, c } = indexToRC(nextIdx);

  toggleNeighbors(r, c);
  stepCount++;
  hintIndex++;         // переходимо до наступного кроку підказки
  renderHints();

  if (allSameColor()) {
    gameWon = true;
    winTime = Math.floor((performance.now() - startTime) / 1000);
    stopTimer();
  }
  updatePanel();
}

function updateActiveGridButtons(r, c) {
  document.querySelectorAll('.btnGrid').forEach(b => b.classList.remove('active'));
  const sel = `.btnGrid[data-rows="${r}"][data-cols="${c}"]`;
  const active = document.querySelector(sel);
  if (active) active.classList.add('active');
}

// ------------ Клавіші (залишаємо теж) ------------
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    newGame(rows, cols);
  } else if (e.key === '1') {
    newGame(3, 4); updateActiveGridButtons(3,4);
  } else if (e.key === '2') {
    newGame(4, 4); updateActiveGridButtons(4,4);
  } else if (e.key === '3') {
    newGame(5, 5); updateActiveGridButtons(5,5);
  } else if (e.key === 'h' || e.key === 'H') {
    performHintStep();
  }
});

// ------------ Життєвий цикл ------------
function newGame(r, c) {
  rows = r; cols = c;
  resizeCanvas();
  generateSolvablePosition();
  stepCount = 0;
  gameWon = false;
  winTime = 0;
  startTimer();
  updatePanel();
}

// ініціалізація кольорів + обробники пікерів/кнопок тем
loadColors();
if (inputColorOn) {
  inputColorOn.addEventListener('input', (e) => {
    COLORS.on = e.target.value;
    saveColors();
    draw();
  });
}
if (inputColorOff) {
  inputColorOff.addEventListener('input', (e) => {
    COLORS.off = e.target.value;
    saveColors();
    draw();
  });
}
if (btnColorsReset) {
  btnColorsReset.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    resetColorsToDefault();
  });
}
if (btnRandomTheme) {
  btnRandomTheme.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    generateRandomTheme();
  });
}

// старт
newGame(rows, cols);
updateActiveGridButtons(rows, cols);
