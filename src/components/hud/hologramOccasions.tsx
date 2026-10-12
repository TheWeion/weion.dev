import { useFrame } from '@react-three/fiber';
import { type ReactNode, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type Group,
  type InstancedMesh,
  Object3D,
  type ShaderMaterial,
} from 'three';
import type { Occasion } from '@/lib/occasions';
import { colors } from '@/lib/tokens';

// Occasion-only colours. Deliberately not design tokens: they appear nowhere
// else in the HUD and have no Tailwind mirror.
const pumpkin = '#FF7A1A';
const hex = '#9D4EDD';
const ectoplasm = '#7CFF4F';
const holly = '#2EE87A';
const berry = '#FF2E3B';
const blossom = '#FF7FBF';
const primrose = '#FFD84A';
const mint = '#5CF0B4';
const lilac = '#9D7BFF';

// Prop palettes live at module scope: HoloSurface memoizes its uniforms on
// the palette's identity, and an inline array would restart the fade-in on
// every re-render.
type Palette = [string, string, string];
const PARTY_HAT: Palette = [colors.magenta, colors.amberHot, colors.cyan];
const WITCH_HAT: Palette = [hex, pumpkin, hex];
const WITCH_BRIM: Palette = [hex, hex, hex];
const SANTA_HAT: Palette = [berry, berry, berry];
const EGG: Palette = [blossom, primrose, lilac];

/** Particle field drifting through the portrait frame for an occasion. */
interface ParticleConfig {
  colors: string[];
  count: number;
  shape: 'rect' | 'dot';
  /** Rect: `[width, height]`; dot: `[radius]`. */
  size: [number, number?];
  speed: [min: number, max: number];
  /** `1` falls, `-1` rises. */
  direction: 1 | -1;
  sway: number;
  spin: number;
}

/**
 * Visual theme for one {@link Occasion}.
 */
export interface OccasionTheme {
  /** Three colours the portrait tint cycles through. */
  palette: Palette;
  /** Corner brackets and the label strip's left text. */
  accent: string;
  /** Background glow behind the canvas (CSS colour). */
  glow: string;
  label: string;
  tag: string;
  tagColor: string;
  particles: ParticleConfig;
}

/**
 * Theme per {@link Occasion} for {@link HologramPortrait}.
 */
export const OCCASION_THEMES: Record<Occasion, OccasionTheme> = {
  birthday: {
    palette: [colors.amberHot, colors.magenta, colors.cyan],
    accent: colors.magenta,
    glow: 'rgba(255,0,85,0.1)',
    label: 'SIG // HAPPY BIRTHDAY',
    tag: 'REL-0.01',
    tagColor: colors.amberHot,
    particles: {
      colors: [colors.amberHot, colors.magenta, colors.cyan, colors.ok, colors.bright],
      count: 90,
      shape: 'rect',
      size: [0.045, 0.075],
      speed: [0.25, 0.55],
      direction: 1,
      sway: 0.06,
      spin: 4,
    },
  },
  halloween: {
    palette: [pumpkin, hex, ectoplasm],
    accent: pumpkin,
    glow: 'rgba(157,78,221,0.12)',
    label: 'SIG // HAUNTED SIGNAL',
    tag: 'BOO-10.31',
    tagColor: ectoplasm,
    particles: {
      colors: [pumpkin, pumpkin, hex, ectoplasm],
      count: 60,
      shape: 'rect',
      size: [0.028, 0.028],
      speed: [0.1, 0.25],
      direction: -1,
      sway: 0.1,
      spin: 1.5,
    },
  },
  christmas: {
    palette: [berry, holly, colors.bright],
    accent: berry,
    glow: 'rgba(46,232,122,0.08)',
    label: "SIG // SEASON'S GREETINGS",
    tag: 'XMAS-12.25',
    tagColor: holly,
    particles: {
      colors: [colors.bright, colors.bright, colors.halo],
      count: 110,
      shape: 'dot',
      size: [0.016],
      speed: [0.1, 0.22],
      direction: 1,
      sway: 0.12,
      spin: 0,
    },
  },
  easter: {
    palette: [blossom, primrose, mint],
    accent: blossom,
    glow: 'rgba(201,184,255,0.12)',
    label: 'SIG // EASTER EGG FOUND',
    tag: 'EGG-01',
    tagColor: primrose,
    particles: {
      colors: [blossom, primrose, mint, lilac],
      count: 60,
      shape: 'rect',
      size: [0.04, 0.06],
      speed: [0.12, 0.28],
      direction: 1,
      sway: 0.1,
      spin: 2,
    },
  },
};

const surfaceVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const surfaceFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform float uPattern;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  vec3 pick(float band) {
    return band < 1.0 ? uColorA : band < 2.0 ? uColorB : uColorC;
  }

  void main() {
    vec3 col;
    if (uPattern < 0.5) {
      // Spiral candy-stripes that slowly wind up the surface.
      col = pick(floor(fract(vUv.y * 3.0 + vUv.x * 2.0 - uTime * 0.2) * 3.0));
    } else if (uPattern < 1.5) {
      // Solid A with a B band just above the base (hat bands).
      col = vUv.y < 0.14 && vUv.y > 0.04 ? uColorB : uColorA;
    } else {
      // Painted-egg zigzag bands.
      float zig = abs(fract(vUv.x * 10.0) - 0.5) * 0.08;
      col = pick(mod(floor((vUv.y + zig) * 7.0), 3.0));
    }

    vec3 normal = normalize(vWorldNormal);
    if (!gl_FrontFacing) normal = -normal;
    float fresnel = pow(1.0 - max(dot(normal, vViewDir), 0.0), 1.4);

    // Same scrolling scanlines as the portrait so props read as part of the
    // projection rather than solid objects.
    float stripes = fract(vUv.y * 60.0 - uTime * 0.35);
    stripes = 0.7 + 0.3 * pow(stripes, 2.5);

    vec3 base = (col * 0.6 + col * fresnel * 1.2) * stripes;
    gl_FragColor = vec4(base, (0.55 + fresnel * 0.4) * uReveal);
  }
