/**
 * DAVID // INVERTED PERSPECTIVES
 * Section 1: Stearman Biplane Cockpit Analog Gauges & Avionics
 * Section 2: Mobile- & Desktop-Compatible Wing-Walker Flight Simulator
 */

(() => {
  const simViewport = document.getElementById('sim-viewport');
  const canvas = document.getElementById('flight-canvas');
  const ctx = canvas.getContext('2d');

  // Cockpit & Simulator DOM Elements
  const rollReadout = document.getElementById('roll-readout');
  const gReadout = document.getElementById('g-readout');
  const barrelRollBtn = document.getElementById('barrel-roll-btn');
  const throttleSlider = document.getElementById('throttle-slider');
  const rpmReadout = document.getElementById('rpm-readout');
  const speedValue = document.getElementById('speed-value');
  const altValue = document.getElementById('alt-value');
  const compassTrack = document.getElementById('compass-track');
  const hudHorizonRing = document.getElementById('hud-horizon-ring');
  const flightModeBadge = document.getElementById('flight-mode-badge');
  const tensionFill = document.getElementById('tension-fill');
  const windAudioToggle = document.getElementById('wind-audio-toggle');
  const toggleSwitches = document.querySelectorAll('.toggle-switch');
  const tabText = document.getElementById('tab-text');

  // Stearman Analog Gauge Needles / Dials
  const cockpitHorizonDial = document.getElementById('cockpit-horizon-dial');
  const airspeedNeedle = document.getElementById('airspeed-needle');
  const gforceNeedle = document.getElementById('gforce-needle');

  // Persona Switcher Data
  const personaModes = {
    wingwalker: {
      text: '<strong>[LOG // AEROBATIC]</strong> Standing on a silver airfoil at 140 MPH while the Pacific Ocean hangs above your head teaches you a lot about trust in physics, rigging, and preparation.',
      targetRollDeg: -166,
      rpm: 1850
    },
    engineer: {
      text: '<strong>[LOG // SYSTEMS]</strong> From low-level code to physical hardware rigs, I build systems that hold together under high G-loads. Clean architecture, zero duct tape.',
      targetRollDeg: -178,
      rpm: 2150
    },
    creator: {
      text: '<strong>[LOG // BROADCAST]</strong> Sharing the entire process — the prototypes, the math, the failures, and the final flight test — on YouTube, open-sourcing on GitHub, and connecting on LinkedIn.',
      targetRollDeg: -156,
      rpm: 1950
    }
  };

  toggleSwitches.forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleSwitches.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const mode = personaModes[btn.dataset.mode];
      if (mode) {
        tabText.innerHTML = mode.text;
        state.baseRollDeg = state.isInverted ? mode.targetRollDeg : (mode.targetRollDeg + 180);
        throttleSlider.value = mode.rpm;
        state.targetRpm = mode.rpm;
        pluckAllWires(0.5);
      }
    });
  });

  // Flight & Simulator State
  const state = {
    width: 800,
    height: 580,
    mouseX: 0, // normalized -1 to 1 inside simulator
    mouseY: 0, // normalized -1 to 1 inside simulator
    rawMouseX: 400,
    rawMouseY: 290,

    isInverted: true,
    baseRollDeg: -166, // Iconic inverted coastal horizon tilt
    currentRollDeg: -166,
    pitchOffset: 0,

    rpm: 1850,
    targetRpm: 1850,
    propAngle: 0,
    airspeed: 138,
    altitude: 4250,
    gForce: -1.8,

    time: 0,
    wires: [],
    windParticles: [],
    seaSparkles: []
  };

  // Optional WebAudio Synthesizer for Radial Engine + Wire Plucks
  let audioCtx = null;
  let engineGain = null;
  let engineOsc = null;
  let soundEnabled = false;

  function initAudio() {
    if (audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    engineOsc = audioCtx.createOscillator();
    const subOsc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    engineGain = audioCtx.createGain();

    engineOsc.type = 'sawtooth';
    subOsc.type = 'triangle';
    engineOsc.frequency.value = 62;
    subOsc.frequency.value = 31;

    filter.type = 'lowpass';
    filter.frequency.value = 180;
    engineGain.gain.value = 0.0;

    engineOsc.connect(filter);
    subOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(audioCtx.destination);

    engineOsc.start();
    subOsc.start();
  }

  function playWirePluck(freq = 240) {
    if (!soundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.96, audioCtx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.46);
  }

  windAudioToggle.addEventListener('click', () => {
    initAudio();
    soundEnabled = !soundEnabled;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    windAudioToggle.textContent = soundEnabled ? 'SOUND: ON' : 'SOUND: OFF';
    windAudioToggle.style.color = soundEnabled ? '#4ade80' : '';
    if (engineGain) {
      engineGain.gain.setTargetAtTime(soundEnabled ? 0.035 : 0.0, audioCtx.currentTime, 0.15);
    }
  });

  // Initialize Particles
  function initParticles() {
    state.windParticles = [];
    for (let i = 0; i < 60; i++) {
      state.windParticles.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 1200,
        length: 40 + Math.random() * 100,
        speed: 8 + Math.random() * 14,
        alpha: 0.06 + Math.random() * 0.22
      });
    }

    state.seaSparkles = [];
    for (let i = 0; i < 80; i++) {
      state.seaSparkles.push({
        x: (Math.random() - 0.5) * 2000,
        y: 25 + Math.random() * 500,
        size: 1 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // Define interactive flying wires in aircraft-local coordinates
  function initRiggingWires() {
    state.wires = [
      // Guy wires bracing the wing-walker's harness stanchion
      { x1: -40, y1: -115, x2: -195, y2: -22, vib: 0, vel: 0, freq: 290 },
      { x1: -40, y1: -115, x2: 120, y2: -22, vib: 0, vel: 0, freq: 260 },
      // Biplane cross-bracing flying wires between wings & fuselage
      { x1: -175, y1: -12, x2: -55, y2: 110, vib: 0, vel: 0, freq: 195 },
      { x1: -55, y1: -12, x2: -175, y2: 110, vib: 0, vel: 0, freq: 210 },
      { x1: 65, y1: -12, x2: 260, y2: 125, vib: 0, vel: 0, freq: 175 },
      { x1: 230, y1: -12, x2: 75, y2: 115, vib: 0, vel: 0, freq: 185 },
      { x1: 140, y1: 60, x2: 420, y2: 215, vib: 0, vel: 0, freq: 155 }
    ];
  }

  function pluckAllWires(strength = 1) {
    state.wires.forEach((w, idx) => {
      w.vel += (idx % 2 === 0 ? 1 : -1) * 14 * strength;
    });
    if (state.wires[0]) playWirePluck(240);
  }

  // Resize simulator canvas to match #sim-viewport container
  function handleResize() {
    const rect = simViewport.getBoundingClientRect();
    state.width = rect.width || window.innerWidth;
    state.height = rect.height || 500;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', handleResize);
  handleResize();
  initParticles();
  initRiggingWires();

  // Unified Pointer (Mouse + Touch) Handler inside Simulator Viewport
  function updatePointerFromEvent(e) {
    const rect = simViewport.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    state.rawMouseX = localX;
    state.rawMouseY = localY;
    state.mouseX = Math.max(-1, Math.min(1, (localX / state.width) * 2 - 1));
    state.mouseY = Math.max(-1, Math.min(1, (localY / state.height) * 2 - 1));
  }

  simViewport.addEventListener('pointermove', (e) => {
    updatePointerFromEvent(e);
  });

  simViewport.addEventListener('pointerdown', (e) => {
    updatePointerFromEvent(e);

    const planePos = getPlaneAnchor();
    const localX = (state.rawMouseX - planePos.x) / planePos.scale;
    const localY = (state.rawMouseY - planePos.y) / planePos.scale;

    let pluckedAny = false;
    state.wires.forEach((w) => {
      const d = distToSegment(localX, localY, w.x1, w.y1, w.x2, w.y2);
      if (d < 45) {
        w.vel = 22;
        pluckedAny = true;
        playWirePluck(w.freq);
      }
    });

    if (!pluckedAny) {
      pluckAllWires(0.75);
    }
  });

  // Toggle Barrel Roll (Invert vs Upright)
  function triggerBarrelRoll() {
    state.isInverted = !state.isInverted;
    if (state.isInverted) {
      state.baseRollDeg -= 180;
      document.body.classList.add('inverted-world');
      flightModeBadge.textContent = 'INVERTED FLIGHT';
      flightModeBadge.style.borderColor = 'rgba(231, 90, 76, 0.55)';
      flightModeBadge.style.color = '#fca5a5';
    } else {
      state.baseRollDeg += 180;
      document.body.classList.remove('inverted-world');
      flightModeBadge.textContent = 'POSITIVE-G UPRIGHT';
      flightModeBadge.style.borderColor = 'rgba(74, 222, 128, 0.55)';
      flightModeBadge.style.color = '#86efac';
    }
    pluckAllWires(1.1);
  }

  barrelRollBtn.addEventListener('click', triggerBarrelRoll);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'BUTTON') {
      e.preventDefault();
      triggerBarrelRoll();
    }
  });

  throttleSlider.addEventListener('input', (e) => {
    state.targetRpm = Number(e.target.value);
  });

  // Distance from point to segment for wire plucking
  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  function getPlaneAnchor() {
    // Center the Stearman cleanly on both wide desktops and narrow mobile screens
    const isMobile = state.width < 680;
    const scale = isMobile
      ? Math.max(0.42, state.width / 760)
      : Math.min(state.width / 1100, state.height / 640) * 0.95;

    return {
      x: state.width * (isMobile ? 0.48 : 0.52) + state.mouseX * 20,
      y: state.height * 0.55 + state.mouseY * 16,
      scale
    };
  }

  // Draw the inverted (or upright) horizon: Deep ocean on one side, coastline, bright sky on the other
  function drawHorizonWorld() {
    ctx.save();
    const cx = state.width * 0.5;
    const cy = state.height * 0.48 + state.pitchOffset;

    ctx.translate(cx, cy);
    const rad = (state.currentRollDeg * Math.PI) / 180;
    ctx.rotate(rad);

    const span = Math.hypot(state.width, state.height) * 1.6;

    // 1. Sky Hemisphere
    const skyGrad = ctx.createLinearGradient(0, 0, 0, -span * 0.65);
    skyGrad.addColorStop(0, '#d8ecfa');
    skyGrad.addColorStop(0.25, '#8ec2eb');
    skyGrad.addColorStop(0.7, '#3f7cac');
    skyGrad.addColorStop(1, '#1c4466');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-span, -span, span * 2, span);

    // Subtle atmospheric cloud wisps
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let i = -3; i <= 3; i++) {
      const cloudX = i * 320 + ((state.time * 18) % 320);
      ctx.beginPath();
      ctx.ellipse(cloudX, -55 - Math.abs(i) * 12, 160, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Deep Ocean Hemisphere (Hangs at the top of the viewport when inverted!)
    const seaGrad = ctx.createLinearGradient(0, 0, 0, span * 0.65);
    seaGrad.addColorStop(0, '#133b54');
    seaGrad.addColorStop(0.2, '#0c283a');
    seaGrad.addColorStop(0.65, '#061724');
    seaGrad.addColorStop(1, '#030b12');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(-span, 0, span * 2, span);

    // Ocean wave glints
    ctx.lineWidth = 1;
    state.seaSparkles.forEach((s) => {
      const sx = ((s.x + state.time * 12) % 2000) - 1000;
      const alpha = 0.06 + 0.08 * Math.sin(state.time * 2 + s.phase);
      ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(sx, s.y);
      ctx.lineTo(sx + s.size * 14, s.y);
      ctx.stroke();
    });

    // 3. Coastal Mountain Wedge & Shoreline
    ctx.beginPath();
    ctx.moveTo(-span, 0);
    ctx.lineTo(-900, -48);
    ctx.lineTo(-620, -64);
    ctx.lineTo(-350, -45);
    ctx.lineTo(-120, -32);
    ctx.lineTo(140, -14);
    ctx.lineTo(340, 0);
    ctx.closePath();

    const mountainGrad = ctx.createLinearGradient(0, -65, 0, 0);
    mountainGrad.addColorStop(0, '#4a5559');
    mountainGrad.addColorStop(0.55, '#6e6a59');
    mountainGrad.addColorStop(1, '#9c8b70');
    ctx.fillStyle = mountainGrad;
    ctx.fill();

    // Coastal ridges
    ctx.strokeStyle = 'rgba(235, 218, 188, 0.32)';
    ctx.lineWidth = 1.4;
    for (let k = -800; k < 240; k += 85) {
      ctx.beginPath();
      ctx.moveTo(k, -3);
      ctx.lineTo(k - 45, -18);
      ctx.stroke();
    }

    // Golden shoreline beach strip
    ctx.strokeStyle = '#d8c39e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-span, 0);
    ctx.lineTo(350, 0);
    ctx.stroke();

    // Crisp horizon glow line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-span, 1);
    ctx.lineTo(span, 1);
    ctx.stroke();

    ctx.restore();
  }

  // Draw stylized vector Stearman Biplane & Wing-Walker silhouette
  function drawBiplaneAndWalker() {
    const anchor = getPlaneAnchor();
    ctx.save();
    ctx.translate(anchor.x, anchor.y);
    ctx.scale(anchor.scale, anchor.scale);

    const planeTilt = state.mouseX * 0.06;
    ctx.rotate(planeTilt);

    // 1. HIGH-SPEED WIND STREAKS
    const speedFactor = state.rpm / 1850;
    ctx.lineWidth = 1.2;
    state.windParticles.forEach((p) => {
      p.x += p.speed * speedFactor;
      if (p.x > 1000) p.x = -1000;
      ctx.strokeStyle = `rgba(226, 232, 240, ${p.alpha})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.length * speedFactor, p.y - 6);
      ctx.stroke();
    });

    // 2. LOWER WING
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(30, 125);
    ctx.lineTo(680, 295);
    ctx.lineTo(680, 390);
    ctx.lineTo(-45, 165);
    ctx.closePath();
    const lowerWingGrad = ctx.createLinearGradient(0, 125, 450, 340);
    lowerWingGrad.addColorStop(0, '#475569');
    lowerWingGrad.addColorStop(0.3, '#cbd5e1');
    lowerWingGrad.addColorStop(0.7, '#64748b');
    lowerWingGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = lowerWingGrad;
    ctx.fill();

    ctx.fillStyle = '#0b0f17';
    ctx.beginPath();
    ctx.moveTo(95, 155);
    ctx.lineTo(680, 315);
    ctx.lineTo(680, 338);
    ctx.lineTo(70, 168);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. LANDING GEAR STRUT & WHEEL
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-112, 206, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#334155';
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(-112, 206, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#090d14';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-60, 145);
    ctx.lineTo(-18, 295);
    ctx.lineTo(6, 295);
    ctx.lineTo(-22, 138);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 4. OBSIDIAN FUSELAGE & RADIAL ENGINE COWLING
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-215, 68);
    ctx.quadraticCurveTo(-235, 115, -205, 165);
    ctx.quadraticCurveTo(-165, 192, -95, 168);
    ctx.lineTo(395, 22);
    ctx.lineTo(415, -8);
    ctx.lineTo(135, 16);
    ctx.lineTo(105, 30);
    ctx.lineTo(52, 32);
    ctx.lineTo(35, 20);
    ctx.lineTo(-140, 42);
    ctx.closePath();

    const fuseGrad = ctx.createLinearGradient(-220, 40, 350, 160);
    fuseGrad.addColorStop(0, '#05070b');
    fuseGrad.addColorStop(0.45, '#111827');
    fuseGrad.addColorStop(1, '#090d14');
    ctx.fillStyle = fuseGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Silver-white fuselage spear stripe with crimson trim
    ctx.beginPath();
    ctx.moveTo(-165, 142);
    ctx.lineTo(-125, 122);
    ctx.lineTo(375, 8);
    ctx.lineTo(375, 16);
    ctx.lineTo(-120, 148);
    ctx.closePath();
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = '#e75a4c';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Pilot in open cockpit
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(82, 16, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(71, 12, 9, 4);
    ctx.restore();

    // 5. CHROME SPINNER & HIGH-RPM PROPELLER
    ctx.save();
    ctx.translate(-225, 125);
    ctx.rotate(-0.18);

    state.propAngle += (state.rpm / 60) * 0.25;
    const propBlurAlpha = Math.min(0.45, state.rpm / 4500);
    const propGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 145);
    propGrad.addColorStop(0, 'rgba(226, 232, 240, 0.5)');
    propGrad.addColorStop(0.7, `rgba(203, 213, 225, ${propBlurAlpha})`);
    propGrad.addColorStop(0.95, 'rgba(255, 159, 28, 0.18)');
    propGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = propGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 148, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let b = 0; b < 2; b++) {
      const ang = state.propAngle + b * Math.PI;
      const bladeY = Math.sin(ang) * 142;
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.65)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * 14, bladeY);
      ctx.stroke();
    }

    const spinnerGrad = ctx.createLinearGradient(-42, -18, 10, 22);
    spinnerGrad.addColorStop(0, '#ffffff');
    spinnerGrad.addColorStop(0.45, '#94a3b8');
    spinnerGrad.addColorStop(0.8, '#1e293b');
    spinnerGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = spinnerGrad;
    ctx.beginPath();
    ctx.moveTo(4, -22);
    ctx.quadraticCurveTo(-52, 0, 4, 22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 6. WING-WALKER FIGURE & HARNESS RIG
    ctx.save();
    const walkerSway = state.mouseX * 4;
    ctx.translate(-42 + walkerSway, -22);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(14, -105);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(10, -60);
    ctx.stroke();

    // Legs
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(-8, -58);
    ctx.moveTo(4, -2);
    ctx.lineTo(2, -58);
    ctx.stroke();

    // Shorts
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-14, -92, 22, 38, 4);
    ctx.fill();

    // Rust-crimson shirt
    ctx.fillStyle = '#d9534f';
    ctx.beginPath();
    ctx.roundRect(-15, -142, 24, 52, 6);
    ctx.fill();

    // Harness belt
    ctx.fillStyle = '#475569';
    ctx.fillRect(-16, -98, 26, 8);

    // Outstretched arms
    const armWave = Math.sin(state.time * 4) * 3;
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(-13, -132);
    ctx.lineTo(-42, -102 + armWave);
    ctx.moveTo(9, -132);
    ctx.lineTo(44, -112 - armWave);
    ctx.stroke();

    // Head & Goggles
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.arc(-3, -156, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-1, -158, 10.5, -Math.PI * 0.85, Math.PI * 0.2);
    ctx.fill();
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(-13, -160, 8, 4);
    ctx.restore();

    // 7. SWEPT METALLIC SILVER TOP WING
    ctx.save();
    const wingGrad = ctx.createLinearGradient(0, -32, 0, 2);
    wingGrad.addColorStop(0, '#f8fafc');
    wingGrad.addColorStop(0.35, '#cbd5e1');
    wingGrad.addColorStop(0.75, '#475569');
    wingGrad.addColorStop(1, '#1e293b');

    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(-255, -14);
    ctx.lineTo(720, -36);
    ctx.lineTo(720, 4);
    ctx.lineTo(-250, -2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-255, -14);
    ctx.lineTo(720, -36);
    ctx.stroke();
    ctx.restore();

    // 8. N-STRUTS & INTERACTIVE PLUCKABLE FLYING WIRES
    ctx.save();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 5;
    const struts = [
      [-175, -8, -145, 78],
      [-55, -10, -40, 58],
      [60, -14, 30, 45],
      [215, -18, 285, 185]
    ];
    struts.forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    let totalTensionEnergy = 0;
    const localMouseX = (state.rawMouseX - anchor.x) / anchor.scale;
    const localMouseY = (state.rawMouseY - anchor.y) / anchor.scale;

    state.wires.forEach((w) => {
      const d = distToSegment(localMouseX, localMouseY, w.x1, w.y1, w.x2, w.y2);
      if (d < 16 && Math.abs(w.vel) < 4) {
        w.vel = (Math.random() > 0.5 ? 1 : -1) * 11;
        playWirePluck(w.freq);
      }

      const k = 0.28;
      const damp = 0.90;
      const accel = -k * w.vib;
      w.vel = (w.vel + accel) * damp;
      w.vib += w.vel;
      totalTensionEnergy += Math.abs(w.vib);

      const midX = (w.x1 + w.x2) * 0.5;
      const midY = (w.y1 + w.y2) * 0.5 + w.vib;

      ctx.strokeStyle = Math.abs(w.vib) > 1.5 ? '#ff9f1c' : 'rgba(226, 232, 240, 0.68)';
      ctx.lineWidth = Math.abs(w.vib) > 1.5 ? 2.0 : 1.25;
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.quadraticCurveTo(midX, midY, w.x2, w.y2);
      ctx.stroke();
    });

    const tensionPct = Math.min(100, Math.round(64 + totalTensionEnergy * 1.8));
    if (tensionFill) tensionFill.style.width = `${tensionPct}%`;
    ctx.restore();

    ctx.restore();
  }

  // Synchronize Cockpit Analog Gauges & Simulator HUD
  function updateTelemetry() {
    const targetRoll = state.baseRollDeg + state.mouseX * 16;
    state.currentRollDeg += (targetRoll - state.currentRollDeg) * 0.08;

    const targetPitch = state.mouseY * 42;
    state.pitchOffset += (targetPitch - state.pitchOffset) * 0.08;

    state.rpm += (state.targetRpm - state.rpm) * 0.1;

    const targetSpeed = Math.round(95 + (state.rpm / 2400) * 68 - state.mouseY * 8);
    state.airspeed += (targetSpeed - state.airspeed) * 0.1;

    const baseG = state.isInverted ? -1.8 : 1.2;
    const dynamicG = baseG - state.mouseY * 0.6 + (Math.abs(state.mouseX) * 0.3);
    state.gForce += (dynamicG - state.gForce) * 0.1;

    let normRoll = ((state.currentRollDeg + 180) % 360 + 360) % 360 - 180;
    rollReadout.textContent = `ROLL ${normRoll >= 0 ? '+' : ''}${Math.round(normRoll)}°`;
    gReadout.textContent = `${state.gForce >= 0 ? '+' : ''}${state.gForce.toFixed(1)} G`;
    rpmReadout.textContent = `${Math.round(state.rpm)} RPM`;
    speedValue.textContent = Math.round(state.airspeed);

    const currentAlt = Math.round(state.altitude - state.pitchOffset * 4);
    altValue.textContent = `${currentAlt.toLocaleString()} FT`;

    // Update Stearman Cockpit Analog Dials
    if (cockpitHorizonDial) {
      cockpitHorizonDial.style.transform = `rotate(${normRoll}deg) translateY(${state.mouseY * 8}px)`;
    }
    if (airspeedNeedle) {
      // Map 80..180 KIAS to -110deg..+110deg
      const speedDeg = ((state.airspeed - 130) / 50) * 95;
      airspeedNeedle.style.transform = `rotate(${speedDeg}deg)`;
    }
    if (gforceNeedle) {
      // Map -3G..+3G to needle angle
      const gDeg = (state.gForce / 3) * 95;
      gforceNeedle.style.transform = `rotate(${gDeg}deg)`;
    }

    // Update Simulator Compass & Center Reticle
    const compassShift = -110 + state.mouseX * 60;
    compassTrack.style.transform = `translateX(${compassShift}px)`;

    hudHorizonRing.setAttribute(
      'transform',
      `rotate(${normRoll}) translate(0, ${state.mouseY * 18})`
    );
  }

  function animate() {
    state.time += 0.016;
    ctx.clearRect(0, 0, state.width, state.height);

    updateTelemetry();
    drawHorizonWorld();
    drawBiplaneAndWalker();

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();
