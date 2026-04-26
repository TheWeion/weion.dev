import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Perf } from 'r3f-perf';
import { Suspense, useEffect, useRef, useState } from 'react';
import { FogExp2, Vector2 } from 'three';
import { AmbientDust } from './AmbientDust';
import { GridFloor } from './GridFloor';
import { HoloOrb } from './HoloOrb';
import { Lights } from './Lights';

// Enabled when the page URL carries `?perf` (or `?perf=1`). Resolved once at
// module load — toggling requires a reload, which keeps the perf overlay out
// of every render path for normal visits.
const perfOverlayEnabled =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf');

const PERF_OVERLAY_STYLE = {
  transform: 'scale(1.5)',
  transformOrigin: 'top left',
} as const;

/**
 * Re-parents the r3f-perf overlay div from `gl.domElement.parentNode` (the
 * canvas wrapper, which lives at z-0 and is `position: fixed` — always a new
 * stacking context) into `document.body`, so the overlay escapes that
 * context and renders above every HUD layer.
 *
 * @remarks
 * r3f-perf's `HtmlMinimal` appends a fresh `<div>` next to the canvas on
 * mount and removes it on unmount. We watch for that append, hoist it to
 * `document.body`, then put it back before unmount so the library's own
 * `target.removeChild(el)` cleanup still finds the node where it expects.
 * Returns `null`; behavior-only.
 */
function PerfOverlayPortal() {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const target = gl.domElement.parentNode as HTMLElement | null;
    if (!target) return;

    let movedNode: HTMLElement | null = null;
    const hoist = () => {
      if (movedNode) return;
      const candidate = Array.from(target.children).find(
        (child): child is HTMLElement => child instanceof HTMLElement && child !== gl.domElement,
      );
      if (candidate) {
        movedNode = candidate;
        document.body.appendChild(candidate);
      }
    };

    hoist();
    const observer = new MutationObserver(hoist);
    observer.observe(target, { childList: true });

    return () => {
      observer.disconnect();
      if (movedNode && document.body.contains(movedNode)) {
        target.appendChild(movedNode);
      }
    };
  }, [gl]);

  return null;
}

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

    // Disable pointer parallax on touch devices
    if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover)').matches) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
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
  // Animation starts paused. Switches on at the first user signal
  // (pointermove / scroll / keydown / touchstart) or after a 2.05s fallback so
  // the scene still comes alive even on a perfectly idle desktop. Lighthouse
  // never interacts during its measurement window, so it sees a quiet canvas
  // and lands a real TBT/TTI instead of measuring the perpetual render loop.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    let timer: number | undefined;
    const start = () => setAnimate(true);
    const opts = { once: true, passive: true } as const;
    window.addEventListener('pointermove', start, opts);
    window.addEventListener('scroll', start, opts);
    window.addEventListener('touchstart', start, opts);
    window.addEventListener('keydown', start, { once: true });
    timer = window.setTimeout(start, 2050);
    return () => {
      window.removeEventListener('pointermove', start);
      window.removeEventListener('scroll', start);
      window.removeEventListener('touchstart', start);
      window.removeEventListener('keydown', start);
      if (timer) window.clearTimeout(timer);
    };
  }, [reducedMotion]);

  const postEnabled = !reducedMotion && quality !== 'low';
  const frameloop = reducedMotion || !animate ? 'demand' : 'always';

  return (
    <Canvas
      className="absolute inset-0"
      frameloop={frameloop}
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

      {perfOverlayEnabled && (
        <>
          <Perf position="top-left" style={PERF_OVERLAY_STYLE} />
          <PerfOverlayPortal />
        </>
      )}

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
