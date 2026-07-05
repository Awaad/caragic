import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  AdditiveBlending,
  type Points as ThreePoints,
  type CanvasTexture,
} from "three";
import { createStarTexture } from "../../scene/utils/pointTexture";

/**
 * Slow-drift ambient starfield. Two layers with different densities and
 * point sizes so the sky reads with depth — nearby bright stars over a
 * fine dusting of distant ones.
 *
 * Intentionally minimal: no cursor parallax, no reactivity to messages.
 * The background is atmosphere, not attention.
 */
function StarLayer({
  count,
  size,
  radius,
  opacity,
  driftScale,
  texture,
  axisY,
  axisX,
  axisZ,
}: {
  count: number;
  size: number;
  radius: [number, number];
  opacity: number;
  driftScale: number;
  texture: CanvasTexture;
  axisY: number;
  axisX: number;
  axisZ: number;
}) {
  const ref = useRef<ThreePoints>(null);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius[0] + Math.random() * (radius[1] - radius[0]);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    g.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return g;
  }, [count, radius]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Per-axis sine modulation. Different periods per axis, per layer.
    // The parallax we perceive between the two layers comes from them
    // rotating around DIFFERENT axes at different rates — not from
    // rotating the same way at different speeds (that just looks desynced).
    const yMod = 1 + Math.sin(t * 0.06) * 0.4;
    const xMod = 1 + Math.cos(t * 0.05) * 0.4;
    const zMod = 1 + Math.sin(t * 0.04) * 0.4;
    ref.current.rotation.y += delta * axisY * driftScale * yMod;
    ref.current.rotation.x += delta * axisX * driftScale * xMod;
    ref.current.rotation.z += delta * axisZ * driftScale * zMod;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={size}
        sizeAttenuation
        color="#ffffff"
        alphaMap={texture}
        transparent
        opacity={opacity}
        blending={AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </points>
  );
}

function Stars() {
  const texture = useMemo(() => createStarTexture(128), []);

  // Dispose the CanvasTexture when the component unmounts so GPU memory
  // isn't held for the life of the page.
  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return (
    <>
      {/* Far layer: many small stars, slow parallax */}
      <StarLayer
        count={2500}
        size={0.1}
        radius={[8, 14]}
        opacity={0.9}
        driftScale={1}
        texture={texture}
        axisY={0.006}
        axisX={0.001}
        axisZ={0}
      />
      {/* Near layer: fewer, bigger, brighter — reads as foreground */}
      <StarLayer
        count={120}
        size={0.18}
        radius={[3, 7]}
        opacity={0.7}
        driftScale={1.2}
        texture={texture}
        axisY={0.004}
        axisX={0.009}
        axisZ={0.002}
      />
      <StarLayer
        count={150}
        size={0.19}
        radius={[4, 8]}
        opacity={0.7}
        driftScale={1.4}
        texture={texture}
        axisY={0.006}
        axisX={0.007}
        axisZ={0.0015}
      />
    </>
  );
}

export function Starfield() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 0.1], fov: 65 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
      >
        <Stars />
      </Canvas>
    </div>
  );
}