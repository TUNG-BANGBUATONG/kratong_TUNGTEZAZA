// ============================================================================
// REACT THREE FIBER (R3F) 3D VOXEL / PIXEL ART LOY KRATHONG WORLD
// Uses @react-three/fiber, @react-three/drei, Three.js, and HTM
// ============================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import htm from 'htm';

const html = htm.bind(React.createElement);

// Color palettes matching our 2D Pixel Art Customizer
const BASE_COLORS = {
  banana: { main: '#2e7d32', dark: '#1b5e20', leaf: '#43a047', tip: '#81c784' },
  lotus_gold: { main: '#e69500', dark: '#b26a00', leaf: '#ffc107', tip: '#fff59d' },
  bread_turtle: { main: '#d48946', dark: '#9c5a20', leaf: '#e09b56', tip: '#f2b872' },
  coconut: { main: '#5d4037', dark: '#3e2723', leaf: '#795548', tip: '#a1887f' },
  ice_crystal: { main: '#29b6f6', dark: '#0288d1', leaf: '#81d4fa', tip: '#e1f5fe' }
};

const FLOWER_COLORS = {
  lotus_pink: ['#ec407a', '#f48fb1', '#fce4ec'],
  marigold: ['#ff8f00', '#ffc107', '#fff59d'],
  orchid: ['#8e24aa', '#ce93d8', '#f3e5f5'],
  jasmine: ['#cfd8dc', '#ffffff', '#e0f7fa'],
  rainbow: ['#ff5252', '#ffca28', '#26c6da', '#ab47bc']
};

const CANDLE_COLORS = {
  classic: '#ffca28',
  sparkle: '#80deea',
  pink_heart: '#ff80ab',
  double: '#ffb300'
};

// Extra-Wide Vice Beach bay bands (massive open ocean/bay so krathongs scatter freely!)
const LANE_Z = [-30, -14, 3, 18];

function mapXTo3D(px) {
  const w = Math.max(800, window.innerWidth);
  return ((px / w) - 0.5) * 140;
}

function getKrathongWorldPos(entity) {
  const x3d = entity.x3D !== undefined ? entity.x3D : mapXTo3D(entity.x);
  const z3d = entity.z3D !== undefined ? entity.z3D : (LANE_Z[entity.lane % 4] ?? 0);
  return { x3d, z3d };
}

// ============================================================================
// 1. 3D VOXEL KRATHONG COMPONENT (Memoized & GPU-Optimized for 100+ Krathongs!)
// ============================================================================
const VoxelKrathong = React.memo(function VoxelKrathong({ entity, isFollowed, onSelect }) {
  const groupRef = useRef();
  const flameRef = useRef();
  const [hovered, setHovered] = useState(false);

  const basePal = BASE_COLORS[entity.base_style] || BASE_COLORS.banana;
  const flowerPal = FLOWER_COLORS[entity.flower_style] || FLOWER_COLORS.lotus_pink;
  const candleColor = CANDLE_COLORS[entity.candle_style] || CANDLE_COLORS.classic;

  // Voxel folded leaf positions around the octagonal voxel base
  const leafAngles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 8; i++) {
      arr.push((i * Math.PI * 2) / 8);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const pos = getKrathongWorldPos(entity);
      let x3d = pos.x3d;
      let z3d = pos.z3d + Math.sin(t * 0.5 + (entity.bobPhase || 0)) * 0.65;
      let y3d = Math.sin(t * 2.5 + (entity.bobPhase || 0)) * 0.14;
      let rotX = 0;

      // Parabolic 3D Throw Flight Trajectory & Landing Splash Bounce
      if (entity.throwAnim) {
        const now = performance.now();
        const elapsed = now - entity.throwAnim.startTime;
        const dur = entity.throwAnim.durationMs || 720;

        if (elapsed < dur) {
          const p = Math.max(0, Math.min(1, elapsed / dur));
          x3d = THREE.MathUtils.lerp(entity.throwAnim.startX, entity.throwAnim.endX, p);
          z3d = THREE.MathUtils.lerp(entity.throwAnim.startZ, entity.throwAnim.endZ, p);
          const baseHeight = THREE.MathUtils.lerp(entity.throwAnim.startY, 0, p);
          const arc = 4 * (entity.throwAnim.peakHeight || 4.8) * p * (1 - p);
          y3d = baseHeight + arc;
          rotX = Math.sin(p * Math.PI) * 0.35;
        } else if (elapsed < dur + 450) {
          // Damped water splash bounce right after landing
          const bp = (elapsed - dur) / 450;
          y3d = -Math.sin(bp * Math.PI * 2.5) * 0.35 * (1 - bp);
        } else {
          entity.throwAnim = null;
        }
      }

      groupRef.current.position.set(x3d, y3d, z3d);
      groupRef.current.rotation.x = rotX;
      groupRef.current.rotation.y = Math.sin(t * 0.7 + (entity.bobPhase || 0)) * 0.25;
      groupRef.current.rotation.z = Math.cos(t * 1.8 + (entity.bobPhase || 0)) * 0.04;
    }

    if (flameRef.current) {
      const flicker = 0.88 + Math.sin(t * 18 + (entity.bobPhase || 0)) * 0.16;
      flameRef.current.scale.set(flicker, 0.9 + Math.cos(t * 23) * 0.2, flicker);
    }
  });

  const isHighlighted = hovered || isFollowed;
  const shortWish = entity.wish_message && entity.wish_message.length > 34
    ? entity.wish_message.slice(0, 34) + '...'
    : entity.wish_message;

  return html`
    <group
      ref=${groupRef}
      onClick=${(e) => {
        e.stopPropagation();
        onSelect(entity);
      }}
      onPointerOver=${(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut=${() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <!-- Dynamic PointLight ONLY on highlighted/locked Krathong (prevents WebGL shader lag with many krathongs!) -->
      ${isHighlighted && html`
        <pointLight
          position=${[0, 2.2, 0]}
          color="#ffcc66"
          intensity=${4.5}
          distance=${14}
          decay=${1.6}
        />
      `}

      <!-- Soft Fake Water Glow Disc under each Krathong (Zero GPU light cost!) -->
      <mesh position=${[0, 0.03, 0]} rotation=${[-Math.PI / 2, 0, 0]}>
        <circleGeometry args=${[1.45, 12]} />
        <meshBasicMaterial
          color="#ffaa33"
          transparent=${true}
          opacity=${0.22}
        />
      </mesh>

      <!-- Highlight / Spotlight Ring on Water when Hovered or Followed -->
      ${isHighlighted && html`
        <mesh position=${[0, 0.05, 0]} rotation=${[-Math.PI / 2, 0, 0]}>
          <ringGeometry args=${[1.45, 1.75, 16]} />
          <meshBasicMaterial
            color=${isFollowed ? '#00f5d4' : '#ffe28a'}
            transparent=${true}
            opacity=${0.8}
            side=${THREE.DoubleSide}
          />
        </mesh>
      `}

      <!-- Voxel Base Bottom Tier -->
      <mesh position=${[0, 0.18, 0]}>
        <boxGeometry args=${[1.8, 0.36, 1.8]} />
        <meshStandardMaterial color=${basePal.dark} roughness=${0.7} />
      </mesh>
      <mesh position=${[0, 0.42, 0]}>
        <boxGeometry args=${[2.05, 0.24, 2.05]} />
        <meshStandardMaterial color=${basePal.main} roughness=${0.6} />
      </mesh>

      <!-- Bread Turtle Head & Flippers if bread_turtle selected -->
      ${entity.base_style === 'bread_turtle' && html`
        <group>
          <mesh position=${[1.25, 0.35, 0]}>
            <boxGeometry args=${[0.5, 0.4, 0.5]} />
            <meshStandardMaterial color=${basePal.tip} />
          </mesh>
          <mesh position=${[-1.2, 0.28, 0]}>
            <boxGeometry args=${[0.35, 0.25, 0.35]} />
            <meshStandardMaterial color=${basePal.dark} />
          </mesh>
        </group>
      `}

      <!-- 8 Voxel Folded Banana Leaf / Lotus Tips (กลีบกระทง 3D) -->
      ${leafAngles.map((angle, idx) => {
        const radius = 0.88;
        const lx = Math.cos(angle) * radius;
        const lz = Math.sin(angle) * radius;
        return html`
          <group key=${idx} position=${[lx, 0.68, lz]} rotation=${[0, -angle, 0]}>
            <mesh position=${[0, 0, 0]} castShadow>
              <boxGeometry args=${[0.42, 0.42, 0.42]} />
              <meshStandardMaterial color=${basePal.leaf} roughness=${0.5} />
            </mesh>
            <mesh position=${[0.05, 0.3, 0]} castShadow>
              <boxGeometry args=${[0.26, 0.28, 0.26]} />
              <meshStandardMaterial color=${basePal.tip} roughness=${0.4} />
            </mesh>
          </group>
        `;
      })}

      <!-- Voxel Flower Layer -->
      ${leafAngles.map((angle, idx) => {
        const radius = 0.5;
        const fx = Math.cos(angle + 0.3) * radius;
        const fz = Math.sin(angle + 0.3) * radius;
        const fColor = flowerPal[idx % flowerPal.length];
        return html`
          <mesh key=${'fl-' + idx} position=${[fx, 0.72, fz]} castShadow>
            <boxGeometry args=${[0.34, 0.28, 0.34]} />
            <meshStandardMaterial color=${fColor} roughness=${0.4} />
          </mesh>
        `;
      })}

      <!-- Topping / Lucky Charm in 3D Voxels -->
      ${entity.topping_style === 'coin' && html`
        <mesh position=${[0.55, 0.92, 0.55]}>
          <boxGeometry args=${[0.32, 0.32, 0.12]} />
          <meshStandardMaterial color="#ffd700" metalness=${0.7} roughness=${0.2} emissive="#ffab00" emissiveIntensity=${0.3} />
        </mesh>
      `}
      ${entity.topping_style === 'cat_doll' && html`
        <group position=${[0.52, 0.95, 0.45]}>
          <mesh>
            <boxGeometry args=${[0.38, 0.42, 0.38]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position=${[-0.12, 0.28, 0]}>
            <boxGeometry args=${[0.12, 0.16, 0.12]} />
            <meshStandardMaterial color="#ff8a80" />
          </mesh>
          <mesh position=${[0.12, 0.28, 0]}>
            <boxGeometry args=${[0.12, 0.16, 0.12]} />
            <meshStandardMaterial color="#ff8a80" />
          </mesh>
        </group>
      `}
      ${entity.topping_style === 'heart_charm' && html`
        <mesh position=${[0.5, 0.95, 0.5]}>
          <boxGeometry args=${[0.34, 0.34, 0.22]} />
          <meshStandardMaterial color="#ff4081" emissive="#f50057" emissiveIntensity=${0.4} />
        </mesh>
      `}
      ${entity.topping_style === 'garland' && html`
        <mesh position=${[0, 0.5, 1.08]}>
          <boxGeometry args=${[0.9, 0.22, 0.2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      `}

      <!-- 3 Voxel Incense Sticks (ธูป 3 ดอก) -->
      ${[-0.22, 0, 0.22].map((ix, idx) => html`
        <group key=${'inc-' + idx} position=${[ix, 1.15, -0.18]}>
          <mesh>
            <boxGeometry args=${[0.06, 0.95, 0.06]} />
            <meshStandardMaterial color="#8d6e63" />
          </mesh>
          <mesh position=${[0, 0.5, 0]}>
            <boxGeometry args=${[0.09, 0.09, 0.09]} />
            <meshBasicMaterial color="#ff3d00" />
          </mesh>
        </group>
      `)}

      <!-- Voxel Candle Column -->
      <mesh position=${[0, 1.12, 0.08]}>
        <boxGeometry args=${[entity.candle_style === 'double' ? 0.38 : 0.24, 0.85, 0.24]} />
        <meshStandardMaterial color=${candleColor} roughness=${0.3} />
      </mesh>

      <!-- Glowing Voxel Candle Flame -->
      <group ref=${flameRef} position=${[0, 1.72, 0.08]}>
        <mesh>
          <boxGeometry args=${[0.24, 0.34, 0.24]} />
          <meshBasicMaterial color="#ff6d00" />
        </mesh>
        <mesh position=${[0, 0.06, 0]}>
          <boxGeometry args=${[0.14, 0.24, 0.14]} />
          <meshBasicMaterial color="#ffff8d" />
        </mesh>
      </group>

      <!-- Floating HTML Nameplate & Wish Preview in 3D Space -->
      <${Html} position=${[0, -0.55, 0]} center distanceFactor=${22} zIndexRange=${[5, 0]}>
        <div
          className=${'r3f-nametag' + (isHighlighted ? ' highlighted' : '')}
          onClick=${(e) => {
            e.stopPropagation();
            onSelect(entity);
          }}
        >
          🪷 ${entity.sender_name} ${entity.likes_count > 0 ? `♥${entity.likes_count}` : ''}
        </div>
      </${Html}>

      ${isHighlighted && html`
        <${Html} position=${[0, 2.55, 0]} center distanceFactor=${20} zIndexRange=${[8, 0]}>
          <div className="r3f-wish-bubble">"${shortWish}"</div>
        </${Html}>
      `}
    </group>
  `;
});

// ============================================================================
// 2. 3D VOXEL SKY LANTERNS (โคมลอย 3D)
// ============================================================================
function VoxelSkyLanterns() {
  const groupRef = useRef();

  // Gentle, continuous self-floating sky lanterns rising across the 360° night sky
  const lanterns = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const radius = 18 + Math.random() * 24;
      arr.push({
        x: Math.cos(angle) * radius,
        y: 3 + Math.random() * 28,
        z: Math.sin(angle) * radius - 4,
        speedY: 0.45 + Math.random() * 0.45,
        driftX: (Math.random() - 0.3) * 0.18,
        phase: Math.random() * Math.PI * 2
      });
    }
    return arr;
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (!groupRef.current) return;

    groupRef.current.children.forEach((child, idx) => {
      const lt = lanterns[idx];
      if (!lt) return;
      lt.y += lt.speedY * delta;
      lt.x += lt.driftX * delta;
      if (lt.y > 35) {
        lt.y = 2.5;
        const angle = Math.random() * Math.PI * 2;
        const radius = 18 + Math.random() * 24;
        lt.x = Math.cos(angle) * radius;
        lt.z = Math.sin(angle) * radius - 4;
      }
      child.position.set(
        lt.x + Math.sin(t * 0.8 + lt.phase) * 1.1,
        lt.y,
        lt.z
      );
    });
  });

  return html`
    <group ref=${groupRef}>
      ${lanterns.map((lt, idx) => html`
        <group key=${idx} position=${[lt.x, lt.y, lt.z]}>
          <mesh>
            <boxGeometry args=${[0.7, 0.95, 0.7]} />
            <meshBasicMaterial color="#ff9100" />
          </mesh>
          <mesh position=${[0, -0.1, 0]}>
            <boxGeometry args=${[0.45, 0.5, 0.45]} />
            <meshBasicMaterial color="#fff59d" />
          </mesh>
        </group>
      `)}
    </group>
  `;
}

