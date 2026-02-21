const els = {
  question: document.getElementById('question'),
  status: document.getElementById('status'),
  rope: document.getElementById('rope'),
  ropePos: document.getElementById('ropePos'),

  difficulty: document.getElementById('difficulty'),
  cpuSpeed: document.getElementById('cpuSpeed'),

  displayA: document.getElementById('displayA'),
  displayB: document.getElementById('displayB'),
  keypadA: document.getElementById('keypadA'),
  keypadB: document.getElementById('keypadB'),

  comboA: document.getElementById('comboA'),
  comboB: document.getElementById('comboB'),

  btnReset: document.getElementById('btnReset'),
  btnFullscreen: document.getElementById('btnFullscreen'),
  btnMode: document.getElementById('btnMode'),

  teamB: document.getElementById('teamB'),
  teamBTitle: document.getElementById('teamBTitle'),

  overlay: document.getElementById('winnerOverlay'),
  winnerText: document.getElementById('winnerText'),
  btnPlayAgain: document.getElementById('btnPlayAgain'),
};

const state = {
  mode: 'teams', // 'teams' | 'cpu'
  ropePos: 0,    // -100..+100
  question: null,
  inputA: '',
  inputB: '',
  comboA: 0,
  comboB: 0,
  locked: false,
  ended: false,
  aiTimer: null,
};

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function setStatus(msg){
  els.status.textContent = msg;
}

/* ---------- Fullscreen / viewport sizing (Samsung-safe) ---------- */
function setViewportVars(){
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');

  const tb = document.querySelector('.topbar');
  const tbH = tb ? Math.ceil(tb.getBoundingClientRect().height) : 60;
  document.documentElement.style.setProperty('--topbar-h', tbH + 'px');
}

function difficulty(){
  return parseInt(els.difficulty.value, 10);
}

/* ---------- Question generator ---------- */
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
  // diff 5
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

/* ---------- CPU speed profiles ---------- */
function getCpuProfile() {
  // bazowe czasy w ms (przed skalowaniem trudnością)
  // "slow" jest default
  const map = {
    very_slow: { min: 2500, max: 6500, correct: 0.76 },
    slow:      { min: 2000, max: 5200, correct: 0.78 },
    normal:    { min: 1400, max: 3800, correct: 0.80 },
    fast:      { min: 900,  max: 2600, correct: 0.82 },
  };
  return map[els.cpuSpeed?.value || 'slow'] || map.slow;
}

function scaleByDifficulty(diff, baseMin, baseMax, baseCorrect) {
  // Im trudniej, tym trochę wolniej + minimalnie lepsza dokładność (ale nie perfekcyjna)
  const timeFactor = [1.00, 1.00, 1.05, 1.10, 1.15, 1.20][diff] || 1.10;
  const correctBonus = [0, 0.00, 0.01, 0.02, 0.03, 0.04][diff] || 0.02;

  return {
    min: Math.round(baseMin * timeFactor),
    max: Math.round(baseMax * timeFactor),
    correct: Math.min(0.92, baseCorrect + correctBonus),
  };
}

/* ---------- AI scheduling ---------- */
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
  const prof = getCpuProfile();
  const scaled = scaleByDifficulty(diff, prof.min, prof.max, prof.correct);

  const delay = Math.floor(Math.random()*(scaled.max - scaled.min + 1)) + scaled.min;

  state.aiTimer = setTimeout(() => {
    state.aiTimer = null;
    if(state.ended || state.locked) return;

    const correct = Math.random() < scaled.correct;
    let ans = state.question.answer;

    if(!correct){
      const delta = (Math.floor(Math.random()*3)+1) * (Math.random()<0.5?1:-1);
      ans = ans + delta;
    }

    state.inputB = String(ans);
    render();

    submit('B', true); // CPU presses OK
  }, delay);
}

/* ---------- UI / game flow ---------- */
function render(){
  els.question.textContent = state.question ? state.question.text : '—';
  els.displayA.textContent = state.inputA || '—';
  els.displayB.textContent = state.inputB || '—';
  els.comboA.textContent = String(state.comboA);
  els.comboB.textContent = String(state.comboB);

  els.ropePos.textContent = String(Math.round(state.ropePos));

  const offsetPct = (state.ropePos / 100) * 36;
  els.rope.style.left = `calc(50% + ${offsetPct}%)`;
}

