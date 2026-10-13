import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  type BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  type Group,
  type Mesh,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { Occasion } from '@/lib/occasions';
import { colors } from '@/lib/tokens';
import { HolographicMaterial } from './HolographicMaterial';

// Occasion-only colours, matching the portrait themes in
// `components/hud/hologramOccasions.tsx`. Deliberately not design tokens.
const pumpkin = '#FF7A1A';
const ectoplasm = '#7CFF4F';
const candle = '#FFD84A';
const blossom = '#FF7FBF';
const primrose = '#FFD84A';
const mint = '#5CF0B4';
const coal = '#07090D';
const sponge = '#C46A2B';
const chocolate = '#2A160C';
const cherry = '#FF2E3B';

/** Same tuning as the default orb core so occasion cores read as the same projection. */
const CORE_HOLOGRAM = {
  fresnelAmount: 1.6,
  fresnelOpacity: 0.9,
  scanlineSize: 9,
  signalSpeed: 0.6,
  hologramBrightness: 1.1,
  hologramOpacity: 0.8,
  blinkFresnelOnly: true,
  side: DoubleSide,
} as const;

/**
 * Sways the core gently about the camera axis so a face stays roughly toward
 * the viewer, with a slight bob and breathing pulse.
 */
function useFaceForward() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const core = ref.current;
    if (!core) return;
    const t = clock.getElapsedTime();
    core.rotation.y = Math.sin(t * 0.5) * 0.45;
    core.position.y = Math.sin(t * 1.1) * 0.04;
    core.scale.setScalar(1 + Math.sin(t * 1.8) * 0.015);
  });
  return ref;
}

/**
 * Bends a flat XY geometry onto a surface by replacing each vertex's Z with
 * `zAt(x, y)`.
 */
function wrapOnto(geometry: BufferGeometry, zAt: (x: number, y: number) => number) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, zAt(pos.getX(i), pos.getY(i)));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function polygon(points: [number, number][], scale: number) {
  return new Shape(points.map(([x, y]) => new Vector2(x * scale, y * scale)));
}

// --- Pumpkin ---------------------------------------------------------------

const PUMPKIN_RADIUS = 0.95;
const PUMPKIN_SQUASH = 0.82;
const PUMPKIN_RIBS = 10;
const PUMPKIN_GROOVE = 0.07;

/** Radial rib profile: 1 on a lobe crest, `1 - PUMPKIN_GROOVE` in a groove. */
function ribAt(azimuth: number) {
  return 1 - PUMPKIN_GROOVE * (1 - Math.abs(Math.sin((azimuth * PUMPKIN_RIBS) / 2)));
}

