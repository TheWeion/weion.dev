import { useTexture } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type Mesh,
  type ShaderMaterial,
  type Texture,
} from 'three';
import { GlitchText } from '@/components/text/GlitchText';
import { useOccasionTransition } from '@/hooks/useOccasionTransition';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { Occasion } from '@/lib/occasions';
import { colors } from '@/lib/tokens';
import { CornerBrackets } from './CornerBrackets';
import { OCCASION_THEMES, OccasionParticles, OccasionProp } from './hologramOccasions';

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
  uniform float uOccasion;
  uniform vec3 uPaletteA;
  uniform vec3 uPaletteB;
  uniform vec3 uPaletteC;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying float vDisplacement;

  // Cyclic three-colour gradient for occasion tints.
  vec3 occasionTint(float t) {
    t = fract(t) * 3.0;
    if (t < 1.0) return mix(uPaletteA, uPaletteB, t);
    if (t < 2.0) return mix(uPaletteB, uPaletteC, t - 1.0);
    return mix(uPaletteC, uPaletteA, t - 2.0);
  }

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.02) discard;

    vec3 tint = mix(uTint, occasionTint(vUv.y * 0.8 + vUv.x * 0.3 - uTime * 0.15), uOccasion);

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
  occasion: Occasion | null;
}

function HologramMesh({ reducedMotion, occasion }: HologramMeshProps) {
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
      uOccasion: { value: 0 },
      uPaletteA: { value: new Color() },
      uPaletteB: { value: new Color() },
      uPaletteC: { value: new Color() },
    }),
    [texture],
  );

  useEffect(() => {
    const mat = matRef.current;
    if (!mat || !occasion) return;
    const [a, b, c] = OCCASION_THEMES[occasion].palette;
    mat.uniforms.uPaletteA.value.set(a);
    mat.uniforms.uPaletteB.value.set(b);
    mat.uniforms.uPaletteC.value.set(c);
  }, [occasion]);

  useFrame((_, delta) => {
    const mat = matRef.current;
    if (mat) {
      mat.uniforms.uTime.value += delta;
      // Ease the occasion tint in/out rather than snapping at midnight.
      const mix = mat.uniforms.uOccasion;
      mix.value += ((occasion ? 1 : 0) - mix.value) * Math.min(1, delta * 2);
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
      {occasion && (
        <OccasionProp
          occasion={occasion}
          width={width}
          height={height}
          reducedMotion={reducedMotion}
        />
      )}
    </mesh>
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
  /**
   * Whether the portrait is on screen yet. The occasion glitch waits until
   * this has been true for a moment, so it isn't spent behind the boot
   * curtain.
   *
   * @defaultValue true
   */
  active?: boolean;
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
 * On calendar occasions ({@link useOccasionTransition}) the portrait re-themes per
 * {@link OCCASION_THEMES}: the tint cycles through the occasion's palette, a
 * prop is parented to the portrait mesh so it sways with the head (party,
 * witch, or Santa hat; an orbiting egg at Easter), particles drift through
 * the frame (confetti, embers, snow, petals — frozen under reduced motion),
 * and the brackets and label strip take the occasion's accent. The default
 * portrait shows first and then glitches into the occasion (and back out if
 * it ends mid-visit) via {@link useOccasionTransition}: the canvas runs the
 * `hud-signal-glitch` tear, and the label text bursts with {@link GlitchText}
 * ghosts while it scrambles to the new copy.
 *
 * @example
 * ```tsx
 * <HologramPortrait size={360} active={booted} />
 * ```
 */
export function HologramPortrait({ size = 360, active = true }: HologramPortraitProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { occasion, transition } = useOccasionTransition({ active });
  const theme = occasion ? OCCASION_THEMES[occasion] : null;
  const glitching = transition !== null;
  const label = theme
    ? { left: theme.label, leftColor: theme.accent, right: theme.tag, rightColor: theme.tagColor }
    : { left: 'SIG // HOLOGRAM', leftColor: colors.halo, right: 'REL-0.01', rightColor: undefined };
  const labelText = (text: string) => (
    <GlitchText mode={glitching ? 'burst' : 'off'} scramble={reducedMotion ? undefined : 450}>
      {text}
    </GlitchText>
  );

  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        border: `1px solid ${colors.line}`,
        background: `radial-gradient(ellipse at center, ${theme?.glow ?? 'rgba(3,216,243,0.08)'}, rgba(5,8,12,0) 70%)`,
      }}
    >
      <CornerBrackets color={theme?.accent ?? colors.amber} size={14} />

      <div className={`absolute inset-0${glitching ? ' hud-signal-glitch' : ''}`}>
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
            <HologramMesh reducedMotion={reducedMotion} occasion={occasion} />
          </Suspense>
          {occasion && <OccasionParticles occasion={occasion} reducedMotion={reducedMotion} />}
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
        <span style={{ color: label.leftColor }}>{labelText(label.left)}</span>
        <span style={{ color: label.rightColor }}>{labelText(label.right)}</span>
      </div>
    </div>
  );
}
