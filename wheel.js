/* =========================
   WHEEL — Spin logic for the current layout
   ========================= */

const WHEEL_LOCK_DEBUG = true; // allow multiple spins for mapping during setup
window.WHEEL_LOCK_DEBUG = WHEEL_LOCK_DEBUG;

const SECTORS_COUNT = 9;
const SECTOR_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
const SECTOR_LABELS = {
  s1: 'Бесплатно Индвидуальный План развития',
  s2: '30% скидку на Звездный аватар',
  s3: 'Бесплатно месяц Chronos Plus',
  s4: '45% скидку на Консультацию "Кто я?',
  s5: 'Бесплатную диагностику с астрологом',
  s6: '50% скидку на годовой прогноз',
  s7: 'Бесплатно 5 вопросов ИИ-астрологу',
  s8: 'Бесплатный месяц ИИ-астролога',
  s9: '30% скидку на программу “Свой год. Свои правила. Свои желания”'
};
const SECTOR_PROBABILITY = [0, 20, 5, 20, 0, 20, 9, 6, 20];

const SECTOR_LINKS = {
  s1: '',
  s2: 'https://p.chronos.mg/offer-avatar?utm_source=landing&utm_medium=wheel&utm_campaign=newyear2026&utm_content=avatar30',
  s3: 'https://sbsite.pro//ChronosPlusPromo_1',
  s4: 'https://p.chronos.mg/ktoya45?utm_source=landing&utm_medium=wheel&utm_campaign=newyear2026&utm_content=ktoya45',
  s5: '',
  s6: 'https://p.chronos.mg/ny/prognosis/pr?utm_source=landing&utm_medium=wheel&utm_campaign=newyear2025&utm_content=prognoznagod',
  s7: 'https://t.me/chronos_io_bot?start=ny26-5quest-wheel',
  s8: 'https://t.me/chronos_io_bot?start=ny26-5quest-wheel',
  s9: 'https://p.chronos.mg/newme_rec?utm_source=landing&utm_medium=wheel&utm_campaign=newyear2026&utm_content=newme_rec'
};

const spinSettings = { minTurns: 5, maxTurns: 7, duration: 6000 };
const TARGET_DEG = 180;
let ORDER_OFFSET = 0;
let BASE_SHIFT = 90;
let NUDGE = 8;

const rotor = document.querySelector('.wheel-stage__wheel');
const spinBtn = document.getElementById('spinBtn');
const resultText = document.getElementById('spinResult');
const countdown = document.getElementById('countdown');
const countdownTimer = document.getElementById('countdown-timer');
const timerNotice = document.getElementById('timerNotice');
const pageRoot = document.querySelector('.page');
const resultPopup = document.getElementById('resultPopup');
const popupEmphasis = document.getElementById('popupEmphasis');
const popupDescription = document.getElementById('popupDescription');
const popupRedeemLink = document.getElementById('popupRedeemLink');
const confettiCanvas = document.getElementById('confettiCanvas');

let spinning = false;
let hasSpun = false;
let currentRotation = 0;
let redeemUrl = null;
let lastPrizeId = null;
let lastPrizeLabel = null;
let lastPrizeLink = null;
let confettiInstance = null;
let confettiInterval = null;

const slice = 360 / SECTORS_COUNT;
const norm = deg => ((deg % 360) + 360) % 360;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function syncPrizeGlobals() {
  window.redeemUrl = redeemUrl;
  window.lastPrizeId = lastPrizeId;
  window.lastPrizeLabel = lastPrizeLabel;
  window.lastPrizeLink = lastPrizeLink;
  window.currentRotation = currentRotation;
}
syncPrizeGlobals();

