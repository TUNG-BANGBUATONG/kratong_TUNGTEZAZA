// ============================================================================
// LOY KRATHONG 8-BIT PIXEL ART WORLD + SUPABASE REALTIME MULTIPLAYER
// ============================================================================

const SUPABASE_URL = 'https://yymwkncwwwdiwtkdjuxu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NcWHXfPp6qChd7LtD9kRMQ_9ZkhiOhE';

// Initialize Supabase Client
let supabaseClient = null;
try {
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
} catch (err) {
  console.warn('Supabase client init warning:', err);
}

// ============================================================================
// APPLICATION STATE
// ============================================================================
const state = {
  krathongs: [],          // Active floating Krathong entities in the river
  krathongMap: new Map(), // id -> krathong entity
  stars: [],              // Twinkling pixel stars
  lanterns: [],           // Sky lanterns (โคมลอย)
  fireworks: [],          // Rocket projectiles + pixel explosion particles
  ripples: [],            // Extra water surface sparkles
  hoveredKrathong: null,
  selectedKrathong: null,
  followedKrathongId: null,
  tick: 0,

  // Customizer current selection
  builder: {
    base_style: 'banana',
    flower_style: 'lotus_pink',
    candle_style: 'classic',
    topping_style: 'coin',
    lane: 1
  },

  // 3D Throw / Aiming Mode State (Originating from the connected South Pier at X=-14, Z=12.5)
  throwMode: {
    active: false,
    charging: false,
    power: 0,       // 0.0 to 1.0
    powerDir: 1,
    aimX3D: -4,     // 3D river target X
    aimZ3D: 2,      // 3D river target Z
    draftPayload: null
  }
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const sceneCanvas = document.getElementById('sceneCanvas');
const ctx = sceneCanvas.getContext('2d');

const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');

const inspectCanvas = document.getElementById('inspectCanvas');
const inspectCtx = inspectCanvas.getContext('2d');

const totalKrathongCountEl = document.getElementById('totalKrathongCount');
const onlineStatusTextEl = document.getElementById('onlineStatusText');
const connectionBadgeEl = document.getElementById('connectionBadge');
const toastContainer = document.getElementById('toastContainer');

// Modals & Drawers
const builderModal = document.getElementById('builderModal');
const inspectModal = document.getElementById('inspectModal');
const wishesDrawer = document.getElementById('wishesDrawer');
const wishesListEl = document.getElementById('wishesList');
const searchWishInput = document.getElementById('searchWishInput');

// ============================================================================
// SCENE GEOMETRY & RESIZE
// ============================================================================
let W = window.innerWidth;
let H = window.innerHeight;
let horizonY = Math.floor(H * 0.48);

function resizeScene() {
  W = window.innerWidth;
  H = window.innerHeight;
  sceneCanvas.width = W;
  sceneCanvas.height = H;
  ctx.imageSmoothingEnabled = false;
  horizonY = Math.floor(H * 0.47);
  initStars();
}

window.addEventListener('resize', resizeScene);

function initStars() {
  state.stars = [];
  const count = Math.floor((W * horizonY) / 4800);
  for (let i = 0; i < count; i++) {
    state.stars.push({
      x: Math.floor(Math.random() * W),
      y: Math.floor(Math.random() * (horizonY - 35)),
      size: Math.random() > 0.75 ? 4 : 2,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() > 0.8 ? '#ffe57f' : '#e0f2f1'
    });
  }
}

function initAmbientLanterns() {
  state.lanterns = [];
  for (let i = 0; i < 9; i++) {
    spawnSkyLantern(Math.random() * W, Math.random() * (horizonY - 30));
  }
}

function spawnSkyLantern(x, y) {
  state.lanterns.push({
    x: x ?? (W * 0.15 + Math.random() * W * 0.7),
    y: y ?? (horizonY - 10),
    vx: (Math.random() - 0.35) * 0.25,
    vy: -(0.18 + Math.random() * 0.22),
    scale: Math.random() > 0.5 ? 3 : 2,
    wobblePhase: Math.random() * Math.PI * 2
  });
}

// ============================================================================
// FIREWORKS SYSTEM (8-BIT PIXEL BURSTS)
// ============================================================================
const FIREWORK_PALETTES = [
  ['#ff2a85', '#00f5d4', '#ffd166'],
  ['#ff5e7e', '#c77dff', '#ffffff'],
  ['#00f5d4', '#ff9e64', '#ff2a85'],
  ['#ff007f', '#72efdd', '#ffe57f'],
  ['#ff7b54', '#ff2a85', '#ffffff']
];

function launchFirework(targetX, targetY) {
  const tx = targetX ?? (W * 0.15 + Math.random() * W * 0.7);
  const ty = targetY ?? (65 + Math.random() * (horizonY * 0.55));
  const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];

  state.fireworks.push({
    type: 'rocket',
    x: tx + (Math.random() - 0.5) * 40,
    y: horizonY,
    tx,
    ty,
    vy: -7.5,
    palette
  });

  if (window.retroAudio) {
    window.retroAudio.playFireworkSfx();
  }
}

function explodeFirework(x, y, palette) {
  if (window.retroAudio) {
    window.retroAudio.playFireworkBoomSfx();
  }
  const count = 28;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.15;
    const speed = 1.2 + Math.random() * 2.8;
    state.fireworks.push({
      type: 'spark',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.016 + Math.random() * 0.015,
      color: palette[i % palette.length],
      size: Math.random() > 0.4 ? 4 : 3
    });
  }
}

// ============================================================================
// KRATHONG ENTITY MANAGEMENT
// ============================================================================
function getLaneMetrics(laneIndex) {
  const clamped = Math.max(0, Math.min(3, Number(laneIndex) || 0));
  const riverTop = horizonY + 34;
  const riverBottom = H - 78;
  const usableHeight = Math.max(140, riverBottom - riverTop);

  // Perspective lanes: lane 0 is further away (smaller & slower), lane 3 is closer (larger & faster)
  const ratios = [0.16, 0.40, 0.66, 0.90];
  const scales = [2.2, 2.75, 3.3, 3.9];
  const speeds = [0.28, 0.42, 0.58, 0.76];

  return {
    baseY: riverTop + usableHeight * ratios[clamped],
    scale: scales[clamped],
    speed: speeds[clamped]
  };
}

