// ============================
// Tug-of-War Math Game (MVP)
// + Mobile fullscreen scaling fix (vh via visualViewport)
// + Mode: Teams OR vs CPU (computer as Team B)
// ============================

const els = {
  displayA: document.getElementById('displayA'),
  displayB: document.getElementById('displayB'),
  keypadA: document.getElementById('keypadA'),
  keypadB: document.getElementById('keypadB'),
  teamB: document.getElementById('teamB'),
  cpuBadge: document.getElementById('cpuBadge'),

  questionText: document.getElementById('questionText'),
  timeLeft: document.getElementById('timeLeft'),
  rope: document.getElementById('rope'),
  ropePos: document.getElementById('ropePos'),
  status: document.getElementById('status'),

  difficulty: document.getElementById('difficulty'),
  gameMode: document.getElementById('gameMode'),

  btnNext: document.getElementById('btnNext'),
  btnReset: document.getElementById('btnReset'),
  btnFullscreen: document.getElementById('btnFullscreen'),

  overlay: document.getElementById('winnerOverlay'),
  winnerText: document.getElementById('winnerText'),
  btnPlayAgain: document.getElementById('btnPlayAgain'),

  comboA: document.getElementById('comboA'),
  comboB: document.getElementById('comboB'),
  lastMoveA: document.getElementById('lastMoveA'),
  lastMoveB: document.getElementById('lastMoveB'),
};

const state = {
  ropePos: 0,        // -100 ... +100
  question: null,    // { text, answer }
  inputA: '',
  inputB: '',
  comboA: 0,
  comboB: 0,
  roundSeconds: 10.0,
  timeLeft: 10.0,
  timerId: null,
  locked: false,
  ended: false,

  mode: 'teams',     // 'teams' | 'cpu'
  aiTimeoutId: null,
  aiThinking: false,
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function setStatus(msg, kind = 'muted') {
  els.status.textContent = msg;
  els.status.style.color =
    kind === 'good' ? 'var(--good)' :
    kind === 'bad'  ? 'var(--bad)'  :
    kind === 'warn' ? 'var(--warn)' :
    'var(--muted)';
}

function render() {
  els.displayA.textContent = state.inputA || '—';
  els.displayB.textContent = state.inputB || (state.mode === 'cpu' ? (state.aiThinking ? '…' : '—') : '—');

  els.ropePos.textContent = Math.round(state.ropePos).toString();
  els.comboA.textContent = state.comboA.toString();
  els.comboB.textContent = state.comboB.toString();

  // ropePos -100..+100 -> offset -36%..+36%
  const offsetPct = (state.ropePos / 100) * 36;
  els.rope.style.left = `calc(50% + ${offsetPct}%)`;

  els.timeLeft.textContent = state.timeLeft.toFixed(1);
}

function buildKeypad(container, team) {
  const keys = [
    '1','2','3',
    '4','5','6',
    '7','8','9',
    '⌫','0','OK',
  ];

  container.innerHTML = '';
  for (const k of keys) {
    const btn = document.createElement('button');
    btn.className = 'key';
    btn.type = 'button';
    btn.textContent = k;

    if (k === 'OK') btn.classList.add('ok');
    if (k === '⌫') btn.classList.add('back');

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onKey(team, k);
    });

    container.appendChild(btn);
  }
}

function onKey(team, key) {
  if (state.ended) return;
  if (state.locked) return;

  // If CPU mode, block B input
  if (state.mode === 'cpu' && team === 'B') return;

  const isA = team === 'A';
  let buf = isA ? state.inputA : state.inputB;

  if (key === '⌫') {
    buf = buf.slice(0, -1);
  } else if (key === 'OK') {
    submit(team);
    return;
  } else {
    if (buf.length < 4) buf += key;
  }

  if (isA) state.inputA = buf;
  else state.inputB = buf;

  render();
}

