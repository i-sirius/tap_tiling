
// ------------ Константи/стан ------------
const CELL = 100;
const BOTTOM_PAD = 60;
let rows = 3, cols = 4;

const DEFAULT_ON  = '#40e0d0'; // бірюзовий
const DEFAULT_OFF = '#ffffff'; // білий
const COLORS = { on: DEFAULT_ON, off: DEFAULT_OFF, grid:'#000' };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const shuffleInfo = document.getElementById('shuffleInfo');
const stepsInfo   = document.getElementById('stepsInfo');
const timeInfo    = document.getElementById('timeInfo');
const hintLine1   = document.getElementById('hintLine1');
const hintLine2   = document.getElementById('hintLine2');

const toolbar     = document.getElementById('toolbar');

const inputColorOn   = document.getElementById('colorOn');
const inputColorOff  = document.getElementById('colorOff');
const btnColorsReset = document.getElementById('btnColorsReset');
const btnRandomTheme = document.getElementById('btnRandomTheme');

let grid = [];
let stepCount = 0;
let startTime = 0;
let timerId = null;
let gameWon = false;
let winTime = 0;

let shuffleHistory = [];
let solutionHint = [];
let hintIndex = 0;

// ------------ Утиліти ------------
function resizeCanvas() {
  canvas.width  = cols * CELL;
  canvas.height = rows * CELL + BOTTOM_PAD;
}
function cellIndex(r, c) { return r * cols + c + 1; }
function indexToRC(idx1) { const z = idx1 - 1; return { r: Math.floor(z/cols), c: z % cols }; }
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

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
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) if (grid[r][c]!==first) return false;
  return true;
}

// ------------ Таймер ------------
function startTimer(){ stopTimer(); startTime = performance.now(); timerId = setInterval(updatePanel, 200); }
function stopTimer(){ if (timerId) { clearInterval(timerId); timerId = null; } }

// ------------ Збереження кольорів ------------
function saveColors(){ localStorage.setItem('colorOn', COLORS.on); localStorage.setItem('colorOff', COLORS.off); }
function loadColors(){
  const on = localStorage.getItem('colorOn'); const off = localStorage.getItem('colorOff');
  if (on) COLORS.on = on; if (off) COLORS.off = off;
  if (inputColorOn)  inputColorOn.value  = COLORS.on;
  if (inputColorOff) inputColorOff.value = COLORS.off;
}

// ------------ Контраст для цифр ------------
function hexToRgb(hex){ const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); if(!m) return {r:0,g:0,b:0}; return {r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}; }
function isDarkColor(hex){ const {r,g,b}=hexToRgb(hex); const yiq=(r*299+g*587+b*114)/1000; return yiq<128; }

// ------------ Теми ------------
function applyTheme(on, off, persist=false){
  COLORS.on=on; COLORS.off=off;
  if (inputColorOn) inputColorOn.value=on;
  if (inputColorOff) inputColorOff.value=off;
  if (persist) saveColors();
  draw();
}
function resetColorsToDefault(){ applyTheme(DEFAULT_ON, DEFAULT_OFF, true); }
function randomPastelOrVivid(){
  const h=Math.floor(Math.random()*360), s=Math.floor(60+Math.random()*30), l=Math.floor(45+Math.random()*15);
  function hslToRgb(h,s,l){ s/=100; l/=100; const k=n=>(n+h/30)%12; const a=s*Math.min(l,1-l);
    const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
    return [Math.round(255*f(0)),Math.round(255*f(8)),Math.round(255*f(4))];}
  const [r,g,b]=hslToRgb(h,s,l), toHex=v=>v.toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function generateRandomTheme(){
  const on=randomPastelOrVivid(); let off='#ffffff';
  if (!isDarkColor(on)) off='#111111';
  const a=hexToRgb(on), b=hexToRgb(off);
  const dist=Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b);
  if (dist<120) off=isDarkColor(on)?'#ffffff':'#111111';
  applyTheme(on, off, false);
}

// ------------ Генерація позиції ------------
function generateSolvablePosition(){
  grid=Array.from({length:rows},()=>Array.from({length:cols},()=>true));
  const numMoves=randInt(5,14);
  shuffleHistory=[];
  for (let i=0;i<numMoves;i++){
    const r=randInt(0,rows-1), c=randInt(0,cols-1);
    toggleNeighbors(r,c);
    shuffleHistory.push(cellIndex(r,c));
  }
  solutionHint=[...shuffleHistory].reverse();
  hintIndex=0;
  shuffleInfo.textContent=`Заплутано за ${numMoves} кроків`;
  renderHints();
}
function renderHints(){
  const remaining=solutionHint.slice(hintIndex);
  if (remaining.length>7){
    hintLine1.textContent=remaining.slice(0,7).join(' > ');
    hintLine2.textContent=remaining.slice(7).join(' > ');
  }else{
    hintLine1.textContent=remaining.join(' > ');
    hintLine2.textContent='';
  }
}

