// ============================
// Tug-of-War Math Game (MVP)
// ============================

const els = {
  displayA: document.getElementById('displayA'),
  displayB: document.getElementById('displayB'),
  keypadA: document.getElementById('keypadA'),
  keypadB: document.getElementById('keypadB'),
  questionText: document.getElementById('questionText'),
  timeLeft: document.getElementById('timeLeft'),
  rope: document.getElementById('rope'),
  ropePos: document.getElementById('ropePos'),
  status: document.getElementById('status'),
  difficulty: document.getElementById('difficulty'),
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
  // rope position: -100 ... +100
  ropePos: 0,
  // current question
  question: null, // { text, answer }
  // input buffers (as string)
  inputA: '',
  inputB: '',
  // per-team combo
  comboA: 0,
  comboB: 0,
  // timer
  roundSeconds: 10.0,
  timeLeft: 10.0,
  timerId: null,
  // control
  locked: false,
  ended: false,
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function setStatus(msg, kind = 'muted') {
  // kind: muted | good | bad | warn
  els.status.textContent = msg;
  els.status.style.color =
    kind === 'good' ? 'var(--good)' :
    kind === 'bad'  ? 'var(--bad)'  :
    kind === 'warn' ? 'var(--warn)' :
    'var(--muted)';
}

function render() {
  els.displayA.textContent = state.inputA || '—';
  els.displayB.textContent = state.inputB || '—';

  els.ropePos.textContent = Math.round(state.ropePos).toString();
  els.comboA.textContent = state.comboA.toString();
  els.comboB.textContent = state.comboB.toString();

  // Move rope visually: translate rope container left/right based on ropePos
  // ropePos -100..+100 -> offset -36%..+36% (so it stays inside)
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

    // Pointer events work for touch + mouse
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

  const isA = team === 'A';
  let buf = isA ? state.inputA : state.inputB;

  if (key === '⌫') {
    buf = buf.slice(0, -1);
  } else if (key === 'OK') {
    submit(team);
    return;
  } else {
    // digit
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
      // time out -> new question
      setStatus('Czas minął! Nowe pytanie.', 'warn');
      // reset inputs but don't punish
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

function difficultyValue() {
  return parseInt(els.difficulty.value, 10);
}

function genQuestion(diff) {
  // diff: 1..5
  // 1: add <= 20
  // 2: add/sub <= 50 (no negatives)
  // 3: add/sub <= 100
  // 4: multiply (small) OR mixed
  // 5: harder mixed + 2-step sometimes
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
    if (op === '-') {
      if (b > a) [a, b] = [b, a];
    }
    return { text: `${a} ${op} ${b}`, answer: op === '+' ? a + b : a - b };
  }

  if (diff === 3) {
    const op = Math.random() < 0.55 ? '+' : '-';
    let a = rnd(10, 90);
    let b = rnd(0, 50);
    if (op === '-') {
      if (b > a) [a, b] = [b, a];
    }
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
    // 2-step: (a + b) - c
    const a = rnd(10, 60);
    const b = rnd(10, 60);
    const c = rnd(5, 50);
    const ans = (a + b) - c;
    return { text: `(${a} + ${b}) - ${c}`, answer: ans };
  }
}

function nextQuestion() {
  state.question = genQuestion(difficultyValue());
  els.questionText.textContent = state.question.text;

  // reset inputs
  state.inputA = '';
  state.inputB = '';
  state.locked = false;

  // restart timer
  startTimer();
  render();
}

function bonusBySpeed(timeLeft, roundSeconds) {
  // timeLeft high -> big bonus
  const elapsed = roundSeconds - timeLeft;

  // thresholds in seconds
  if (elapsed < 2) return 6;
  if (elapsed < 4) return 4;
  if (elapsed < 6) return 2;
  return 0;
}

function submit(team) {
  if (state.ended) return;
  if (state.locked) return;

  const isA = team === 'A';
  const buf = isA ? state.inputA : state.inputB;

  if (!buf) {
    setStatus('Najpierw wpisz wynik.', 'warn');
    return;
  }

  const value = Number(buf);
  if (!Number.isFinite(value)) {
    setStatus('To nie jest liczba.', 'bad');
    return;
  }

  // lock momentarily to avoid double submit
  state.locked = true;

  const correct = (value === state.question.answer);
  const base = 6;
  const bonus = bonusBySpeed(state.timeLeft, state.roundSeconds);
  const move = correct ? (base + bonus) : 0;

  if (correct) {
    // update combos
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

    // Apply movement: A pulls left (negative), B pulls right (positive)
    state.ropePos += isA ? -move : +move;
    state.ropePos = clamp(state.ropePos, -100, 100);

    setStatus(`✅ Dobrze! Ruch: ${move} (bonus: ${bonus})`, 'good');
  } else {
    // wrong answer: no punishment in MVP (less frustration)
    if (isA) {
      state.comboA = 0;
      els.lastMoveA.textContent = `0`;
    } else {
      state.comboB = 0;
      els.lastMoveB.textContent = `0`;
    }
    setStatus(`❌ Źle. Poprawna odpowiedź to ${state.question.answer}.`, 'bad');
  }

  render();

  // Check winner
  if (state.ropePos <= -100) return endGame('Drużyna A');
  if (state.ropePos >= 100) return endGame('Drużyna B');

  // Next question after short delay
  setTimeout(() => {
    state.locked = false;
    nextQuestion();
  }, correct ? 450 : 650);
}

function endGame(winner) {
  state.ended = true;
  stopTimer();
  els.overlay.classList.remove('hidden');
  els.overlay.setAttribute('aria-hidden', 'false');
  els.winnerText.textContent = `Wygrywa ${winner}! 🎉`;
}

function resetGame() {
  stopTimer();
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
  nextQuestion();
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    // ignore if blocked by browser policies
    setStatus('Nie udało się włączyć pełnego ekranu (polityka przeglądarki).', 'warn');
  }
}

// --- Wire up UI ---
buildKeypad(els.keypadA, 'A');
buildKeypad(els.keypadB, 'B');

els.btnNext.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!state.ended) nextQuestion(); });
els.btnReset.addEventListener('pointerdown', (e) => { e.preventDefault(); resetGame(); });
els.btnPlayAgain.addEventListener('pointerdown', (e) => { e.preventDefault(); resetGame(); });
els.btnFullscreen.addEventListener('pointerdown', (e) => { e.preventDefault(); toggleFullscreen(); });

// Prevent page scrolling / pinch zoom quirks on touch screens
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// Start
resetGame();
render();