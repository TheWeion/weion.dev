import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Suspense, useEffect, useRef, useState } from 'react';
import { FogExp2, Vector2 } from 'three';
import { AmbientDust } from './AmbientDust';
import { GridFloor } from './GridFloor';
import { HoloOrb } from './HoloOrb';
import { Lights } from './Lights';

interface CameraParallaxProps {
  /**
   * When false, the pointermove listener is detached and the per-frame
   * easing is a no-op — used to honour `prefers-reduced-motion`.
   */
  enabled: boolean;
}

/**
 * Smoothly eases the camera toward a target position derived from the pointer.
 *
 * @remarks
 * The pointer-derived target is stored in a ref to avoid React re-renders
 * during pointer movement; the actual easing happens inside `useFrame`
 * with a delta-scaled lerp so motion stays framerate-independent. The
 * camera always looks at the origin, keeping {@link HoloOrb} framed even
 * as the position drifts. Returns `null` — this component contributes
 * behavior only, not scene graph.
 */
function CameraParallax({ enabled }: CameraParallaxProps) {
  const { camera, gl } = useThree();
  const target = useRef({ x: 0, y: 0.6 });

  useEffect(() => {
    if (!enabled) return;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      target.current.x = nx * 0.8;
      target.current.y = 0.6 + ny * 0.4;
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [enabled, gl.domElement]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const ease = Math.min(1, delta * 3);
    camera.position.x += (target.current.x - camera.position.x) * ease;
    camera.position.y += (target.current.y - camera.position.y) * ease;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/**
 * Props for {@link HudScene}.
 */
interface HudSceneProps {
  /**
   * When true, disables pointer parallax and the {@link AmbientDust} field
   * to honour the user's `prefers-reduced-motion` setting. The orb's own
   * idle rotation and the shader-driven scanlines are preserved.
   *
   * @defaultValue false
   */
  reducedMotion?: boolean;
}

// Fixed Vector2 passed to ChromaticAberration — avoids per-render allocation.
const CHROMATIC_OFFSET = new Vector2(0.0015, 0.001);

/**
 * Background 3D scene mounted as a fixed, full-viewport canvas beneath
 * all HUD content (z-index 0).
 *
 * @remarks
 * Quality adapts at runtime via drei's `PerformanceMonitor`:
 *  - `high`   — full dpr `[1, 2]` + bloom + chromatic aberration
 *  - `medium` — reduced dpr `[1, 1.5]` + bloom + chromatic aberration
 *  - `low`    — dpr 1, postprocessing disabled entirely
 *
 * Exponential fog is attached once via the canvas `onCreated` callback so
 * scene children (notably {@link GridFloor}) can fade into it. The
 * postprocessing chain is conditionally mounted: it is skipped both under
 * `reducedMotion` and on the `low` quality tier so that struggling devices
 * stop paying for `EffectComposer`.
 *
 * @example
 * ```tsx
 * // From src/App.tsx — a single instance is the page's z-index 0 layer.
 * <div className="fixed inset-0 z-0">
 *   <HudScene reducedMotion={prefersReducedMotion} />
 * </div>
 * ```
 */
export function HudScene({ reducedMotion = false }: HudSceneProps) {
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [dpr, setDpr] = useState<number | [number, number]>([1, 2]);

  const postEnabled = !reducedMotion && quality !== 'low';

  return (
    <Canvas
      className="absolute inset-0"
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      dpr={dpr}
      camera={{ position: [0, 0.6, 5.2], fov: 45, near: 0.1, far: 100 }}
      onCreated={({ scene }) => {
        scene.fog = new FogExp2(0x05080c, 0.09);
      }}
    >
      <PerformanceMonitor
        onIncline={() => {
          setQuality('high');
          setDpr([1, 2]);
        }}
        onDecline={() => {
          setQuality('medium');
          setDpr([1, 1.5]);
        }}
        onFallback={() => {
          setQuality('low');
          setDpr(1);
        }}
      >
        <Suspense fallback={null}>
          <Lights />
          <HoloOrb />
          {!reducedMotion && quality !== 'low' && <AmbientDust count={500} />}
          <GridFloor />
        </Suspense>
        <CameraParallax enabled={!reducedMotion} />
      </PerformanceMonitor>

      {postEnabled && (
        <EffectComposer enableNormalPass={false} multisampling={0}>
          <Bloom
            intensity={quality === 'high' ? 0.9 : 0.6}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
          <ChromaticAberration
            offset={CHROMATIC_OFFSET}
            radialModulation={false}
            modulationOffset={0}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}