function togglePopupVisibility(visible) {
  const popupExists = Boolean(resultPopup);
  if (popupExists) {
    resultPopup.classList.toggle('popup--open', Boolean(visible));
    resultPopup.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
  if (pageRoot) {
    pageRoot.classList.toggle('page--popup-visible', Boolean(visible && popupExists));
  }
}

function ensureConfettiInstance() {
  if (!confettiCanvas || typeof window.confetti !== 'function') return null;
  if (!confettiInstance) {
    confettiInstance = window.confetti.create(confettiCanvas, { resize: true, useWorker: true });
  }
  return confettiInstance;
}

function stopPopupConfetti() {
  if (confettiInterval) {
    clearInterval(confettiInterval);
    confettiInterval = null;
  }
  if (confettiInstance && typeof confettiInstance.reset === 'function') {
    confettiInstance.reset();
  }
}

function startPopupConfetti(duration = 15_000) {
  stopPopupConfetti();
  const instance = ensureConfettiInstance();
  if (!instance) return;

  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 15, spread: 360, ticks: 60, zIndex: 0, shapes: ['polygon'] };
  const randomInRange = (min, max) => Math.random() * (max - min) + min;

  confettiInterval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      stopPopupConfetti();
      return;
    }

    const particleCount = 50 * (timeLeft / duration);
    instance(
      Object.assign({}, defaults, {
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
    );
    instance(
      Object.assign({}, defaults, {
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    );
  }, 250);
}

function splitPrizeLabel(label) {
  const source = (label || '').replace(/\s+/g, ' ').trim();
  if (!source) return { emphasis: '', description: '' };
  const normalized = source.toLowerCase();
  const separators = [' на '];
  for (const separator of separators) {
    const idx = normalized.indexOf(separator);
    if (idx >= 0) {
      return {
        emphasis: source.slice(0, idx).trim(),
        description: source.slice(idx).trim()
      };
    }
  }
  const words = source.split(' ');
  if (words.length <= 1) {
    return { emphasis: source, description: '' };
  }
  const emphasis = [words.shift()];
  if ((/%/.test(emphasis[0]) || /скид/i.test(words[0] || '')) && words.length) {
    emphasis.push(words.shift());
  } else if (/бесплат/i.test(emphasis[0]) && words.length) {
    // keep только первое слово "Бесплатно", остальное уходит в описание
  }
  return { emphasis: emphasis.join(' '), description: words.join(' ') };
}

function updatePopupContent(label, link) {
  const { emphasis, description } = splitPrizeLabel(label);
  if (popupEmphasis) {
    popupEmphasis.textContent = emphasis || label || '';
  }
  if (popupDescription) {
    popupDescription.textContent = description || label || '';
  }
  if (popupRedeemLink) {
    popupRedeemLink.href = link || '#';
    popupRedeemLink.target = '_blank';
    popupRedeemLink.rel = 'noopener noreferrer';
  }
}

function openResultPopup(label, link) {
  updatePopupContent(label, link);
  togglePopupVisibility(true);
  startPopupConfetti();
}

function closeResultPopup() {
  togglePopupVisibility(false);
  stopPopupConfetti();
}

function setResultMessage(message) {
  if (!resultText) return;
  resultText.textContent = message || '';
}

function updateResultText(id, label) {
  if (!resultText) return;
  if (!label) {
    resultText.textContent = '';
    return;
  }
  const suffix = id && WHEEL_LOCK_DEBUG ? ` (сектор ${id.toUpperCase()})` : '';
  resultText.textContent = `Выпало: ${label.trim()}${suffix}`;
}

function weightedRandomIndex() {
  const total = SECTOR_PROBABILITY.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let c = 0;
  for (let i = 0; i < SECTOR_PROBABILITY.length; i++) {
    c += SECTOR_PROBABILITY[i];
    if (r <= c) return i;
  }
  return SECTOR_PROBABILITY.length - 1;
}

const TIMER_KEY = 'chronos_wheel_timer_deadline_v1';

function saveTimerDeadline(ts) {
  try {
    localStorage.setItem(TIMER_KEY, String(ts));
  } catch (e) {}
}

function loadTimerDeadline() {
  try {
    return Number(localStorage.getItem(TIMER_KEY)) || null;
  } catch (e) {
    return null;
  }
}

function clearTimerDeadline() {
  try {
    localStorage.removeItem(TIMER_KEY);
  } catch (e) {}
}

function startCountdown(seconds = 900) {
  if (!countdown || !countdownTimer) return;
  countdown.hidden = false;
  countdown.classList.add('show');
  if (timerNotice) timerNotice.hidden = true;
  clearInterval(window.countdownInterval);

  function format(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  countdownTimer.textContent = format(seconds);
  window.countdownInterval = setInterval(() => {
    seconds -= 1;
    countdownTimer.textContent = format(Math.max(seconds, 0));
    if (seconds <= 0) {
      clearInterval(window.countdownInterval);
      clearTimerDeadline();
      countdown.hidden = true;
      if (timerNotice) {
        timerNotice.hidden = false;
        timerNotice.classList.add('show');
      }
    }
  }, 1000);
}

(function restoreTimerFromStorage() {
  const deadline = loadTimerDeadline();
  if (!deadline) return;
  const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
  if (left > 0) {
    startCountdown(left);
  } else {
    clearTimerDeadline();
  }
})();

function scrollToResult() {
  const target =
    document.querySelector('#spinResult') ||
    document.querySelector('#countdown') ||
    document.querySelector('#gift') ||
    document.querySelector('#spinBtn');
  if (!target) return;
  setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
}

function getDisplayedSectorId(angle) {
  let bestIndex = 0;
  let smallestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < SECTORS_COUNT; i++) {
    const center = (i + 0.5) * slice + BASE_SHIFT + angle;
    const delta = Math.abs(norm(center) - TARGET_DEG);
    if (delta < smallestDelta) {
      smallestDelta = delta;
      bestIndex = i;
    }
  }
  const visualIndex = bestIndex;
  const logicalIndex = (visualIndex - ORDER_OFFSET + SECTORS_COUNT) % SECTORS_COUNT;
  return SECTOR_IDS[logicalIndex];
}

function handleSpinComplete() {
  const id = getDisplayedSectorId(currentRotation);
  const label = (SECTOR_LABELS[id] || id).trim();
  const link = SECTOR_LINKS[id] || 'https://chronos.mg/';

  redeemUrl = link;
  lastPrizeId = id;
  lastPrizeLabel = label;
  lastPrizeLink = link;
  syncPrizeGlobals();

  updateResultText(id, label);
  openResultPopup(label, link);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'wheel_spin',
    prize_id: id,
    prize_label: label,
    prize_link: link,
    final_rotation: currentRotation
  });

  const deadline = Date.now() + 900_000;
  saveTimerDeadline(deadline);
  startCountdown(900);
  scrollToResult();

  spinning = false;
  if (WHEEL_LOCK_DEBUG) {
    hasSpun = false;
    if (spinBtn) spinBtn.disabled = false;
  } else if (spinBtn) {
    spinBtn.disabled = true;
  }
}