// ============================================================================
// 3. 360-DEGREE PANORAMIC VOXEL METROPOLIS, NIGHT MARKET, BOATS & AIM ARC
// ============================================================================
function VoxelThrowTrajectory() {
  const [, setTick] = useState(0);

  useFrame(() => {
    if (window.loyState && window.loyState.throwMode && window.loyState.throwMode.active) {
      setTick((t) => (t + 1) % 100000);
    }
  });

  const tm = window.loyState && window.loyState.throwMode;
  if (!tm || !tm.active) return null;

  // Connected South Pier tip coordinates on the extra-wide bay
  const startX = -14.0;
  const startY = 2.4;
  const startZ = 30.5;

  const power = tm.charging ? tm.power : 0.65;
  const boost = 0.65 + power * 0.55;
  const endX = Math.max(-64, Math.min(64, startX + (tm.aimX3D - startX) * boost));
  const endZ = Math.max(-38, Math.min(26, startZ + (tm.aimZ3D - startZ) * boost));
  const peakH = 5.2 + power * 6.5;

  const dots = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const x = THREE.MathUtils.lerp(startX, endX, p);
    const z = THREE.MathUtils.lerp(startZ, endZ, p);
    const y = THREE.MathUtils.lerp(startY, 0.15, p) + 4 * peakH * p * (1 - p);
    dots.push({ x, y, z, p });
  }

  return html`
    <group>
      <!-- Parabolic Trajectory Voxel Dots -->
      ${dots.map((d, idx) => html`
        <mesh key=${idx} position=${[d.x, d.y, d.z]}>
          <boxGeometry args=${[0.32, 0.32, 0.32]} />
          <meshBasicMaterial color=${tm.charging ? '#ffeb3b' : '#4deeea'} />
        </mesh>
      `)}

      <!-- Target Splash Ring on the Water Surface -->
      <group position=${[endX, 0.12, endZ]}>
        <mesh rotation=${[-Math.PI / 2, 0, 0]}>
          <ringGeometry args=${[1.1, 1.5, 16]} />
          <meshBasicMaterial color=${tm.charging ? '#ff5252' : '#4deeea'} side=${THREE.DoubleSide} />
        </mesh>
        <mesh rotation=${[-Math.PI / 2, 0, 0]}>
          <ringGeometry args=${[0.3, 0.55, 16]} />
          <meshBasicMaterial color="#ffe57f" side=${THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  `;
}

// ============================================================================
// 3B. 3D VOXEL FESTIVAL PEOPLE / VILLAGERS (ผู้คนมาร่วมงานลอยกระทง)
// ============================================================================
function VoxelPerson({
  position = [0, 0, 0],
  rotationY = 0,
  shirtColor = '#ff4081',
  pantsColor = '#283593',
  hairColor = '#1a1a1a',
  holdingKrathong = false,
  isPlayerThrower = false,
  phase = 0
}) {
  const groupRef = useRef();
  const rightArmRef = useRef();
  const leftArmRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // Gentle cheerful festival bounce
      const hop = Math.abs(Math.sin(t * 3.2 + phase)) * 0.12;
      groupRef.current.position.y = position[1] + hop;
    }

    if (rightArmRef.current && leftArmRef.current) {
      const tm = window.loyState && window.loyState.throwMode;
      if (isPlayerThrower && tm && tm.active) {
        // Aiming / Charging throw pose!
        const chargeLift = tm.charging ? tm.power * 1.1 : 0.45;
        rightArmRef.current.rotation.x = -0.9 - chargeLift;
        leftArmRef.current.rotation.x = -0.9 - chargeLift;
      } else if (holdingKrathong) {
        rightArmRef.current.rotation.x = -0.75 + Math.sin(t * 2.5 + phase) * 0.08;
        leftArmRef.current.rotation.x = -0.75 + Math.sin(t * 2.5 + phase) * 0.08;
      } else {
        // Waving / cheering at the river
        rightArmRef.current.rotation.x = Math.sin(t * 4 + phase) * 0.45;
        leftArmRef.current.rotation.x = -Math.sin(t * 4 + phase) * 0.35;
      }
    }
  });

  return html`
    <group ref=${groupRef} position=${position} rotation=${[0, rotationY, 0]}>
      <!-- Legs -->
      <mesh position=${[-0.16, 0.32, 0]} castShadow>
        <boxGeometry args=${[0.24, 0.64, 0.26]} />
        <meshStandardMaterial color=${pantsColor} />
      </mesh>
      <mesh position=${[0.16, 0.32, 0]} castShadow>
        <boxGeometry args=${[0.24, 0.64, 0.26]} />
        <meshStandardMaterial color=${pantsColor} />
      </mesh>

      <!-- Torso / Thai Traditional Sabai or Festival Shirt -->
      <mesh position=${[0, 0.96, 0]} castShadow>
        <boxGeometry args=${[0.62, 0.68, 0.36]} />
        <meshStandardMaterial color=${shirtColor} />
      </mesh>

      <!-- Head -->
      <mesh position=${[0, 1.54, 0]} castShadow>
        <boxGeometry args=${[0.48, 0.48, 0.48]} />
        <meshStandardMaterial color="#ffcc99" />
      </mesh>

      <!-- Pixel Eyes -->
      <mesh position=${[-0.11, 1.56, 0.25]}>
        <boxGeometry args=${[0.07, 0.08, 0.04]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position=${[0.11, 1.56, 0.25]}>
        <boxGeometry args=${[0.07, 0.08, 0.04]} />
        <meshBasicMaterial color="#111111" />
      </mesh>

      <!-- Hair Top & Back -->
      <mesh position=${[0, 1.80, -0.02]}>
        <boxGeometry args=${[0.52, 0.16, 0.52]} />
        <meshStandardMaterial color=${hairColor} />
      </mesh>
      <mesh position=${[0, 1.56, -0.22]}>
        <boxGeometry args=${[0.50, 0.44, 0.14]} />
        <meshStandardMaterial color=${hairColor} />
      </mesh>

      <!-- Left & Right Arms -->
      <group ref=${leftArmRef} position=${[-0.42, 1.22, 0]}>
        <mesh position=${[0, -0.24, 0]}>
          <boxGeometry args=${[0.2, 0.56, 0.22]} />
          <meshStandardMaterial color="#ffcc99" />
        </mesh>
      </group>
      <group ref=${rightArmRef} position=${[0.42, 1.22, 0]}>
        <mesh position=${[0, -0.24, 0]}>
          <boxGeometry args=${[0.2, 0.56, 0.22]} />
          <meshStandardMaterial color="#ffcc99" />
        </mesh>
      </group>

      <!-- Mini Krathong held in hands if holdingKrathong -->
      ${holdingKrathong && html`
        <group position=${[0, 0.95, 0.46]}>
          <mesh>
            <boxGeometry args=${[0.48, 0.18, 0.48]} />
            <meshStandardMaterial color="#2e7d32" />
          </mesh>
          <mesh position=${[0, 0.15, 0]}>
            <boxGeometry args=${[0.36, 0.14, 0.36]} />
            <meshStandardMaterial color="#ec407a" />
          </mesh>
          <mesh position=${[0, 0.32, 0]}>
            <boxGeometry args=${[0.1, 0.22, 0.1]} />
            <meshBasicMaterial color="#ffee58" />
          </mesh>
        </group>
      `}
    </group>
  `;
}

// ============================================================================
// 3C. 3D VOXEL CUTE ANIMALS (น้องหมา, น้องแมว, น้องเป็ดลอยน้ำ, น้องกระต่าย, คาปิบาร่า!)
// ============================================================================
function VoxelDog({ position = [0, 0, 0], rotationY = 0, furColor = '#d49a5a', earColor = '#8d5524', phase = 0 }) {
  const groupRef = useRef();
  const tailRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // Excited doggy bounce
      groupRef.current.position.y = position[1] + Math.abs(Math.sin(t * 4.5 + phase)) * 0.14;
    }
    if (tailRef.current) {
      // Happy wagging tail!
      tailRef.current.rotation.z = Math.sin(t * 14 + phase) * 0.55;
    }
  });

  return html`
    <group ref=${groupRef} position=${position} rotation=${[0, rotationY, 0]}>
      <!-- Body -->
      <mesh position=${[0, 0.42, 0]} castShadow>
        <boxGeometry args=${[0.42, 0.34, 0.72]} />
        <meshStandardMaterial color=${furColor} />
      </mesh>
      <!-- Legs -->
      ${[[-0.14, 0.24], [0.14, 0.24], [-0.14, -0.24], [0.14, -0.24]].map(([lx, lz], i) => html`
        <mesh key=${i} position=${[lx, 0.15, lz]} castShadow>
          <boxGeometry args=${[0.12, 0.3, 0.12]} />
          <meshStandardMaterial color=${furColor} />
        </mesh>
      `)}
      <!-- Head -->
      <mesh position=${[0, 0.68, 0.34]} castShadow>
        <boxGeometry args=${[0.38, 0.36, 0.36]} />
        <meshStandardMaterial color=${furColor} />
      </mesh>
      <!-- Snout + Black Nose -->
      <mesh position=${[0, 0.61, 0.56]}>
        <boxGeometry args=${[0.2, 0.16, 0.16]} />
        <meshStandardMaterial color="#fff3e0" />
      </mesh>
      <mesh position=${[0, 0.65, 0.65]}>
        <boxGeometry args=${[0.09, 0.07, 0.05]} />
        <meshBasicMaterial color="#1a1a1a" />
      </mesh>
      <!-- Eyes -->
      <mesh position=${[-0.1, 0.72, 0.53]}>
        <boxGeometry args=${[0.06, 0.07, 0.04]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position=${[0.1, 0.72, 0.53]}>
        <boxGeometry args=${[0.06, 0.07, 0.04]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <!-- Floppy Ears -->
      <mesh position=${[-0.22, 0.74, 0.32]}>
        <boxGeometry args=${[0.1, 0.24, 0.14]} />
        <meshStandardMaterial color=${earColor} />
      </mesh>
      <mesh position=${[0.22, 0.74, 0.32]}>
        <boxGeometry args=${[0.1, 0.24, 0.14]} />
        <meshStandardMaterial color=${earColor} />
      </mesh>
      <!-- Cute Red Collar -->
      <mesh position=${[0, 0.52, 0.28]}>
        <boxGeometry args=${[0.44, 0.09, 0.14]} />
        <meshStandardMaterial color="#e53935" />
      </mesh>
      <!-- Wagging Tail -->
      <group ref=${tailRef} position=${[0, 0.54, -0.36]}>
        <mesh position=${[0, 0.14, -0.06]} rotation=${[-0.4, 0, 0]}>
          <boxGeometry args=${[0.1, 0.32, 0.1]} />
          <meshStandardMaterial color=${earColor} />
        </mesh>
      </group>
    </group>
  `;
}

function VoxelCat({ position = [0, 0, 0], rotationY = 0, furColor = '#ffffff', accentColor = '#ffab40', phase = 0 }) {
  const groupRef = useRef();
  const tailRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 2.8 + phase) * 0.05;
    }
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(t * 5.5 + phase) * 0.4;
    }
  });

  return html`
    <group ref=${groupRef} position=${position} rotation=${[0, rotationY, 0]}>
      <!-- Sitting / Standing Cat Body -->
      <mesh position=${[0, 0.32, 0]} castShadow>
        <boxGeometry args=${[0.34, 0.3, 0.54]} />
        <meshStandardMaterial color=${furColor} />
      </mesh>
      <!-- Cute Calico / Tabby Patch -->
      <mesh position=${[0.12, 0.36, -0.04]}>
        <boxGeometry args=${[0.14, 0.22, 0.26]} />
        <meshStandardMaterial color=${accentColor} />
      </mesh>
      <!-- Paws -->
      ${[[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.18], [0.1, -0.18]].map(([lx, lz], i) => html`
        <mesh key=${i} position=${[lx, 0.11, lz]}>
          <boxGeometry args=${[0.1, 0.22, 0.1]} />
          <meshStandardMaterial color=${furColor} />
        </mesh>
      `)}
      <!-- Head -->
      <mesh position=${[0, 0.56, 0.25]} castShadow>
        <boxGeometry args=${[0.34, 0.3, 0.3]} />
        <meshStandardMaterial color=${furColor} />
      </mesh>
      <!-- Pointy Cat Ears -->
      <mesh position=${[-0.12, 0.76, 0.25]}>
        <boxGeometry args=${[0.1, 0.14, 0.08]} />
        <meshStandardMaterial color=${accentColor} />
      </mesh>
      <mesh position=${[0.12, 0.76, 0.25]}>
        <boxGeometry args=${[0.1, 0.14, 0.08]} />
        <meshStandardMaterial color=${accentColor} />
      </mesh>
      <!-- Eyes + Pink Nose -->
      <mesh position=${[-0.08, 0.58, 0.41]}>
        <boxGeometry args=${[0.06, 0.07, 0.03]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position=${[0.08, 0.58, 0.41]}>
        <boxGeometry args=${[0.06, 0.07, 0.03]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position=${[0, 0.52, 0.41]}>
        <boxGeometry args=${[0.06, 0.04, 0.03]} />
        <meshBasicMaterial color="#ff80ab" />
      </mesh>
      <!-- Tall Swaying Cat Tail -->
      <group ref=${tailRef} position=${[0, 0.38, -0.26]}>
        <mesh position=${[0, 0.24, -0.04]}>
          <boxGeometry args=${[0.08, 0.48, 0.08]} />
          <meshStandardMaterial color=${accentColor} />
        </mesh>
      </group>
    </group>
  `;
}

