import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, LineBasicMaterial, Mesh } from 'three';
import { DoubleSide } from 'three';
import { OCCASION_GLITCH_MS, useOccasionTransition } from '@/hooks/useOccasionTransition';
import type { Occasion } from '@/lib/occasions';
import { createGoldbergWireframe } from './goldbergGeometry';
import { HolographicMaterial } from './HolographicMaterial';
import { hasOccasionCore, OccasionCore } from './OccasionCore';

const SHELL_OPACITY = 0.55;

/** Seconds between glitch re-rolls — slow enough to read as signal dropout, not strobing. */
const GLITCH_STEP = 0.05;

const coreKey = (occasion: Occasion | null) => occasion ?? 'default';

/**
 * Central holographic decoration sitting at the scene origin.
 *
 * @remarks
 * Composed of three layers:
 *  - An inner icosahedron rendered with the fresnel + scanline
 *    {@link HolographicMaterial}
 *  - An outer wireframe blue icosahedron (atmospheric colour)
 *  - Three thin torus rings at offset angles, two amber and one halo-cyan
 *
 * On calendar occasions ({@link useOccasionTransition}) the inner core is
 * swapped for an {@link OccasionCore} — Portal cake, pumpkin, painted egg, or
 * snowman's head. The default core shows first, then glitches into the
 * occasion (and back out if it ends mid-visit): for the length of the
 * transition both cores stay mounted and each frame step re-rolls which one
 * is visible — weighted from old to new as it progresses — while the core
 * jitters sideways, stretches, and the shell flickers. The core sits outside
 * the spinning shell group so occasion faces can stay toward the camera.
 *
 * All animation runs inside a single `useFrame` and only mutates
 * `rotation`/`scale` on existing refs — no allocations per tick. The
 * inner core also pulses its scale by ±3% to give the rim shader a subtle
 * breathing read. Intended to render inside the {@link HudScene} `<Canvas>`.
 *
 * @example
 * ```tsx
 * <Canvas>
 *   <Lights />
 *   <HoloOrb />
 * </Canvas>
 * ```
 */
export function HoloOrb() {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Group>(null);
  const innerRef = useRef<Mesh>(null);
  const ring1Ref = useRef<Mesh>(null);
  const ring2Ref = useRef<Mesh>(null);
  const ring3Ref = useRef<Mesh>(null);
  const shellMatRef = useRef<LineBasicMaterial>(null);
  const slots = useRef(new Map<string, Group>());
  const glitch = useRef({ next: 0, showTo: false, both: false, x: 0, sx: 1, sy: 1, shell: 1 });
  const { occasion, transition } = useOccasionTransition();

  // Goldberg polyhedron wireframe
  const shellGeometry = useMemo(() => createGoldbergWireframe(1.35, 2), []);

  const cores = transition ? [transition.from, transition.to] : [occasion];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.22;
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.08;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.28;
      innerRef.current.rotation.x = t * 0.3;
      const pulse = 1 + Math.sin(t * 1.8) * 0.03;
      innerRef.current.scale.setScalar(pulse);
    }
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.4;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.3;
    if (ring3Ref.current) ring3Ref.current.rotation.z = t * 0.15;

    const g = glitch.current;
    if (transition) {
      const p = Math.min(1, (performance.now() - transition.startedAt) / OCCASION_GLITCH_MS);
      const intensity = Math.sin(Math.PI * p);
      if (t >= g.next || p >= 1) {
        g.next = t + GLITCH_STEP;
        g.showTo = p >= 1 || Math.random() < p * p * (3 - 2 * p);
        g.both = Math.random() < 0.25 * intensity;
        g.x = (Math.random() - 0.5) * 0.3 * intensity;
        g.sx = 1 + (Math.random() - 0.5) * 0.5 * intensity;
        g.sy = 1 - Math.random() * 0.25 * intensity;
        g.shell = 1 - Math.random() * 0.8 * intensity;
      }
    } else {
      g.showTo = true;
      g.both = false;
      g.x = 0;
      g.sx = 1;
      g.sy = 1;
      g.shell = 1;
    }

    if (transition) {
      const from = slots.current.get(coreKey(transition.from));
      const to = slots.current.get(coreKey(transition.to));
      if (from) from.visible = g.both || !g.showTo;
      if (to) to.visible = g.both || g.showTo;
    } else {
      for (const slot of slots.current.values()) slot.visible = true;
    }
    if (coreRef.current) {
      coreRef.current.position.x = g.x;
      coreRef.current.scale.set(g.sx, g.sy, 1);
    }
    if (shellMatRef.current) shellMatRef.current.opacity = SHELL_OPACITY * g.shell;
  });

  return (
    <>
      <group ref={coreRef}>
        {cores.map((core) => {
          const key = coreKey(core);
          return (
            // Keyed by occasion so the incoming core stays mounted when the
            // glitch ends rather than remounting outside its slot.
            <group
              key={key}
              ref={(slot) => {
                if (slot) slots.current.set(key, slot);
                else slots.current.delete(key);
              }}
            >
              {hasOccasionCore(core) ? (
                <OccasionCore occasion={core} />
              ) : (
                // Inner holographic core — fresnel + scrolling scanlines on the mesh
                <mesh ref={innerRef}>
                  <icosahedronGeometry args={[1.05, 2]} />
                  <HolographicMaterial
                    color="#F5A623"
                    fresnelAmount={1.6}
                    fresnelOpacity={0.9}
                    scanlineSize={9}
                    signalSpeed={0.6}
                    hologramBrightness={1.1}
                    hologramOpacity={0.8}
                    blinkFresnelOnly
                    side={DoubleSide}
                  />
                </mesh>
              )}
            </group>
          );
        })}
      </group>

      <group ref={groupRef}>
        {/* Outer hexagonal shell — Goldberg polyhedron wireframe */}
        <lineSegments geometry={shellGeometry}>
          <lineBasicMaterial
            ref={shellMatRef}
            color="#B6D6EB"
            transparent
            opacity={SHELL_OPACITY}
          />
        </lineSegments>

        {/* Orbital rings */}
        <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.75, 0.006, 6, 96]} />
          <meshBasicMaterial color="#FFB547" transparent opacity={0.85} />
        </mesh>

        <mesh ref={ring2Ref} rotation={[Math.PI / 2.3, 0, Math.PI / 4]} scale={1.08}>
          <torusGeometry args={[1.75, 0.006, 6, 96]} />
          <meshBasicMaterial color="#FFB547" transparent opacity={0.7} />
        </mesh>

        <mesh ref={ring3Ref} rotation={[Math.PI / 1.8, 0, 0]} scale={1.18}>
          <torusGeometry args={[1.75, 0.006, 6, 96]} />
          <meshBasicMaterial color="#03D8F3" transparent opacity={0.5} />
        </mesh>
      </group>
    </>
  );
}