// ------------ Рендер ------------
function drawOutlinedText(text, x, y){
  ctx.save();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#fff'; ctx.strokeStyle='#000'; ctx.lineWidth=4;
  ctx.strokeText(text,x,y); ctx.fillText(text,x,y);
  ctx.restore();
}
function draw(){
  ctx.fillStyle='#dcdcdc'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='16px Verdana';

  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      const bg = grid[r][c] ? COLORS.on : COLORS.off;
      ctx.fillStyle = bg;
      ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 2; ctx.strokeRect(c*CELL, r*CELL, CELL, CELL);
      ctx.fillStyle = isDarkColor(bg) ? '#ffffff' : '#000000';
      ctx.fillText(String(cellIndex(r,c)), c*CELL+CELL/2, r*CELL+CELL/2);
    }
  }

  if (gameWon){
    const msg=`Перемога! Час: ${winTime} с`;
    ctx.font='20px Verdana';
    drawOutlinedText(msg, (cols*CELL)/2, rows*CELL+20);
  }
}

// ------------ Панель ------------
function updatePanel(){
  stepsInfo.textContent=`Кроки: ${stepCount}`;
  const sec = gameWon ? winTime : Math.floor((performance.now()-startTime)/1000);
  timeInfo.textContent=`Час: ${sec} с`;
  draw();
}

// ------------ Pointer Events ------------
canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.style.touchAction='manipulation';

function canvasPosToCell(clientX, clientY){
  const rect=canvas.getBoundingClientRect();
  const x=clientX-rect.left, y=clientY-rect.top;
  if (y>rows*CELL) return null;
  const c=Math.floor(x/CELL), r=Math.floor(y/CELL);
  if (r<0||r>=rows||c<0||c>=cols) return null;
  return {r,c};
}
function handleTap(e){
  if (gameWon) return;
  const cell=canvasPosToCell(e.clientX,e.clientY); if(!cell) return;
  toggleNeighbors(cell.r,cell.c);
  stepCount++;
  if (allSameColor()){ gameWon=true; winTime=Math.floor((performance.now()-startTime)/1000); stopTimer(); }
  renderHints();
  updatePanel();
}
canvas.addEventListener('pointerdown', e=>{
  if (e.pointerType==='mouse' && e.button!==0) return;
  e.preventDefault(); handleTap(e);
});

// ------------ Toolbar ------------
toolbar.addEventListener('pointerdown', e=>{
  const btn=e.target.closest('button'); if(!btn) return; e.preventDefault();
  if (btn.id==='btnRestart'){ newGame(rows, cols); return; }
  if (btn.id==='btnHint'){ performHintStep(); return; }
  if (btn.classList.contains('btnGrid')){
    const r=parseInt(btn.dataset.rows,10), c=parseInt(btn.dataset.cols,10);
    newGame(r,c); updateActiveGridButtons(r,c); return;
  }
});
function performHintStep(){
  if (gameWon) return;
  if (hintIndex>=solutionHint.length) return;
  const nextIdx=solutionHint[hintIndex], {r,c}=indexToRC(nextIdx);
  toggleNeighbors(r,c); stepCount++; hintIndex++; renderHints();
  if (allSameColor()){ gameWon=true; winTime=Math.floor((performance.now()-startTime)/1000); stopTimer(); }
  updatePanel();
}
function updateActiveGridButtons(r,c){
  document.querySelectorAll('.btnGrid').forEach(b=>b.classList.remove('active'));
  const active=document.querySelector(`.btnGrid[data-rows="${r}"][data-cols="${c}"]`);
  if (active) active.classList.add('active');
}

// ------------ Клавіатура ------------
window.addEventListener('keydown', (e)=>{
  if (e.key==='r'||e.key==='R'){ newGame(rows,cols); }
  else if (e.key==='1'){ newGame(3,4); updateActiveGridButtons(3,4); }
  else if (e.key==='2'){ newGame(4,4); updateActiveGridButtons(4,4); }
  else if (e.key==='3'){ newGame(5,5); updateActiveGridButtons(5,5); }
  else if (e.key==='h'||e.key==='H'){ performHintStep(); }
});

// ------------ iOS Install hint ------------
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}
window.addEventListener('load', () => {
  const el = document.getElementById('iosInstallHint');
  if (el && !isStandalone()) el.hidden = false;
});

// ------------ Старт гри ------------
function newGame(r,c){
  rows=r; cols=c; resizeCanvas(); generateSolvablePosition();
  stepCount=0; gameWon=false; winTime=0; startTimer(); updatePanel();
}

// ініціалізація кольорів з localStorage
loadColors();
// обробники пікерів
if (inputColorOn) inputColorOn.addEventListener('input', e=>{ COLORS.on=e.target.value; saveColors(); draw(); });
if (inputColorOff) inputColorOff.addEventListener('input', e=>{ COLORS.off=e.target.value; saveColors(); draw(); });
// кнопки кольорів
if (btnColorsReset) btnColorsReset.addEventListener('pointerdown', e=>{ e.preventDefault(); resetColorsToDefault(); });
if (btnRandomTheme) btnRandomTheme.addEventListener('pointerdown', e=>{ e.preventDefault(); generateRandomTheme(); });

// старт
newGame(rows, cols);
updateActiveGridButtons(rows, cols);