function VoxelBunny({ position = [0, 0, 0], rotationY = 0, furColor = '#fff8f0', phase = 0 }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // Cute bunny hop!
      const hop = Math.max(0, Math.sin(t * 3.8 + phase)) * 0.26;
      groupRef.current.position.y = position[1] + hop;
    }
  });

  return html`
    <group ref=${groupRef} position=${position} rotation=${[0, rotationY, 0]}>
      <!-- Plump Bunny Body -->
      <mesh position=${[0, 0.24, 0]} castShadow>
        <boxGeometry args=${[0.32, 0.3, 0.38]} />
        <meshStandardMaterial color=${furColor} />
      </mesh>
      <!-- Head -->
      <mesh position=${[0, 0.46, 0.16]} castShadow>
        <boxGeometry args=${[0.28, 0.26, 0.28]} />
        <meshStandardMaterial color=${furColor} />
      </mesh>
      <!-- Long Bunny Ears -->
      <mesh position=${[-0.08, 0.72, 0.14]}>
        <boxGeometry args=${[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color=${furColor} />
      </mesh>
      <mesh position=${[0.08, 0.72, 0.14]}>
        <boxGeometry args=${[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color=${furColor} />
      </mesh>
      <mesh position=${[-0.08, 0.72, 0.18]}>
        <boxGeometry args=${[0.04, 0.22, 0.02]} />
        <meshBasicMaterial color="#ff80ab" />
      </mesh>
      <mesh position=${[0.08, 0.72, 0.18]}>
        <boxGeometry args=${[0.04, 0.22, 0.02]} />
        <meshBasicMaterial color="#ff80ab" />
      </mesh>
      <!-- Eyes + Cotton Tail -->
      <mesh position=${[-0.07, 0.48, 0.31]}>
        <boxGeometry args=${[0.05, 0.06, 0.03]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position=${[0.07, 0.48, 0.31]}>
        <boxGeometry args=${[0.05, 0.06, 0.03]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position=${[0, 0.22, -0.22]}>
        <boxGeometry args=${[0.14, 0.14, 0.14]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  `;
}

// Swimming Yellow Ducklings & Floating Capybara in the River!
function VoxelSwimmingDuck({ startX = 0, z = 4, speed = 1.2, phase = 0, isBaby = false }) {
  const groupRef = useRef();
  const s = isBaby ? 0.65 : 1.0;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const range = 128;
      const x = ((startX + t * speed + range * 10) % range) - range / 2;
      const bob = Math.sin(t * 3.5 + phase) * 0.08;
      groupRef.current.position.set(x, 0.1 + bob, z + Math.sin(t * 0.9 + phase) * 0.65);
      groupRef.current.rotation.z = Math.sin(t * 3 + phase) * 0.08;
    }
  });

  return html`
    <group ref=${groupRef} scale=${[s, s, s]} rotation=${[0, Math.PI / 2, 0]}>
      <!-- Yellow Duck Body -->
      <mesh position=${[0, 0.18, 0]} castShadow>
        <boxGeometry args=${[0.44, 0.28, 0.56]} />
        <meshStandardMaterial color="#ffeb3b" />
      </mesh>
      <!-- Wings -->
      <mesh position=${[-0.25, 0.2, -0.02]}>
        <boxGeometry args=${[0.08, 0.18, 0.34]} />
        <meshStandardMaterial color="#fdd835" />
      </mesh>
      <mesh position=${[0.25, 0.2, -0.02]}>
        <boxGeometry args=${[0.08, 0.18, 0.34]} />
        <meshStandardMaterial color="#fdd835" />
      </mesh>
      <!-- Head -->
      <mesh position=${[0, 0.44, 0.22]} castShadow>
        <boxGeometry args=${[0.34, 0.3, 0.32]} />
        <meshStandardMaterial color="#ffeb3b" />
      </mesh>
      <!-- Orange Beak -->
      <mesh position=${[0, 0.4, 0.44]}>
        <boxGeometry args=${[0.2, 0.09, 0.18]} />
        <meshStandardMaterial color="#ff6d00" />
      </mesh>
      <!-- Eyes -->
      <mesh position=${[-0.1, 0.48, 0.39]}>
        <boxGeometry args=${[0.06, 0.06, 0.03]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position=${[0.1, 0.48, 0.39]}>
        <boxGeometry args=${[0.06, 0.06, 0.03]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
    </group>
  `;
}

// Chill Voxel Capybara with a Tangerine on its head floating on a Giant Lotus Pad!
function VoxelCapybara({ startX = -10, z = -6, speed = 0.75 }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const range = 130;
      const x = ((startX + t * speed + range * 10) % range) - range / 2;
      groupRef.current.position.set(x, 0.08 + Math.sin(t * 2.2) * 0.07, z);
    }
  });

  return html`
    <group ref=${groupRef} rotation=${[0, Math.PI / 2, 0]}>
      <!-- Giant Green Lotus Leaf Raft -->
      <mesh position=${[0, 0.04, 0]}>
        <boxGeometry args=${[1.45, 0.1, 1.65]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      <!-- Chubby Capybara Body -->
      <mesh position=${[0, 0.38, -0.05]} castShadow>
        <boxGeometry args=${[0.62, 0.54, 0.92]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      <!-- Square Capybara Head -->
      <mesh position=${[0, 0.62, 0.48]} castShadow>
        <boxGeometry args=${[0.44, 0.4, 0.52]} />
        <meshStandardMaterial color="#795548" />
      </mesh>
      <!-- Tiny Ears -->
      <mesh position=${[-0.18, 0.84, 0.32]}>
        <boxGeometry args=${[0.1, 0.1, 0.08]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position=${[0.18, 0.84, 0.32]}>
        <boxGeometry args=${[0.1, 0.1, 0.08]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <!-- Chill Closed Eyes -->
      <mesh position=${[-0.23, 0.66, 0.52]}>
        <boxGeometry args=${[0.03, 0.04, 0.12]} />
        <meshBasicMaterial color="#1a1a1a" />
      </mesh>
      <mesh position=${[0.23, 0.66, 0.52]}>
        <boxGeometry args=${[0.03, 0.04, 0.12]} />
        <meshBasicMaterial color="#1a1a1a" />
      </mesh>
      <!-- Iconic Orange Yuzu / Tangerine on top of Capybara's Head! -->
      <mesh position=${[0, 0.92, 0.48]}>
        <boxGeometry args=${[0.22, 0.2, 0.22]} />
        <meshStandardMaterial color="#ff9800" emissive="#ff6d00" emissiveIntensity=${0.2} />
      </mesh>
      <mesh position=${[0, 1.05, 0.48]}>
        <boxGeometry args=${[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>
    </group>
  `;
}

// Cute Dogs & Cats Floating in the River on Vice Beach Flamingos, Neon Lotus Krathongs, Donuts & Surfboards!
function VoxelFloatingPet({
  species = 'dog',
  floatType = 'flamingo',
  furColor = '#e6a85c',
  accentColor = '#ffffff',
  sunglasses = false,
  startX = 0,
  z = 0,
  speed = 0.85,
  phase = 0
}) {
  const groupRef = useRef();
  const tailRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const range = 132;
      const x = ((startX + t * speed + range * 10) % range) - range / 2;
      const bob = Math.sin(t * 2.8 + phase) * 0.1;
      const swayZ = Math.sin(t * 0.75 + phase) * 0.65;
      groupRef.current.position.set(x, 0.08 + bob, z + swayZ);
      groupRef.current.rotation.z = Math.sin(t * 2.2 + phase) * 0.06;
      groupRef.current.rotation.x = Math.cos(t * 1.9 + phase) * 0.04;
    }
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 11 + phase) * 0.5;
    }
  });

  return html`
    <group ref=${groupRef} rotation=${[0, Math.PI / 2, 0]}>
      <!-- ================= FLOAT / RAFT BASE ================= -->
      ${floatType === 'flamingo' && html`
        <group>
          <!-- Neon Pink Flamingo Tube Ring -->
          <mesh position=${[0, 0.12, 0]} castShadow>
            <boxGeometry args=${[1.15, 0.26, 1.25]} />
            <meshStandardMaterial color="#ff2a85" emissive="#b5179e" emissiveIntensity=${0.28} roughness=${0.35} />
          </mesh>
          <!-- Wing accents -->
          <mesh position=${[-0.6, 0.2, -0.05]}>
            <boxGeometry args=${[0.12, 0.22, 0.65]} />
            <meshStandardMaterial color="#ff70a6" />
          </mesh>
          <mesh position=${[0.6, 0.2, -0.05]}>
            <boxGeometry args=${[0.12, 0.22, 0.65]} />
            <meshStandardMaterial color="#ff70a6" />
          </mesh>
          <!-- Flamingo Neck & Head at Front -->
          <mesh position=${[0, 0.52, 0.58]}>
            <boxGeometry args=${[0.2, 0.65, 0.2]} />
            <meshStandardMaterial color="#ff2a85" emissive="#ff2a85" emissiveIntensity=${0.2} />
          </mesh>
          <mesh position=${[0, 0.82, 0.68]}>
            <boxGeometry args=${[0.24, 0.22, 0.32]} />
            <meshStandardMaterial color="#ff5e9c" />
          </mesh>
          <mesh position=${[0, 0.77, 0.88]}>
            <boxGeometry args=${[0.16, 0.12, 0.16]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        </group>
      `}

      ${floatType === 'lotus_vice' && html`
        <group>
          <!-- Giant Vice Turquoise & Neon Pink Lotus Krathong Raft -->
          <mesh position=${[0, 0.08, 0]} castShadow>
            <boxGeometry args=${[1.35, 0.18, 1.35]} />
            <meshStandardMaterial color="#00bbf9" emissive="#0077b6" emissiveIntensity=${0.25} />
          </mesh>
          ${[[-0.55, 0], [0.55, 0], [0, -0.55], [0, 0.55]].map(([px, pz], idx) => html`
            <mesh key=${idx} position=${[px, 0.22, pz]}>
              <boxGeometry args=${[0.36, 0.24, 0.36]} />
              <meshStandardMaterial color=${idx % 2 === 0 ? '#ff2a85' : '#ffd166'} emissive="#ff2a85" emissiveIntensity=${0.2} />
            </mesh>
          `)}
          <!-- Mini Glowing Candle at Front of Pet's Krathong -->
          <mesh position=${[0, 0.34, 0.56]}>
            <boxGeometry args=${[0.12, 0.28, 0.12]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
          <mesh position=${[0, 0.54, 0.56]}>
            <boxGeometry args=${[0.14, 0.18, 0.14]} />
            <meshBasicMaterial color="#ffff8d" />
          </mesh>
        </group>
      `}

      ${floatType === 'donut' && html`
        <group>
          <!-- Dough Ring -->
          <mesh position=${[0, 0.1, 0]} castShadow>
            <boxGeometry args=${[1.2, 0.22, 1.2]} />
            <meshStandardMaterial color="#f4a261" />
          </mesh>
          <!-- Electric Cyan Frosting + Sprinkles -->
          <mesh position=${[0, 0.22, 0]}>
            <boxGeometry args=${[1.12, 0.08, 1.12]} />
            <meshStandardMaterial color="#00f5d4" emissive="#00bbf9" emissiveIntensity=${0.22} />
          </mesh>
          <mesh position=${[0.35, 0.27, 0.3]}>
            <boxGeometry args=${[0.12, 0.05, 0.06]} />
            <meshBasicMaterial color="#ff2a85" />
          </mesh>
          <mesh position=${[-0.35, 0.27, -0.28]}>
            <boxGeometry args=${[0.12, 0.05, 0.06]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
        </group>
      `}

      ${floatType === 'surfboard' && html`
        <group>
          <!-- Retro Vice Beach Striped Surfboard -->
          <mesh position=${[0, 0.08, 0]} castShadow>
            <boxGeometry args=${[0.95, 0.14, 1.75]} />
            <meshStandardMaterial color="#fff5fb" />
          </mesh>
          <mesh position=${[-0.18, 0.16, 0]}>
            <boxGeometry args=${[0.14, 0.03, 1.65]} />
            <meshBasicMaterial color="#ff2a85" />
          </mesh>
          <mesh position=${[0.18, 0.16, 0]}>
            <boxGeometry args=${[0.14, 0.03, 1.65]} />
            <meshBasicMaterial color="#00f5d4" />
          </mesh>
        </group>
      `}

      <!-- ================= PASSENGER PET (DOG OR CAT) ================= -->
      ${species === 'dog' ? html`
        <group position=${[0, 0.22, -0.05]}>
          <!-- Dog Body -->
          <mesh position=${[0, 0.24, 0]} castShadow>
            <boxGeometry args=${[0.44, 0.34, 0.62]} />
            <meshStandardMaterial color=${furColor} />
          </mesh>
          <!-- Chest Patch -->
          <mesh position=${[0, 0.22, 0.29]}>
            <boxGeometry args=${[0.3, 0.24, 0.08]} />
            <meshStandardMaterial color=${accentColor} />
          </mesh>
          <!-- Dog Head -->
          <mesh position=${[0, 0.52, 0.22]} castShadow>
            <boxGeometry args=${[0.4, 0.36, 0.36]} />
            <meshStandardMaterial color=${furColor} />
          </mesh>
          <!-- Snout + Nose -->
          <mesh position=${[0, 0.45, 0.44]}>
            <boxGeometry args=${[0.2, 0.15, 0.15]} />
            <meshStandardMaterial color=${accentColor} />
          </mesh>
          <mesh position=${[0, 0.49, 0.53]}>
            <boxGeometry args=${[0.09, 0.07, 0.05]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
          <!-- Ears -->
          <mesh position=${[-0.16, 0.72, 0.2]}>
            <boxGeometry args=${[0.11, 0.16, 0.1]} />
            <meshStandardMaterial color=${furColor} />
          </mesh>
          <mesh position=${[0.16, 0.72, 0.2]}>
            <boxGeometry args=${[0.11, 0.16, 0.1]} />
            <meshStandardMaterial color=${furColor} />
          </mesh>
          <!-- Eyes or Cool Vice Shades -->
          ${sunglasses ? html`
            <mesh position=${[0, 0.56, 0.41]}>
              <boxGeometry args=${[0.36, 0.1, 0.05]} />
              <meshBasicMaterial color="#00f5d4" />
            </mesh>
          ` : html`
            <group>
              <mesh position=${[-0.1, 0.56, 0.41]}>
                <boxGeometry args=${[0.06, 0.07, 0.03]} />
                <meshBasicMaterial color="#111111" />
              </mesh>
              <mesh position=${[0.1, 0.56, 0.41]}>
                <boxGeometry args=${[0.06, 0.07, 0.03]} />
                <meshBasicMaterial color="#111111" />
              </mesh>
            </group>
          `}
          <!-- Wagging Tail -->
          <group ref=${tailRef} position=${[0, 0.36, -0.32]}>
            <mesh position=${[0, 0.14, -0.04]}>
              <boxGeometry args=${[0.1, 0.28, 0.1]} />
              <meshStandardMaterial color=${accentColor} />
            </mesh>
          </group>
        </group>
      ` : html`
        <group position=${[0, 0.22, -0.04]}>
          <!-- Cat Body -->
          <mesh position=${[0, 0.22, 0]} castShadow>
            <boxGeometry args=${[0.36, 0.3, 0.52]} />
            <meshStandardMaterial color=${furColor} />
          </mesh>
          <!-- Patch -->
          <mesh position=${[0.12, 0.25, -0.02]}>
            <boxGeometry args=${[0.15, 0.2, 0.24]} />
            <meshStandardMaterial color=${accentColor} />
          </mesh>
          <!-- Cat Head -->
          <mesh position=${[0, 0.48, 0.2]} castShadow>
            <boxGeometry args=${[0.36, 0.3, 0.3]} />
            <meshStandardMaterial color=${furColor} />
          </mesh>
          <!-- Pointy Cat Ears -->
          <mesh position=${[-0.12, 0.68, 0.2]}>
            <boxGeometry args=${[0.1, 0.15, 0.08]} />
            <meshStandardMaterial color=${accentColor} />
          </mesh>
          <mesh position=${[0.12, 0.68, 0.2]}>
            <boxGeometry args=${[0.1, 0.15, 0.08]} />
            <meshStandardMaterial color=${accentColor} />
          </mesh>
          <!-- Eyes or Cool Pink Vice Shades + Pink Nose -->
          ${sunglasses ? html`
            <mesh position=${[0, 0.51, 0.36]}>
              <boxGeometry args=${[0.34, 0.09, 0.05]} />
              <meshBasicMaterial color="#ff2a85" />
            </mesh>
          ` : html`
            <group>
              <mesh position=${[-0.09, 0.5, 0.36]}>
                <boxGeometry args=${[0.06, 0.07, 0.03]} />
                <meshBasicMaterial color="#111111" />
              </mesh>
              <mesh position=${[0.09, 0.5, 0.36]}>
                <boxGeometry args=${[0.06, 0.07, 0.03]} />
                <meshBasicMaterial color="#111111" />
              </mesh>
            </group>
          `}
          <mesh position=${[0, 0.44, 0.36]}>
            <boxGeometry args=${[0.06, 0.04, 0.03]} />
            <meshBasicMaterial color="#ff80ab" />
          </mesh>
          <!-- Tall Swaying Cat Tail -->
          <group ref=${tailRef} position=${[0, 0.3, -0.26]}>
            <mesh position=${[0, 0.22, -0.03]}>
              <boxGeometry args=${[0.08, 0.44, 0.08]} />
              <meshStandardMaterial color=${accentColor} />
            </mesh>
          </group>
        </group>
      `}
    </group>
  `;
}

// ============================================================================
// 3C-2. 3D VOXEL SHARK (ปลาฉลามว่ายโชว์ครีบ) & LEAPING DOLPHIN (ปลาโลมากระโดดน้ำ)
// ============================================================================
function VoxelShark({ startX = 0, z = -3.5, speed = 2.6, dir = 1, scale = 1.0, phase = 0 }) {
  const groupRef = useRef();
  const tailRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const range = 134;
      const raw = (startX + t * speed * dir + range * 10) % range;
      const x = raw - range / 2;
      const zSway = Math.sin(t * 1.4 + phase) * 1.1;
      const ySubmerge = -0.18 + Math.sin(t * 1.8 + phase) * 0.14;
      groupRef.current.position.set(x, ySubmerge, z + zSway);
      // Slight yaw sway as shark swims
      groupRef.current.rotation.y = (dir > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.cos(t * 1.4 + phase) * 0.12;
    }
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 7.5 + phase) * 0.42;
    }
  });

  return html`
    <group ref=${groupRef} scale=${[scale, scale, scale]}>
      <!-- Shark Main Torso (Grey-Blue Top + White Belly) -->
      <mesh position=${[0, 0.34, 0]} castShadow>
        <boxGeometry args=${[0.78, 0.46, 2.0]} />
        <meshStandardMaterial color="#546e7a" roughness=${0.4} />
      </mesh>
      <mesh position=${[0, 0.12, 0.05]}>
        <boxGeometry args=${[0.7, 0.22, 1.85]} />
        <meshStandardMaterial color="#eceff1" roughness=${0.5} />
      </mesh>

      <!-- Tapered Shark Snout & Fierce Voxel Teeth -->
      <mesh position=${[0, 0.36, 1.25]} castShadow>
        <boxGeometry args=${[0.58, 0.34, 0.65]} />
        <meshStandardMaterial color="#546e7a" />
      </mesh>
      <mesh position=${[0, 0.19, 1.22]}>
        <boxGeometry args=${[0.46, 0.12, 0.45]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      <!-- Shark Eyes -->
      <mesh position=${[-0.31, 0.42, 1.18]}>
        <boxGeometry args=${[0.05, 0.08, 0.08]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position=${[0.31, 0.42, 1.18]}>
        <boxGeometry args=${[0.05, 0.08, 0.08]} />
        <meshBasicMaterial color="#111111" />
      </mesh>

      <!-- Iconic Tall Shark Dorsal Fin slicing above the water! -->
      <mesh position=${[0, 0.86, 0.1]} rotation=${[-0.25, 0, 0]} castShadow>
        <boxGeometry args=${[0.14, 0.85, 0.65]} />
        <meshStandardMaterial color="#455a64" />
      </mesh>
      <mesh position=${[0, 1.24, -0.05]} rotation=${[-0.35, 0, 0]}>
        <boxGeometry args=${[0.12, 0.35, 0.32]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>

      <!-- Side Pectoral Fins -->
      <mesh position=${[-0.68, 0.2, 0.3]} rotation=${[0, 0.35, -0.25]}>
        <boxGeometry args=${[0.75, 0.12, 0.48]} />
        <meshStandardMaterial color="#455a64" />
      </mesh>
      <mesh position=${[0.68, 0.2, 0.3]} rotation=${[0, -0.35, 0.25]}>
        <boxGeometry args=${[0.75, 0.12, 0.48]} />
        <meshStandardMaterial color="#455a64" />
      </mesh>

      <!-- Animated Swishing Tail + Crescent Tail Fin -->
      <group ref=${tailRef} position=${[0, 0.32, -1.02]}>
        <mesh position=${[0, 0, -0.38]}>
          <boxGeometry args=${[0.38, 0.3, 0.78]} />
          <meshStandardMaterial color="#455a64" />
        </mesh>
        <mesh position=${[0, 0.38, -0.82]} rotation=${[-0.35, 0, 0]}>
          <boxGeometry args=${[0.12, 0.78, 0.38]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>
        <mesh position=${[0, -0.18, -0.78]} rotation=${[0.35, 0, 0]}>
          <boxGeometry args=${[0.12, 0.45, 0.28]} />
          <meshStandardMaterial color="#455a64" />
        </mesh>
      </group>
    </group>
  `;
}

