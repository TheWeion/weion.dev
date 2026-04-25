import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  FrontSide,
  NormalBlending,
  type ShaderMaterial,
  type Side,
} from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uFresnelAmount;
  uniform float uFresnelOpacity;
  uniform float uScanlineSize;
  uniform float uSignalSpeed;
  uniform float uHologramBrightness;
  uniform float uHologramOpacity;
  uniform float uBlink;
  uniform float uBlinkFresnelOnly;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    if (!gl_FrontFacing) normal = -normal;

    float facing = max(dot(normal, vViewDir), 0.0);
    float fresnel = pow(1.0 - facing, uFresnelAmount);

    // Animated scanlines across world Y
    float stripes = fract(vWorldPosition.y * uScanlineSize - uTime * uSignalSpeed);
    stripes = pow(stripes, 3.0);

    // Flicker: optionally constrained to the fresnel rim so the core stays stable
    float blinkMask = uBlink > 0.5
      ? mix(1.0, 0.55 + 0.45 * sin(uTime * 4.2), 1.0)
      : 1.0;
    float flickerOnFresnel = uBlinkFresnelOnly > 0.5 ? blinkMask : 1.0;
    float flickerGlobal = uBlinkFresnelOnly > 0.5 ? 1.0 : blinkMask;

    float intensity =
      stripes * uHologramBrightness * flickerGlobal +
      fresnel * uFresnelOpacity * flickerOnFresnel;

    vec3 color = uColor * intensity;
    float alpha = clamp(fresnel + stripes * 0.5, 0.0, 1.0) * uHologramOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Props for {@link HolographicMaterial}.
 */
export interface HolographicMaterialProps {
  /**
   * Tint of the hologram — accepts any CSS color string consumed by
   * `THREE.Color`.
   *
   * @defaultValue `'#B6D6EB'`
   */
  color?: string;
  /**
   * Exponent on the rim term. Higher values tighten the rim into a thinner
   * fresnel band.
   *
   * @defaultValue 1.4
   */
  fresnelAmount?: number;
  /**
   * Brightness multiplier applied to the rim contribution.
   *
   * @defaultValue 1.0
   */
  fresnelOpacity?: number;
  /**
   * Stripes per world unit measured along the Y axis.
   *
   * @defaultValue 8
   */
  scanlineSize?: number;
  /**
   * Scroll speed of the scanlines, in stripes per second.
   *
   * @defaultValue 0.45
   */
  signalSpeed?: number;
  /**
   * Multiplier on the stripe brightness. Combined with `fresnelOpacity` to
   * compose the final luminance.
   *
   * @defaultValue 1.3
   */
  hologramBrightness?: number;
  /**
   * Overall alpha multiplier applied after the fresnel + stripe blend.
   *
   * @defaultValue 1.0
   */
  hologramOpacity?: number;
  /**
   * Whether the hologram pulses ("blinks") on a sine schedule.
   *
   * @defaultValue true
   */
  blink?: boolean;
  /**
   * When true, the blink modulates only the fresnel rim and leaves the
   * scrolling scanlines steady — useful for a stable core with a flickering
   * silhouette.
   *
   * @defaultValue true
   */
  blinkFresnelOnly?: boolean;
  /**
   * Three.js cull side. Pass `DoubleSide` for closed shells where the
   * back-face stripes should still read.
   *
   * @defaultValue `FrontSide`
   */
  side?: Side;
  /**
   * Whether to use additive blending. When false, falls back to normal
   * alpha blending — handy for stacking multiple holograms without
   * over-bright clipping.
   *
   * @defaultValue true
   */
  additive?: boolean;
}

/**
 * Rim-lit, scanline-scrolling hologram shader material.
 *
 * @remarks
 * R3F port of Anderson Mancini's HolographicMaterial
 * (github.com/ektogamat/threejs-holographic-material, MIT).
 *
 * The `uniforms` object is memoised with an empty dep list so its identity
 * stays stable across renders — Three.js compares uniform object identity
 * when deciding whether to re-upload, and a fresh object on every prop
 * change would thrash the GPU. Prop values are instead synced into the
 * existing uniforms via a follow-up `useEffect`. `useFrame` advances
 * `uTime` by the per-frame delta, so the animation is framerate-independent.
 *
 * Drop in as a child of any `<mesh>` rendered inside the {@link HudScene}
 * `<Canvas>` — see {@link HoloOrb} for the canonical configuration.
 *
 * @example
 * ```tsx
 * <mesh>
 *   <icosahedronGeometry args={[1.05, 2]} />
 *   <HolographicMaterial
 *     color="#F5A623"
 *     fresnelAmount={1.6}
 *     scanlineSize={9}
 *     blinkFresnelOnly
 *     side={DoubleSide}
 *   />
 * </mesh>
 * ```
 */
export function HolographicMaterial({
  color = '#B6D6EB',
  fresnelAmount = 1.4,
  fresnelOpacity = 1.0,
  scanlineSize = 8,
  signalSpeed = 0.45,
  hologramBrightness = 1.3,
  hologramOpacity = 1.0,
  blink = true,
  blinkFresnelOnly = true,
  side = FrontSide,
  additive = true,
}: HolographicMaterialProps) {
  const matRef = useRef<ShaderMaterial>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: uniform object identity must stay stable across renders; prop values are synced via the effect below
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new Color(color) },
      uFresnelAmount: { value: fresnelAmount },
      uFresnelOpacity: { value: fresnelOpacity },
      uScanlineSize: { value: scanlineSize },
      uSignalSpeed: { value: signalSpeed },
      uHologramBrightness: { value: hologramBrightness },
      uHologramOpacity: { value: hologramOpacity },
      uBlink: { value: blink ? 1 : 0 },
      uBlinkFresnelOnly: { value: blinkFresnelOnly ? 1 : 0 },
    }),
    [],
  );

  useEffect(() => {
    const u = uniforms;
    u.uColor.value.set(color);
    u.uFresnelAmount.value = fresnelAmount;
    u.uFresnelOpacity.value = fresnelOpacity;
    u.uScanlineSize.value = scanlineSize;
    u.uSignalSpeed.value = signalSpeed;
    u.uHologramBrightness.value = hologramBrightness;
    u.uHologramOpacity.value = hologramOpacity;
    u.uBlink.value = blink ? 1 : 0;
    u.uBlinkFresnelOnly.value = blinkFresnelOnly ? 1 : 0;
  }, [
    uniforms,
    color,
    fresnelAmount,
    fresnelOpacity,
    scanlineSize,
    signalSpeed,
    hologramBrightness,
    hologramOpacity,
    blink,
    blinkFresnelOnly,
  ]);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
  });

  return (
    <shaderMaterial
      ref={matRef}
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      transparent
      depthWrite={false}
      side={side === DoubleSide ? DoubleSide : side}
      blending={additive ? AdditiveBlending : NormalBlending}
    />
  );
}