function runSpin() {
  if (!rotor || !spinBtn) return;

  if (spinning) return;
  if (hasSpun && !WHEEL_LOCK_DEBUG) return;

  closeResultPopup();
  hasSpun = true;
  spinning = true;
  spinBtn.disabled = true;
  setResultMessage('Колесо крутится...');

  const chosenIndex = weightedRandomIndex();
  const autoCenter = (chosenIndex + 0.5) * slice + BASE_SHIFT;
  const delta = norm(TARGET_DEG - norm(autoCenter + currentRotation) + NUDGE);

  const turns = randInt(spinSettings.minTurns, spinSettings.maxTurns);
  const start = currentRotation;
  const end = start + turns * 360 + delta;

  const startedAt = performance.now();
  const duration = spinSettings.duration;

  const frame = now => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const angle = start + (end - start) * eased;
    if (rotor) {
      rotor.style.transform = `rotate(${angle}deg)`;
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }

    currentRotation = norm(end);
    syncPrizeGlobals();
    handleSpinComplete();
  };

  requestAnimationFrame(frame);
}

if (spinBtn && rotor) {
  spinBtn.addEventListener('click', runSpin);
} else {
  console.warn('Wheel: spin button or rotor element is missing in the layout.');
}

/* ---------- ONE-SPIN LOCK (storage + restore) ---------- */
(function () {
  const TEST_MODE = Boolean(window.WHEEL_LOCK_DEBUG);
  const KEY = 'chronos_wheel_lock_v1';
  const COOKIE = 'chronos_wheel_lock_v1';

  function setCookie(name, value, days) {
    try {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 864e5);
      document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    } catch (e) {}
  }

  function getCookie(name) {
    try {
      const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : null;
    } catch (e) {
      return null;
    }
  }

  function save(payload) {
    try {
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (e) {}
    try {
      setCookie(COOKIE, JSON.stringify(payload), 365);
    } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    try {
      const fromCookie = getCookie(COOKIE);
      if (fromCookie) return JSON.parse(fromCookie);
    } catch (e) {}
    return null;
  }

  function restoreUI(payload) {
    if (!payload) return;
    redeemUrl = payload.link;
    lastPrizeId = payload.id;
    lastPrizeLabel = payload.label || SECTOR_LABELS[payload.id] || '';
    lastPrizeLink = payload.link;
    currentRotation = Number(payload.angle) || 0;
    syncPrizeGlobals();

    if (rotor) {
      rotor.style.transform = `rotate(${currentRotation}deg)`;
    }
    updateResultText(payload.id, lastPrizeLabel);
    openResultPopup(lastPrizeLabel, lastPrizeLink);

    hasSpun = true;
    if (spinBtn) {
      spinBtn.disabled = !TEST_MODE;
    }

    scrollToResult();
  }

  const existing = !TEST_MODE && load();
  if (existing) restoreUI(existing);

  window.dataLayer = window.dataLayer || [];
  if (!window.__wheelLockHooked) {
    window.__wheelLockHooked = true;
    const originalPush = window.dataLayer.push;
    window.dataLayer.push = function () {
      for (let i = 0; i < arguments.length; i++) {
        const args = arguments[i];
        try {
          if (args && args.event === 'wheel_spin' && !TEST_MODE) {
            const payload = {
              id: args.prize_id,
              label: args.prize_label,
              link: args.prize_link,
              angle: Number(args.final_rotation) || 0,
              ts: Date.now()
            };
            save(payload);
          }
        } catch (e) {}
      }
      return originalPush.apply(this, arguments);
    };
  }
})();