function VoxelDolphin({ startX = 0, z = 1.5, speed = 3.1, dir = 1, bodyColor = '#29b6f6', bellyColor = '#e1f5fe', phase = 0 }) {
  const groupRef = useRef();
  const tailRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      const range = 130;
      const raw = (startX + t * speed * dir + range * 10) % range;
      const x = raw - range / 2;

      // Graceful Dolphin Jumping Cycle (swims underwater then leaps high into the air!)
      const cycle = (t * 0.75 + phase) % 3.2;
      let y = -0.32;
      let pitch = 0;

      if (cycle < 1.35) {
        // Parabolic leap above the water surface!
        const p = cycle / 1.35; // 0..1
        y = -0.32 + Math.sin(p * Math.PI) * 3.1;
        // Pitch nose upward on takeoff, downward on dive
        pitch = -Math.cos(p * Math.PI) * 0.72;
      } else {
        // Cruising smoothly near the surface
        y = -0.25 + Math.sin(t * 4 + phase) * 0.1;
        pitch = Math.cos(t * 4 + phase) * 0.08;
      }

      groupRef.current.position.set(x, y, z + Math.sin(t * 0.9 + phase) * 0.6);
      groupRef.current.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      groupRef.current.rotation.x = pitch;
    }
    if (tailRef.current) {
      tailRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 11 + phase) * 0.35;
    }
  });

  return html`
    <group ref=${groupRef}>
      <!-- Dolphin Body + Soft Belly -->
      <mesh position=${[0, 0.28, 0]} castShadow>
        <boxGeometry args=${[0.56, 0.44, 1.55]} />
        <meshStandardMaterial color=${bodyColor} roughness=${0.3} />
      </mesh>
      <mesh position=${[0, 0.1, 0.05]}>
        <boxGeometry args=${[0.48, 0.16, 1.35]} />
        <meshStandardMaterial color=${bellyColor} />
      </mesh>

      <!-- Rounded Head & Cute Dolphin Bottle-Nose Snout -->
      <mesh position=${[0, 0.32, 0.88]} castShadow>
        <boxGeometry args=${[0.46, 0.38, 0.42]} />
        <meshStandardMaterial color=${bodyColor} />
      </mesh>
      <mesh position=${[0, 0.22, 1.24]}>
        <boxGeometry args=${[0.24, 0.16, 0.36]} />
        <meshStandardMaterial color=${bodyColor} />
      </mesh>

      <!-- Cute Eyes -->
      <mesh position=${[-0.24, 0.34, 0.92]}>
        <boxGeometry args=${[0.04, 0.07, 0.07]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
      <mesh position=${[0.24, 0.34, 0.92]}>
        <boxGeometry args=${[0.04, 0.07, 0.07]} />
        <meshBasicMaterial color="#111111" />
      </mesh>

      <!-- Curved Dorsal Fin -->
      <mesh position=${[0, 0.62, -0.05]} rotation=${[-0.35, 0, 0]}>
        <boxGeometry args=${[0.12, 0.42, 0.4]} />
        <meshStandardMaterial color=${bodyColor} />
      </mesh>

      <!-- Side Flippers -->
      <mesh position=${[-0.44, 0.16, 0.25]} rotation=${[0, 0.4, -0.35]}>
        <boxGeometry args=${[0.48, 0.1, 0.3]} />
        <meshStandardMaterial color=${bodyColor} />
      </mesh>
      <mesh position=${[0.44, 0.16, 0.25]} rotation=${[0, -0.4, 0.35]}>
        <boxGeometry args=${[0.48, 0.1, 0.3]} />
        <meshStandardMaterial color=${bodyColor} />
      </mesh>

      <!-- Horizontal Flapping Dolphin Tail Fluke -->
      <group ref=${tailRef} position=${[0, 0.26, -0.82]}>
        <mesh position=${[0, 0, -0.28]}>
          <boxGeometry args=${[0.28, 0.22, 0.56]} />
          <meshStandardMaterial color=${bodyColor} />
        </mesh>
        <mesh position=${[0, 0, -0.62]}>
          <boxGeometry args=${[0.82, 0.1, 0.32]} />
          <meshStandardMaterial color=${bodyColor} />
        </mesh>
      </group>
    </group>
  `;
}