function startTimer() {
  stopTimer();
  state.timeLeft = state.roundSeconds;

  state.timerId = setInterval(() => {
    if (state.ended) return;

    state.timeLeft = Math.max(0, state.timeLeft - 0.1);
    render();

    if (state.timeLeft <= 0.0001) {
      setStatus('Czas minął! Nowe pytanie.', 'warn');
      state.inputA = '';
      state.inputB = '';
      state.comboA = 0;
      state.comboB = 0;
      els.lastMoveA.textContent = '0';
      els.lastMoveB.textContent = '0';
      nextQuestion();
    }
  }, 100);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function clearAI() {
  if (state.aiTimeoutId) {
    clearTimeout(state.aiTimeoutId);
    state.aiTimeoutId = null;
  }
  state.aiThinking = false;
}

function difficultyValue() {
  return parseInt(els.difficulty.value, 10);
}

function genQuestion(diff) {
  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  if (diff === 1) {
    const a = rnd(0, 10);
    const b = rnd(0, 10);
    return { text: `${a} + ${b}`, answer: a + b };
  }

  if (diff === 2) {
    const op = Math.random() < 0.6 ? '+' : '-';
    let a = rnd(5, 30);
    let b = rnd(0, 20);
    if (op === '-' && b > a) [a, b] = [b, a];
    return { text: `${a} ${op} ${b}`, answer: op === '+' ? a + b : a - b };
  }

  if (diff === 3) {
    const op = Math.random() < 0.55 ? '+' : '-';
    let a = rnd(10, 90);
    let b = rnd(0, 50);
    if (op === '-' && b > a) [a, b] = [b, a];
    return { text: `${a} ${op} ${b}`, answer: op === '+' ? a + b : a - b };
  }

  if (diff === 4) {
    const mode = Math.random();
    if (mode < 0.55) {
      const a = rnd(2, 9);
      const b = rnd(2, 9);
      return { text: `${a} × ${b}`, answer: a * b };
    } else {
      const op = Math.random() < 0.5 ? '+' : '-';
      let a = rnd(20, 150);
      let b = rnd(0, 80);
      if (op === '-' && b > a) [a, b] = [b, a];
      return { text: `${a} ${op} ${b}`, answer: op === '+' ? a + b : a - b };
    }
  }

  // diff 5
  const mode = Math.random();
  if (mode < 0.45) {
    const a = rnd(3, 12);
    const b = rnd(3, 12);
    return { text: `${a} × ${b}`, answer: a * b };
  } else if (mode < 0.8) {
    const a = rnd(50, 200);
    const b = rnd(10, 120);
    const op = Math.random() < 0.5 ? '+' : '-';
    let aa = a, bb = b;
    if (op === '-' && bb > aa) [aa, bb] = [bb, aa];
    return { text: `${aa} ${op} ${bb}`, answer: op === '+' ? aa + bb : aa - bb };
  } else {
    const a = rnd(10, 60);
    const b = rnd(10, 60);
    const c = rnd(5, 50);
    return { text: `(${a} + ${b}) - ${c}`, answer: (a + b) - c };
  }
}

function bonusBySpeed(timeLeft, roundSeconds) {
  const elapsed = roundSeconds - timeLeft;
  if (elapsed < 2) return 6;
  if (elapsed < 4) return 4;
  if (elapsed < 6) return 2;
  return 0;
}

function scheduleCPUAnswer() {
  clearAI();
  if (state.mode !== 'cpu' || state.ended) return;

  state.aiThinking = true;
  render();

  const diff = difficultyValue();

  // CPU speed tuned to be "fun but beatable"
  // lower diff -> slower + more mistakes, higher diff -> a bit slower again
  const baseMin = [0, 1.4, 1.6, 1.8, 2.0, 2.2][diff];
  const baseMax = [0, 4.8, 4.6, 4.4, 4.6, 4.8][diff];
  const delay = (Math.random() * (baseMax - baseMin) + baseMin) * 1000;

  // correctness chance (not perfect!)
  const correctChance = [0, 0.70, 0.72, 0.75, 0.78, 0.80][diff];

  state.aiTimeoutId = setTimeout(() => {
    state.aiTimeoutId = null;
    if (state.ended) return;

    const willBeCorrect = Math.random() < correctChance;

    // if time is already 0, let normal timer handle next question
    if (state.timeLeft <= 0.05) {
      state.aiThinking = false;
      render();
      return;
    }

    if (willBeCorrect) {
      // CPU "submits" correct answer
      state.inputB = String(state.question.answer);
      state.aiThinking = false;
      render();
      submit('B', true);
    } else {
      // wrong: show wrong number and "submit" (no move)
      const wrong = state.question.answer + (Math.random() < 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1);
      state.inputB = String(wrong);
      state.aiThinking = false;
      render();
      submit('B', true);
    }
  }, delay);
}

function nextQuestion() {
  state.question = genQuestion(difficultyValue());
  els.questionText.textContent = state.question.text;

  state.inputA = '';
  state.inputB = '';
  state.locked = false;

  startTimer();

  // In CPU mode schedule AI attempt each question
  scheduleCPUAnswer();

  render();
}

function submit(team, isCpuSubmit = false) {
  if (state.ended) return;
  if (state.locked) return;

  // If human A submits, cancel CPU for this question to avoid double
  if (state.mode === 'cpu' && team === 'A') {
    clearAI();
  }

  const isA = team === 'A';
  const buf = isA ? state.inputA : state.inputB;

  if (!buf) {
    if (!isCpuSubmit) setStatus('Najpierw wpisz wynik.', 'warn');
    return;
  }

  const value = Number(buf);
  if (!Number.isFinite(value)) {
    if (!isCpuSubmit) setStatus('To nie jest liczba.', 'bad');
    return;
  }

  state.locked = true;

  const correct = (value === state.question.answer);
  const base = 6;
  const bonus = bonusBySpeed(state.timeLeft, state.roundSeconds);
  const move = correct ? (base + bonus) : 0;

  if (correct) {
    if (isA) {
      state.comboA += 1;
      state.comboB = 0;
      els.lastMoveA.textContent = `${move}`;
      els.lastMoveB.textContent = `0`;
    } else {
      state.comboB += 1;
      state.comboA = 0;
      els.lastMoveB.textContent = `${move}`;
      els.lastMoveA.textContent = `0`;
    }

    state.ropePos += isA ? -move : +move;
    state.ropePos = clamp(state.ropePos, -100, 100);

    if (isCpuSubmit) setStatus(`🤖 CPU: ✅ dobrze! Ruch: ${move}`, 'good');
    else setStatus(`✅ Dobrze! Ruch: ${move} (bonus: ${bonus})`, 'good');
  } else {
    if (isA) {
      state.comboA = 0;
      els.lastMoveA.textContent = `0`;
    } else {
      state.comboB = 0;
      els.lastMoveB.textContent = `0`;
    }

    if (isCpuSubmit) setStatus(`🤖 CPU: ❌ źle`, 'bad');
    else setStatus(`❌ Źle. Poprawna odpowiedź to ${state.question.answer}.`, 'bad');
  }

  render();

  if (state.ropePos <= -100) return endGame('Drużyna A');
  if (state.ropePos >= 100) return endGame(state.mode === 'cpu' ? 'Komputer (Drużyna B)' : 'Drużyna B');

  setTimeout(() => {
    state.locked = false;
    nextQuestion();
  }, correct ? 450 : 650);
}

function endGame(winner) {
  state.ended = true;
  stopTimer();
  clearAI();
  els.overlay.classList.remove('hidden');
  els.overlay.setAttribute('aria-hidden', 'false');
  els.winnerText.textContent = `Wygrywa ${winner}! 🎉`;
}

function resetGame() {
  stopTimer();
  clearAI();

  state.ropePos = 0;
  state.inputA = '';
  state.inputB = '';
  state.comboA = 0;
  state.comboB = 0;
  els.lastMoveA.textContent = '0';
  els.lastMoveB.textContent = '0';
  state.locked = false;
  state.ended = false;

  els.overlay.classList.add('hidden');
  els.overlay.setAttribute('aria-hidden', 'true');

  setStatus('Dotknij OK po wpisaniu wyniku.', 'muted');
  applyModeUI();
  nextQuestion();
  render();
}

function applyModeUI() {
  state.mode = els.gameMode.value;

  if (state.mode === 'cpu') {
    els.teamB.classList.add('disabled');
    els.cpuBadge.classList.remove('hidden');
    // clear B input
    state.inputB = '';
    setStatus('Tryb CPU: Drużyna A gra przeciw komputerowi 🤖', 'warn');
  } else {
    els.teamB.classList.remove('disabled');
    els.cpuBadge.classList.add('hidden');
    setStatus('Tryb 2 drużyny: obie strony odpowiadają.', 'muted');
  }
  render();
}

/* ===== Fullscreen + proper mobile height (Samsung-safe) ===== */
function setVhUnit() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  const vh = h * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    setStatus('Nie udało się włączyć pełnego ekranu (polityka przeglądarki).', 'warn');
  } finally {
    // after entering/leaving fullscreen update vh
    setTimeout(setVhUnit, 50);
  }
}

// Wire up
buildKeypad(els.keypadA, 'A');
buildKeypad(els.keypadB, 'B');

els.btnNext.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!state.ended) nextQuestion(); });
els.btnReset.addEventListener('pointerdown', (e) => { e.preventDefault(); resetGame(); });
els.btnPlayAgain.addEventListener('pointerdown', (e) => { e.preventDefault(); resetGame(); });
els.btnFullscreen.addEventListener('pointerdown', (e) => { e.preventDefault(); toggleFullscreen(); });

els.gameMode.addEventListener('change', () => {
  applyModeUI();
  resetGame();
});

els.difficulty.addEventListener('change', () => {
  resetGame();
});

document.addEventListener('fullscreenchange', () => {
  setTimeout(setVhUnit, 50);
});

window.addEventListener('resize', () => {
  setVhUnit();
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => setVhUnit());
  window.visualViewport.addEventListener('scroll', () => setVhUnit());
}

// Start
setVhUnit();
applyModeUI();
resetGame();
render();