function upsertKrathongEntity(record, options = { isNewlyLaunched: false }) {
  if (!record || !record.id) return null;

  if (state.krathongMap.has(record.id)) {
    const existing = state.krathongMap.get(record.id);
    existing.likes_count = record.likes_count ?? existing.likes_count;
    existing.sender_name = record.sender_name || existing.sender_name;
    existing.wish_message = record.wish_message || existing.wish_message;
    return existing;
  }

  const lane = Number(record.lane ?? 1) % 4;
  const metrics = getLaneMetrics(lane);

  const startX = options.startX !== undefined
    ? options.startX
    : (options.isNewlyLaunched
        ? Math.max(110, W * 0.12)
        : (80 + Math.random() * Math.max(300, W - 180)));

  const entity = {
    id: record.id,
    sender_name: record.sender_name || 'ผู้ลอยกระทงนิรนาม',
    wish_message: record.wish_message || 'ขอให้มีความสุขในคืนวันเพ็ญ',
    base_style: record.base_style || 'banana',
    flower_style: record.flower_style || 'lotus_pink',
    candle_style: record.candle_style || 'classic',
    topping_style: record.topping_style || 'coin',
    lane,
    likes_count: Number(record.likes_count || 0),
    created_at: record.created_at || new Date().toISOString(),
    x: startX,
    y: metrics.baseY,
    bobPhase: Math.random() * Math.PI * 2,
    speedMultiplier: 0.85 + Math.random() * 0.3,
    throwAnim: options.throwAnim || null
  };

  state.krathongMap.set(entity.id, entity);
  state.krathongs.push(entity);

  // Sort by lane so closer Krathongs draw in front of distant ones
  state.krathongs.sort((a, b) => a.lane - b.lane);

  updateHUDCounters();
  renderWishesDrawerList();
  return entity;
}

function updateHUDCounters() {
  totalKrathongCountEl.textContent = state.krathongs.length.toLocaleString();
}

// ============================================================================
// SUPABASE REALTIME & DATA SYNC
// ============================================================================
async function loadInitialKrathongs() {
  if (!supabaseClient) {
    setConnectionStatus(false, 'OFFLINE');
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('krathongs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    if (data && data.length > 0) {
      // Spread initial krathongs evenly across the river width
      data.forEach((row, idx) => {
        const entity = upsertKrathongEntity(row, { isNewlyLaunched: false });
        if (entity) {
          entity.x = ((idx * 210) % Math.max(400, W - 120)) + 60;
        }
      });
    }

    setConnectionStatus(true, 'SUPABASE LIVE');
    subscribeRealtimeKrathongs();
  } catch (err) {
    console.error('Failed loading krathongs from Supabase:', err);
    setConnectionStatus(false, 'OFFLINE MODE');
  }
}

function subscribeRealtimeKrathongs() {
  if (!supabaseClient) return;

  supabaseClient
    .channel('public:krathongs')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'krathongs' },
      (payload) => {
        const row = payload.new;
        if (!state.krathongMap.has(row.id)) {
          const entity = upsertKrathongEntity(row, { isNewlyLaunched: true });
          showToast(`🪷 "${entity.sender_name}" เพิ่งลอยกระทงลงสู่แม่น้ำ!`);
          launchFirework(entity.x + 80, horizonY * 0.45);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'krathongs' },
      (payload) => {
        const row = payload.new;
        if (state.krathongMap.has(row.id)) {
          const entity = state.krathongMap.get(row.id);
          entity.likes_count = row.likes_count;
          if (state.selectedKrathong && state.selectedKrathong.id === row.id) {
            document.getElementById('inspectLikesCount').textContent = row.likes_count;
          }
          renderWishesDrawerList();
        }
      }
    )
    .subscribe();
}

function setConnectionStatus(isOnline, label) {
  if (!onlineStatusTextEl || !connectionBadgeEl) return;
  onlineStatusTextEl.textContent = label;
  const dot = connectionBadgeEl.querySelector('.dot');
  if (!dot) return;
  if (isOnline) {
    dot.classList.remove('offline');
    dot.classList.add('live');
  } else {
    dot.classList.remove('live');
    dot.classList.add('offline');
  }
}



// ============================================================================
// MAIN PIXEL ART SCENE RENDERER
// ============================================================================
function drawPixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function renderNightSky() {
  // Stepped 8-bit gradient night sky
  const bands = [
    { ratio: 0.00, color: '#070817' },
    { ratio: 0.22, color: '#0c102b' },
    { ratio: 0.48, color: '#141b42' },
    { ratio: 0.72, color: '#1f285c' },
    { ratio: 0.90, color: '#2c3575' }
  ];

  for (let i = 0; i < bands.length; i++) {
    const yStart = Math.floor(horizonY * bands[i].ratio);
    const yEnd = i < bands.length - 1 ? Math.floor(horizonY * bands[i + 1].ratio) : horizonY;
    drawPixelRect(0, yStart, W, yEnd - yStart + 1, bands[i].color);
  }

  // Twinkling pixel stars
  state.stars.forEach((st) => {
    const twinkle = Math.sin(state.tick * 2.5 + st.phase);
    if (twinkle > -0.4) {
      drawPixelRect(st.x, st.y, st.size, st.size, st.color);
    }
  });

  // Giant Pixel Full Moon (คืนวันเพ็ญเดือนสิบสอง)
  const moonX = Math.floor(W * 0.76);
  const moonY = Math.floor(horizonY * 0.34);
  const p = 5; // Moon pixel scale

  // Outer moon glow aura
  ctx.fillStyle = 'rgba(255, 232, 140, 0.08)';
  ctx.fillRect(moonX - 16 * p, moonY - 16 * p, 32 * p, 32 * p);
  ctx.fillStyle = 'rgba(255, 232, 140, 0.14)';
  ctx.fillRect(moonX - 12 * p, moonY - 12 * p, 24 * p, 24 * p);

  // Pixelated circle moon body
  const moonRows = [
    [-4, 8],
    [-6, 12],
    [-7, 14],
    [-8, 16],
    [-8, 16],
    [-9, 18],
    [-9, 18],
    [-9, 18],
    [-9, 18],
    [-9, 18],
    [-8, 16],
    [-8, 16],
    [-7, 14],
    [-6, 12],
    [-4, 8]
  ];
  moonRows.forEach(([startOff, width], rowIdx) => {
    const ry = moonY + (rowIdx - 7) * p;
    drawPixelRect(moonX + startOff * p, ry, width * p, p, '#fff3b0');
  });

  // Subtle moon craters (rabbit in the moon silhouette!)
  drawPixelRect(moonX - 3 * p, moonY - 2 * p, 4 * p, 3 * p, '#f2d379');
  drawPixelRect(moonX + 1 * p, moonY + 1 * p, 3 * p, 3 * p, '#f2d379');
  drawPixelRect(moonX - 5 * p, moonY + 2 * p, 2 * p, 2 * p, '#f2d379');
}

