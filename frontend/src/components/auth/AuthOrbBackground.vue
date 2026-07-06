<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

interface Orb {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radiusBase: number;
  currentRadius: number;
  color: [number, number, number];
  phase: number;
  speed: number;
  amplitudeX: number;
  amplitudeY: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const seededRandom = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const parseColor = (value: string): [number, number, number] => {
  const color = value.trim();
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (hex) {
    const raw = hex[1].length === 3
      ? hex[1].split("").map((char) => char + char).join("")
      : hex[1];

    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  }

  const rgb = color.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1]
      .replace(/\s*\/.*$/, "")
      .split(/[,\s]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => clamp(Number.parseFloat(part), 0, 255));
    return [parts[0], parts[1], parts[2]];
  }

  return [233, 106, 95];
};

const rgba = ([r, g, b]: [number, number, number], alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

const canvas = ref<HTMLCanvasElement | null>(null);

let width = 1;
let height = 1;
let pixelRatio = 1;
let context: CanvasRenderingContext2D | null = null;
let orbs: Orb[] = [];
let frameId = 0;
let resizeObserver: ResizeObserver | null = null;
const mouse = { active: false, x: 0, y: 0 };
const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const getPaletteColor = (): [number, number, number] => {
  if (!canvas.value) return [233, 106, 95];
  const styles = getComputedStyle(canvas.value);
  return parseColor(styles.getPropertyValue("--color-primary") || "#e96a5f");
};

const createOrbs = () => {
  const orbCount = width < 760 ? 14 : 22;
  const color = getPaletteColor();

  orbs = Array.from({ length: orbCount }, (_, index) => {
    const xSeed = seededRandom(index + 1);
    const ySeed = seededRandom(index + 18);
    const baseX = (xSeed * 1.18 - 0.09) * width;
    const baseY = (0.1 + ySeed * 0.86) * height;
    const radiusBase = width < 760
      ? clamp(70 + seededRandom(index + 34) * 110, 60, 160)
      : clamp(130 + seededRandom(index + 34) * 220, 110, 340);

    return {
      baseX,
      baseY,
      x: baseX,
      y: baseY,
      vx: 0,
      vy: 0,
      radiusBase,
      currentRadius: radiusBase,
      color,
      phase: seededRandom(index + 51) * Math.PI * 2,
      speed: 0.00038 + seededRandom(index + 68) * 0.0009,
      amplitudeX: 72 + seededRandom(index + 85) * 130,
      amplitudeY: 70 + seededRandom(index + 102) * 125,
    };
  });
};

const updateOrb = (orb: Orb, time: number) => {
  const idleX = orb.baseX + Math.sin(time * orb.speed + orb.phase) * orb.amplitudeX;
  const idleY = orb.baseY + Math.cos(time * orb.speed * 0.8 + orb.phase) * orb.amplitudeY;
  const targetX = idleX;
  const targetY = idleY;

  if (mouse.active) {
    const dx = orb.x - mouse.x;
    const dy = orb.y - mouse.y;
    const distance = Math.hypot(dx, dy) || 1;
    const influenceRadius = 340;

    if (distance < influenceRadius) {
      const force = (influenceRadius - distance) / influenceRadius;
      const angle = Math.atan2(dy, dx);
      orb.vx += Math.cos(angle) * force * 2.6;
      orb.vy += Math.sin(angle) * force * 2.6;
      orb.currentRadius += (orb.radiusBase * 0.72 - orb.currentRadius) * 0.1;
    } else {
      orb.currentRadius += (orb.radiusBase - orb.currentRadius) * 0.05;
    }
  } else {
    orb.currentRadius += (orb.radiusBase - orb.currentRadius) * 0.05;
  }

  const tension = 0.014;
  const friction = 0.9;
  orb.vx = (orb.vx + (targetX - orb.x) * tension) * friction;
  orb.vy = (orb.vy + (targetY - orb.y) * tension) * friction;
  orb.x += orb.vx;
  orb.y += orb.vy;
};

const drawOrb = (orb: Orb) => {
  if (!context) return;

  const gradient = context.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.currentRadius);
  gradient.addColorStop(0, rgba(orb.color, 0.58));
  gradient.addColorStop(0.35, rgba(orb.color, 0.34));
  gradient.addColorStop(0.72, rgba(orb.color, 0.13));
  gradient.addColorStop(1, rgba(orb.color, 0));

  context.fillStyle = gradient;
  context.beginPath();
  context.arc(orb.x, orb.y, orb.currentRadius, 0, Math.PI * 2);
  context.fill();
};

const draw = (time = 0) => {
  if (!context) return;

  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = "multiply";

  orbs.forEach((orb) => {
    if (!prefersReducedMotion) updateOrb(orb, time);
    drawOrb(orb);
  });

  context.globalCompositeOperation = "source-over";

  if (!prefersReducedMotion) {
    frameId = window.requestAnimationFrame(draw);
  }
};

const resizeCanvas = () => {
  const el = canvas.value;
  if (!el) return;

  const bounds = el.getBoundingClientRect();
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);

  el.width = Math.round(width * pixelRatio);
  el.height = Math.round(height * pixelRatio);

  context = el.getContext("2d", { alpha: true });
  if (!context) return;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  createOrbs();
  draw(performance.now());
};

const handlePointerMove = (event: PointerEvent) => {
  const el = canvas.value;
  if (!el) return;

  const bounds = el.getBoundingClientRect();
  mouse.active =
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom;
  mouse.x = event.clientX - bounds.left;
  mouse.y = event.clientY - bounds.top;
};

const handlePointerLeave = () => {
  mouse.active = false;
};

onMounted(() => {
  resizeCanvas();

  if (canvas.value && "ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas.value);
  }

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerleave", handlePointerLeave, { passive: true });

  if (!prefersReducedMotion) {
    frameId = window.requestAnimationFrame(draw);
  }
});

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerleave", handlePointerLeave);
});
</script>

<template>
  <canvas ref="canvas" class="auth-orb-background" aria-hidden="true"></canvas>
</template>

<style scoped>
.auth-orb-background {
  position: absolute;
  inset: -16% -8%;
  z-index: 0;
  width: 116%;
  height: 132%;
  filter: blur(52px) saturate(1.08);
  pointer-events: none;
  transform: translateZ(0);
}
</style>
