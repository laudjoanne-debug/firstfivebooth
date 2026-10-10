/* FIRSTFIVEBOOTH - 3-2-1 Countdown (drop-in add-on)
 * Intercepts the snap buttons. In "countdown" mode it shows 3 -> 2 -> 1,
 * then triggers your ORIGINAL capture handler. In "snap" mode it does nothing.
 * Load this BEFORE photobooth.js. */
(function () {
  'use strict';

  var COUNT_FROM = 3;
  var STEP_MS = 1000;
  var SNAP_IDS = ['manualSnapBtn', 'bigShutterBtn'];

  var counting = false;
  var passthrough = false;
  var timer = null;
  var audioCtx = null;
  var chosenMode = 'countdown';          // default matches the .mode-card.active in HTML

  function $(id) { return document.getElementById(id); }

  /* ---------- mode tracking ---------- */
  function currentMode() {
    var toggle = $('modeToggleBtn');
    var arena = $('arenaSection');
    if (toggle && arena && arena.classList.contains('active')) {
      var t = (toggle.textContent || '').toLowerCase();
      if (t.indexOf('countdown') !== -1) return 'countdown';
      if (t.indexOf('instant') !== -1 || t.indexOf('snap') !== -1) return 'snap';
    }
    var cd = $('modeCardCountdown'), sn = $('modeCardSnap');
    if (cd && cd.classList.contains('active')) return 'countdown';
    if (sn && sn.classList.contains('active')) return 'snap';
    return chosenMode;
  }

  document.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('.mode-card');
    if (card && card.dataset.mode) chosenMode = card.dataset.mode;
  }, true);

  /* ---------- sound ---------- */
  function soundOn() {
    var b = $('toggleAudioBtn');
    return !b || (b.textContent || '').toUpperCase().indexOf('OFF') === -1;
  }
  function beep(freq, dur) {
    if (!soundOn()) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.18, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (err) { /* audio is optional */ }
  }

  /* ---------- overlay ---------- */
  function showOverlay(n) {
    var ov = $('countdownOverlay'), num = $('countdownNumber');
    if (!ov || !num) return;
    ov.classList.add('active', 'show', 'visible');
    ov.style.cssText =
      'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.35);z-index:50;opacity:1;visibility:visible;cursor:pointer;';
    num.style.cssText =
      'font-size:clamp(7rem,28vw,14rem);font-weight:900;color:#fff;line-height:1;' +
      'text-shadow:0 0 40px rgba(255,64,160,.9),0 6px 24px rgba(0,0,0,.6);pointer-events:none;';
    num.textContent = n;
    num.animate(
      [{ transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 },
       { transform: 'scale(.85)', opacity: .85 }],
      { duration: STEP_MS * 0.9, easing: 'ease-out' }
    );
  }
  function hideOverlay() {
    var ov = $('countdownOverlay');
    if (!ov) return;
    ov.classList.remove('active', 'show', 'visible');
    ov.style.cssText = 'display:none;';
  }
  function toast(msg) {
    var t = $('toastNotice');
    if (!t) return;
    t.textContent = msg; t.classList.add('show', 'visible', 'active');
    setTimeout(function () { t.classList.remove('show', 'visible', 'active'); }, 1800);
  }
  function setBusy(busy) {
    SNAP_IDS.forEach(function (id) {
      var b = $(id); if (b) { b.disabled = busy; b.style.opacity = busy ? '.6' : ''; }
    });
  }

  /* ---------- countdown ---------- */
  function cancel(silent) {
    if (!counting) return;
    clearTimeout(timer); counting = false;
    hideOverlay(); setBusy(false);
    if (!silent) toast('Countdown cancelled');
  }

  function start(btn) {
    if (counting) return;
    counting = true; setBusy(true);
    var n = COUNT_FROM;
    (function tick() {
      if (n > 0) {
        showOverlay(n); beep(660, 0.15);
        n--; timer = setTimeout(tick, STEP_MS);
      } else {
        hideOverlay(); beep(1040, 0.3);
        counting = false; setBusy(false);
        passthrough = true;            // let the original capture handler run
        try { btn.click(); } finally { passthrough = false; }
      }
    })();
  }

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    if (passthrough) return;
    var btn = e.target.closest && e.target.closest('#manualSnapBtn, #bigShutterBtn');
    if (btn) {
      if (currentMode() !== 'countdown') return;      // Snap Now: untouched
      e.stopImmediatePropagation(); e.preventDefault();
      start(btn);
      return;
    }
    if (counting && e.target.closest('#countdownOverlay')) cancel();   // tap overlay to cancel
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') cancel();
  });

  // Cancel if the user leaves the arena, shuffles the pose, or switches mode mid-count
  document.addEventListener('click', function (e) {
    if (counting && e.target.closest('#shufflePoseBtn, #modeToggleBtn, #reconnectCameraBtn')) cancel(true);
  }, true);

  window.FirstFiveCountdown = { cancel: cancel, isCounting: function () { return counting; } };
})();
