/**
 * Three-light scene rig that produces the HUD's amber/halo dual-tone look.
 *
 * @remarks
 * Composed of a cool ambient baseline, a warm amber key light to simulate
 * signal glow, and a cool halo fill that reads as atmospheric back-light.
 * Intended to render inside the {@link HudScene} `<Canvas>` once at the
 * top of the scene graph; positions are tuned for the orb at the origin
 * and will need adjustment if the orb is moved.
 *
 * @example
 * ```tsx
 * <Canvas>
 *   <Lights />
 *   <HoloOrb />
 * </Canvas>
 * ```
 */
export function Lights() {
  return (
    <>
      <ambientLight color="#8FAFCF" intensity={0.4} />
      <pointLight color="#F5A623" intensity={2.2} distance={20} position={[2, 2, 3]} />
      <pointLight color="#B6D6EB" intensity={1.2} distance={25} position={[-3, -1, 2]} />
    </>
  );
}