function renderTempleSilhouette() {
  // Rich Bangkok Riverside City Skyline + Wat Arun + Ferris Wheel + Rama VIII Bridge
  const baseLine = horizonY;

  // Distant city base embankment
  drawPixelRect(0, baseLine - 12, W, 12, '#0b0e24');

  // 1. High-rise City Skyscrapers & Lit Windows across the horizon
  const buildings = [
    { rx: 0.04, w: 38, h: 95, color: '#101536', neon: '#ff4081' },
    { rx: 0.09, w: 46, h: 135, color: '#131940', neon: '#00e5ff' },
    { rx: 0.15, w: 34, h: 78, color: '#0f1433', neon: null },
    { rx: 0.34, w: 52, h: 150, color: '#12183d', neon: '#ffd740' },
    { rx: 0.40, w: 40, h: 110, color: '#151c47', neon: '#69f0ae' },
    { rx: 0.62, w: 48, h: 142, color: '#11173b', neon: '#ff4081' },
    { rx: 0.68, w: 56, h: 175, color: '#141b45', neon: '#40c4ff' },
    { rx: 0.75, w: 38, h: 105, color: '#101538', neon: null },
    { rx: 0.90, w: 45, h: 128, color: '#131a42', neon: '#e040fb' }
  ];

  buildings.forEach((b, bIdx) => {
    const bx = Math.floor(W * b.rx);
    const by = baseLine - b.h;
    drawPixelRect(bx, by, b.w, b.h, b.color);

    // Rooftop neon sign / beacon
    if (b.neon) {
      drawPixelRect(bx + 6, by - 6, b.w - 12, 4, b.neon);
    }

    // Pixel window grid
    for (let wy = by + 10; wy < baseLine - 16; wy += 10) {
      for (let wx = bx + 6; wx < bx + b.w - 8; wx += 8) {
        if (((wx * 13 + wy * 7 + bIdx) % 5) !== 0) {
          const winColor = ((wx + wy) % 3 === 0) ? '#ffe57f' : '#80d8ff';
          drawPixelRect(wx, wy, 4, 5, winColor);
        }
      }
    }
  });

  // 2. Suspension Bridge (สะพานพระราม 8) on the right side
  const towerX = Math.floor(W * 0.83);
  drawPixelRect(towerX - 5, baseLine - 160, 10, 160, '#26326e');
  drawPixelRect(towerX - 2, baseLine - 175, 4, 15, '#ffd54f');
  // Bridge deck
  drawPixelRect(Math.floor(W * 0.68), baseLine - 28, Math.floor(W * 0.30), 6, '#303f8c');
  // Golden suspension cables
  for (let i = 1; i <= 7; i++) {
    const cableOffset = i * 16;
    drawPixelRect(towerX - cableOffset, baseLine - 150 + i * 17, 3, 3, '#ffd54f');
    drawPixelRect(towerX + cableOffset, baseLine - 150 + i * 17, 3, 3, '#ffd54f');
  }

  // 3. Temple Chedi Cluster (วัดอรุณริมน้ำ)
  const cx = Math.floor(W * 0.25);
  const scale = 4;
  drawPixelRect(cx - 10 * scale, baseLine - 6 * scale, 20 * scale, 6 * scale, '#161b3d');
  drawPixelRect(cx - 7 * scale, baseLine - 12 * scale, 14 * scale, 6 * scale, '#161b3d');
  drawPixelRect(cx - 4 * scale, baseLine - 18 * scale, 8 * scale, 6 * scale, '#161b3d');
  drawPixelRect(cx - 2 * scale, baseLine - 24 * scale, 4 * scale, 6 * scale, '#161b3d');
  drawPixelRect(cx - 1 * scale, baseLine - 31 * scale, 2 * scale, 7 * scale, '#f5b942');

  // Promenade street lamps along the embankment
  for (let lx = 16; lx < W; lx += 38) {
    const flicker = Math.sin(state.tick * 4 + lx) > 0 ? '#ffd54f' : '#ff4081';
    drawPixelRect(lx, baseLine - 5, 4, 4, flicker);
  }
}

function renderSkyLanterns() {
  state.lanterns.forEach((lt) => {
    lt.x += lt.vx + Math.sin(state.tick * 1.5 + lt.wobblePhase) * 0.15;
    lt.y += lt.vy;

    if (lt.y < -30) {
      lt.y = horizonY - 12;
      lt.x = Math.random() * W;
    }

    const s = lt.scale;
    const x = Math.floor(lt.x);
    const y = Math.floor(lt.y);

    // Warm outer glow
    drawPixelRect(x - 3 * s, y - 3 * s, 6 * s, 6 * s, 'rgba(255, 160, 40, 0.18)');
    // Lantern cylinder body
    drawPixelRect(x - 2 * s, y - 2 * s, 4 * s, 4 * s, '#ff8f00');
    drawPixelRect(x - 1 * s, y - 2 * s, 2 * s, 3 * s, '#ffd54f');
    // Bright flame at bottom of lantern
    drawPixelRect(x - 1 * s, y + 1 * s, 2 * s, 1 * s, '#ffffff');
  });
}

