import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Edges } from '@react-three/drei';
import {
  Color,
  MathUtils,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';

interface PanelFrameProps {
  width: number;
  height: number;
  depth?: number;
  text: string;
  textSize?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  accentColor: string;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  typewriter?: boolean;
}

export function PanelFrame({
  width,
  height,
  depth = 0.05,
  text,
  textSize = 0.08,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  visible = true,
  accentColor,
  selected = false,
  dimmed = false,
  onClick,
  typewriter = false,
}: PanelFrameProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const fillMaterialRef = useRef<MeshBasicMaterial>(null);

  const accent = useMemo(() => new Color(accentColor), [accentColor]);
  const accentBright = useMemo(() => {
    const c = new Color(accentColor);
    c.multiplyScalar(2.2);
    return c;
  }, [accentColor]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    // Scale-in/out on visibility
    const targetScale = visible ? 1 : 0;
    const current = group.scale.x;
    const next = MathUtils.lerp(current, targetScale, 0.18);
    group.scale.setScalar(next);
    group.visible = next > 0.01;

    if (!visible) return;

    // Selection feedback
    if (meshRef.current) {
      const targetMeshScale = selected ? 1.05 : dimmed ? 0.92 : 1;
      const cur = meshRef.current.scale.x;
      meshRef.current.scale.setScalar(MathUtils.lerp(cur, targetMeshScale, 0.15));
    }

    if (fillMaterialRef.current) {
      const targetOpacity = selected ? 0.88 : dimmed ? 0.35 : 0.7;
      fillMaterialRef.current.opacity = MathUtils.lerp(
        fillMaterialRef.current.opacity,
        targetOpacity,
        0.15,
      );
    }
  });

  // Edge color: brighter when selected
  const edgeColor = selected ? accentBright : accent;

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={0}>
      {/* Solid box with edge outline */}
      <mesh
        ref={meshRef}
        onClick={
          onClick
            ? (e) => {
                e.stopPropagation();
                onClick();
              }
            : undefined
        }
      >
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial
          ref={fillMaterialRef}
          color="#08041a"
          transparent
          opacity={0.7}
          toneMapped={false}
          depthWrite={false}
        />
        {/* drei <Edges> renders the wireframe edges of the parent geometry */}
        <Edges
          threshold={15}
          color={edgeColor}
          linewidth={1.5}
        />
      </mesh>

      {/* Inner subtle glow layer behind front face — adds body to the dark fill */}
      <mesh position={[0, 0, depth / 2 - 0.001]}>
        <planeGeometry args={[width * 0.95, height * 0.85]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.08}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Corner accent marks — small bright dots at corners for tech feel */}
      {[
        [-width / 2, height / 2],
        [width / 2, height / 2],
        [-width / 2, -height / 2],
        [width / 2, -height / 2],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, depth / 2 + 0.002]}>
          <circleGeometry args={[0.015, 8]} />
          <meshBasicMaterial color={edgeColor} toneMapped={false} />
        </mesh>
      ))}

      {/* Text on the front face */}
      {!typewriter ? (
        <Text
          position={[0, 0, depth / 2 + 0.005]}
          fontSize={textSize}
          color="white"
          anchorX="center"
          anchorY="middle"
          maxWidth={width * 0.9}
          textAlign="center"
          outlineWidth={0.003}
          outlineColor="#000000"
          outlineOpacity={0.7}
        >
          {text}
        </Text>
      ) : null}
    </group>
  );
}