import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import { DoubleSide } from 'three';
import { HolographicMaterial } from './HolographicMaterial';

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
  const innerRef = useRef<Mesh>(null);
  const ring1Ref = useRef<Mesh>(null);
  const ring2Ref = useRef<Mesh>(null);
  const ring3Ref = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.22;
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.08;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.5;
      innerRef.current.rotation.x = t * 0.3;
      const pulse = 1 + Math.sin(t * 1.8) * 0.03;
      innerRef.current.scale.setScalar(pulse);
    }
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.4;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.3;
    if (ring3Ref.current) ring3Ref.current.rotation.z = t * 0.15;
  });

  return (
    <group ref={groupRef}>
      {/* Inner holographic core — fresnel + scrolling scanlines on the mesh */}
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

      {/* Outer wireframe shell */}
      <mesh>
        <icosahedronGeometry args={[1.35, 2]} />
        <meshBasicMaterial color="#B6D6EB" wireframe transparent opacity={0.55} />
      </mesh>

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
  );
}