function renderFireworks() {
  // When R3F 3D scene is active, VoxelFireworks in r3f-scene.js handles updating firework physics
  if (document.getElementById('r3fRoot')) return;
  for (let i = state.fireworks.length - 1; i >= 0; i--) {
    const fw = state.fireworks[i];
    if (fw.type === 'rocket') {
      fw.y += fw.vy;
      drawPixelRect(fw.x, fw.y, 4, 6, '#ffe57f');
      drawPixelRect(fw.x, fw.y + 6, 3, 4, '#ff6d00');
      if (fw.y <= fw.ty) {
        explodeFirework(fw.x, fw.y, fw.palette);
        state.fireworks.splice(i, 1);
      }
    } else {
      fw.x += fw.vx;
      fw.y += fw.vy;
      fw.vy += 0.04; // Gravity
      fw.life -= fw.decay;

      if (fw.life <= 0) {
        state.fireworks.splice(i, 1);
      } else {
        ctx.globalAlpha = Math.max(0, fw.life);
        drawPixelRect(fw.x, fw.y, fw.size, fw.size, fw.color);
        ctx.globalAlpha = 1.0;
      }
    }
  }
}

function renderRiverAndReflections() {
  const riverHeight = H - horizonY;

  // Deep pixel river bands
  const riverBands = [
    { ratio: 0.00, color: '#0d1b3d' },
    { ratio: 0.18, color: '#10234d' },
    { ratio: 0.42, color: '#132a5c' },
    { ratio: 0.70, color: '#0f224a' },
    { ratio: 0.88, color: '#0a1736' }
  ];

  for (let i = 0; i < riverBands.length; i++) {
    const yStart = horizonY + Math.floor(riverHeight * riverBands[i].ratio);
    const yEnd = i < riverBands.length - 1
      ? horizonY + Math.floor(riverHeight * riverBands[i + 1].ratio)
      : H;
    drawPixelRect(0, yStart, W, yEnd - yStart + 1, riverBands[i].color);
  }

  // Moon reflection column shimmering on the water
  const moonX = Math.floor(W * 0.76);
  for (let ry = horizonY + 8; ry < H - 40; ry += 10) {
    const progress = (ry - horizonY) / riverHeight;
    const spread = 18 + progress * 65;
    const shift = Math.sin(state.tick * 3 + ry * 0.15) * (8 + progress * 14);
    drawPixelRect(
      moonX - spread / 2 + shift,
      ry,
      spread,
      4,
      'rgba(255, 236, 150, 0.22)'
    );
  }

  // Animated pixel water current lines
  for (let row = 0; row < 18; row++) {
    const wy = horizonY + 16 + (row * (riverHeight / 18));
    const speed = 12 + row * 2.5;
    const waveX = ((state.tick * speed + row * 97) % (W + 120)) - 60;
    drawPixelRect(waveX, wy, 28 + (row % 3) * 14, 2, 'rgba(120, 190, 255, 0.18)');
  }
}

function renderWoodenPier() {
  // Traditional Thai wooden pier (ท่าน้ำไม้สัก) on the bottom-left foreground
  const pierY = horizonY + 26;
  const pierW = 92;

  // Pier stilts in water
  drawPixelRect(14, pierY + 20, 10, 75, '#2b1810');
  drawPixelRect(64, pierY + 20, 10, 75, '#2b1810');

  // Wooden deck planks
  drawPixelRect(0, pierY, pierW, 22, '#5d3a1a');
  drawPixelRect(0, pierY, pierW, 5, '#7c4dff');
  drawPixelRect(0, pierY, pierW, 6, '#8b5a2b');
  for (let px = 8; px < pierW; px += 16) {
    drawPixelRect(px, pierY + 2, 2, 18, '#3d230e');
  }

  // Hanging pier lantern post
  drawPixelRect(72, pierY - 46, 5, 46, '#4a2c11');
  drawPixelRect(72, pierY - 46, 18, 4, '#4a2c11');
  // Glowing lantern at pier
  const glowSize = Math.sin(state.tick * 5) > 0 ? 14 : 12;
  drawPixelRect(85 - glowSize / 2, pierY - 36, glowSize, glowSize, 'rgba(255, 190, 60, 0.28)');
  drawPixelRect(81, pierY - 38, 8, 12, '#ffab00');
  drawPixelRect(83, pierY - 36, 4, 8, '#fff59d');
}

function renderFloatingKrathongs() {
  state.hoveredKrathong = null;

  state.krathongs.forEach((k) => {
    const metrics = getLaneMetrics(k.lane);

    // Move horizontally with gentle river current
    k.x += metrics.speed * k.speedMultiplier;
    if (k.x > W + 90) {
      k.x = -70;
    }

    // Gentle vertical bobbing wave
    const bobOffset = Math.sin(state.tick * 2.6 + k.bobPhase) * 3.5;
    k.y = metrics.baseY + bobOffset;

    const scale = metrics.scale;

    // Spotlight ring if user is following or hovering this Krathong
    const isFollowed = state.followedKrathongId === k.id;
    const isHovered = isPointInsideKrathong(mousePos.x, mousePos.y, k, scale);
    if (isHovered) {
      state.hoveredKrathong = k;
    }

    if (isFollowed || isHovered) {
      drawPixelRect(
        k.x - 18 * scale,
        k.y + 7 * scale,
        36 * scale,
        4 * scale,
        isFollowed ? 'rgba(77, 238, 234, 0.45)' : 'rgba(255, 226, 138, 0.35)'
      );
    }

    // Draw the 32x32 pixel Krathong sprite
    window.drawPixelKrathong(ctx, k.x, k.y, scale, k, state.tick, true);

    // Floating Pixel Nameplate & Wish Tag above or below the Krathong
    renderKrathongNameTag(k, scale, isHovered || isFollowed);
  });

  sceneCanvas.style.cursor = state.hoveredKrathong ? 'pointer' : 'crosshair';
}

