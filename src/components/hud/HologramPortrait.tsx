import { useTexture } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type Group,
  type InstancedMesh,
  type Mesh,
  Object3D,
  type ShaderMaterial,
  type Texture,
} from 'three';
import { useBirthday } from '@/hooks/useBirthday';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { colors } from '@/lib/tokens';
import { CornerBrackets } from './CornerBrackets';

const vertexShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uDisplace;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying float vDisplacement;

  void main() {
    vUv = uv;
    vec4 tex = texture2D(uMap, uv);
    // Luminance * alpha drives the Z-extrusion.
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    float d = lum * tex.a;
    vDisplacement = d;

    vec3 displaced = position + normal * d * uDisplace;

    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform vec3 uTint;
  uniform float uScanlineSize;
  uniform float uSignalSpeed;
  uniform float uFresnelAmount;
  uniform float uParty;
  uniform vec3 uPartyA;
  uniform vec3 uPartyB;
  uniform vec3 uPartyC;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying float vDisplacement;

  // Cyclic amber -> magenta -> cyan gradient for the birthday tint.
  vec3 partyTint(float t) {
    t = fract(t) * 3.0;
    if (t < 1.0) return mix(uPartyA, uPartyB, t);
    if (t < 2.0) return mix(uPartyB, uPartyC, t - 1.0);
    return mix(uPartyC, uPartyA, t - 2.0);
  }

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.02) discard;

    vec3 tint = mix(uTint, partyTint(vUv.y * 0.8 + vUv.x * 0.3 - uTime * 0.15), uParty);

    vec3 normal = normalize(vWorldNormal);
    if (!gl_FrontFacing) normal = -normal;
    float facing = max(dot(normal, vViewDir), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelAmount);

    // Scrolling scanlines in UV space
    float stripes = fract(vUv.y * uScanlineSize - uTime * uSignalSpeed);
    stripes = 0.7 + 0.3 * pow(stripes, 2.5);

    // Depth-tinted colour: deeper pixels pick up more of the hologram tint.
    vec3 base = mix(tex.rgb, tex.rgb * tint, 0.55);
    base += tint * fresnel * 1.4;
    base *= stripes;

    float alpha = tex.a * (0.85 + fresnel * 0.4);
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(base, alpha);
  }
`;

interface HologramMeshProps {
  reducedMotion: boolean;
  birthday: boolean;
}

function HologramMesh({ reducedMotion, birthday }: HologramMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<ShaderMaterial>(null);
  const texture = useTexture('/hero-hologram.webp') as Texture;
  texture.anisotropy = 4;

  const { width, height } = useMemo(() => {
    const img = texture.image as { width?: number; height?: number } | undefined;
    const aspect = img?.width && img?.height ? img.width / img.height : 1;
    const h = 2.6;
    return { width: h * aspect, height: h };
  }, [texture]);

  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uDisplace: { value: 0.125 },
      uTime: { value: 0 },
      uTint: { value: new Color(colors.amber) },
      uScanlineSize: { value: 180 },
      uSignalSpeed: { value: 0.35 },
      uFresnelAmount: { value: 1.4 },
      uParty: { value: 0 },
      uPartyA: { value: new Color(colors.amberHot) },
      uPartyB: { value: new Color(colors.magenta) },
      uPartyC: { value: new Color(colors.cyan) },
    }),
    [texture],
  );

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (mat) {
      mat.uniforms.uTime.value += delta;
      // Ease the party tint in/out rather than snapping at midnight.
      const party = mat.uniforms.uParty;
      party.value += ((birthday ? 1 : 0) - party.value) * Math.min(1, delta * 2);
    }
    const mesh = meshRef.current;
    if (!mesh || reducedMotion || !mat) return;
    const t = mat.uniforms.uTime.value;
    // Slow pendulum on Y + gentle float so the displacement relief reads
    mesh.rotation.y = Math.sin(t * 0.45) * 0.35;
    mesh.rotation.x = Math.sin(t * 0.33) * 0.05;
    mesh.position.y = Math.sin(t * 0.7) * 0.06;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[width, height, 160, 160]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
      />
      {birthday && <PartyHat width={width} height={height} reducedMotion={reducedMotion} />}
    </mesh>
  );
}

const hatVertexShader = /* glsl */ `
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

const hatFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform vec3 uStripeA;
  uniform vec3 uStripeB;
  uniform vec3 uStripeC;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    // Spiral candy-stripes that slowly wind up the cone.
    float band = floor(fract(vUv.y * 3.0 + vUv.x * 2.0 - uTime * 0.2) * 3.0);
    vec3 col = band < 1.0 ? uStripeA : band < 2.0 ? uStripeB : uStripeC;

    vec3 normal = normalize(vWorldNormal);
    if (!gl_FrontFacing) normal = -normal;
    float fresnel = pow(1.0 - max(dot(normal, vViewDir), 0.0), 1.4);

    // Same scrolling scanlines as the portrait so the hat reads as part of
    // the projection rather than a solid prop.
    float stripes = fract(vUv.y * 60.0 - uTime * 0.35);
    stripes = 0.7 + 0.3 * pow(stripes, 2.5);

    vec3 base = (col * 0.6 + col * fresnel * 1.2) * stripes;
    gl_FragColor = vec4(base, (0.55 + fresnel * 0.4) * uReveal);
  }
`;

/**
 * Where the hat sits on the portrait texture, in UV space from the top-left:
 * the hair tuft between the ears of `/hero-hologram.webp`. Update if the
 * portrait image changes.
 */
const HAT_ANCHOR = { u: 0.5, v: 0.375 };
const HAT_HEIGHT = 0.58;
const HAT_RADIUS = 0.22;

interface PartyHatProps {
  width: number;
  height: number;
  reducedMotion: boolean;
}

/**
 * Holographic party hat, rendered as a child of the portrait mesh so it
 * inherits the pendulum sway and float and stays planted on the head.
 */
function PartyHat({ width, height, reducedMotion }: PartyHatProps) {
  const groupRef = useRef<Group>(null);
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: reducedMotion ? 1 : 0 },
      uStripeA: { value: new Color(colors.magenta) },
      uStripeB: { value: new Color(colors.amberHot) },
      uStripeC: { value: new Color(colors.cyan) },
    }),
    [reducedMotion],
  );

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += delta;
    const reveal = mat.uniforms.uReveal;
    reveal.value += (1 - reveal.value) * Math.min(1, delta * 2.5);
    // Materialize by growing up out of the head.
    groupRef.current?.scale.set(1, reveal.value, 1);
  });

  return (
    <group
      ref={groupRef}
      position={[(HAT_ANCHOR.u - 0.5) * width, (0.5 - HAT_ANCHOR.v) * height, 0.08]}
      rotation={[0, 0, -0.12]}
    >
      <mesh position={[0, HAT_HEIGHT / 2, 0]}>
        <coneGeometry args={[HAT_RADIUS, HAT_HEIGHT, 48, 1, true]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={hatVertexShader}
          fragmentShader={hatFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, HAT_HEIGHT + 0.03, 0]}>
        <sphereGeometry args={[0.055, 16, 12]} />
        <meshBasicMaterial color={colors.amberHot} toneMapped={false} />
      </mesh>
    </group>
  );
}

const CONFETTI_COUNT = 90;
const CONFETTI_COLORS = [colors.amberHot, colors.magenta, colors.cyan, colors.ok, colors.bright];
const CONFETTI_TOP = 1.5;
const CONFETTI_BOTTOM = -1.5;

/** Falling confetti flakes in front of and behind the portrait on its birthday. */
function BirthdayConfetti({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const flakes = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        x: (Math.random() * 2 - 1) * 1.3,
        y: CONFETTI_BOTTOM + Math.random() * (CONFETTI_TOP - CONFETTI_BOTTOM),
        z: Math.random() * 1.3 - 0.5,
        speed: 0.25 + Math.random() * 0.3,
        sway: Math.random() * Math.PI * 2,
        spin: (Math.random() * 2 - 1) * 4,
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        color: new Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length]),
      })),
    [],
  );

  const place = (mesh: InstancedMesh, t: number) => {
    flakes.forEach((f, i) => {
      dummy.position.set(f.x + Math.sin(t * 1.3 + f.sway) * 0.06, f.y, f.z);
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
    for (const f of flakes) {
      f.y -= f.speed * delta;
      if (f.y < CONFETTI_BOTTOM) f.y += CONFETTI_TOP - CONFETTI_BOTTOM;
    }
    place(mesh, clock.elapsedTime);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CONFETTI_COUNT]}>
      <planeGeometry args={[0.045, 0.075]} />
      <meshBasicMaterial side={DoubleSide} transparent opacity={0.9} toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * Props for {@link HologramPortrait}.
 */
export interface HologramPortraitProps {
  /**
   * Outer dimension of the framed portrait in pixels (rendered as a square).
   * The inner R3F camera and plane geometry scale with the image's aspect
   * ratio independently of this value.
   *
   * @defaultValue 360
   */
  size?: number;
}

/**
 * Displacement-driven holographic portrait — the hero section's signature
 * visual.
 *
 * @remarks
 * The vertex shader samples per-pixel luminance from `/hero-hologram.webp`
 * and extrudes a 160×160 subdivided plane along the surface normal, turning
 * the 2D portrait into real 3D relief. The fragment shader layers fresnel
 * rim light, scrolling scanlines, and an amber tint pulled from
 * {@link colors}.
 *
 * Renders inside a *nested* `<Canvas>` rather than the global one in
 * `HudScene` so the bloom post-processing pass and `DoubleSide` /
 * `AdditiveBlending` material settings stay isolated from the scene graph
 * underneath the document. Per-frame rotation and bloom are skipped when
 * {@link usePrefersReducedMotion} is true; only the time uniform keeps
 * advancing so the scanlines remain readable as moving texture.
 *
 * The amber {@link CornerBrackets} and the bottom HUD label strip live
 * outside the canvas as sibling DOM, layered above the WebGL output along
 * with the CRT scanline mask and refresh sweep.
 *
 * On the operative's birthday ({@link useBirthday}) the tint cycles through
 * amber / magenta / cyan, a holographic party hat materializes on the head
 * (parented to the portrait mesh so it sways with it), confetti falls through
 * the frame (frozen in place under reduced motion), and the brackets and
 * label strip switch to magenta.
 *
 * @example
 * ```tsx
 * <HologramPortrait size={360} />
 * ```
 */
export function HologramPortrait({ size = 360 }: HologramPortraitProps) {
  const reducedMotion = usePrefersReducedMotion();
  const birthday = useBirthday();
  const accent = birthday ? colors.magenta : colors.amber;

  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        border: `1px solid ${colors.line}`,
        background: birthday
          ? 'radial-gradient(ellipse at center, rgba(255,0,85,0.1), rgba(5,8,12,0) 70%)'
          : 'radial-gradient(ellipse at center, rgba(3,216,243,0.08), rgba(5,8,12,0) 70%)',
      }}
    >
      <CornerBrackets color={accent} size={14} />

      <div className="absolute inset-0">
        <Canvas
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
            premultipliedAlpha: true,
          }}
          dpr={[1, 2]}
          camera={{ position: [0, 0, 3.4], fov: 38, near: 0.1, far: 20 }}
        >
          <Suspense fallback={null}>
            <HologramMesh reducedMotion={reducedMotion} birthday={birthday} />
          </Suspense>
          {birthday && <BirthdayConfetti reducedMotion={reducedMotion} />}
          {!reducedMotion && (
            <EffectComposer enableNormalPass={false} multisampling={0}>
              <Bloom
                intensity={0.8}
                luminanceThreshold={0.15}
                luminanceSmoothing={0.4}
                mipmapBlur
              />
            </EffectComposer>
          )}
        </Canvas>
      </div>

      {/* Foreground CRT treatment — a rolling scanline mask plus a slow
          refresh-sweep beam, both sitting above the canvas. */}
      <div aria-hidden className="hud-crt-scanlines absolute inset-0 pointer-events-none" />
      <div aria-hidden className="hud-crt-sweep absolute inset-0 pointer-events-none" />

      {/* HUD label strip */}
      <div
        className="absolute bottom-0 left-0 right-0 px-3 py-1.5 font-mono uppercase flex items-center justify-between"
        style={{
          fontSize: 9,
          letterSpacing: '0.25em',
          color: colors.muted,
          borderTop: `1px solid ${colors.line}`,
          background: 'rgba(11,30,46,0.6)',
        }}
      >
        {birthday ? (
          <>
            <span style={{ color: colors.magenta }}>SIG // HAPPY BIRTHDAY</span>
            <span style={{ color: colors.amberHot }}>REL-0.01</span>
          </>
        ) : (
          <>
            <span style={{ color: colors.halo }}>SIG // HOLOGRAM</span>
            <span>REL-0.01</span>
          </>
        )}
      </div>
    </div>
  );
}
