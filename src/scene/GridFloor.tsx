import { Grid } from '@react-three/drei';

/**
 * Infinite, fog-faded floor grid sitting below the hero orb.
 *
 * @remarks
 * Uses drei's shader-based `Grid` helper so the cells appear to recede into
 * the fog set on the scene by {@link HudScene}. Major section lines are
 * highlighted amber (every 5 world units) while the half-unit cell lines
 * use the darker `#1E3A52` line token. `followCamera` is intentionally
 * disabled — the grid is anchored at `y = -2.2` so the orb stays framed
 * above it during the camera parallax.
 *
 * @example
 * ```tsx
 * <Canvas>
 *   <HoloOrb />
 *   <GridFloor />
 * </Canvas>
 * ```
 */
export function GridFloor() {
  return (
    <Grid
      position={[0, -2.2, 0]}
      args={[40, 40]}
      cellSize={0.5}
      cellThickness={0.5}
      cellColor="#1E3A52"
      sectionSize={5}
      sectionThickness={1.2}
      sectionColor="#F5A623"
      fadeDistance={22}
      fadeStrength={1}
      followCamera={false}
      infiniteGrid
    />
  );
}