function VoxelCuteAnimals() {
  // 30 Floating Dogs & Cats cruising across the massive Vice Beach Bay!
  const floatingPets = useMemo(() => [
    // Band 1: Foreground near Pier (Z ~ +16 to +24)
    { species: 'dog', floatType: 'flamingo', fur: '#e69b45', acc: '#fff8e7', shades: true, x: -55, z: 22.5, speed: 1.05, phase: 0.2 },
    { species: 'cat', floatType: 'lotus_vice', fur: '#ffffff', acc: '#ff9e64', shades: false, x: -34, z: 18.2, speed: 0.98, phase: 1.4 },
    { species: 'dog', floatType: 'surfboard', fur: '#f4a261', acc: '#ffffff', shades: true, x: -12, z: 21.0, speed: 1.12, phase: 2.7 },
    { species: 'cat', floatType: 'donut', fur: '#ff9800', acc: '#fff3e0', shades: false, x: 11, z: 17.5, speed: 0.94, phase: 3.9 },
    { species: 'dog', floatType: 'lotus_vice', fur: '#ffffff', acc: '#00f5d4', shades: true, x: 33, z: 23.0, speed: 1.02, phase: 4.8 },
    { species: 'cat', floatType: 'flamingo', fur: '#37474f', acc: '#ff2a85', shades: true, x: 54, z: 19.2, speed: 0.96, phase: 5.5 },

    // Band 2: Mid-Front (Z ~ +5 to +13)
    { species: 'cat', floatType: 'flamingo', fur: '#212121', acc: '#00f5d4', shades: true, x: -58, z: 11.4, speed: 0.88, phase: 0.9 },
    { species: 'dog', floatType: 'lotus_vice', fur: '#f5deb3', acc: '#d4a373', shades: false, x: -38, z: 6.5, speed: 0.91, phase: 2.1 },
    { species: 'cat', floatType: 'surfboard', fur: '#fce4ec', acc: '#ff2a85', shades: true, x: -18, z: 12.6, speed: 0.95, phase: 3.3 },
    { species: 'dog', floatType: 'donut', fur: '#455a64', acc: '#eceff1', shades: false, x: 4, z: 7.8, speed: 0.85, phase: 4.5 },
    { species: 'cat', floatType: 'lotus_vice', fur: '#ffb703', acc: '#ffffff', shades: false, x: 25, z: 10.9, speed: 0.89, phase: 1.7 },
    { species: 'dog', floatType: 'flamingo', fur: '#8d5524', acc: '#ffe0b2', shades: true, x: 48, z: 5.4, speed: 0.93, phase: 2.9 },

    // Band 3: Center Bay (Z ~ -7 to +2)
    { species: 'dog', floatType: 'lotus_vice', fur: '#d49a5a', acc: '#3e2723', shades: false, x: -60, z: -2.2, speed: 0.78, phase: 1.1 },
    { species: 'cat', floatType: 'donut', fur: '#fff8e7', acc: '#5d4037', shades: false, x: -40, z: 1.8, speed: 0.82, phase: 2.5 },
    { species: 'dog', floatType: 'flamingo', fur: '#ffffff', acc: '#ff80ab', shades: true, x: -20, z: -5.4, speed: 0.84, phase: 3.8 },
    { species: 'cat', floatType: 'lotus_vice', fur: '#cfd8dc', acc: '#455a64', shades: false, x: 2, z: 0.6, speed: 0.76, phase: 5.0 },
    { species: 'dog', floatType: 'surfboard', fur: '#e6a85c', acc: '#ffffff', shades: true, x: 24, z: -4.1, speed: 0.86, phase: 0.4 },
    { species: 'cat', floatType: 'flamingo', fur: '#ff9800', acc: '#ffd166', shades: true, x: 46, z: 1.2, speed: 0.80, phase: 1.9 },

    // Band 4: Mid-Far (Z ~ -21 to -11)
    { species: 'cat', floatType: 'flamingo', fur: '#ffb703', acc: '#ffffff', shades: true, x: -52, z: -15.6, speed: 0.72, phase: 0.6 },
    { species: 'dog', floatType: 'surfboard', fur: '#8d5524', acc: '#ffe0b2', shades: false, x: -30, z: -19.8, speed: 0.75, phase: 1.9 },
    { species: 'cat', floatType: 'lotus_vice', fur: '#ffffff', acc: '#00f5d4', shades: false, x: -8, z: -13.2, speed: 0.70, phase: 3.1 },
    { species: 'dog', floatType: 'flamingo', fur: '#e6a85c', acc: '#ffffff', shades: true, x: 14, z: -18.5, speed: 0.74, phase: 4.4 },
    { species: 'cat', floatType: 'donut', fur: '#212121', acc: '#ff2a85', shades: true, x: 36, z: -12.4, speed: 0.69, phase: 2.3 },
    { species: 'dog', floatType: 'lotus_vice', fur: '#f5e6ca', acc: '#c49a6c', shades: false, x: 58, z: -17.0, speed: 0.73, phase: 5.1 },

    // Band 5: Deep North Bay near Ocean Drive (Z ~ -34 to -25)
    { species: 'dog', floatType: 'donut', fur: '#f4a261', acc: '#ffffff', shades: false, x: -56, z: -29.0, speed: 0.64, phase: 1.3 },
    { species: 'cat', floatType: 'surfboard', fur: '#ffffff', acc: '#ff2a85', shades: true, x: -32, z: -33.2, speed: 0.68, phase: 2.8 },
    { species: 'dog', floatType: 'flamingo', fur: '#455a64', acc: '#eceff1', shades: true, x: -10, z: -26.5, speed: 0.62, phase: 4.0 },
    { species: 'cat', floatType: 'lotus_vice', fur: '#ffe0b2', acc: '#e65100', shades: false, x: 12, z: -31.8, speed: 0.66, phase: 0.7 },
    { species: 'dog', floatType: 'lotus_vice', fur: '#6d4c41', acc: '#d7ccc8', shades: false, x: 34, z: -27.4, speed: 0.63, phase: 3.5 },
    { species: 'cat', floatType: 'flamingo', fur: '#fce4ec', acc: '#00f5d4', shades: true, x: 56, z: -32.0, speed: 0.67, phase: 4.9 }
  ], []);

  return html`
    <group>
      <!-- 0. Massive Fleet of 30 Cute Dogs & Cats Floating Across the Wide Bay! -->
      ${floatingPets.map((pet, idx) => html`
        <${VoxelFloatingPet}
          key=${'fpet-' + idx}
          species=${pet.species}
          floatType=${pet.floatType}
          furColor=${pet.fur}
          accentColor=${pet.acc}
          sunglasses=${pet.shades}
          startX=${pet.x}
          z=${pet.z}
          speed=${pet.speed}
          phase=${pet.phase}
        />
      `)}

      <!-- 1 & 2. Cute Dogs & Cats on the Extra-Wide South Pier & Promenade (Z + 18) -->
      <group position=${[0, 0, 18]}>
        <${VoxelDog} position=${[-12.2, 1.4, 13.6]} rotationY=${Math.PI + 0.4} furColor="#e6a85c" earColor="#8d5524" phase=${0.3} />
        <${VoxelCat} position=${[-16.1, 1.4, 13.2]} rotationY=${Math.PI - 0.5} furColor="#ffffff" accentColor="#ff9800" phase=${1.1} />
        <${VoxelDog} position=${[-16.0, 1.4, 16.8]} rotationY=${Math.PI - 0.2} furColor="#f5deb3" earColor="#c49a6c" phase=${1.9} />
        <${VoxelCat} position=${[-11.8, 1.4, 18.2]} rotationY=${Math.PI + 0.2} furColor="#37474f" accentColor="#cfd8dc" phase=${2.5} />

        <${VoxelDog} position=${[-21.2, 1.4, 20.9]} rotationY=${Math.PI - 0.1} furColor="#e69b45" earColor="#ffffff" phase=${0.6} />
        <${VoxelCat} position=${[-19.5, 1.4, 21.1]} rotationY=${Math.PI + 0.3} furColor="#212121" accentColor="#ff2a85" phase=${3.2} />
        <${VoxelDog} position=${[-10.4, 1.4, 20.9]} rotationY=${Math.PI + 0.2} furColor="#ffffff" earColor="#ff80ab" phase=${2.4} />
        <${VoxelDog} position=${[-5.2, 1.4, 21.0]} rotationY=${Math.PI - 0.2} furColor="#f5e6ca" earColor="#c49a6c" phase=${1.8} />
        <${VoxelCat} position=${[-3.2, 1.4, 20.8]} rotationY=${Math.PI} furColor="#ff9800" accentColor="#ffffff" phase=${1.2} />
        <${VoxelBunny} position=${[0.1, 1.4, 20.7]} rotationY=${Math.PI} furColor="#ffffff" phase=${0.2} />
        <${VoxelCat} position=${[3.4, 1.4, 20.9]} rotationY=${Math.PI} furColor="#ffe0b2" accentColor="#e65100" phase=${0.4} />
        <${VoxelDog} position=${[5.8, 1.4, 21.0]} rotationY=${Math.PI - 0.25} furColor="#455a64" earColor="#cfd8dc" phase=${3.5} />
        <${VoxelDog} position=${[10.2, 1.4, 21.1]} rotationY=${Math.PI + 0.3} furColor="#6d4c41" earColor="#3e2723" phase=${0.9} />
        <${VoxelCat} position=${[12.6, 1.4, 20.8]} rotationY=${Math.PI - 0.15} furColor="#ffffff" accentColor="#00f5d4" phase=${2.2} />
        <${VoxelBunny} position=${[18.2, 1.4, 21.0]} rotationY=${Math.PI - 0.4} furColor="#fce4ec" phase=${1.7} />
        <${VoxelDog} position=${[21.0, 1.4, 20.9]} rotationY=${Math.PI + 0.1} furColor="#d49a5a" earColor="#8d5524" phase=${2.8} />
      </group>

      <!-- 3. Dogs & Cats watching from the Extra-Wide North Ocean Drive Riverbank (Z - 24) -->
      <group position=${[0, 0, -24]}>
        <${VoxelDog} position=${[-18.0, 1.4, -21.0]} rotationY=${0.2} furColor="#f5deb3" earColor="#a1887f" phase=${0.8} />
        <${VoxelDog} position=${[-13.5, 1.4, -21.0]} rotationY=${0.3} furColor="#d49a5a" earColor="#795548" phase=${2.1} />
        <${VoxelCat} position=${[-7.5, 1.4, -21.0]} rotationY=${-0.1} furColor="#ff9800" accentColor="#fff3e0" phase=${1.9} />
        <${VoxelBunny} position=${[-2.0, 1.4, -21.0]} rotationY=${0} furColor="#fff8e1" phase=${2.9} />
        <${VoxelCat} position=${[8.5, 1.4, -21.0]} rotationY=${-0.2} furColor="#ffffff" accentColor="#78909c" phase=${1.4} />
        <${VoxelDog} position=${[19.0, 1.4, -21.0]} rotationY=${-0.25} furColor="#e69b45" earColor="#8d5524" phase=${3.3} />
      </group>

      <!-- 4. Two Families of Swimming Ducks + 3 Chill Capybaras Floating Across the Bay! -->
      <${VoxelSwimmingDuck} startX=${-28} z=${14.2} speed=${1.15} phase=${0} isBaby=${false} />
      <${VoxelSwimmingDuck} startX=${-29.4} z=${14.5} speed=${1.15} phase=${0.8} isBaby=${true} />
      <${VoxelSwimmingDuck} startX=${-30.6} z=${14.0} speed=${1.15} phase=${1.6} isBaby=${true} />
      <${VoxelSwimmingDuck} startX=${22} z=${-8.6} speed=${1.05} phase=${2.1} isBaby=${false} />
      <${VoxelSwimmingDuck} startX=${20.6} z=${-8.3} speed=${1.05} phase=${2.9} isBaby=${true} />
      <${VoxelSwimmingDuck} startX=${19.4} z=${-8.8} speed=${1.05} phase=${3.7} isBaby=${true} />
      <${VoxelSwimmingDuck} startX=${-4} z=${-23.2} speed=${0.95} phase=${4.2} isBaby=${false} />

      <${VoxelCapybara} startX=${-36} z=${-6.2} speed=${0.72} />
      <${VoxelCapybara} startX=${6} z=${8.5} speed=${0.68} />
      <${VoxelCapybara} startX=${42} z=${-22.4} speed=${0.64} />

      <!-- 5. 4 Cruising Voxel Sharks & 5 Leaping Dolphins Across the Expansive Waters! -->
      <${VoxelShark} startX=${-34} z=${-10.5} speed=${2.6} dir=${1} scale=${1.18} phase=${0.2} />
      <${VoxelShark} startX=${26} z=${15.2} speed=${2.3} dir=${-1} scale=${0.95} phase=${2.4} />
      <${VoxelShark} startX=${-10} z=${-28.5} speed=${2.8} dir=${1} scale=${1.1} phase=${1.3} />
      <${VoxelShark} startX=${48} z=${2.8} speed=${2.4} dir=${-1} scale=${1.0} phase=${3.8} />

      <${VoxelDolphin} startX=${-24} z=${3.6} speed=${3.2} dir=${1} bodyColor="#29b6f6" bellyColor="#e1f5fe" phase=${0.0} />
      <${VoxelDolphin} startX=${-27.5} z=${5.0} speed=${3.2} dir=${1} bodyColor="#4fc3f7" bellyColor="#ffffff" phase=${0.55} />
      <${VoxelDolphin} startX=${18} z=${-14.6} speed=${2.9} dir=${-1} bodyColor="#ff80ab" bellyColor="#fce4ec" phase=${1.4} />
      <${VoxelDolphin} startX=${38} z=${11.2} speed=${3.0} dir=${-1} bodyColor="#00f5d4" bellyColor="#e0f7fa" phase=${2.2} />
      <${VoxelDolphin} startX=${-46} z=${-24.0} speed=${3.1} dir=${1} bodyColor="#ff80ab" bellyColor="#ffffff" phase=${3.0} />
    </group>
  `;
}

function VoxelFestivalCrowd() {
  // Crowd of Voxel People distributed along the Connected Pier, South Market Promenade, and North Bank
  const people = useMemo(() => [
    // 1. Main Thrower Character standing at the tip of the Connected Pier (X = -14, Z = 13.0) facing the river (rotationY = Math.PI)
    { pos: [-14.0, 1.4, 13.0], rot: Math.PI, shirt: '#ff6d00', pants: '#1a237e', hold: true, isPlayer: true, phase: 0 },
    // Friends on the pier bridge cheering & holding krathongs
    { pos: [-15.8, 1.4, 14.8], rot: Math.PI - 0.3, shirt: '#ec407a', pants: '#fff8e1', hold: true, isPlayer: false, phase: 1.2 },
    { pos: [-12.3, 1.4, 16.5], rot: Math.PI + 0.25, shirt: '#00e5ff', pants: '#263238', hold: false, isPlayer: false, phase: 2.4 },
    { pos: [-15.4, 1.4, 18.8], rot: Math.PI - 0.15, shirt: '#ffd740', pants: '#3e2723', hold: true, isPlayer: false, phase: 3.1 },

    // 2. People strolling & watching along the South Night Market Promenade (Z = 20.8..22.2)
    { pos: [-24.5, 1.4, 21.0], rot: Math.PI, shirt: '#ab47bc', pants: '#1a237e', hold: true, phase: 0.7 },
    { pos: [-22.8, 1.4, 21.2], rot: Math.PI - 0.2, shirt: '#26c6da', pants: '#212121', hold: false, phase: 1.5 },
    { pos: [-8.5, 1.4, 20.8], rot: Math.PI, shirt: '#66bb6a', pants: '#263238', hold: true, phase: 2.1 },
    { pos: [-6.8, 1.4, 21.0], rot: Math.PI + 0.2, shirt: '#ff4081', pants: '#fff8e1', hold: false, phase: 0.4 },
    { pos: [-1.5, 1.4, 21.2], rot: Math.PI, shirt: '#ffa726', pants: '#3e2723', hold: true, phase: 3.8 },
    { pos: [1.8, 1.4, 21.2], rot: Math.PI, shirt: '#42a5f5', pants: '#1a237e', hold: false, phase: 1.9 },
    { pos: [8.2, 1.4, 20.9], rot: Math.PI - 0.1, shirt: '#ec407a', pants: '#212121', hold: true, phase: 2.8 },
    { pos: [14.5, 1.4, 21.1], rot: Math.PI + 0.15, shirt: '#ffee58', pants: '#283593', hold: false, phase: 0.9 },
    { pos: [16.2, 1.4, 21.1], rot: Math.PI - 0.25, shirt: '#ef5350', pants: '#212121', hold: true, phase: 4.2 },
    { pos: [23.0, 1.4, 21.0], rot: Math.PI, shirt: '#29b6f6', pants: '#263238', hold: false, phase: 1.1 },

    // 3. People across the river on the Extra-Wide North City Promenade (Z = -63 + 18 = -45) facing South (rot = 0)
    { pos: [-20, 1.4, -63.0], rot: 0, shirt: '#ff4081', pants: '#1a237e', hold: true, phase: 0.5 },
    { pos: [-11, 1.4, -63.0], rot: 0.2, shirt: '#ffd740', pants: '#212121', hold: false, phase: 1.7 },
    { pos: [-4, 1.4, -63.0], rot: -0.1, shirt: '#00e5ff', pants: '#263238', hold: true, phase: 2.9 },
    { pos: [6, 1.4, -63.0], rot: 0, shirt: '#69f0ae', pants: '#1a237e', hold: false, phase: 3.4 },
    { pos: [15, 1.4, -63.0], rot: -0.2, shirt: '#ff80ab', pants: '#fff8e1', hold: true, phase: 1.3 },
    { pos: [24, 1.4, -63.0], rot: 0.1, shirt: '#ffa726', pants: '#212121', hold: false, phase: 2.2 }
  ], []);

  return html`
    <group>
      ${people.map((p, idx) => html`
        <${VoxelPerson}
          key=${idx}
          position=${p.pos}
          rotationY=${p.rot}
          shirtColor=${p.shirt}
          pantsColor=${p.pants}
          holdingKrathong=${p.hold}
          isPlayerThrower=${p.isPlayer}
          phase=${p.phase}
        />
      `)}
    </group>
  `;
}

