import { BufferAttribute, BufferGeometry, IcosahedronGeometry } from 'three';

/**
 * Builds a `BufferGeometry` of line segments tracing the edges of a Goldberg
 * polyhedron — the dual of a geodesic icosahedron.
 *
 * @remarks
 * The result is the soccer-ball / honeycomb-sphere pattern: 12 pentagonal
 * cells (one at each original icosahedron vertex) plus a growing number of
 * hexagonal cells as `detail` increases. Intended as the geometry for a
 * `<lineSegments>` so the orb's outer shell reads as hexagons rather than
 * the triangulated wireframe of a raw `IcosahedronGeometry`.
 *
 * Approach: take each triangle of the underlying icosahedron, project its
 * centroid back onto the sphere, then for every edge that's shared by two
 * triangles emit a line between those triangles' centroids. That edge set
 * is exactly the wireframe of the dual polyhedron.
 *
 * Cell counts by detail:
 * - `detail=0` → 12 pentagons, 0 hexagons (regular dodecahedron)
 * - `detail=1` → 12 pentagons, 30 hexagons (Goldberg G(2,0))
 * - `detail=2` → 12 pentagons, 150 hexagons (Goldberg G(4,0))
 *
 * @param radius - Radius of the sphere the polyhedron is inscribed in.
 * @param detail - Subdivision count of the underlying icosahedron.
 *
 * @example
 * ```tsx
 * const geometry = useMemo(() => createGoldbergWireframe(1.35, 1), []);
 * return (
 *   <lineSegments geometry={geometry}>
 *     <lineBasicMaterial color="#B6D6EB" transparent opacity={0.55} />
 *   </lineSegments>
 * );
 * ```
 */
export function createGoldbergWireframe(radius: number, detail: number): BufferGeometry {
  const ico = new IcosahedronGeometry(radius, detail);
  const positions = ico.attributes.position.array as Float32Array;
  const triCount = positions.length / 9;

  // Project the centroid of each triangle back onto the sphere of radius R.
  const centroids = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let v = 0; v < 3; v++) {
      cx += positions[t * 9 + v * 3];
      cy += positions[t * 9 + v * 3 + 1];
      cz += positions[t * 9 + v * 3 + 2];
    }
    cx /= 3;
    cy /= 3;
    cz /= 3;
    const len = Math.hypot(cx, cy, cz) || 1;
    const k = radius / len;
    centroids[t * 3] = cx * k;
    centroids[t * 3 + 1] = cy * k;
    centroids[t * 3 + 2] = cz * k;
  }

  // Find every edge shared by exactly two triangles. IcosahedronGeometry
  // emits unindexed positions, so dedupe vertices by quantised coords.
  const edgeMap = new Map<string, number[]>();
  const vertexKey = (i: number) => {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    return `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
  };
  const edgeKey = (a: number, b: number) => {
    const ka = vertexKey(a);
    const kb = vertexKey(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const i1 = t * 3 + 1;
    const i2 = t * 3 + 2;
    for (const [a, b] of [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ] as const) {
      const k = edgeKey(a, b);
      const list = edgeMap.get(k);
      if (list) list.push(t);
      else edgeMap.set(k, [t]);
    }
  }

  const lineCoords: number[] = [];
  for (const tris of edgeMap.values()) {
    if (tris.length !== 2) continue;
    const [t1, t2] = tris;
    lineCoords.push(
      centroids[t1 * 3],
      centroids[t1 * 3 + 1],
      centroids[t1 * 3 + 2],
      centroids[t2 * 3],
      centroids[t2 * 3 + 1],
      centroids[t2 * 3 + 2],
    );
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(lineCoords), 3));
  // Source icosahedron is no longer needed once centroids + edge map are built.
  ico.dispose();
  return geo;
}
