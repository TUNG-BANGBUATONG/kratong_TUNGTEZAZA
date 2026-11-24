// ============================================================================
// PIXEL ART KRATHONG SPRITE ENGINE (Procedural 32x32 Pixel Grid Renderer)
// ============================================================================

const KRATHONG_PARTS = {
  bases: [
    { id: 'banana', name: 'ใบตองสด', icon: '🌿', desc: 'กระทงใบตองกลีบพับแบบไทยโบราณ' },
    { id: 'lotus_gold', name: 'บัวทองคำ', icon: '🪷', desc: 'ฐานกลีบบัวสีทองอร่ามเรืองรอง' },
    { id: 'bread_turtle', name: 'ขนมปังเต่า', icon: '🐢', desc: 'กระทงขนมปังน้องเต่าเป็นอาหารปลา' },
    { id: 'coconut', name: 'กะลามะพร้าว', icon: '🥥', desc: 'กะลามะพร้าวขัดเงาเรียบง่ายรักษ์โลก' },
    { id: 'ice_crystal', name: 'น้ำแข็งคริสตัล', icon: '🧊', desc: 'กระทงน้ำแข็งใสละลายกลายเป็นน้ำ' }
  ],
  flowers: [
    { id: 'lotus_pink', name: 'ดอกบัวหลวง', icon: '🌸' },
    { id: 'marigold', name: 'ดาวเรืองทอง', icon: '🌼' },
    { id: 'orchid', name: 'กล้วยไม้ม่วง', icon: '🌺' },
    { id: 'jasmine', name: 'มะลิร้อยมาลัย', icon: '🤍' },
    { id: 'rainbow', name: 'เบญจพรรณ 8-Bit', icon: '🌈' }
  ],
  candles: [
    { id: 'classic', name: 'เทียนขี้ผึ้ง', icon: '🕯️' },
    { id: 'sparkle', name: 'เทียนทิพย์ประกาย', icon: '✨' },
    { id: 'pink_heart', name: 'เทียนคู่รักสีชมพู', icon: '💖' },
    { id: 'double', name: 'เทียนคู่เสริมดวง', icon: '🔥' }
  ],
  toppings: [
    { id: 'coin', name: 'เหรียญทองคำ', icon: '🪙' },
    { id: 'garland', name: 'พวงมาลัยชายอุบะ', icon: '🎗️' },
    { id: 'cat_doll', name: 'ตุ๊กตาแมวนำโชค', icon: '🐱' },
    { id: 'heart_charm', name: 'หัวใจพิกเซล', icon: '💝' },
    { id: 'none', name: 'ไม่ใส่ของตกแต่ง', icon: '➖' }
  ]
};

const SAMPLE_WISHES = [
  'ขอขมาพระแม่คงคา ขอให้สิ่งไม่ดีลอยพ้นไปกับสายน้ำ มีแต่ความสุขความเจริญเข้ามา ✨',
  'ขอให้สุขภาพแข็งแรง การงานราบรื่น เงินทองไหลมาเทมาเหมือนสายน้ำคืนเพ็ญ 🌕',
  'อธิษฐานให้ครอบครัวมีความสุข สมหวังในทุกสิ่งที่ตั้งใจไว้ตลอดปี 🙏',
  'ขอให้ความรักสดใส งดงามเหมือนแสงจันทร์วันเพ็ญเดือนสิบสอง 💖',
  'ขอให้เขียนโค้ดไม่มีบั๊ก โปรเจกต์ผ่านฉลุย เซิร์ฟเวอร์ไม่ล่มตลอดปี! 💻🚀',
  'ลอยความทุกข์ความกังวลทิ้งไป เริ่มต้นใหม่ด้วยพลังใจที่เต็มเปี่ยม 🌟'
];

/**
 * Helper to draw a single integer pixel or rectangle on a 32x32 logical grid
 */
function fillPx(ctx, gx, gy, gw, gh, color, scale, offsetX, offsetY) {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.floor(offsetX + gx * scale),
    Math.floor(offsetY + gy * scale),
    Math.ceil(gw * scale),
    Math.ceil(gh * scale)
  );
}

