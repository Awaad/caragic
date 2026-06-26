import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { MathUtils, type Group, type Mesh, type Vector3 } from 'three';

interface ShardLabelProps {
  shardPosition: Vector3;
  label: string;
  visible: boolean;
}

export function ShardLabel({ shardPosition, label, visible }: ShardLabelProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    // Track shard position, offset slightly below
    group.position.x = shardPosition.x;
    group.position.y = shardPosition.y - 0.25;
    group.position.z = shardPosition.z;

    const targetScale = visible ? 1 : 0;
    group.scale.setScalar(MathUtils.lerp(group.scale.x, targetScale, 0.15));
    group.visible = group.scale.x > 0.01;
  });

  return (
    <group ref={groupRef} scale={0}>
      <mesh ref={meshRef}>
        <planeGeometry args={[0.6, 0.18]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.07}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.55}
        outlineWidth={0.003}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
}