function Voxel360SurroundingCity() {
  // South Side (Behind Camera, Z = +24..+32): Festive Thai Night Market, Street Stalls & High-rises
  const southBuildings = useMemo(() => [
    { x: -38, z: 31, w: 6, h: 18, d: 5, color: '#232e69', neon: '#ff4081' },
    { x: -28, z: 32, w: 5.5, h: 22, d: 5, color: '#283578', neon: '#00e5ff' },
    { x: -16, z: 30, w: 7, h: 15, d: 5, color: '#212c63', neon: '#ffd740' },
    { x: 14, z: 31, w: 6.5, h: 20, d: 5.5, color: '#263270', neon: '#e040fb' },
    { x: 26, z: 30, w: 5.5, h: 16, d: 5, color: '#222d66', neon: '#69f0ae' },
    { x: 38, z: 31, w: 6, h: 24, d: 5, color: '#2a377a', neon: '#40c4ff' }
  ], []);

  // Night Market Festival Stalls along the South Promenade (Z = +23.5)
  const marketStalls = useMemo(() => [
    { x: -24, roof1: '#ff5252', roof2: '#ffffff' },
    { x: -18, roof1: '#26c6da', roof2: '#fff59d' },
    { x: -12, roof1: '#ab47bc', roof2: '#ffffff' },
    { x: -6, roof1: '#ffa726', roof2: '#fff59d' },
    { x: 6, roof1: '#ec407a', roof2: '#ffffff' },
    { x: 12, roof1: '#66bb6a', roof2: '#fff59d' },
    { x: 18, roof1: '#29b6f6', roof2: '#ffffff' },
    { x: 24, roof1: '#ff7043', roof2: '#fff59d' }
  ], []);

  // East & West Canal Banks & Bridges (X = -86 and X = +86) closing the extra-wide 360° horizon
  const sideTowers = useMemo(() => [
    { x: -86, z: -48, w: 6, h: 19, d: 6, color: '#25306e', neon: '#00f5d4' },
    { x: -86, z: -26, w: 5.5, h: 14, d: 5.5, color: '#212b63', neon: '#ffd166' },
    { x: -86, z: -4, w: 6, h: 21, d: 6, color: '#283475', neon: '#ff2a85' },
    { x: -86, z: 16, w: 5, h: 15, d: 5, color: '#222c66', neon: '#00f5d4' },
    { x: 86, z: -48, w: 6, h: 22, d: 6, color: '#273373', neon: '#e040fb' },
    { x: 86, z: -25, w: 5.5, h: 16, d: 5.5, color: '#232e69', neon: '#00f5d4' },
    { x: 86, z: -3, w: 6, h: 20, d: 6, color: '#293678', neon: '#ff2a85' },
    { x: 86, z: 17, w: 5.5, h: 14, d: 5.5, color: '#212b63', neon: '#ffd166' }
  ], []);

  return html`
    <group>
      <!-- South Promenade Riverbank Embankment (Extra-Wide 200 units) -->
      <mesh position=${[0, 0.6, 24.5]}>
        <boxGeometry args=${[200, 1.6, 9]} />
        <meshStandardMaterial color="#1a224d" roughness=${0.85} />
      </mesh>

      <!-- Grand Thai Festival Entrance Archway (ซุ้มประตูงานวัดลอยกระทง) on South Bank -->
      <group position=${[0, 1.4, 22.5]}>
        <mesh position=${[-3.4, 2.8, 0]}>
          <boxGeometry args=${[0.8, 5.6, 0.8]} />
          <meshStandardMaterial color="#b71c1c" />
        </mesh>
        <mesh position=${[3.4, 2.8, 0]}>
          <boxGeometry args=${[0.8, 5.6, 0.8]} />
          <meshStandardMaterial color="#b71c1c" />
        </mesh>
        <mesh position=${[0, 5.8, 0]}>
          <boxGeometry args=${[8.4, 1.1, 1.1]} />
          <meshStandardMaterial color="#f5b942" emissive="#ff8f00" emissiveIntensity=${0.45} />
        </mesh>
        <mesh position=${[0, 6.8, 0]}>
          <boxGeometry args=${[5.2, 0.9, 0.9]} />
          <meshBasicMaterial color="#ffe57f" />
        </mesh>
        <pointLight position=${[0, 4.5, -1]} color="#ffd54f" intensity=${5} distance=${18} />
      </group>

      <!-- Festive Thai Night Market Stalls & String Lights along South Promenade -->
      ${marketStalls.map((st, idx) => html`
        <group key=${'stall-' + idx} position=${[st.x, 1.4, 23.2]}>
          <!-- Stall Counter -->
          <mesh position=${[0, 0.6, 0]}>
            <boxGeometry args=${[3.2, 1.2, 2.2]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <!-- Glowing Awning Roof -->
          <mesh position=${[-0.8, 2.2, 0]}>
            <boxGeometry args=${[1.7, 0.45, 2.6]} />
            <meshBasicMaterial color=${st.roof1} />
          </mesh>
          <mesh position=${[0.8, 2.2, 0]}>
            <boxGeometry args=${[1.7, 0.45, 2.6]} />
            <meshBasicMaterial color=${st.roof2} />
          </mesh>
          <!-- Warm Stall Bulb -->
          <mesh position=${[0, 1.65, -0.5]}>
            <boxGeometry args=${[0.35, 0.35, 0.35]} />
            <meshBasicMaterial color="#fff59d" />
          </mesh>
        </group>
      `)}

      <!-- South Skyscrapers & Lit Windows (Behind Camera) -->
      ${southBuildings.map((b, idx) => html`
        <group key=${'sb-' + idx} position=${[b.x, 1.2, b.z]}>
          <mesh position=${[0, b.h / 2, 0]}>
            <boxGeometry args=${[b.w, b.h, b.d]} />
            <meshStandardMaterial color=${b.color} roughness=${0.75} />
          </mesh>
          ${b.neon && html`
            <mesh position=${[0, b.h + 0.6, -b.d * 0.3]}>
              <boxGeometry args=${[b.w * 0.65, 0.5, 0.35]} />
              <meshBasicMaterial color=${b.neon} />
            </mesh>
          `}
          <!-- Front windows facing the river (towards -Z) -->
          ${[-1.4, 0, 1.4].map((wx, cIdx) =>
            [3, 6, 9, 12, 15].filter((wy) => wy < b.h - 1.5).map((wy, rIdx) => html`
              <mesh key=${`${cIdx}-${rIdx}`} position=${[wx, wy, -b.d / 2 - 0.06]}>
                <boxGeometry args=${[0.65, 0.75, 0.08]} />
                <meshBasicMaterial color=${(cIdx + rIdx) % 2 === 0 ? '#ffe57f' : '#80d8ff'} />
              </mesh>
            `)
          )}
        </group>
      `)}

      <!-- East & West Side Embankments & City Towers (Pushed far out to X = ±88 for massive wide bay) -->
      <mesh position=${[-88, 0.6, -21]}>
        <boxGeometry args=${[12, 1.6, 128]} />
        <meshStandardMaterial color="#18204a" />
      </mesh>
      <mesh position=${[88, 0.6, -21]}>
        <boxGeometry args=${[12, 1.6, 128]} />
        <meshStandardMaterial color="#18204a" />
      </mesh>

      ${sideTowers.map((b, idx) => {
        const faceSign = b.x < 0 ? 1 : -1;
        return html`
          <group key=${'side-' + idx} position=${[b.x, 1.2, b.z]}>
            <mesh position=${[0, b.h / 2, 0]}>
              <boxGeometry args=${[b.w, b.h, b.d]} />
              <meshStandardMaterial color=${b.color} />
            </mesh>
            ${b.neon && html`
              <mesh position=${[faceSign * (b.w / 2 + 0.1), b.h + 0.5, 0]}>
                <boxGeometry args=${[0.35, 0.5, b.d * 0.65]} />
                <meshBasicMaterial color=${b.neon} />
              </mesh>
            `}
            ${[-1.2, 1.2].map((wz, cIdx) =>
              [3.5, 7, 10.5, 14, 17.5].filter((wy) => wy < b.h - 1.5).map((wy, rIdx) => html`
                <mesh key=${`${cIdx}-${rIdx}`} position=${[faceSign * (b.w / 2 + 0.06), wy, wz]}>
                  <boxGeometry args=${[0.08, 0.75, 0.65]} />
                  <meshBasicMaterial color="#ffe57f" />
                </mesh>
              `)
            )}
          </group>
        `;
      })}
    </group>
  `;
}
// ============================================================================
// 3D. GTA 6 VICE BEACH PALM TREES & 360° SUNSET-TWILIGHT HORIZON
// ============================================================================
function VoxelPalmTree({ position = [0, 0, 0], scale = 1, neonColor = '#ff2a85', lean = 0.12 }) {
  const frondAngles = useMemo(() => [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3], []);

  return html`
    <group position=${position} scale=${[scale, scale, scale]}>
      <!-- Neon Base Uplight Ring -->
      <mesh position=${[0, 0.08, 0]}>
        <boxGeometry args=${[0.95, 0.12, 0.95]} />
        <meshBasicMaterial color=${neonColor} />
      </mesh>
      <!-- Segmented Curved Palm Trunk -->
      ${[0, 1, 2, 3, 4, 5].map((seg) => html`
        <mesh
          key=${seg}
          position=${[seg * lean * 0.42, 0.55 + seg * 0.82, 0]}
          rotation=${[0, 0, -lean * 0.45]}
          castShadow
        >
          <boxGeometry args=${[0.44 - seg * 0.03, 0.88, 0.44 - seg * 0.03]} />
          <meshStandardMaterial color=${seg % 2 === 0 ? '#6d4c41' : '#8d6e63'} />
        </mesh>
      `)}
      <!-- Coconuts & Lush Tropical Palm Fronds -->
      <group position=${[5 * lean * 0.45, 5.4, 0]}>
        <mesh position=${[0, -0.15, 0]}>
          <boxGeometry args=${[0.5, 0.35, 0.5]} />
          <meshStandardMaterial color="#4e342e" />
        </mesh>
        ${frondAngles.map((ang, i) => html`
          <group key=${i} rotation=${[0, ang, 0]}>
            <mesh position=${[0.95, 0.12, 0]} rotation=${[0, 0, -0.22]}>
              <boxGeometry args=${[1.8, 0.16, 0.52]} />
              <meshStandardMaterial color="#00cba9" emissive="#006d77" emissiveIntensity=${0.25} />
            </mesh>
            <mesh position=${[2.0, -0.28, 0]} rotation=${[0, 0, -0.52]}>
              <boxGeometry args=${[1.05, 0.12, 0.38]} />
              <meshStandardMaterial color="#2ec4b6" emissive=${neonColor} emissiveIntensity=${0.15} />
            </mesh>
          </group>
        `)}
      </group>
    </group>
  `;
}

function VoxelViceSunsetHorizon() {
  // 360-degree distant GTA 6 Vice Beach Sunset-to-Twilight Horizon Cylinder Bands (Extra-Wide Radius 130)
  return html`
    <group position=${[0, 0, 0]}>
      <!-- Lowest Warm Peach-Orange Horizon Band -->
      <mesh position=${[0, 4.0, 0]}>
        <cylinderGeometry args=${[128, 128, 8.0, 32, 1, true]} />
        <meshBasicMaterial color="#ff8c61" side=${THREE.BackSide} fog=${false} transparent=${true} opacity=${0.62} />
      </mesh>
      <!-- Hot Vice Pink-Magenta Band -->
      <mesh position=${[0, 11.5, 0]}>
        <cylinderGeometry args=${[128.5, 128.5, 8.5, 32, 1, true]} />
        <meshBasicMaterial color="#ff2a85" side=${THREE.BackSide} fog=${false} transparent=${true} opacity=${0.48} />
      </mesh>
      <!-- Electric Leonida Violet-Purple Band -->
      <mesh position=${[0, 20.5, 0]}>
        <cylinderGeometry args=${[129, 129, 11.0, 32, 1, true]} />
        <meshBasicMaterial color="#7209b7" side=${THREE.BackSide} fog=${false} transparent=${true} opacity=${0.36} />
      </mesh>

      <!-- Palm Trees Lining Both the Extra-Wide North Ocean Drive & South Beach Festival Walk -->
      ${[-60, -44, -28, -14, 2, 16, 32, 48, 62].map((px, i) => html`
        <${VoxelPalmTree}
          key=${'npalm-' + i}
          position=${[px, 1.35, -45.8]}
          scale=${0.95}
          neonColor=${i % 2 === 0 ? '#ff2a85' : '#00f5d4'}
          lean=${i % 2 === 0 ? 0.12 : -0.1}
        />
      `)}
      ${[-56, -38, -22, -9, 9, 22, 38, 56].map((px, i) => html`
        <${VoxelPalmTree}
          key=${'spalm-' + i}
          position=${[px, 1.35, 39.8]}
          scale=${0.98}
          neonColor=${i % 2 === 0 ? '#00f5d4' : '#ff2a85'}
          lean=${i % 2 === 0 ? -0.11 : 0.11}
        />
      `)}
    </group>
  `;
}

function VoxelCitySkyline() {
  const wheelRef = useRef();

  // Art Deco Vice Beach / Ocean Drive 3D Skyscrapers with Neon Vertical Strips
  const buildings = useMemo(() => [
    { x: -42, z: -27, w: 4.8, h: 15, d: 4.5, color: '#311b63', neon: '#ff2a85', winColor: '#ffd166' },
    { x: -36, z: -29, w: 5.5, h: 21, d: 5.0, color: '#242f73', neon: '#00f5d4', winColor: '#b8f2e6' },
    { x: -29, z: -26, w: 4.2, h: 12, d: 4.0, color: '#3c1661', neon: '#ff9e64', winColor: '#ffe5ec' },
    { x: -23, z: -28, w: 5.0, h: 17, d: 4.6, color: '#2b226b', neon: '#00f5d4', winColor: '#ffd166' },
    // (-14 to -2 is the Riverside Temple Chedi heritage zone)
    { x: 4, z: -28, w: 5.8, h: 24, d: 5.2, color: '#381866', neon: '#ff2a85', winColor: '#ffe57f' },
    { x: 11, z: -26, w: 4.6, h: 14, d: 4.2, color: '#1d356b', neon: '#00f5d4', winColor: '#a8f9ff' },
    { x: 17, z: -29, w: 6.2, h: 27, d: 5.5, color: '#331a6b', neon: '#ff7b54', winColor: '#ffd6ff' },
    { x: 24, z: -27, w: 4.8, h: 16, d: 4.4, color: '#292266', neon: '#ff2a85', winColor: '#ffe57f' },
    { x: 42, z: -28, w: 5.4, h: 19, d: 4.8, color: '#351c6e', neon: '#00f5d4', winColor: '#fff59d' }
  ], []);

  // Precompute lit voxel windows for each skyscraper
  const buildingWindows = useMemo(() => {
    return buildings.map((b, bIdx) => {
      const wins = [];
      const cols = Math.floor(b.w / 1.1);
      const rows = Math.floor((b.h - 2) / 1.3);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Deterministic pseudo-random pattern so ~70% of windows are lit
          if (((r * 17 + c * 31 + bIdx * 13) % 10) > 2) {
            const wx = (c - (cols - 1) / 2) * 0.95;
            const wy = 1.6 + r * 1.25;
            const wz = b.d / 2 + 0.06;
            wins.push({ wx, wy, wz, isWarm: (r + c + bIdx) % 3 !== 0 });
          }
        }
      }
      return wins;
    });
  }, [buildings]);

  // 12 spokes/pods for the Giant Riverside Ferris Wheel (ชิงช้าสวรรค์เอเชียทีค)
  const wheelPods = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 12; i++) {
      arr.push((i * Math.PI * 2) / 12);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (wheelRef.current) {
      wheelRef.current.rotation.z = clock.getElapsedTime() * 0.22;
    }
  });

  return html`
    <group>
      <!-- Continuous Concrete City Riverbank & Promenade Wall (Extra-Wide 200 units) -->
      <mesh position=${[0, 0.6, -24.5]}>
        <boxGeometry args=${[200, 1.6, 7]} />
        <meshStandardMaterial color="#111633" roughness=${0.85} />
      </mesh>

      <!-- Promenade Neon & Warm Streetlights along the Riverfront -->
      ${Array.from({ length: 22 }).map((_, idx) => {
        const lx = -46 + idx * 4.4;
        const lampColor = idx % 3 === 0 ? '#00e5ff' : (idx % 2 === 0 ? '#ffd54f' : '#ff4081');
        return html`
          <group key=${'lamp-' + idx} position=${[lx, 1.4, -21.2]}>
            <mesh position=${[0, 0.7, 0]}>
              <boxGeometry args=${[0.15, 1.4, 0.15]} />
              <meshStandardMaterial color="#37474f" />
            </mesh>
            <mesh position=${[0, 1.5, 0]}>
              <boxGeometry args=${[0.42, 0.42, 0.42]} />
              <meshBasicMaterial color=${lampColor} />
            </mesh>
          </group>
        `;
      })}

      <!-- 1. High-Rise City Skyscrapers with Glowing Voxel Windows & Neon Rooftops -->
      ${buildings.map((b, bIdx) => html`
        <group key=${'bldg-' + bIdx} position=${[b.x, 1.2, b.z]}>
          <!-- Main Building Tower -->
          <mesh position=${[0, b.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args=${[b.w, b.h, b.d]} />
            <meshStandardMaterial color=${b.color} roughness=${0.75} />
          </mesh>

          <!-- Stepped Rooftop Crown -->
          <mesh position=${[0, b.h + 0.6, 0]}>
            <boxGeometry args=${[b.w * 0.7, 1.2, b.d * 0.7]} />
            <meshStandardMaterial color="#1c2454" />
          </mesh>

          <!-- Glowing Neon Sign / Penthouse Beacon + Vertical Art Deco Vice Neon Strips -->
          ${b.neon && html`
            <group>
              <mesh position=${[0, b.h + 1.45, b.d * 0.25]}>
                <boxGeometry args=${[b.w * 0.68, 0.52, 0.35]} />
                <meshBasicMaterial color=${b.neon} />
              </mesh>
              <mesh position=${[-b.w / 2 + 0.08, b.h / 2, b.d / 2 + 0.08]}>
                <boxGeometry args=${[0.14, b.h * 0.92, 0.12]} />
                <meshBasicMaterial color=${b.neon} />
              </mesh>
              <mesh position=${[b.w / 2 - 0.08, b.h / 2, b.d / 2 + 0.08]}>
                <boxGeometry args=${[0.14, b.h * 0.92, 0.12]} />
                <meshBasicMaterial color=${b.neon} />
              </mesh>
            </group>
          `}

          <!-- Lit Office & Condo Voxel Windows -->
          ${buildingWindows[bIdx].map((w, wIdx) => html`
            <mesh key=${wIdx} position=${[w.wx, w.wy, w.wz]}>
              <boxGeometry args=${[0.55, 0.68, 0.08]} />
              <meshBasicMaterial color=${w.isWarm ? b.winColor : '#ffffff'} />
            </mesh>
          `)}
        </group>
      `)}

      <!-- 2. Giant Glowing Riverside Ferris Wheel (ชิงช้าสวรรค์ริมแม่น้ำ) -->
      <group position=${[-18, 1.4, -24.5]}>
        <!-- A-Frame Support Legs -->
        <mesh position=${[-1.8, 3.8, 0]} rotation=${[0, 0, -0.22]}>
          <boxGeometry args=${[0.4, 8.2, 0.4]} />
          <meshStandardMaterial color="#283593" />
        </mesh>
        <mesh position=${[1.8, 3.8, 0]} rotation=${[0, 0, 0.22]}>
          <boxGeometry args=${[0.4, 8.2, 0.4]} />
          <meshStandardMaterial color="#283593" />
        </mesh>

        <!-- Rotating Ferris Wheel Rim & Glowing Capsules -->
        <group ref=${wheelRef} position=${[0, 7.6, 0.4]}>
          <mesh>
            <boxGeometry args=${[0.9, 0.9, 0.6]} />
            <meshBasicMaterial color="#ffd54f" />
          </mesh>
          ${wheelPods.map((angle, i) => {
            const r = 5.2;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            const podColor = i % 3 === 0 ? '#00e5ff' : (i % 2 === 0 ? '#ff4081' : '#ffe57f');
            return html`
              <group key=${i}>
                <!-- Spoke -->
                <mesh position=${[px * 0.5, py * 0.5, 0]} rotation=${[0, 0, angle]}>
                  <boxGeometry args=${[r, 0.14, 0.14]} />
                  <meshBasicMaterial color="#5c6bc0" />
                </mesh>
                <!-- Glowing Passenger Capsule -->
                <mesh position=${[px, py, 0.2]}>
                  <boxGeometry args=${[0.75, 0.75, 0.65]} />
                  <meshBasicMaterial color=${podColor} />
                </mesh>
              </group>
            `;
          })}
        </group>
      </group>

      <!-- 3. Cable-Stayed Suspension Bridge (สะพานพระราม 8 ริมแม่น้ำ) -->
      <group position=${[32, 1.2, -23.5]}>
        <!-- Inverted-Y Main Bridge Pylon Tower -->
        <mesh position=${[0, 9.5, 0]}>
          <boxGeometry args=${[1.8, 19, 1.8]} />
          <meshStandardMaterial color="#283593" />
        </mesh>
        <mesh position=${[0, 19.8, 0]}>
          <boxGeometry args=${[0.9, 2.5, 0.9]} />
          <meshBasicMaterial color="#ffd54f" />
        </mesh>
        <!-- Bridge Highway Deck -->
        <mesh position=${[-2, 4.2, 0.5]}>
          <boxGeometry args=${[24, 0.75, 2.4]} />
          <meshStandardMaterial color="#1a237e" />
        </mesh>
        <!-- Illuminated Golden Suspension Cables -->
        ${[-9, -6.5, -4, 4, 6.5, 9].map((cx, i) => {
          const dist = Math.abs(cx);
          const tilt = cx > 0 ? 0.58 : -0.58;
          return html`
            <mesh key=${i} position=${[cx * 0.55, 11.5 - dist * 0.35, 0.5]} rotation=${[0, 0, tilt]}>
              <boxGeometry args=${[0.14, 13.5, 0.14]} />
              <meshBasicMaterial color="#ffe082" />
            </mesh>
          `;
        })}
      </group>

      <!-- 4. Riverside Heritage Temple Chedi (วัดอรุณริมน้ำเคียงคู่ตึกเมือง) -->
      <group position=${[-8, 1.2, -23.5]}>
        <mesh position=${[0, 1.5, 0]}>
          <boxGeometry args=${[5.6, 3, 5.6]} />
          <meshStandardMaterial color="#1e2452" />
        </mesh>
        <mesh position=${[0, 4.1, 0]}>
          <boxGeometry args=${[3.8, 2.5, 3.8]} />
          <meshStandardMaterial color="#27306b" />
        </mesh>
        <mesh position=${[0, 6.4, 0]}>
          <boxGeometry args=${[2.3, 2.2, 2.3]} />
          <meshStandardMaterial color="#313c85" />
        </mesh>
        <mesh position=${[0, 8.7, 0]}>
          <boxGeometry args=${[1.1, 2.4, 1.1]} />
          <meshStandardMaterial color="#f5b942" emissive="#ff8f00" emissiveIntensity=${0.5} />
        </mesh>
        <mesh position=${[0, 10.8, 0]}>
          <boxGeometry args=${[0.42, 2.0, 0.42]} />
          <meshBasicMaterial color="#ffe57f" />
        </mesh>
        <!-- Flanking Minor Chedis -->
        ${[-5.5, 5.5].map((ox, i) => html`
          <group key=${i} position=${[ox, 0, 0]}>
            <mesh position=${[0, 1.2, 0]}>
              <boxGeometry args=${[2.8, 2.4, 2.8]} />
              <meshStandardMaterial color="#1e2452" />
            </mesh>
            <mesh position=${[0, 3.1, 0]}>
              <boxGeometry args=${[1.7, 1.8, 1.7]} />
              <meshStandardMaterial color="#2b3575" />
            </mesh>
            <mesh position=${[0, 4.9, 0]}>
              <boxGeometry args=${[0.65, 2.0, 0.65]} />
              <meshStandardMaterial color="#f5b942" emissive="#ff8f00" emissiveIntensity=${0.4} />
            </mesh>
          </group>
        `)}
      </group>
    </group>
  `;
}

function VoxelEnvironment({ onWaterClick }) {
  const waterRef = useRef();

  // Animated water shimmer
  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.position.y = -0.05 + Math.sin(clock.getElapsedTime() * 1.6) * 0.04;
    }
  });

  return html`
    <group>
      <!-- GTA 6 Vice Beach Sunset-Twilight + Loy Krathong Neon Festival Lighting -->
      <ambientLight intensity=${1.45} color="#f3c4fb" />
      <hemisphereLight
        skyColor="#ff8fab"
        groundColor="#00bbf9"
        intensity=${1.35}
      />
      <directionalLight
        position=${[18, 28, -22]}
        intensity=${2.35}
        color="#ffd6a5"
        castShadow
      />
      <!-- Front Vice Coral-Cyan Fill Light so Krathongs, Pets & Pier pop vividly -->
      <directionalLight
        position=${[-12, 16, 22]}
        intensity=${1.25}
        color="#ff9ebb"
      />
      <!-- Vice Beach Neon Pink & Electric Cyan Promenade Glow Lights -->
      <pointLight position=${[-16, 10, -18]} color="#ff2a85" intensity=${8} distance=${60} />
      <pointLight position=${[16, 10, -18]} color="#00f5d4" intensity=${7} distance=${60} />
      <pointLight position=${[0, 9, 18]} color="#ff7b54" intensity=${6} distance=${50} />

      <!-- 360° Vice Beach Sunset Gradient Horizon & Neon Palm Trees -->
      <${VoxelViceSunsetHorizon} />

      <!-- Giant Glowing 3D Voxel Full Moon (พระจันทร์เต็มดวงคืนวันเพ็ญบนท้องฟ้า) -->
      <group position=${[-1, 22.0, -58]}>
        <!-- Round Voxel/Low-Poly Full Moon Core (fog=false so it always shines crisply) -->
        <mesh>
          <sphereGeometry args=${[5.8, 14, 10]} />
          <meshBasicMaterial color="#fff9d2" fog=${false} />
        </mesh>
        <!-- Subtle Pixel Moon Craters (ลายกระต่ายบนดวงจันทร์) -->
        <mesh position=${[-1.7, 1.2, 5.5]}>
          <boxGeometry args=${[1.8, 1.5, 0.4]} />
          <meshBasicMaterial color="#ebd27f" fog=${false} />
        </mesh>
        <mesh position=${[1.6, -0.8, 5.5]}>
          <boxGeometry args=${[1.5, 1.3, 0.4]} />
          <meshBasicMaterial color="#ebd27f" fog=${false} />
        </mesh>
        <mesh position=${[-1.0, -2.1, 5.3]}>
          <boxGeometry args=${[1.1, 1.1, 0.4]} />
          <meshBasicMaterial color="#e5c86e" fog=${false} />
        </mesh>
        <mesh position=${[1.0, 2.0, 5.3]}>
          <boxGeometry args=${[1.0, 1.0, 0.4]} />
          <meshBasicMaterial color="#e5c86e" fog=${false} />
        </mesh>
        <!-- Inner Warm Golden Moon Halo -->
        <mesh position=${[0, 0, -0.5]}>
          <circleGeometry args=${[8.2, 24]} />
          <meshBasicMaterial color="#ffe58f" transparent=${true} opacity=${0.36} fog=${false} />
        </mesh>
        <!-- Outer Soft Vice Sunset Moon Aura -->
        <mesh position=${[0, 0, -1.0]}>
          <circleGeometry args=${[11.8, 24]} />
          <meshBasicMaterial color="#ff9ebb" transparent=${true} opacity=${0.2} fog=${false} />
        </mesh>
        <pointLight color="#fff0b3" intensity=${10} distance=${180} />
      </group>

      <!-- 3D Voxel Vice Beach Skyline (Extra-Wide Massive Bay: North Bank Z=-48, South Bank Z=+42) -->
      <group position=${[0, 0, -24]}>
        <${VoxelCitySkyline} />
      </group>
      <group position=${[0, 0, 18]}>
        <${Voxel360SurroundingCity} />
      </group>
      <group position=${[0, 0, 18]}>
        <${VoxelFestivalCrowd} />
      </group>
      <${VoxelCuteAnimals} />
      <${VoxelThrowTrajectory} />

      <!-- Shore-Connected Thai Wooden Pier Bridge (เชื่อมต่อจากริมฝั่งถนนงานวัด Z=39 ยื่นลงสู่แม่น้ำกว้าง Z=30.5) -->
      <group position=${[-14, 0, 34.5]}>
        <!-- Main Wooden Walkway Deck connecting South Bank directly into the River -->
        <mesh position=${[0, 1.15, 0]} receiveShadow castShadow>
          <boxGeometry args=${[6.8, 0.45, 9.5]} />
          <meshStandardMaterial color="#8d6e63" roughness=${0.7} />
        </mesh>

        <!-- Front Wooden Steps descending down toward the water surface (บันไดท่าน้ำ) -->
        <mesh position=${[0, 0.82, -5.1]} receiveShadow>
          <boxGeometry args=${[5.8, 0.35, 1.0]} />
          <meshStandardMaterial color="#795548" />
        </mesh>
        <mesh position=${[0, 0.48, -5.8]} receiveShadow>
          <boxGeometry args=${[5.8, 0.35, 1.0]} />
          <meshStandardMaterial color="#6d4c41" />
        </mesh>

        <!-- Wooden Side Railings (ราวสะพานท่าน้ำซ้าย-ขวา) -->
        <mesh position=${[-3.15, 2.0, 0.5]}>
          <boxGeometry args=${[0.25, 0.22, 8.5]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
        <mesh position=${[3.15, 2.0, 0.5]}>
          <boxGeometry args=${[0.25, 0.22, 8.5]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>

        <!-- Railing Support Pillars & Pier Underwater Stilts -->
        ${[-3.6, 0, 3.6].map((pz, idx) => html`
          <group key=${idx}>
            <mesh position=${[-3.15, 0.5, pz]}>
              <boxGeometry args=${[0.48, 3.2, 0.48]} />
              <meshStandardMaterial color="#4e342e" />
            </mesh>
            <mesh position=${[3.15, 0.5, pz]}>
              <boxGeometry args=${[0.48, 3.2, 0.48]} />
              <meshStandardMaterial color="#4e342e" />
            </mesh>
          </group>
        `)}

        <!-- Twin Glowing Thai Pier Lantern Posts at the Riverfront Tip -->
        ${[-3.15, 3.15].map((lx, idx) => html`
          <group key=${'post-' + idx} position=${[lx, 2.8, -4.2]}>
            <mesh position=${[0, 0, 0]}>
              <boxGeometry args=${[0.35, 3.4, 0.35]} />
              <meshStandardMaterial color="#5d4037" />
            </mesh>
            <mesh position=${[0, 1.75, 0]}>
              <boxGeometry args=${[0.75, 0.9, 0.75]} />
              <meshBasicMaterial color="#fff59d" />
            </mesh>
          </group>
        `)}
        <pointLight position=${[0, 4.6, -4.2]} color="#ffcc80" intensity=${7} distance=${24} />
      </group>

      <!-- 3D River Surface Plane (Extra-Wide Massive Vice Beach Bay 220x125 + Aim & Charge-Throw) -->
      <mesh
        ref=${waterRef}
        position=${[0, -0.05, -3]}
        rotation=${[-Math.PI / 2, 0, 0]}
        onPointerMove=${(e) => {
          if (window.loyState && window.loyState.throwMode && window.loyState.throwMode.active) {
            e.stopPropagation();
            window.loyState.throwMode.aimX3D = Math.max(-64, Math.min(64, e.point.x));
            window.loyState.throwMode.aimZ3D = Math.max(-38, Math.min(26, e.point.z));
          }
        }}
        onPointerDown=${(e) => {
          if ((e.button === 0 || e.pointerType === 'touch') && window.loyState && window.loyState.throwMode && window.loyState.throwMode.active) {
            e.stopPropagation();
            window.loyState.throwMode.aimX3D = Math.max(-64, Math.min(64, e.point.x));
            window.loyState.throwMode.aimZ3D = Math.max(-38, Math.min(26, e.point.z));
            window.loyState.throwMode.charging = true;
            window.loyState.throwMode.power = 0.15;
            window.loyState.throwMode.powerDir = 1;
            if (window.retroAudio) window.retroAudio.playClickSfx();
          }
        }}
        onPointerUp=${(e) => {
          if (window.loyState && window.loyState.throwMode && window.loyState.throwMode.active && window.loyState.throwMode.charging) {
            e.stopPropagation();
            const finalPower = window.loyState.throwMode.power;
            window.loyState.throwMode.charging = false;
            if (window.execute3DThrow) {
              window.execute3DThrow(finalPower);
            }
          }
        }}
        onClick=${(e) => {
          e.stopPropagation();
          if (window.loyState && window.loyState.throwMode && window.loyState.throwMode.active) {
            return;
          }
          if (onWaterClick) onWaterClick(e.point);
        }}
      >
        <planeGeometry args=${[220, 125, 12, 12]} />
        <meshStandardMaterial
          color="#135685"
          emissive="#2d1259"
          emissiveIntensity=${0.48}
          metalness=${0.55}
          roughness=${0.2}
        />
      </mesh>
    </group>
  `;
}