`;

const PATTERNS = { spiral: 0, band: 1, egg: 2 } as const;

interface HoloSurfaceProps {
  pattern: keyof typeof PATTERNS;
  palette: Palette;
  reducedMotion: boolean;
}

/** Holographic shader material shared by every occasion prop. Fades in on mount. */
function HoloSurface({ pattern, palette, reducedMotion }: HoloSurfaceProps) {
  // Driven through the ref: R3F does not keep the identity of the `uniforms`
  // object passed as a prop, so mutating the memoized copy has no effect.
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: reducedMotion ? 1 : 0 },
      uPattern: { value: PATTERNS[pattern] },
      uColorA: { value: new Color(palette[0]) },
      uColorB: { value: new Color(palette[1]) },
      uColorC: { value: new Color(palette[2]) },
    }),
    [pattern, palette, reducedMotion],
  );

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += delta;
    const reveal = mat.uniforms.uReveal;
    reveal.value += (1 - reveal.value) * Math.min(1, delta * 2.5);
  });

  return (
    <shaderMaterial
      ref={matRef}
      vertexShader={surfaceVertexShader}
      fragmentShader={surfaceFragmentShader}
      uniforms={uniforms}
      transparent
      depthWrite={false}
      side={DoubleSide}
      blending={AdditiveBlending}
    />
  );
}

/**
 * Where headwear sits on the portrait texture, in UV space from the
 * top-left: the hair tuft between the ears of `/hero-hologram.webp`. Update
 * if the portrait image changes.
 */
const HAT_ANCHOR = { u: 0.5, v: 0.375 };

/** Centre of the head in UV space, for the Easter egg's orbit. */
const HEAD_CENTER = { u: 0.5, v: 0.55 };

/** Group that grows up out of the head on mount, at a UV-space anchor. */
function Materialize({
  width,
  height,
  anchor,
  tilt,
  z,
  children,
}: {
  width: number;
  height: number;
  anchor: { u: number; v: number };
  tilt: number;
  z: number;
  children: ReactNode;
}) {
  const groupRef = useRef<Group>(null);
  const grow = useRef(0);
  useFrame((_, delta) => {
    grow.current += (1 - grow.current) * Math.min(1, delta * 2.5);
    groupRef.current?.scale.set(1, grow.current, 1);
  });
  return (
    <group
      ref={groupRef}
      position={[(anchor.u - 0.5) * width, (0.5 - anchor.v) * height, z]}
      rotation={[0, 0, tilt]}
    >
      {children}
    </group>
  );
}

function PartyHat({ reducedMotion }: { reducedMotion: boolean }) {
  const h = 0.58;
  return (
    <>
      <mesh position={[0, h / 2, 0]}>
        <coneGeometry args={[0.22, h, 48, 1, true]} />
        <HoloSurface pattern="spiral" palette={PARTY_HAT} reducedMotion={reducedMotion} />
      </mesh>
      <mesh position={[0, h + 0.03, 0]}>
        <sphereGeometry args={[0.055, 16, 12]} />
        <meshBasicMaterial color={colors.amberHot} toneMapped={false} />
      </mesh>
    </>
  );
}

function WitchHat({ reducedMotion }: { reducedMotion: boolean }) {
  const h = 0.7;
  return (
    <>
      <mesh position={[0, h / 2, 0]}>
        <coneGeometry args={[0.23, h, 48, 1, true]} />
        <HoloSurface pattern="band" palette={WITCH_HAT} reducedMotion={reducedMotion} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2 + 0.25, 0, 0]}>
        <ringGeometry args={[0.2, 0.44, 48]} />
        <HoloSurface pattern="band" palette={WITCH_BRIM} reducedMotion={reducedMotion} />
      </mesh>
    </>
  );
}

function SantaHat({ reducedMotion }: { reducedMotion: boolean }) {
  const h = 0.55;
  return (
    <>
      <mesh position={[0, h / 2, 0]}>
        <coneGeometry args={[0.22, h, 48, 1, true]} />
        <HoloSurface pattern="band" palette={SANTA_HAT} reducedMotion={reducedMotion} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.055, 12, 48]} />
        <meshBasicMaterial color={colors.bright} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[0, h + 0.03, 0]}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshBasicMaterial color={colors.bright} toneMapped={false} />
      </mesh>
    </>
  );
}

/** Painted egg orbiting the head. Static beside the face under reduced motion. */
function OrbitingEgg({
  width,
  height,
  reducedMotion,
}: {
  width: number;
  height: number;
  reducedMotion: boolean;
}) {
  const orbitRef = useRef<Group>(null);
  const eggRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    if (orbitRef.current) orbitRef.current.rotation.y = t * 0.6;
    if (eggRef.current) {
      eggRef.current.rotation.y = t * 1.5;
      eggRef.current.position.y = Math.sin(t * 1.2) * 0.08;
    }
  });
  return (
    <group
      ref={orbitRef}
      position={[(HEAD_CENTER.u - 0.5) * width, (0.5 - HEAD_CENTER.v) * height, 0.05]}
      rotation={[0.2, reducedMotion ? 0.6 : 0, 0]}
    >
      <group ref={eggRef} position={[0.9, 0, 0]} rotation={[0, 0, 0.25]}>
        <mesh scale={[1, 1.3, 1]}>
          <sphereGeometry args={[0.13, 32, 24]} />
          <HoloSurface pattern="egg" palette={EGG} reducedMotion={reducedMotion} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The occasion's prop, parented to the portrait mesh so it inherits the
 * pendulum sway and float — party hat, witch hat, Santa hat, or an orbiting
 * Easter egg.
 *
 * @remarks
 * Must render as a child of the portrait `<mesh>`; `width` / `height` are the
 * portrait plane's dimensions so the UV anchors map onto it.
 */
export function OccasionProp({
  occasion,
  width,
  height,
  reducedMotion,
}: {
  occasion: Occasion;
  width: number;
  height: number;
  reducedMotion: boolean;
}) {
  if (occasion === 'easter') {
    return <OrbitingEgg width={width} height={height} reducedMotion={reducedMotion} />;
  }
  const hats = {
    birthday: { Hat: PartyHat, tilt: -0.12 },
    halloween: { Hat: WitchHat, tilt: -0.22 },
    christmas: { Hat: SantaHat, tilt: -0.3 },
  } as const;
  const { Hat, tilt } = hats[occasion];
  return (
    <Materialize width={width} height={height} anchor={HAT_ANCHOR} tilt={tilt} z={0.08}>
      <Hat reducedMotion={reducedMotion} />
    </Materialize>
  );
}

const FIELD_TOP = 1.5;
const FIELD_BOTTOM = -1.5;

/**
 * Particles drifting through the portrait frame — confetti, embers, snow,
 * or petals per {@link OCCASION_THEMES}. Frozen in place under reduced
 * motion.
 */
export function OccasionParticles({
  occasion,
  reducedMotion,
}: {
  occasion: Occasion;
  reducedMotion: boolean;
}) {
  const config = OCCASION_THEMES[occasion].particles;
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const flakes = useMemo(
    () =>
      Array.from({ length: config.count }, (_, i) => ({
        x: (Math.random() * 2 - 1) * 1.3,
        y: FIELD_BOTTOM + Math.random() * (FIELD_TOP - FIELD_BOTTOM),
        z: Math.random() * 1.3 - 0.5,
        speed: config.speed[0] + Math.random() * (config.speed[1] - config.speed[0]),
        sway: Math.random() * Math.PI * 2,
        spin: (Math.random() * 2 - 1) * config.spin,
        rx: config.spin ? Math.random() * Math.PI : 0,
        ry: config.spin ? Math.random() * Math.PI : 0,
        color: new Color(config.colors[i % config.colors.length]),
      })),
    [config],
  );

  const place = (mesh: InstancedMesh, t: number) => {
    flakes.forEach((f, i) => {
      dummy.position.set(f.x + Math.sin(t * 1.3 + f.sway) * config.sway, f.y, f.z);
      dummy.rotation.set(f.rx + t * f.spin, f.ry + t * f.spin * 0.7, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    flakes.forEach((f, i) => {
      mesh.setColorAt(i, f.color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    place(mesh, 0);
  });

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh || reducedMotion) return;
    const span = FIELD_TOP - FIELD_BOTTOM;
    for (const f of flakes) {
      f.y -= f.speed * delta * config.direction;
      if (f.y < FIELD_BOTTOM) f.y += span;
      if (f.y > FIELD_TOP) f.y -= span;
    }
    place(mesh, clock.elapsedTime);
  });

  return (
    // Keyed by occasion so the instance count is fixed for the mesh's life.
    <instancedMesh key={occasion} ref={meshRef} args={[undefined, undefined, config.count]}>
      {config.shape === 'dot' ? (
        <circleGeometry args={[config.size[0], 10]} />
      ) : (
        <planeGeometry args={[config.size[0], config.size[1]]} />
      )}
      <meshBasicMaterial side={DoubleSide} transparent opacity={0.9} toneMapped={false} />
    </instancedMesh>
  );
}