/** Ribbed, squashed sphere with dimpled poles. A lobe crest faces +Z. */
function createPumpkinGeometry() {
  const geometry = new SphereGeometry(PUMPKIN_RADIUS, 72, 40);
  const pos = geometry.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const rib = ribAt(Math.atan2(v.z, v.x));
    const rho = Math.hypot(v.x, v.z) / PUMPKIN_RADIUS;
    const dimple = 0.16 * Math.exp(-((rho / 0.3) ** 2)) * Math.sign(v.y);
    pos.setXYZ(i, v.x * rib, (v.y * PUMPKIN_SQUASH - dimple * PUMPKIN_RADIUS) * rib, v.z * rib);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Front Z of the pumpkin surface at `(x, y)`, lifted slightly so carvings sit proud. */
function pumpkinZ(x: number, y: number) {
  const ellipse = (r: number) => r * r * (1 - (y / (PUMPKIN_SQUASH * r)) ** 2) - x * x;
  const z0 = Math.sqrt(Math.max(0, ellipse(PUMPKIN_RADIUS)));
  const r = PUMPKIN_RADIUS * ribAt(Math.atan2(z0, x));
  return Math.sqrt(Math.max(0, ellipse(r))) + 0.025;
}

/** Jack-o'-lantern face outlines in unit-radius space. */
const LEFT_EYE: [number, number][] = [
  [-0.48, 0.1],
  [-0.16, 0.1],
  [-0.32, 0.36],
];
const NOSE: [number, number][] = [
  [-0.08, -0.04],
  [0.08, -0.04],
  [0, 0.1],
];
const MOUTH: [number, number][] = [
  [-0.56, -0.12],
  [-0.38, -0.22],
  [-0.3, -0.13],
  [-0.22, -0.25],
  [0.22, -0.25],
  [0.3, -0.13],
  [0.38, -0.22],
  [0.56, -0.12],
  [0.42, -0.36],
  [0.2, -0.46],
  [0.11, -0.36],
  [0.02, -0.47],
  [-0.2, -0.46],
  [-0.42, -0.36],
];

function createPumpkinFace() {
  const mirror = (pts: [number, number][]) =>
    pts.map(([x, y]) => [-x, y] as [number, number]).reverse();
  const shapes = [LEFT_EYE, mirror(LEFT_EYE), NOSE, MOUTH].map((p) => polygon(p, PUMPKIN_RADIUS));
  return wrapOnto(new ShapeGeometry(shapes), pumpkinZ);
}

function Pumpkin() {
  const ref = useFaceForward();
  const body = useMemo(createPumpkinGeometry, []);
  const face = useMemo(createPumpkinFace, []);
  const top = PUMPKIN_RADIUS * (PUMPKIN_SQUASH - 0.16);

  return (
    <group ref={ref}>
      <mesh geometry={body}>
        <HolographicMaterial color={pumpkin} {...CORE_HOLOGRAM} />
      </mesh>
      {/* Candle-lit carving */}
      <mesh geometry={face}>
        <meshBasicMaterial color={candle} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0.02, top + 0.12, 0]} rotation={[0.1, 0, -0.18]}>
        <cylinderGeometry args={[0.06, 0.1, 0.3, 10]} />
        <HolographicMaterial color={ectoplasm} {...CORE_HOLOGRAM} />
      </mesh>
    </group>
  );
}

// --- Easter egg ------------------------------------------------------------

const EGG_RADIUS = 0.78;
const EGG_STRETCH = 1.3;
const EGG_TAPER = 0.14;

/** Point on the egg surface at unit height `yn` ∈ [-1, 1] and azimuth `theta`. */
function eggPoint(yn: number, theta: number, out = new Vector3()) {
  const ring = EGG_RADIUS * Math.sqrt(Math.max(0, 1 - yn * yn)) * (1 - EGG_TAPER * yn) * 1.012;
  return out.set(ring * Math.cos(theta), EGG_RADIUS * EGG_STRETCH * yn, ring * Math.sin(theta));
}