// ============================================================================
// 4. 3D VOXEL FIREWORKS RENDERER (Synced with state.fireworks)
// ============================================================================
function VoxelFireworks() {
  const [, setTick] = useState(0);

  useFrame(() => {
    // Advance firework physics inside R3F loop so 3D fireworks move & explode with sound!
    const st = window.loyState;
    if (st && st.fireworks && st.fireworks.length > 0) {
      for (let i = st.fireworks.length - 1; i >= 0; i--) {
        const fw = st.fireworks[i];
        if (fw.type === 'rocket') {
          fw.y += fw.vy;
          if (fw.y <= fw.ty) {
            if (window.explodeFirework) {
              window.explodeFirework(fw.x, fw.y, fw.palette);
            }
            st.fireworks.splice(i, 1);
          }
        } else {
          fw.x += fw.vx;
          fw.y += fw.vy;
          fw.vy += 0.04;
          fw.life -= fw.decay;
          if (fw.life <= 0) {
            st.fireworks.splice(i, 1);
          }
        }
      }
      setTick((t) => (t + 1) % 100000);
    }
  });

  const fireworks = (window.loyState && window.loyState.fireworks) || [];

  return html`
    <group>
      ${fireworks.map((fw, idx) => {
        const x3d = mapXTo3D(fw.x);
        const h = Math.max(400, window.innerHeight * 0.48);
        const y3d = Math.max(2, (1 - fw.y / h) * 20 + 2);
        return html`
          <mesh key=${idx} position=${[x3d, y3d, -14]}>
            <boxGeometry args=${[0.45, 0.45, 0.45]} />
            <meshBasicMaterial
              color=${fw.color || '#ffe57f'}
              transparent=${true}
              opacity=${fw.life ?? 1}
            />
          </mesh>
        `;
      })}
    </group>
  `;
}

