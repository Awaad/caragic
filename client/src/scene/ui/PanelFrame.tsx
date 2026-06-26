import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
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
  text: string;
  textSize?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  accentColor: string;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

const BORDER_THICKNESS = 0.025;  // how much the neon backplate extends past the inner panel
const PANEL_DEPTH = 0.04;

export function PanelFrame({
  width,
  height,
  text,
  textSize = 0.08,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  visible = true,
  accentColor,
  selected = false,
  dimmed = false,
  onClick,
}: PanelFrameProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const borderRef = useRef<Mesh>(null);
  const borderMaterialRef = useRef<MeshBasicMaterial>(null);
  const innerGlowMaterialRef = useRef<MeshBasicMaterial>(null);
  const fillMaterialRef = useRef<MeshBasicMaterial>(null);

  const accent = useMemo(() => new Color(accentColor), [accentColor]);
  const accentBright = useMemo(() => {
    const c = new Color(accentColor);
    c.multiplyScalar(3);
    return c;
  }, [accentColor]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const targetScale = visible ? 1 : 0;
    const current = group.scale.x;
    const next = MathUtils.lerp(current, targetScale, 0.18);
    group.scale.setScalar(next);
    group.visible = next > 0.01;

    if (!visible) return;

    if (meshRef.current) {
      const target = selected ? 1.04 : dimmed ? 0.92 : 1;
      meshRef.current.scale.setScalar(
        MathUtils.lerp(meshRef.current.scale.x, target, 0.15),
      );
    }
    if (borderRef.current) {
      const target = selected ? 1.04 : dimmed ? 0.92 : 1;
      borderRef.current.scale.setScalar(
        MathUtils.lerp(borderRef.current.scale.x, target, 0.15),
      );
    }

    if (borderMaterialRef.current) {
      borderMaterialRef.current.color.lerp(
        selected ? accentBright : accent,
        0.15,
      );
    }
    if (innerGlowMaterialRef.current) {
      const targetOp = selected ? 0.35 : dimmed ? 0.08 : 0.18;
      innerGlowMaterialRef.current.opacity = MathUtils.lerp(
        innerGlowMaterialRef.current.opacity,
        targetOp,
        0.15,
      );
    }
    if (fillMaterialRef.current) {
      const target = selected ? 0.92 : dimmed ? 0.35 : 0.78;
      fillMaterialRef.current.opacity = MathUtils.lerp(
        fillMaterialRef.current.opacity,
        target,
        0.15,
      );
    }
  });

  const borderWidth = width + BORDER_THICKNESS * 2;
  const borderHeight = height + BORDER_THICKNESS * 2;

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={0}>
      {/* Outer neon "backplate" — sticks out past the inner panel, full emissive */}
      <mesh ref={borderRef} position={[0, 0, -0.002]}>
        <boxGeometry args={[borderWidth, borderHeight, PANEL_DEPTH]} />
        <meshBasicMaterial
          ref={borderMaterialRef}
          color={accentColor}
          toneMapped={false}
        />
      </mesh>

      {/* Inner glow — slightly larger than fill, soft accent color */}
      <mesh position={[0, 0, PANEL_DEPTH / 2 + 0.001]}>
        <planeGeometry args={[width * 0.98, height * 0.94]} />
        <meshBasicMaterial
          ref={innerGlowMaterialRef}
          color={accentColor}
          transparent
          opacity={0.18}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Main dark fill panel — sits on top, hides border interior */}
      <mesh
        ref={meshRef}
        position={[0, 0, 0]}
        onClick={
          onClick
            ? (e) => {
                e.stopPropagation();
                onClick();
              }
            : undefined
        }
      >
        <boxGeometry args={[width, height, PANEL_DEPTH + 0.002]} />
        <meshBasicMaterial
          ref={fillMaterialRef}
          color="#06031a"
          transparent
          opacity={0.78}
          toneMapped={false}
        />
      </mesh>

      {/* Corner accent dots — bright on the front face */}
      {[
        [-width / 2 + 0.04, height / 2 - 0.04],
        [width / 2 - 0.04, height / 2 - 0.04],
        [-width / 2 + 0.04, -height / 2 + 0.04],
        [width / 2 - 0.04, -height / 2 + 0.04],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, PANEL_DEPTH / 2 + 0.005]}>
          <circleGeometry args={[0.018, 12]} />
          <meshBasicMaterial color={accentBright} toneMapped={false} />
        </mesh>
      ))}

      {/* Text */}
      <Text
        position={[0, 0, PANEL_DEPTH / 2 + 0.01]}
        fontSize={textSize}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={width * 0.88}
        textAlign="center"
        outlineWidth={0.003}
        outlineColor="#000000"
        outlineOpacity={0.8}
      >
        {text}
      </Text>
    </group>
  );
}