function nextQuestion(){
  state.question = genQuestion(difficulty());
  state.inputA = '';
  state.inputB = '';
  state.locked = false;
  setStatus('Wpisz wynik i kliknij OK.');
  render();
  scheduleAI();
}

function move(team, step){
  state.ropePos += (team === 'A') ? -step : step;
  state.ropePos = clamp(state.ropePos, -100, 100);
  render();

  if(state.ropePos <= -100) endGame('Drużyna A');
  if(state.ropePos >= 100) endGame(state.mode === 'cpu' ? 'Komputer (Drużyna B)' : 'Drużyna B');
}

function submit(team, fromCpu=false){
  if(state.ended || state.locked) return;

  // Jeśli A odpowie w CPU mode, anuluj bieżące "myślenie" CPU dla tego pytania
  if(state.mode === 'cpu' && team === 'A') clearAI();

  const value = Number(team === 'A' ? state.inputA : state.inputB);
  if(!Number.isFinite(value)){
    if(!fromCpu) setStatus('To nie jest liczba.');
    return;
  }

  state.locked = true;

  const correct = value === state.question.answer;
  const step = correct ? 10 : 0;

  if(correct){
    if(team === 'A'){ state.comboA += 1; state.comboB = 0; }
    else { state.comboB += 1; state.comboA = 0; }

    setStatus(fromCpu ? '🤖 CPU: poprawnie!' : '✅ Dobrze!');
    move(team, step);
  } else {
    if(team === 'A') state.comboA = 0;
    else state.comboB = 0;

    setStatus(fromCpu ? '🤖 CPU: źle!' : `❌ Źle. Poprawne: ${state.question.answer}`);
    render();
  }

  setTimeout(() => {
    state.locked = false;
    if(!state.ended) nextQuestion();
  }, correct ? 350 : 550);
}

function endGame(winner){
  state.ended = true;
  clearAI();
  els.overlay.classList.remove('hidden');
  els.overlay.setAttribute('aria-hidden','false');
  els.winnerText.textContent = `Wygrywa ${winner}! 🎉`;
}

function resetGame(){
  clearAI();
  state.ended = false;
  state.locked = false;
  state.ropePos = 0;
  state.comboA = 0;
  state.comboB = 0;
  state.inputA = '';
  state.inputB = '';
  els.overlay.classList.add('hidden');
  els.overlay.setAttribute('aria-hidden','true');
  nextQuestion();
}

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
      render();
    });

    container.appendChild(b);
  });
}

function applyModeUI(){
  if(state.mode === 'cpu'){
    els.btnMode.textContent = 'Tryb: vs CPU';
    els.teamB.classList.add('disabled');
    els.teamBTitle.textContent = 'Komputer 🤖';
    setStatus('Tryb CPU: grasz przeciw komputerowi.');
  } else {
    els.btnMode.textContent = 'Tryb: 2 drużyny';
    els.teamB.classList.remove('disabled');
    els.teamBTitle.textContent = 'Drużyna B';
    setStatus('Tryb 2 drużyny: obie strony odpowiadają.');
  }
  render();
  scheduleAI();
}

async function toggleFullscreen(){
  try{
    if(!document.fullscreenElement){
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    // przeglądarka może blokować
  } finally {
    setTimeout(setViewportVars, 50);
  }
}

/* Wire-up */
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

// ZMIANA: przy zmianie CPU speed od razu wpływa na następne pytanie (i reschedule)
els.cpuSpeed.addEventListener('change', () => {
  // tylko ma sens w CPU mode, ale można zmieniać zawsze
  scheduleAI();
});

document.addEventListener('fullscreenchange', ()=> setTimeout(setViewportVars, 50));
window.addEventListener('resize', setViewportVars);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', setViewportVars);
  window.visualViewport.addEventListener('scroll', setViewportVars);
}

/* Start */
setViewportVars();
state.mode = 'teams';
applyModeUI();
resetGame();