// ============================================================================
// 5. FREE-ROAM 360° + KRATHONG LOCK-ON CAMERA CONTROLLER
// ============================================================================
function CameraRig() {
  const controlsRef = useRef();
  const { camera } = useThree();
  const keysPressed = useRef(new Set());
  const zoomingToLockRef = useRef(false);
  const lastLockedPosRef = useRef(null);

  useEffect(() => {
    const handleReset = () => {
      zoomingToLockRef.current = false;
      lastLockedPosRef.current = null;
      camera.position.set(0, 9.5, 21);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 1, -2);
        controlsRef.current.update();
      }
    };

    const handleLockKrathong = () => {
      zoomingToLockRef.current = true;
      lastLockedPosRef.current = null;
    };

    const handleKeyDown = (e) => {
      // Ignore keyboard movement when typing in inputs or textareas
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Escape' && window.closeInspectModal) {
        window.closeInspectModal();
        return;
      }

      keysPressed.current.add(e.code);
      // Cancel camera lock as soon as user starts flying freely with keyboard
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        zoomingToLockRef.current = false;
        lastLockedPosRef.current = null;
        if (window.loyState && window.loyState.followedKrathongId) {
          if (window.closeInspectModal) window.closeInspectModal();
          else window.loyState.followedKrathongId = null;
        }
      }
    };

    const handleKeyUp = (e) => {
      keysPressed.current.delete(e.code);
    };

    window.addEventListener('r3f-reset-camera', handleReset);
    window.addEventListener('r3f-lock-krathong', handleLockKrathong);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('r3f-reset-camera', handleReset);
      window.removeEventListener('r3f-lock-krathong', handleLockKrathong);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [camera]);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    // 1. Free-fly WASD / Arrow keys / Q-E (Up-Down) movement relative to camera facing direction
    const keys = keysPressed.current;
    if (keys.size > 0) {
      const moveSpeed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 24 : 13) * Math.min(delta, 0.05);
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() > 0.0001) forward.normalize();

      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const moveDelta = new THREE.Vector3();

      if (keys.has('KeyW') || keys.has('ArrowUp')) moveDelta.add(forward);
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveDelta.sub(forward);
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveDelta.add(right);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveDelta.sub(right);
      if (keys.has('KeyE') || keys.has('Space')) moveDelta.y += 1;
      if (keys.has('KeyQ')) moveDelta.y -= 1;

      if (moveDelta.lengthSq() > 0) {
        moveDelta.normalize().multiplyScalar(moveSpeed);
        camera.position.add(moveDelta);
        controlsRef.current.target.add(moveDelta);

        // Keep camera safely above water surface
        if (camera.position.y < 1.2) {
          const diff = 1.2 - camera.position.y;
          camera.position.y = 1.2;
          controlsRef.current.target.y += diff;
        }
        controlsRef.current.update();
      }
    }

    // 2. Smooth Close-Up Lock-On & Continuous Drift Tracking for Selected Krathong
    if (window.loyState) {
      const followedId = window.loyState.followedKrathongId;
      if (followedId && window.loyState.krathongMap.has(followedId)) {
        const k = window.loyState.krathongMap.get(followedId);
        const pos = getKrathongWorldPos(k);
        const targetX = pos.x3d;
        const targetZ = pos.z3d;
        const desiredTarget = new THREE.Vector3(targetX, 0.9, targetZ);

        if (zoomingToLockRef.current) {
          const isMobile = window.innerWidth <= 768;
          const desiredCamPos = new THREE.Vector3(
            targetX + (isMobile ? 0.6 : 1.6),
            isMobile ? 4.4 : 3.8,
            targetZ + (isMobile ? 8.2 : 6.8)
          );
          controlsRef.current.target.lerp(desiredTarget, 0.12);
          camera.position.lerp(desiredCamPos, 0.09);

          if (camera.position.distanceTo(desiredCamPos) < 0.35) {
            zoomingToLockRef.current = false;
            lastLockedPosRef.current = { id: followedId, x: targetX, z: targetZ };
          }
        } else {
          if (lastLockedPosRef.current && lastLockedPosRef.current.id === followedId) {
            const dx = targetX - lastLockedPosRef.current.x;
            const dz = targetZ - lastLockedPosRef.current.z;
            // Move camera along with the drifting krathong (and handle wrap-around smoothly)
            camera.position.x += dx;
            camera.position.z += dz;
          }
          controlsRef.current.target.lerp(desiredTarget, 0.2);
          lastLockedPosRef.current = { id: followedId, x: targetX, z: targetZ };
        }
        controlsRef.current.update();
      } else {
        lastLockedPosRef.current = null;
        zoomingToLockRef.current = false;
      }
    }
  });

  const [throwActive, setThrowActive] = useState(false);

  useFrame(() => {
    const active = Boolean(window.loyState && window.loyState.throwMode && window.loyState.throwMode.active);
    if (active !== throwActive) {
      setThrowActive(active);
    }
  });

  return html`
    <${OrbitControls}
      ref=${controlsRef}
      target=${[0, 1, -2]}
      enabled=${!throwActive}
      enableDamping=${true}
      dampingFactor=${0.07}
      enablePan=${true}
      screenSpacePanning=${true}
      panSpeed=${1.25}
      rotateSpeed=${0.9}
      zoomSpeed=${1.15}
      maxPolarAngle=${Math.PI - 0.15}
      minPolarAngle=${0.05}
      minDistance=${2.5}
      maxDistance=${135}
      onStart=${() => {
        // Stop initial auto-zoom so user can freely orbit 360° around the locked krathong
        zoomingToLockRef.current = false;
      }}
    />
  `;
}

// ============================================================================
// 6. MAIN R3F WORLD SCENE (Zero-Lag Versioned Sync + Optimized DPR)
// ============================================================================
function LoyKrathongR3FApp() {
  const [krathongs, setKrathongs] = useState([]);
  const [followedId, setFollowedId] = useState(null);
  const lastVersionRef = useRef(-1);
  const lastFollowedRef = useRef(null);

  // Only trigger React re-render when a krathong is actually added/updated or camera lock changes!
  useEffect(() => {
    const timer = setInterval(() => {
      if (!window.loyState) return;
      const ver = window.loyState.krathongsVersion ?? window.loyState.krathongs.length;
      if (ver !== lastVersionRef.current) {
        lastVersionRef.current = ver;
        setKrathongs([...window.loyState.krathongs]);
      }
      if (window.loyState.followedKrathongId !== lastFollowedRef.current) {
        lastFollowedRef.current = window.loyState.followedKrathongId;
        setFollowedId(window.loyState.followedKrathongId);
      }
    }, 180);
    return () => clearInterval(timer);
  }, []);

  const handleSelectKrathong = useCallback((entity) => {
    if (window.openInspectModal) {
      window.openInspectModal(entity);
    }
  }, []);

  const [isPortrait, setIsPortrait] = useState(() => window.innerHeight > window.innerWidth);

  useEffect(() => {
    const onResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return html`
    <${Canvas}
      dpr=${[1, 1.5]}
      camera=${{
        position: isPortrait ? [0, 18.5, 46] : [0, 14.5, 38],
        fov: isPortrait ? 60 : 50
      }}
      gl=${{ antialias: false, toneMappingExposure: 1.45, powerPreference: 'high-performance' }}
    >
      <color attach="background" args=${['#280e4a']} />
      <fog attach="fog" args=${['#3d1466', 72, 185]} />

      <${Stars} radius=${105} depth=${40} count=${900} factor=${4.5} saturation=${0.85} fade speed=${1.0} />

      <${CameraRig} />
      <${VoxelEnvironment} />
      <${VoxelSkyLanterns} />
      <${VoxelFireworks} />

      ${krathongs.map((k) => html`
        <${VoxelKrathong}
          key=${k.id}
          entity=${k}
          isFollowed=${followedId === k.id}
          onSelect=${handleSelectKrathong}
        />
      `)}
    </${Canvas}>
  `;
}

// Mount React Three Fiber Canvas
const r3fContainer = document.getElementById('r3fRoot');
if (r3fContainer) {
  const root = createRoot(r3fContainer);
  root.render(html`<${LoyKrathongR3FApp} />`);
}