function renderKrathongNameTag(k, scale, isHighlighted) {
  const tagY = Math.floor(k.y + 13 * scale);
  ctx.font = isHighlighted ? '700 13px "Chakra Petch", sans-serif' : '600 11px "Chakra Petch", sans-serif';
  const label = k.likes_count > 0 ? `${k.sender_name} ♥${k.likes_count}` : k.sender_name;
  const textWidth = ctx.measureText(label).width;

  const boxW = textWidth + 14;
  const boxH = 20;
  const boxX = Math.floor(k.x - boxW / 2);

  // Pixel tag background
  ctx.fillStyle = isHighlighted ? 'rgba(28, 35, 88, 0.95)' : 'rgba(10, 14, 36, 0.78)';
  ctx.fillRect(boxX, tagY, boxW, boxH);

  ctx.strokeStyle = isHighlighted ? '#f5b942' : 'rgba(120, 145, 225, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, tagY, boxW, boxH);

  ctx.fillStyle = isHighlighted ? '#ffe28a' : '#e6ecff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, Math.floor(k.x), tagY + boxH / 2 + 1);

  // If hovered or followed, show a preview speech bubble of the wish above the candle!
  if (isHighlighted) {
    const shortWish = k.wish_message.length > 36
      ? k.wish_message.slice(0, 36) + '...'
      : k.wish_message;
    ctx.font = '600 12px "Chakra Petch", sans-serif';
    const wishW = ctx.measureText(shortWish).width + 20;
    const wishH = 26;
    const wishX = Math.floor(k.x - wishW / 2);
    const wishY = Math.floor(k.y - 16 * scale - 24);

    ctx.fillStyle = 'rgba(20, 24, 62, 0.96)';
    ctx.fillRect(wishX, wishY, wishW, wishH);
    ctx.strokeStyle = '#4deeea';
    ctx.lineWidth = 2;
    ctx.strokeRect(wishX, wishY, wishW, wishH);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`"${shortWish}"`, Math.floor(k.x), wishY + wishH / 2 + 1);
  }
}

function isPointInsideKrathong(px, py, k, scale) {
  const halfW = 14 * scale;
  const halfH = 14 * scale;
  return (
    px >= k.x - halfW &&
    px <= k.x + halfW &&
    py >= k.y - halfH &&
    py <= k.y + halfH + 22
  );
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================
const mousePos = { x: -999, y: -999 };

function animate() {
  state.tick += 0.016;

  // Update throw power meter oscillation if user is holding charge
  if (state.throwMode.active && state.throwMode.charging) {
    state.throwMode.power += 0.022 * state.throwMode.powerDir;
    if (state.throwMode.power >= 1) {
      state.throwMode.power = 1;
      state.throwMode.powerDir = -1;
    } else if (state.throwMode.power <= 0.1) {
      state.throwMode.power = 0.1;
      state.throwMode.powerDir = 1;
    }
    const pct = Math.round(state.throwMode.power * 100);
    const fillEl = document.getElementById('throwPowerFill');
    const textEl = document.getElementById('throwPowerText');
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (textEl) textEl.textContent = `กำลังชาร์จแรงโยน: ${pct}% (ปล่อยเมาส์เพื่อโยน!)`;
  }

  ctx.clearRect(0, 0, W, H);
  renderNightSky();
  renderSkyLanterns();
  renderTempleSilhouette();
  renderFireworks();
  renderRiverAndReflections();
  renderWoodenPier();
  renderFloatingKrathongs();

  // Also animate the Builder & Inspect modal preview canvases if open
  if (!builderModal.classList.contains('hidden')) {
    renderBuilderPreview();
  }
  if (!inspectModal.classList.contains('hidden') && state.selectedKrathong) {
    renderInspectPreview(state.selectedKrathong);
  }

  requestAnimationFrame(animate);
}

// ============================================================================
// INTERACTION: CANVAS CLICK (INSPECT KRATHONG OR LAUNCH FIREWORK)
// ============================================================================
sceneCanvas.addEventListener('mousemove', (e) => {
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
});

sceneCanvas.addEventListener('click', (e) => {
  const cx = e.clientX;
  const cy = e.clientY;

  // Check if user clicked on a floating Krathong (check front-most lane first)
  for (let i = state.krathongs.length - 1; i >= 0; i--) {
    const k = state.krathongs[i];
    const metrics = getLaneMetrics(k.lane);
    if (isPointInsideKrathong(cx, cy, k, metrics.scale)) {
      openInspectModal(k);
      return;
    }
  }
});

// ============================================================================
// KRATHONG BUILDER & CUSTOMIZER UI
// ============================================================================
function initBuilderUI() {
  renderOptionButtons('baseOptions', window.KRATHONG_PARTS.bases, 'base_style');
  renderOptionButtons('flowerOptions', window.KRATHONG_PARTS.flowers, 'flower_style');
  renderOptionButtons('candleOptions', window.KRATHONG_PARTS.candles, 'candle_style');
  renderOptionButtons('toppingOptions', window.KRATHONG_PARTS.toppings, 'topping_style');

  // Lane selector buttons
  const laneBtns = document.querySelectorAll('#laneOptions .lane-btn');
  laneBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (window.retroAudio) window.retroAudio.playClickSfx();
      laneBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.builder.lane = Number(btn.dataset.lane);
    });
  });

  // Randomize Krathong button
  document.getElementById('btnRandomizeKrathong').addEventListener('click', () => {
    if (window.retroAudio) window.retroAudio.playClickSfx();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
    state.builder.base_style = pick(window.KRATHONG_PARTS.bases);
    state.builder.flower_style = pick(window.KRATHONG_PARTS.flowers);
    state.builder.candle_style = pick(window.KRATHONG_PARTS.candles);
    state.builder.topping_style = pick(window.KRATHONG_PARTS.toppings);
    refreshBuilderButtonHighlights();
    updatePreviewSummaryText();
  });

  // Random sample wish button
  const wishTextarea = document.getElementById('wishMessage');
  const charCountEl = document.getElementById('charCount');

  document.getElementById('btnSampleWish').addEventListener('click', () => {
    if (window.retroAudio) window.retroAudio.playClickSfx();
    const sample = window.SAMPLE_WISHES[Math.floor(Math.random() * window.SAMPLE_WISHES.length)];
    wishTextarea.value = sample;
    charCountEl.textContent = sample.length;
  });

  wishTextarea.addEventListener('input', () => {
    charCountEl.textContent = wishTextarea.value.length;
  });

  updatePreviewSummaryText();
}

function renderOptionButtons(containerId, items, stateKey) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'part-option-btn' + (state.builder[stateKey] === item.id ? ' selected' : '');
    btn.dataset.key = stateKey;
    btn.dataset.id = item.id;
    btn.innerHTML = `<span>${item.icon}</span><span>${item.name}</span>`;
    btn.addEventListener('click', () => {
      state.builder[stateKey] = item.id;
      if (window.retroAudio) window.retroAudio.playClickSfx(720);
      refreshBuilderButtonHighlights();
      updatePreviewSummaryText();
    });
    container.appendChild(btn);
  });
}

