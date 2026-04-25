import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  type Points,
} from 'three';

/**
 * Props for {@link AmbientDust}.
 */
interface AmbientDustProps {
  /**
   * Number of dust particles to render.
   *
   * @defaultValue 500
   * @remarks
   * Memory scales linearly — each particle stores three position floats plus
   * one phase seed. Render cost is dominated by the per-frame `Float32Array`
   * loop rather than GPU draw, since every particle shares one material and
   * one sprite texture.
   */
  count?: number;
}

/**
 * Drifting particulate dust field rendered as additive halo-blue point sprites.
 *
 * @remarks
 * Particles are seeded once into a 20 × 8 × 18 box around the origin, each
 * with its own phase offset. Per-frame motion mutates the underlying
 * `Float32Array` in place and only flips `BufferAttribute.needsUpdate`, so
 * there is no React state churn during the animation loop. Particles wrap
 * vertically when they leave the ±4 Y band.
 *
 * The point sprite is a single 64×64 radial-gradient canvas texture generated
 * at mount and reused across the whole field via `pointsMaterial.map`.
 *
 * Intended to render inside an `@react-three/fiber` `<Canvas>` and is omitted
 * by `HudScene` when {@link usePrefersReducedMotion} returns true.
 *
 * @example
 * ```tsx
 * <Canvas>
 *   <AmbientDust count={350} />
 * </Canvas>
 * ```
 */
export function AmbientDust({ count = 500 }: AmbientDustProps) {
  const pointsRef = useRef<Points>(null);

  // Build geometry + sprite texture once.
  const { geometry, seeds, spriteTexture } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seedArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18;
      seedArr[i] = Math.random() * Math.PI * 2;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));

    // Circular sprite generated in a 64×64 canvas.
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.25, 'rgba(182,214,235,0.8)');
      gradient.addColorStop(1, 'rgba(182,214,235,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new CanvasTexture(canvas);

    return { geometry: geo, seeds: seedArr, spriteTexture: tex };
  }, [count]);

  useFrame(({ clock }) => {
    const mesh = pointsRef.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();

    const positionAttr = mesh.geometry.attributes.position as BufferAttribute;
    const arr = positionAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const seed = seeds[i] ?? 0;
      arr[i * 3 + 1] += Math.sin(t * 0.3 + seed) * 0.0008;
      arr[i * 3] += Math.cos(t * 0.2 + seed) * 0.0006;
      if (arr[i * 3 + 1] > 4) arr[i * 3 + 1] = -4;
      if (arr[i * 3 + 1] < -4) arr[i * 3 + 1] = 4;
    }
    positionAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.06}
        map={spriteTexture}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        color="#B6D6EB"
        opacity={0.9}
      />
    </points>
  );
}
