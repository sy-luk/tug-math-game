const els = {
  board: document.getElementById('board'),
  btnMode: document.getElementById('btnMode'),
  difficulty: document.getElementById('difficulty'),
  cpuSpeed: document.getElementById('cpuSpeed'),
  btnFullscreen: document.getElementById('btnFullscreen'),
  btnReset: document.getElementById('btnReset'),

  question: document.getElementById('question'),
  status: document.getElementById('status'),
  overlay: document.getElementById('winnerOverlay'),
  winnerText: document.getElementById('winnerText'),
  btnPlayAgain: document.getElementById('btnPlayAgain'),

  boardTug: document.getElementById('boardTug'),
  boardEggs: document.getElementById('boardEggs'),
  rope: document.getElementById('rope'),
  ropePos: document.getElementById('ropePos'),

  hpA: document.getElementById('hpA'),
  hpB: document.getElementById('hpB'),
  eggField: document.querySelector('.eggField'),
  avatarA: document.getElementById('avatarA'),
  avatarB: document.getElementById('avatarB'),

  displayA: document.getElementById('displayA'),
  displayB: document.getElementById('displayB'),
  keypadA: document.getElementById('keypadA'),
  keypadB: document.getElementById('keypadB'),
  teamB: document.getElementById('teamB'),
  teamBTitle: document.getElementById('teamBTitle'),
  comboA: document.getElementById('comboA'),
  comboB: document.getElementById('comboB'),
};

const state = {
  mode: 'teams',   // 'teams' | 'cpu'
  game: 'tug',     // 'tug' | 'eggs'

  question: null,
  inputA: '',
  inputB: '',
  comboA: 0,
  comboB: 0,
  locked: false,
  ended: false,

  aiTimer: null,

  ropePos: 0, // tug
  hpA: 5, hpB: 5, // eggs
};

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function setStatus(msg, kind='muted'){
  els.status.textContent = msg;
  els.status.style.color =
    kind === 'good' ? 'var(--good)' :
    kind === 'bad'  ? 'var(--bad)'  :
    kind === 'warn' ? 'var(--warn)' :
    'var(--muted)';
}

/* viewport sizing (Samsung-safe) */
function setViewportVars(){
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');

  const tb = document.querySelector('.topbar');
  const tbH = tb ? Math.ceil(tb.getBoundingClientRect().height) : 60;
  document.documentElement.style.setProperty('--topbar-h', tbH + 'px');
}

/* questions */
function difficulty(){
  return parseInt(els.difficulty.value, 10);
}
function genQuestion(diff){
  const rnd = (min,max)=>Math.floor(Math.random()*(max-min+1))+min;

  if(diff === 1){
    const a=rnd(0,10), b=rnd(0,10);
    return { text:`${a} + ${b}`, answer:a+b };
  }
  if(diff === 2){
    const op = Math.random()<0.6?'+':'-';
    let a=rnd(5,30), b=rnd(0,20);
    if(op==='-' && b>a) [a,b]=[b,a];
    return { text:`${a} ${op} ${b}`, answer: op==='+'?a+b:a-b };
  }
  if(diff === 3){
    const op = Math.random()<0.55?'+':'-';
    let a=rnd(10,90), b=rnd(0,50);
    if(op==='-' && b>a) [a,b]=[b,a];
    return { text:`${a} ${op} ${b}`, answer: op==='+'?a+b:a-b };
  }
  if(diff === 4){
    if(Math.random()<0.55){
      const a=rnd(2,9), b=rnd(2,9);
      return { text:`${a} × ${b}`, answer:a*b };
    } else {
      const op=Math.random()<0.5?'+':'-';
      let a=rnd(20,150), b=rnd(0,80);
      if(op==='-' && b>a) [a,b]=[b,a];
      return { text:`${a} ${op} ${b}`, answer: op==='+'?a+b:a-b };
    }
  }
  const roll = Math.random();
  if(roll < 0.45){
    const a=rnd(3,12), b=rnd(3,12);
    return { text:`${a} × ${b}`, answer:a*b };
  } else if(roll < 0.8){
    const op=Math.random()<0.5?'+':'-';
    let a=rnd(50,200), b=rnd(10,120);
    if(op==='-' && b>a) [a,b]=[b,a];
    return { text:`${a} ${op} ${b}`, answer: op==='+'?a+b:a-b };
  } else {
    const a=rnd(10,60), b=rnd(10,60), c=rnd(5,50);
    return { text:`(${a} + ${b}) - ${c}`, answer:(a+b)-c };
  }
}