function refreshBuilderButtonHighlights() {
  document.querySelectorAll('.part-option-btn').forEach((btn) => {
    const key = btn.dataset.key;
    const id = btn.dataset.id;
    btn.classList.toggle('selected', state.builder[key] === id);
  });
}

function updatePreviewSummaryText() {
  const findName = (arr, id) => (arr.find((x) => x.id === id) || arr[0]).name;
  const bName = findName(window.KRATHONG_PARTS.bases, state.builder.base_style);
  const fName = findName(window.KRATHONG_PARTS.flowers, state.builder.flower_style);
  const cName = findName(window.KRATHONG_PARTS.candles, state.builder.candle_style);
  document.getElementById('previewStyleSummary').textContent = `${bName} • ${fName} • ${cName}`;
}

function renderBuilderPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.imageSmoothingEnabled = false;

  // Mini water surface in preview box
  previewCtx.fillStyle = '#112552';
  previewCtx.fillRect(0, 155, 220, 65);

  const bob = Math.sin(state.tick * 3) * 3;
  window.drawPixelKrathong(
    previewCtx,
    110,
    115 + bob,
    5.5,
    state.builder,
    state.tick,
    true
  );
}

// ============================================================================
// FORM SUBMISSION & 3D THROW / AIMING SYSTEM
// ============================================================================
const throwHudEl = document.getElementById('throwHud');

function buildDraftPayloadFromForm() {
  const senderInput = document.getElementById('senderName');
  const wishInput = document.getElementById('wishMessage');
  const sender_name = senderInput.value.trim();
  const wish_message = wishInput.value.trim();

  if (!sender_name || !wish_message) {
    showToast('⚠️ กรุณากรอกชื่อและคำอธิษฐานก่อนปล่อยหรือโยนกระทงครับ');
    if (!sender_name) senderInput.focus();
    else wishInput.focus();
    return null;
  }

  return {
    sender_name,
    wish_message,
    base_style: state.builder.base_style,
    flower_style: state.builder.flower_style,
    candle_style: state.builder.candle_style,
    topping_style: state.builder.topping_style,
    lane: state.builder.lane
  };
}

async function saveAndSpawnKrathong(payload, throwOptions = null) {
  let savedRecord = null;
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('krathongs')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      savedRecord = data;
    } catch (err) {
      console.error('Supabase insert fallback:', err);
    }
  }

  if (!savedRecord) {
    savedRecord = {
      ...payload,
      id: 'local-' + Date.now(),
      likes_count: 0,
      created_at: new Date().toISOString()
    };
  }

  const entity = upsertKrathongEntity(savedRecord, {
    isNewlyLaunched: true,
    startX: throwOptions ? throwOptions.landingPxX : undefined,
    throwAnim: throwOptions ? throwOptions.throwAnim : null
  });

  if (entity) {
    state.followedKrathongId = entity.id;
  }

  if (throwOptions && throwOptions.throwAnim) {
    // Play air whoosh now, then water splash on impact!
    if (window.retroAudio) {
      window.retroAudio.playThrowWhooshSfx(throwOptions.power || 0.7);
      setTimeout(() => {
        window.retroAudio.playSplashSfx();
      }, 680);
    }
  } else if (window.retroAudio) {
    window.retroAudio.playSplashSfx();
  }

  launchFirework(W * 0.25, horizonY * 0.4);
  launchFirework(W * 0.45, horizonY * 0.35);
  spawnSkyLantern(W * 0.2, horizonY - 15);

  showToast(`🌕 โยนลอยกระทงของ "${payload.sender_name}" สำเร็จ! ขอให้สมปรารถนาทุกประการ`);

  // Reset form
  const wishInput = document.getElementById('wishMessage');
  wishInput.value = '';
  document.getElementById('charCount').textContent = '0';
}

// Button 1: Standard Direct Launch from Pier
document.getElementById('krathongForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = buildDraftPayloadFromForm();
  if (!payload) return;

  const submitBtn = document.getElementById('btnSubmitKrathong');
  submitBtn.disabled = true;
  submitBtn.textContent = '🌊 กำลังปล่อยกระทงลงน้ำ...';

  // Even direct launch gets a gentle short arc from the connected shore pier into the chosen lane
  const laneZList = [-10, -4, 2, 8];
  const targetZ = laneZList[payload.lane % 4] ?? 2;
  const targetX3D = -8;
  const landingPxX = ((targetX3D / 48) + 0.5) * Math.max(800, window.innerWidth);

  await saveAndSpawnKrathong(payload, {
    landingPxX,
    power: 0.45,
    throwAnim: {
      startTime: performance.now(),
      durationMs: 700,
      startX: -14.0,
      startY: 2.3,
      startZ: 12.5,
      endX: targetX3D,
      endZ: targetZ,
      peakHeight: 3.8
    }
  });

  submitBtn.disabled = false;
  submitBtn.textContent = '🌊 วางลอยจากท่าน้ำทันที';
  builderModal.classList.add('hidden');
});

// Button 2: Enter Interactive 3D Aim & Throw Mode
const btnAimThrow = document.getElementById('btnAimThrowKrathong');
if (btnAimThrow) {
  btnAimThrow.addEventListener('click', () => {
    const payload = buildDraftPayloadFromForm();
    if (!payload) return;

    if (window.retroAudio) window.retroAudio.playClickSfx(780);

    state.throwMode.active = true;
    state.throwMode.charging = false;
    state.throwMode.power = 0.5;
    state.throwMode.draftPayload = payload;
    state.throwMode.aimX3D = -4;
    state.throwMode.aimZ3D = [-10, -4, 2, 8][payload.lane % 4] ?? 2;

    builderModal.classList.add('hidden');
    throwHudEl.classList.remove('hidden');
    document.getElementById('throwSenderPreview').textContent = `🪷 กระทงของ: ${payload.sender_name}`;
    document.getElementById('throwPowerFill').style.width = '0%';
    document.getElementById('throwPowerText').textContent = 'คลิกซ้ายค้างบนแม่น้ำเพื่อชาร์จแรงโยน แล้วปล่อยเมาส์!';
    showToast('🎯 เข้าสู่โหมดเล็งโยนกระทง 3D! เล็งจุดในแม่น้ำแล้วคลิกค้างเพื่อโยน');
  });
}