/** Sphere stretched along Y and tapered toward the top. */
function createEggGeometry() {
  const geometry = new SphereGeometry(EGG_RADIUS, 64, 48);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const yn = pos.getY(i) / EGG_RADIUS;
    const taper = 1 - EGG_TAPER * yn;
    pos.setXYZ(i, pos.getX(i) * taper, pos.getY(i) * EGG_STRETCH, pos.getZ(i) * taper);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Painted band hugging the egg: flat at `yn`, or zigzagging `±zig` around it. */
function createEggBand(yn: number, zig = 0, teeth = 14) {
  const segments = teeth * 2;
  const points = Array.from({ length: segments }, (_, i) =>
    eggPoint(yn + (i % 2 ? zig : -zig), (i / segments) * Math.PI * 2),
  );
  return new TubeGeometry(new CatmullRomCurve3(points, true), segments * 6, 0.024, 6, true);
}

const EGG_BANDS = [
  { yn: 0.45, zig: 0, color: mint },
  { yn: 0, zig: 0.1, color: primrose },
  { yn: -0.45, zig: 0, color: mint },
];

function EasterEgg() {
  const ref = useRef<Group>(null);
  const body = useMemo(createEggGeometry, []);
  const bands = useMemo(() => EGG_BANDS.map((b) => createEggBand(b.yn, b.zig)), []);

  useFrame(({ clock }) => {
    const egg = ref.current;
    if (!egg) return;
    const t = clock.getElapsedTime();
    egg.rotation.y = t * 0.4;
    egg.position.y = Math.sin(t * 1.1) * 0.05;
  });

  return (
    <group rotation={[0, 0, 0.18]}>
      <group ref={ref}>
        <mesh geometry={body}>
          <HolographicMaterial color={blossom} {...CORE_HOLOGRAM} />
        </mesh>
        {bands.map((geometry, i) => (
          <mesh key={EGG_BANDS[i].yn} geometry={geometry}>
            <meshBasicMaterial color={EGG_BANDS[i].color} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// --- Snowman head ----------------------------------------------------------

const SNOW_RADIUS = 0.95;

/** Point on the head's front surface at `(x, y)`, pushed out by `lift`. */
function snowPoint(x: number, y: number, lift = 0): [number, number, number] {
  const z = Math.sqrt(Math.max(0, SNOW_RADIUS ** 2 - x * x - y * y));
  const s = (SNOW_RADIUS + lift) / SNOW_RADIUS;
  return [x * s, y * s, z * s];
}

const SNOW_EYES = [snowPoint(-0.3, 0.26, 0.02), snowPoint(0.3, 0.26, 0.02)];
const SNOW_SMILE = Array.from({ length: 7 }, (_, i) => {
  const x = -0.42 + (i / 6) * 0.84;
  return snowPoint(x, -0.4 + 0.16 * (x / 0.42) ** 2, 0.01);
});

function SnowmanHead() {
  const ref = useFaceForward();
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[SNOW_RADIUS, 48, 32]} />
        <HolographicMaterial color={colors.bright} {...CORE_HOLOGRAM} />
      </mesh>
      {SNOW_EYES.map((p) => (
        <mesh key={p[0]} position={p}>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshBasicMaterial color={coal} />
        </mesh>
      ))}
      {SNOW_SMILE.map((p) => (
        <mesh key={p[0]} position={p}>
          <sphereGeometry args={[0.045, 12, 8]} />
          <meshBasicMaterial color={coal} />
        </mesh>
      ))}
      {/* Carrot nose — cone tip points +Z after the X rotation */}
      <mesh position={[0, 0.02, SNOW_RADIUS + 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.5, 16]} />
        <meshBasicMaterial color={pumpkin} toneMapped={false} />
      </mesh>
    </group>
  );
}

// --- Portal cake -----------------------------------------------------------

const CAKE_RADIUS = 0.78;
const CAKE_HEIGHT = 0.58;
const CAKE_BASE = -0.5;
const CAKE_TOP = CAKE_BASE + CAKE_HEIGHT;
const ROSETTES = 8;
const CANDLE_STRIPES = 7;
const CANDLE_STRIPE_HEIGHT = 0.065;

/** Centre heights of the candle's alternating stripes. */
const STRIPE_HEIGHTS = Array.from(
  { length: CANDLE_STRIPES },
  (_, i) => CAKE_TOP + (i + 0.5) * CANDLE_STRIPE_HEIGHT,
);

/** Rosette ring around the top edge, each crowned with a cherry. */
const ROSETTE_POINTS = Array.from({ length: ROSETTES }, (_, i) => {
  const a = (i / ROSETTES) * Math.PI * 2;
  return [Math.cos(a) * CAKE_RADIUS * 0.78, Math.sin(a) * CAKE_RADIUS * 0.78] as const;
});

/** Chocolate shavings scattered inside the rosette ring, from a fixed seed. */
const SHAVINGS = (() => {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 26 }, () => {
    const a = rand() * Math.PI * 2;
    const r = 0.12 + Math.sqrt(rand()) * CAKE_RADIUS * 0.5;
    return {
      position: [Math.cos(a) * r, CAKE_TOP + 0.015, Math.sin(a) * r] as const,
      rotation: [rand() * 0.6, rand() * Math.PI, rand() * 0.6] as const,
    };
  });
})();

/**
 * Black Forest cake from Portal: chocolate sponge on a plate, cream rosettes
 * with cherries, chocolate shavings, and a single striped candle.
 */
function PortalCake() {
  const ref = useFaceForward();
  const spinRef = useRef<Group>(null);
  const flameRef = useRef<Mesh>(null);
  const candleTop = CAKE_TOP + CANDLE_STRIPES * CANDLE_STRIPE_HEIGHT;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (spinRef.current) spinRef.current.rotation.y = t * 0.25;
    const flame = flameRef.current;
    if (flame) {
      const flicker = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
      flame.scale.set(1, 1.7 * flicker, 1);
      flame.rotation.z = Math.sin(t * 5.1) * 0.08;
    }
  });

  return (
    // Tilted toward the camera so the top of the cake reads, without wobbling
    // as the orb spins.
    <group ref={ref}>
      <group rotation={[0.38, 0, 0]}>
        <group ref={spinRef}>
          <mesh position={[0, CAKE_BASE + CAKE_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[CAKE_RADIUS, CAKE_RADIUS, CAKE_HEIGHT, 48]} />
            <HolographicMaterial color={sponge} {...CORE_HOLOGRAM} />
          </mesh>
          {/* Plate */}
          <mesh position={[0, CAKE_BASE - 0.03, 0]}>
            <cylinderGeometry args={[CAKE_RADIUS + 0.18, CAKE_RADIUS + 0.12, 0.05, 48]} />
            <HolographicMaterial color={colors.halo} {...CORE_HOLOGRAM} />
          </mesh>
          {ROSETTE_POINTS.map(([x, z]) => (
            <group key={`${x},${z}`} position={[x, CAKE_TOP, z]}>
              <mesh position={[0, 0.05, 0]} scale={[1, 0.75, 1]}>
                <sphereGeometry args={[0.1, 16, 10]} />
                <meshBasicMaterial color={colors.bright} transparent opacity={0.9} />
              </mesh>
              <mesh position={[0, 0.16, 0]}>
                <sphereGeometry args={[0.055, 14, 10]} />
                <meshBasicMaterial color={cherry} toneMapped={false} />
              </mesh>
            </group>
          ))}
          {SHAVINGS.map(({ position, rotation }) => (
            <mesh key={`${position[0]},${position[2]}`} position={position} rotation={rotation}>
              <boxGeometry args={[0.08, 0.012, 0.03]} />
              <meshBasicMaterial color={chocolate} />
            </mesh>
          ))}
          {STRIPE_HEIGHTS.map((y, i) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[0.04, 0.04, CANDLE_STRIPE_HEIGHT, 12]} />
              <meshBasicMaterial color={i % 2 ? cherry : colors.bright} toneMapped={false} />
            </mesh>
          ))}
          <mesh ref={flameRef} position={[0, candleTop + 0.08, 0]}>
            <sphereGeometry args={[0.04, 12, 10]} />
            <meshBasicMaterial color={colors.amberHot} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

const CORES = {
  birthday: PortalCake,
  halloween: Pumpkin,
  easter: EasterEgg,
  christmas: SnowmanHead,
} as const;

/** Occasions that swap {@link HoloOrb}'s core for a themed one. */
export type CoreOccasion = keyof typeof CORES;

/** Whether `occasion` has a themed {@link OccasionCore}. */
export function hasOccasionCore(occasion: Occasion | null): occasion is CoreOccasion {
  return occasion !== null && occasion in CORES;
}

/**
 * Occasion replacement for {@link HoloOrb}'s holographic core: the Portal
 * cake on the birthday, a jack-o'-lantern at Halloween, a painted egg at
 * Easter, a snowman's head at Christmas.
 *
 * @remarks
 * Every body uses the orb core's {@link HolographicMaterial} tuning so it
 * still reads as part of the projection; details (carving, bands, coal,
 * carrot, rosettes, candle) are plain unlit materials. Render outside the
 * orb's spinning group: the pumpkin and snowman only sway, keeping their
 * faces toward the camera, and the cake holds its camera-facing tilt while
 * turning slowly on its own axis. The egg spins.
 *
 * @example
 * ```tsx
 * {hasOccasionCore(occasion) ? <OccasionCore occasion={occasion} /> : <DefaultCore />}
 * ```
 */
export function OccasionCore({ occasion }: { occasion: CoreOccasion }) {
  const Core = CORES[occasion];
  return <Core />;
}