/* CPU speed */
function getCpuProfile() {
  const map = {
    very_slow: { min: 5200, max: 13000, correct: 0.75 },
    slow:      { min: 4200, max: 10000, correct: 0.78 },
    normal:    { min: 3200, max:  7800, correct: 0.80 },
    fast:      { min: 2400, max:  6000, correct: 0.82 },
  };
  return map[els.cpuSpeed?.value || 'slow'] || map.slow;
}
function scaleByDifficulty(diff, prof) {
  const timeFactor = [1.00, 1.05, 1.10, 1.18, 1.26, 1.35][diff] || 1.18;
  const correctBonus = [0, 0.00, 0.01, 0.02, 0.03, 0.04][diff] || 0.02;

  return {
    min: Math.round(prof.min * timeFactor),
    max: Math.round(prof.max * timeFactor),
    correct: Math.min(0.90, prof.correct + correctBonus),
  };
}

function clearAI(){
  if(state.aiTimer){
    clearTimeout(state.aiTimer);
    state.aiTimer = null;
  }
}
function scheduleAI(){
  clearAI();
  if(state.mode !== 'cpu' || state.ended) return;

  const diff = difficulty();
  const prof = scaleByDifficulty(diff, getCpuProfile());
  const delay = Math.floor(Math.random()*(prof.max - prof.min + 1)) + prof.min;

  state.inputB = '';
  renderTeamDisplays();
  setStatus('🤖 Komputer myśli…', 'warn');

  state.aiTimer = setTimeout(() => {
    state.aiTimer = null;
    if(state.ended || state.locked) return;

    const correct = Math.random() < prof.correct;
    let ans = state.question.answer;

    if(!correct){
      const delta = (Math.floor(Math.random()*3)+1) * (Math.random()<0.5?1:-1);
      ans = ans + delta;
    }

    state.inputB = String(ans);
    renderTeamDisplays();
    submit('B', true);
  }, delay);
}

/* render */
function renderTeamDisplays(){
  els.displayA.textContent = state.inputA || '—';
  els.displayB.textContent = state.inputB || '—';
  els.comboA.textContent = String(state.comboA);
  els.comboB.textContent = String(state.comboB);
}
function renderTug(){
  els.ropePos.textContent = String(Math.round(state.ropePos));
  const offsetPct = (state.ropePos / 100) * 40;
  els.rope.style.left = `calc(50% + ${offsetPct}%)`;
}
function hearts(n){ return '❤️'.repeat(Math.max(0,n)); }
function renderEggs(){
  els.hpA.textContent = hearts(state.hpA);
  els.hpB.textContent = hearts(state.hpB);
  els.avatarA.textContent = state.hpA <= 2 ? '😵' : '🙂';
  els.avatarB.textContent = state.hpB <= 2 ? '😵' : '🙂';
}
function render(){
  els.question.textContent = state.question ? state.question.text : '—';
  renderTeamDisplays();
  if(state.game === 'tug') renderTug();
  if(state.game === 'eggs') renderEggs();
}

/* switching */
function applyGameUI(){
  state.game = els.board.value;
  if(state.game === 'tug'){
    els.boardTug.classList.remove('hidden');
    els.boardEggs.classList.add('hidden');
  } else {
    els.boardTug.classList.add('hidden');
    els.boardEggs.classList.remove('hidden');
  }
}