function exitThrowMode() {
  state.throwMode.active = false;
  state.throwMode.charging = false;
  state.throwMode.draftPayload = null;
  if (throwHudEl) throwHudEl.classList.add('hidden');
}

async function execute3DThrow(powerValue = 0.65) {
  if (!state.throwMode.active || !state.throwMode.draftPayload) return;
  const payload = { ...state.throwMode.draftPayload };

  const pierX = -14.0;
  const pierZ = 12.5;

  // Compute landing 3D coordinates based on aim target & charge power boost
  const dirX = state.throwMode.aimX3D - pierX;
  const dirZ = state.throwMode.aimZ3D - pierZ;
  const boost = 0.65 + powerValue * 0.55;
  const endX = Math.max(-18, Math.min(24, pierX + dirX * boost));
  const endZ = Math.max(-13, Math.min(10, pierZ + dirZ * boost));

  // Snap to closest river depth lane (0..3) so it floats naturally after landing
  const laneZList = [-10, -4, 2, 8];
  let bestLane = 1;
  let bestDist = 999;
  laneZList.forEach((lz, idx) => {
    const d = Math.abs(endZ - lz);
    if (d < bestDist) {
      bestDist = d;
      bestLane = idx;
    }
  });
  payload.lane = bestLane;

  const landingPxX = ((endX / 48) + 0.5) * Math.max(800, window.innerWidth);
  const peakHeight = 4.2 + powerValue * 5.5;

  exitThrowMode();

  await saveAndSpawnKrathong(payload, {
    landingPxX,
    power: powerValue,
    throwAnim: {
      startTime: performance.now(),
      durationMs: 740,
      startX: pierX,
      startY: 2.4,
      startZ: pierZ,
      endX,
      endZ: laneZList[bestLane],
      peakHeight
    }
  });
}

window.execute3DThrow = execute3DThrow;

document.getElementById('btnQuickThrow').addEventListener('click', () => {
  execute3DThrow(0.7);
});

document.getElementById('btnCancelThrow').addEventListener('click', () => {
  if (window.retroAudio) window.retroAudio.playClickSfx(440);
  exitThrowMode();
  builderModal.classList.remove('hidden');
});