/**
 * Renders a customizable 32x32 pixel-art Krathong at (centerX, centerY)
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} scale - pixel size (e.g., 2, 3, 5)
 * @param {object} config - { base_style, flower_style, candle_style, topping_style }
 * @param {number} tick - animation frame time for flickering candle & water reflection
 * @param {boolean} showReflection - whether to render water ripples & candle reflection below
 */
function drawPixelKrathong(ctx, centerX, centerY, scale, config, tick = 0, showReflection = true) {
  const gridW = 32;
  const gridH = 32;
  const ox = centerX - (gridW * scale) / 2;
  const oy = centerY - (gridH * scale) / 2;

  const base = config.base_style || 'banana';
  const flower = config.flower_style || 'lotus_pink';
  const candle = config.candle_style || 'classic';
  const topping = config.topping_style || 'coin';

  const frame = Math.floor(tick * 6) % 4;

  // -------------------------------------------------------------------------
  // 0. WATER RIPPLE & GOLDEN REFLECTION UNDER KRATHONG
  // -------------------------------------------------------------------------
  if (showReflection) {
    const rippleExpand = (frame % 2 === 0) ? 1 : 0;
    fillPx(ctx, 4 - rippleExpand, 27, 24 + rippleExpand * 2, 1, 'rgba(130, 210, 255, 0.45)', scale, ox, oy);
    fillPx(ctx, 7 + rippleExpand, 29, 18 - rippleExpand * 2, 1, 'rgba(255, 216, 110, 0.38)', scale, ox, oy);
    fillPx(ctx, 13, 30, 6, 1, 'rgba(255, 180, 70, 0.45)', scale, ox, oy);
  }

  // -------------------------------------------------------------------------
  // 1. KRATHONG BASE & OUTER LEAVES (Y: 19..26)
  // -------------------------------------------------------------------------
  if (base === 'banana') {
    // Banana truck cross-section + folded banana leaves (glip bai tong)
    fillPx(ctx, 6, 22, 20, 4, '#1b5e20', scale, ox, oy);
    fillPx(ctx, 5, 21, 22, 2, '#2e7d32', scale, ox, oy);
    fillPx(ctx, 7, 25, 18, 2, '#0d3b10', scale, ox, oy);
    // Triangular folded banana leaf tips
    const leafXs = [6, 10, 14, 18, 22];
    leafXs.forEach((lx, idx) => {
      fillPx(ctx, lx, 18, 4, 3, idx % 2 === 0 ? '#43a047' : '#388e3c', scale, ox, oy);
      fillPx(ctx, lx + 1, 16, 2, 2, '#66bb6a', scale, ox, oy);
      fillPx(ctx, lx + 1, 19, 2, 1, '#a5d6a7', scale, ox, oy);
    });
  } else if (base === 'lotus_gold') {
    // Golden royal lotus base
    fillPx(ctx, 6, 22, 20, 4, '#b26a00', scale, ox, oy);
    fillPx(ctx, 5, 21, 22, 2, '#e69500', scale, ox, oy);
    fillPx(ctx, 7, 25, 18, 2, '#7a4400', scale, ox, oy);
    const petalXs = [5, 9, 13, 17, 21, 25];
    petalXs.forEach((lx, idx) => {
      fillPx(ctx, lx, 18, 3, 3, idx % 2 === 0 ? '#ffd54f' : '#ffb300', scale, ox, oy);
      fillPx(ctx, lx + 1, 16, 1, 2, '#fff59d', scale, ox, oy);
    });
  } else if (base === 'bread_turtle') {
    // Baked bread turtle base
    fillPx(ctx, 6, 21, 20, 5, '#c67c3b', scale, ox, oy);
    fillPx(ctx, 7, 19, 18, 3, '#e09b56', scale, ox, oy);
    fillPx(ctx, 9, 18, 14, 2, '#f2b872', scale, ox, oy);
    // Turtle head & flippers
    fillPx(ctx, 3, 21, 3, 3, '#d48946', scale, ox, oy);
    fillPx(ctx, 3, 22, 1, 1, '#1a1a1a', scale, ox, oy); // eye
    fillPx(ctx, 26, 23, 3, 2, '#b0692c', scale, ox, oy); // tail
    // Crosshatch bread pattern
    fillPx(ctx, 10, 21, 2, 2, '#9c5a20', scale, ox, oy);
    fillPx(ctx, 15, 20, 2, 2, '#9c5a20', scale, ox, oy);
    fillPx(ctx, 20, 21, 2, 2, '#9c5a20', scale, ox, oy);
  } else if (base === 'coconut') {
    // Polished coconut shell bowl
    fillPx(ctx, 6, 20, 20, 4, '#5d4037', scale, ox, oy);
    fillPx(ctx, 8, 24, 16, 3, '#3e2723', scale, ox, oy);
    fillPx(ctx, 7, 19, 18, 2, '#8d6e63', scale, ox, oy);
    fillPx(ctx, 9, 21, 4, 1, '#a1887f', scale, ox, oy); // coconut shine
  } else if (base === 'ice_crystal') {
    // Translucent pixel crystal ice
    fillPx(ctx, 6, 21, 20, 5, '#29b6f6', scale, ox, oy);
    fillPx(ctx, 5, 19, 22, 3, '#81d4fa', scale, ox, oy);
    const iceXs = [6, 11, 16, 21];
    iceXs.forEach((lx) => {
      fillPx(ctx, lx, 17, 4, 3, '#b3e5fc', scale, ox, oy);
      fillPx(ctx, lx + 1, 15, 2, 2, '#e1f5fe', scale, ox, oy);
    });
  }

  // -------------------------------------------------------------------------
  // 2. FLOWERS LAYER (Y: 14..19)
  // -------------------------------------------------------------------------
  const flowerPalettes = {
    lotus_pink: ['#ec407a', '#f48fb1', '#fce4ec'],
    marigold: ['#ff8f00', '#ffc107', '#fff59d'],
    orchid: ['#8e24aa', '#ce93d8', '#f3e5f5'],
    jasmine: ['#cfd8dc', '#ffffff', '#e0f7fa'],
    rainbow: ['#ff5252', '#ffca28', '#26c6da', '#ab47bc']
  };
  const pal = flowerPalettes[flower] || flowerPalettes.lotus_pink;

  for (let i = 0; i < 5; i++) {
    const fx = 7 + i * 4;
    const c1 = flower === 'rainbow' ? pal[i % pal.length] : pal[0];
    const c2 = flower === 'rainbow' ? pal[(i + 1) % pal.length] : pal[1];
    const c3 = pal[2] || '#ffffff';

    fillPx(ctx, fx, 15, 3, 3, c1, scale, ox, oy);
    fillPx(ctx, fx + 1, 14, 2, 2, c2, scale, ox, oy);
    fillPx(ctx, fx + 1, 15, 1, 1, c3, scale, ox, oy);
  }

  // -------------------------------------------------------------------------
  // 3. TOPPING / LUCKY CHARM (Y: 15..22)
  // -------------------------------------------------------------------------
  if (topping === 'coin') {
    // Shiny golden pixel coin in front
    fillPx(ctx, 14, 18, 4, 4, '#ffb300', scale, ox, oy);
    fillPx(ctx, 15, 19, 2, 2, '#fff176', scale, ox, oy);
  } else if (topping === 'garland') {
    // Jasmine garland hanging over the front edge
    fillPx(ctx, 10, 21, 12, 2, '#ffffff', scale, ox, oy);
    fillPx(ctx, 9, 22, 2, 4, '#ff5252', scale, ox, oy);
    fillPx(ctx, 21, 22, 2, 4, '#ff5252', scale, ox, oy);
    fillPx(ctx, 15, 22, 2, 3, '#ffd54f', scale, ox, oy);
  } else if (topping === 'cat_doll') {
    // Little white pixel lucky cat sitting on the side
    fillPx(ctx, 19, 12, 5, 5, '#ffffff', scale, ox, oy);
    fillPx(ctx, 19, 10, 1, 2, '#ff8a80', scale, ox, oy); // left ear
    fillPx(ctx, 23, 10, 1, 2, '#ff8a80', scale, ox, oy); // right ear
    fillPx(ctx, 20, 13, 1, 1, '#212121', scale, ox, oy); // eye
    fillPx(ctx, 22, 13, 1, 1, '#212121', scale, ox, oy); // eye
    fillPx(ctx, 20, 16, 3, 1, '#e53935', scale, ox, oy); // red collar
  } else if (topping === 'heart_charm') {
    // Floating pixel heart charm
    fillPx(ctx, 13, 17, 2, 2, '#ff4081', scale, ox, oy);
    fillPx(ctx, 17, 17, 2, 2, '#ff4081', scale, ox, oy);
    fillPx(ctx, 13, 18, 6, 2, '#f50057', scale, ox, oy);
    fillPx(ctx, 14, 20, 4, 1, '#c51162', scale, ox, oy);
    fillPx(ctx, 15, 21, 2, 1, '#880e4f', scale, ox, oy);
  }

  // -------------------------------------------------------------------------
  // 4. INCENSE STICKS & CANDLE + FLICKERING FLAME (Y: 3..15)
  // -------------------------------------------------------------------------
  // Three incense sticks
  fillPx(ctx, 13, 7, 1, 8, '#8d6e63', scale, ox, oy);
  fillPx(ctx, 18, 7, 1, 8, '#8d6e63', scale, ox, oy);
  // Glowing incense tips
  fillPx(ctx, 13, 6, 1, 1, '#ff5722', scale, ox, oy);
  fillPx(ctx, 18, 6, 1, 1, '#ff5722', scale, ox, oy);

  // Rising pixel smoke particles
  const smokeShift = (frame % 2 === 0) ? 0 : 1;
  fillPx(ctx, 12 + smokeShift, 4, 1, 1, 'rgba(220, 230, 255, 0.45)', scale, ox, oy);
  fillPx(ctx, 19 - smokeShift, 3, 1, 1, 'rgba(220, 230, 255, 0.4)', scale, ox, oy);

  // Candle body
  if (candle === 'double') {
    fillPx(ctx, 14, 9, 2, 6, '#ffd54f', scale, ox, oy);
    fillPx(ctx, 16, 10, 2, 5, '#ffb300', scale, ox, oy);
  } else if (candle === 'pink_heart') {
    fillPx(ctx, 15, 9, 2, 6, '#ff80ab', scale, ox, oy);
    fillPx(ctx, 15, 11, 2, 1, '#f50057', scale, ox, oy);
  } else if (candle === 'sparkle') {
    fillPx(ctx, 15, 9, 2, 6, '#e0f7fa', scale, ox, oy);
    fillPx(ctx, 15, 11, 2, 2, '#80deea', scale, ox, oy);
  } else {
    // Classic golden beeswax candle
    fillPx(ctx, 15, 9, 2, 6, '#ffca28', scale, ox, oy);
    fillPx(ctx, 15, 12, 2, 1, '#ffb300', scale, ox, oy);
  }

  // Animated Pixel Flame
  const flameJitter = (frame === 1) ? -1 : (frame === 3 ? 1 : 0);
  // Outer flame aura
  fillPx(ctx, 14, 5, 4, 4, 'rgba(255, 160, 0, 0.35)', scale, ox, oy);
  // Main orange flame
  fillPx(ctx, 15, 5, 2, 3, '#ff6d00', scale, ox, oy);
  // Bright yellow core
  fillPx(ctx, 15, 6, 2, 2, '#ffee58', scale, ox, oy);
  // Flickering flame tip
  fillPx(ctx, 15 + (flameJitter > 0 ? 1 : 0), 4, 1, 1, '#fff59d', scale, ox, oy);

  if (candle === 'sparkle') {
    // Extra magic pixel sparkles around the flame
    if (frame % 2 === 0) {
      fillPx(ctx, 11, 5, 1, 1, '#84ffff', scale, ox, oy);
      fillPx(ctx, 20, 7, 1, 1, '#ffff8d', scale, ox, oy);
    } else {
      fillPx(ctx, 12, 8, 1, 1, '#ffff8d', scale, ox, oy);
      fillPx(ctx, 19, 4, 1, 1, '#84ffff', scale, ox, oy);
    }
  }
}

window.KRATHONG_PARTS = KRATHONG_PARTS;
window.SAMPLE_WISHES = SAMPLE_WISHES;
window.drawPixelKrathong = drawPixelKrathong;