/* flow */
function nextQuestion(){
  state.question = genQuestion(difficulty());
  state.inputA = '';
  state.inputB = '';
  state.locked = false;

  setStatus('Wpisz wynik i kliknij OK.');
  render();
  scheduleAI();
}

function endGame(winner){
  state.ended = true;
  clearAI();
  els.overlay.classList.remove('hidden');
  els.overlay.setAttribute('aria-hidden','false');
  els.winnerText.textContent = `Wygrywa ${winner}! 🎉`;
}

function tugOnCorrect(team){
  const step = 10;
  state.ropePos += (team === 'A') ? -step : step;
  state.ropePos = clamp(state.ropePos, -100, 100);
  renderTug();

  if(state.ropePos <= -100) endGame('Drużyna A');
  if(state.ropePos >= 100) endGame(state.mode === 'cpu' ? 'Komputer (Drużyna B)' : 'Drużyna B');
}

function throwEgg(fromTeam){
  const field = els.eggField;
  const rect = field.getBoundingClientRect();

  const startX = fromTeam === 'A' ? 70 : rect.width - 70;
  const endX   = fromTeam === 'A' ? rect.width - 70 : 70;

  const startY = rect.height * 0.50;
  const endY   = rect.height * 0.50;

  const egg = document.createElement('div');
  egg.className = 'egg';
  egg.textContent = '🥚';
  egg.style.left = `${startX}px`;
  egg.style.top  = `${startY}px`;
  field.appendChild(egg);

  const anim = egg.animate([
    { transform: 'translate(-50%,-50%) scale(1)', left: `${startX}px`, top: `${startY}px`, opacity: 1 },
    { transform: 'translate(-50%,-50%) scale(1.1)', left: `${(startX+endX)/2}px`, top: `${startY - rect.height*0.25}px`, opacity: 1 },
    { transform: 'translate(-50%,-50%) scale(1)', left: `${endX}px`, top: `${endY}px`, opacity: 1 },
  ], { duration: 650, easing: 'ease-in-out' });

  anim.onfinish = () => {
    egg.remove();

    const splash = document.createElement('div');
    splash.className = 'splash';
    splash.textContent = '💥';
    splash.style.left = `${endX}px`;
    splash.style.top  = `${endY}px`;
    field.appendChild(splash);

    splash.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.8)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.2)' },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' },
    ], { duration: 420, easing: 'ease-out' }).onfinish = () => splash.remove();
  };
}

function eggsOnCorrect(team){
  if(team === 'A'){
    throwEgg('A');
    state.hpB = clamp(state.hpB - 1, 0, 5);
  } else {
    throwEgg('B');
    state.hpA = clamp(state.hpA - 1, 0, 5);
  }
  renderEggs();

  if(state.hpA <= 0) endGame(state.mode === 'cpu' ? 'Komputer (Drużyna B)' : 'Drużyna B');
  if(state.hpB <= 0) endGame('Drużyna A');
}

function submit(team, fromCpu=false){
  if(state.ended || state.locked) return;
  if(state.mode === 'cpu' && team === 'A') clearAI();

  const value = Number(team === 'A' ? state.inputA : state.inputB);
  if(!Number.isFinite(value)){
    if(!fromCpu) setStatus('To nie jest liczba.', 'bad');
    return;
  }

  state.locked = true;
  const correct = value === state.question.answer;

  if(correct){
    if(team === 'A'){ state.comboA += 1; state.comboB = 0; }
    else { state.comboB += 1; state.comboA = 0; }

    setStatus(fromCpu ? '🤖 CPU: poprawnie!' : '✅ Dobrze!', 'good');

    if(state.game === 'tug') tugOnCorrect(team);
    if(state.game === 'eggs') eggsOnCorrect(team);
  } else {
    if(team === 'A') state.comboA = 0;
    else state.comboB = 0;

    setStatus(fromCpu ? '🤖 CPU: źle!' : `❌ Źle. Poprawne: ${state.question.answer}`, 'bad');
    renderTeamDisplays();
  }

  setTimeout(() => {
    state.locked = false;
    if(!state.ended) nextQuestion();
  }, correct ? 450 : 650);
}