// ============================================================================
// INSPECT KRATHONG CAMERA-LOCK CARD & BLESSING (ล็อคกล้อง + โชว์รายละเอียด)
// ============================================================================
function openInspectModal(krathong) {
  if (!krathong) return;
  state.selectedKrathong = krathong;
  state.followedKrathongId = krathong.id;

  if (window.retroAudio) window.retroAudio.playClickSfx();

  // Hide Wishes Drawer so the floating camera-lock card doesn't overlap it
  if (wishesDrawer && !wishesDrawer.classList.contains('hidden')) {
    wishesDrawer.classList.add('hidden');
  }

  document.getElementById('inspectSenderName').textContent = krathong.sender_name;
  document.getElementById('inspectWishText').textContent = `"${krathong.wish_message}"`;
  document.getElementById('inspectLikesCount').textContent = krathong.likes_count || 0;

  // Format relative time
  const dateObj = new Date(krathong.created_at);
  document.getElementById('inspectTimestamp').textContent = isNaN(dateObj)
    ? 'คืนวันเพ็ญ'
    : `ลอยเมื่อ ${dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;

  // Render tags for Krathong parts (Base, Flower, Candle, Topping)
  const findPart = (arr, id) => arr.find((x) => x.id === id);
  const b = findPart(window.KRATHONG_PARTS.bases, krathong.base_style);
  const f = findPart(window.KRATHONG_PARTS.flowers, krathong.flower_style);
  const c = findPart(window.KRATHONG_PARTS.candles, krathong.candle_style);
  const t = krathong.topping_style && krathong.topping_style !== 'none'
    ? findPart(window.KRATHONG_PARTS.toppings, krathong.topping_style)
    : null;

  const tagsEl = document.getElementById('inspectTags');
  tagsEl.innerHTML = '';
  [b, f, c, t].filter(Boolean).forEach((part) => {
    const span = document.createElement('span');
    span.className = 'pixel-tag';
    span.textContent = `${part.icon} ${part.name}`;
    tagsEl.appendChild(span);
  });

  inspectModal.classList.remove('hidden');

  // Notify React Three Fiber CameraRig to smoothly glide & zoom-lock onto this Krathong
  window.dispatchEvent(new CustomEvent('r3f-lock-krathong', { detail: { id: krathong.id } }));
}

function closeInspectModal() {
  state.followedKrathongId = null;
  state.selectedKrathong = null;
  inspectModal.classList.add('hidden');
}

function cycleLockedKrathong(step) {
  if (!state.krathongs || state.krathongs.length === 0) return;
  const currentIdx = state.selectedKrathong
    ? state.krathongs.findIndex((k) => k.id === state.selectedKrathong.id)
    : 0;
  const nextIdx = (currentIdx + step + state.krathongs.length) % state.krathongs.length;
  openInspectModal(state.krathongs[nextIdx]);
}

function renderInspectPreview(krathong) {
  inspectCtx.clearRect(0, 0, inspectCanvas.width, inspectCanvas.height);
  inspectCtx.imageSmoothingEnabled = false;
  const bob = Math.sin(state.tick * 3) * 2.0;
  window.drawPixelKrathong(
    inspectCtx,
    55,
    57 + bob,
    3.0,
    krathong,
    state.tick,
    true
  );
}

document.getElementById('btnBlessKrathong').addEventListener('click', async () => {
  const k = state.selectedKrathong;
  if (!k) return;

  k.likes_count = (k.likes_count || 0) + 1;
  document.getElementById('inspectLikesCount').textContent = k.likes_count;

  if (window.retroAudio) {
    window.retroAudio.playBlessSfx();
  }

  if (supabaseClient && !String(k.id).startsWith('local-') && !String(k.id).startsWith('demo-')) {
    try {
      const { data, error } = await supabaseClient.rpc('bless_krathong', { krathong_id: k.id });
      if (!error && typeof data === 'number') {
        k.likes_count = data;
        document.getElementById('inspectLikesCount').textContent = data;
      }
    } catch (err) {
      console.warn('Bless RPC warning:', err);
    }
  }

  renderWishesDrawerList();
  showToast(`🙏 ร่วมอนุโมทนาคำอธิษฐานของ "${k.sender_name}" แล้ว`);
});

document.getElementById('btnFollowKrathong').addEventListener('click', () => {
  if (window.retroAudio) window.retroAudio.playClickSfx();
  closeInspectModal();
  showToast('🔓 ปลดล็อคกล้องแล้ว — ขยับมุมกล้องได้อย่างอิสระ');
});

document.getElementById('btnPrevKrathong').addEventListener('click', () => {
  cycleLockedKrathong(-1);
});

document.getElementById('btnNextKrathong').addEventListener('click', () => {
  cycleLockedKrathong(1);
});

// ============================================================================
// WISHES FEED DRAWER
// ============================================================================
function renderWishesDrawerList() {
  const query = (searchWishInput.value || '').trim().toLowerCase();
  wishesListEl.innerHTML = '';

  const sorted = [...state.krathongs].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const filtered = sorted.filter(
    (k) =>
      k.sender_name.toLowerCase().includes(query) ||
      k.wish_message.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    wishesListEl.innerHTML = `<div style="text-align:center;color:#b5b9e0;padding:20px;">ไม่พบคำอธิษฐานที่ค้นหา</div>`;
    return;
  }

  filtered.forEach((k) => {
    const item = document.createElement('div');
    item.className = 'wish-feed-item';
    item.innerHTML = `
      <div class="wish-feed-top">
        <span class="wish-feed-sender">🪷 ${escapeHtml(k.sender_name)}</span>
        <span class="wish-feed-likes">♥ ${k.likes_count || 0}</span>
      </div>
      <div class="wish-feed-msg">"${escapeHtml(k.wish_message)}"</div>
    `;
    item.addEventListener('click', () => {
      state.followedKrathongId = k.id;
      openInspectModal(k);
    });
    wishesListEl.appendChild(item);
  });
}

searchWishInput.addEventListener('input', renderWishesDrawerList);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// TOAST NOTIFICATION HELPER
// ============================================================================
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'pixel-toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4200);
}

// ============================================================================
// TOP HUD & MODAL BUTTON LISTENERS
// ============================================================================
document.getElementById('btnOpenBuilder').addEventListener('click', () => {
  if (window.retroAudio) window.retroAudio.playClickSfx(640);
  builderModal.classList.remove('hidden');
});

document.getElementById('btnCloseBuilder').addEventListener('click', () => {
  if (window.retroAudio) window.retroAudio.playClickSfx(440);
  builderModal.classList.add('hidden');
});

document.getElementById('btnCancelBuilder').addEventListener('click', () => {
  if (window.retroAudio) window.retroAudio.playClickSfx(440);
  builderModal.classList.add('hidden');
});

document.getElementById('btnCloseInspect').addEventListener('click', () => {
  if (window.retroAudio) window.retroAudio.playClickSfx();
  closeInspectModal();
});

window.closeInspectModal = closeInspectModal;

document.getElementById('btnWishesFeed').addEventListener('click', () => {
  if (window.retroAudio) window.retroAudio.playClickSfx(660);
  wishesDrawer.classList.toggle('hidden');
  renderWishesDrawerList();
});

document.getElementById('btnCloseDrawer').addEventListener('click', () => {
  if (window.retroAudio) window.retroAudio.playClickSfx(440);
  wishesDrawer.classList.add('hidden');
});

const btnFirework = document.getElementById('btnFirework');
if (btnFirework) {
  btnFirework.addEventListener('click', () => {
    launchFirework();
  });
}

const btnLantern = document.getElementById('btnLantern');
if (btnLantern) {
  btnLantern.addEventListener('click', () => {
    spawnSkyLantern(W * (0.2 + Math.random() * 0.6), horizonY - 12);
    showToast('🏮 ปล่อยโคมลอยขึ้นสู่ท้องฟ้าแล้ว!');
  });
}

const btnSound = document.getElementById('btnSound');
if (btnSound) {
  btnSound.addEventListener('click', () => {
    const playing = window.retroAudio.toggleMusic();
    const icon = document.getElementById('soundIcon');
    btnSound.classList.toggle('active-toggle', playing);
    if (icon) icon.textContent = playing ? '🔊' : '🔇';
    showToast(playing ? '🎵 เปิดเพลงพื้นหลังวันลอยกระทงแล้ว' : '🔇 ปิดเสียงเพลงแล้ว');
  });
}

// ============================================================================
// AMBIENT AUTO FIREWORKS (Lively Festival Pace Every 5-8.5 Seconds)
// ============================================================================
function startAmbientFireworks() {
  const scheduleNext = () => {
    const delayMs = 4800 + Math.random() * 3700; // 4.8 to 8.5 seconds
    setTimeout(() => {
      if (!document.hidden) {
        launchFirework();
      }
      scheduleNext();
    }, delayMs);
  };
  // Launch welcome firework 2.5 seconds after entering
  setTimeout(() => {
    if (!document.hidden) launchFirework();
    scheduleNext();
  }, 2500);
}

// Render mini Krathong icon in Top-Left brand box
function renderBrandIcon() {
  const container = document.getElementById('brandKrathongIcon');
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 40;
  const cctx = c.getContext('2d');
  cctx.imageSmoothingEnabled = false;
  window.drawPixelKrathong(
    cctx,
    20,
    20,
    1.2,
    { base_style: 'lotus_gold', flower_style: 'lotus_pink', candle_style: 'classic', topping_style: 'coin' },
    0,
    false
  );
  container.appendChild(c);
}

// Expose state & actions to React Three Fiber (r3f-scene.js)
window.loyState = state;
window.openInspectModal = openInspectModal;
window.launchFirework = launchFirework;
window.explodeFirework = explodeFirework;
window.spawnSkyLantern = spawnSkyLantern;

const btnResetCamera = document.getElementById('btnResetCamera');
if (btnResetCamera) {
  btnResetCamera.addEventListener('click', () => {
    state.followedKrathongId = null;
    window.dispatchEvent(new CustomEvent('r3f-reset-camera'));
    showToast('🎥 รีเซ็ตมุมกล้อง 3D กลับสู่มุมมองริมแม่น้ำ');
  });
}

// ============================================================================
// BOOTSTRAP
// ============================================================================
resizeScene();
initAmbientLanterns();
initBuilderUI();
renderBrandIcon();
loadInitialKrathongs();
startAmbientFireworks();
animate();