/* ==== QA helpers: сброс результата / UI ===== */
(function (global) {
  const KEY = 'chronos_wheel_lock_v1';
  const COOKIE = 'chronos_wheel_lock_v1';
  const TIMER_KEY = 'chronos_wheel_timer_deadline_v1';

  function setCookie(name, value, days) {
    try {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 864e5);
      document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    } catch (e) {}
  }

  function clearTimer() {
    try {
      clearInterval(global.countdownInterval);
    } catch (e) {}
    try {
      localStorage.removeItem(TIMER_KEY);
    } catch (e) {}

    if (countdown) {
      countdown.hidden = true;
      countdown.classList.remove('show');
    }
    if (timerNotice) {
      timerNotice.hidden = true;
      timerNotice.classList.remove('show');
    }
  }

  function resetUIOnly() {
    clearTimer();
    setResultMessage('');
    closeResultPopup();

    if (spinBtn) {
      spinBtn.disabled = false;
    }
    if (rotor) {
      rotor.style.transform = 'rotate(0deg)';
    }

    hasSpun = false;
    spinning = false;
    currentRotation = 0;
    redeemUrl = null;
    lastPrizeId = null;
    lastPrizeLabel = null;
    lastPrizeLink = null;
    syncPrizeGlobals();

    console.info('✅ UI reset done');
  }

  function hardResetAll() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    setCookie(COOKIE, '', -1);
    try {
      localStorage.removeItem(TIMER_KEY);
    } catch (e) {}
    resetUIOnly();
    console.info('✅ full reset done (storage + UI)');
  }

  global.wheelQA = {
    resetAll: hardResetAll,
    resetUI: resetUIOnly
  };

  console.info('wheelQA ready -> используйте wheelQA.resetAll() или wheelQA.resetUI()');
})(window);