function resetGame(){
  clearAI();
  state.ended = false;
  state.locked = false;

  state.inputA = '';
  state.inputB = '';
  state.comboA = 0;
  state.comboB = 0;

  state.ropePos = 0;
  state.hpA = 5;
  state.hpB = 5;

  els.overlay.classList.add('hidden');
  els.overlay.setAttribute('aria-hidden','true');

  applyGameUI();
  nextQuestion();
  render();
}

function applyModeUI(){
  if(state.mode === 'cpu'){
    els.btnMode.textContent = 'Tryb: vs CPU';
    els.teamB.classList.add('disabled');
    els.teamBTitle.textContent = 'Komputer 🤖';
    setStatus('Tryb CPU: grasz przeciw komputerowi.', 'warn');
  } else {
    els.btnMode.textContent = 'Tryb: 2 drużyny';
    els.teamB.classList.remove('disabled');
    els.teamBTitle.textContent = 'Drużyna B';
    setStatus('Tryb 2 drużyny: obie strony odpowiadają.', 'muted');
  }
  render();
  scheduleAI();
}

/* keypad */
function buildKeypad(container, team){
  const keys = ['1','2','3','4','5','6','7','8','9','⌫','0','OK'];
  container.innerHTML = '';

  keys.forEach(k => {
    const b = document.createElement('button');
    b.className = 'key';
    b.type = 'button';
    b.textContent = k;
    if(k === 'OK') b.classList.add('ok');
    if(k === '⌫') b.classList.add('back');

    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if(state.ended || state.locked) return;
      if(state.mode === 'cpu' && team === 'B') return;

      if(k === '⌫'){
        if(team === 'A') state.inputA = state.inputA.slice(0,-1);
        else state.inputB = state.inputB.slice(0,-1);
      } else if(k === 'OK'){
        submit(team, false);
        return;
      } else {
        if(team === 'A' && state.inputA.length < 4) state.inputA += k;
        if(team === 'B' && state.inputB.length < 4) state.inputB += k;
      }
      renderTeamDisplays();
    });

    container.appendChild(b);
  });
}

/* fullscreen */
async function toggleFullscreen(){
  try{
    if(!document.fullscreenElement){
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    // ignore
  } finally {
    setTimeout(setViewportVars, 50);
  }
}

/* wire */
buildKeypad(els.keypadA, 'A');
buildKeypad(els.keypadB, 'B');

els.btnReset.addEventListener('pointerdown', (e)=>{ e.preventDefault(); resetGame(); });
els.btnPlayAgain.addEventListener('pointerdown', (e)=>{ e.preventDefault(); resetGame(); });

els.btnFullscreen.addEventListener('pointerdown', (e)=>{ e.preventDefault(); toggleFullscreen(); });

els.btnMode.addEventListener('pointerdown', (e)=>{
  e.preventDefault();
  state.mode = (state.mode === 'cpu') ? 'teams' : 'cpu';
  applyModeUI();
  resetGame();
});

els.difficulty.addEventListener('change', ()=> resetGame());
els.cpuSpeed.addEventListener('change', ()=> scheduleAI());
els.board.addEventListener('change', ()=> resetGame());

document.addEventListener('fullscreenchange', ()=> setTimeout(setViewportVars, 50));
window.addEventListener('resize', setViewportVars);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', setViewportVars);
  window.visualViewport.addEventListener('scroll', setViewportVars);
}

/* start */
setViewportVars();
applyGameUI();
applyModeUI();
resetGame();