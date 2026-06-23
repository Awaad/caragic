import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { OpeningObject } from './objects/OpeningObject';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { PermissionPrompt } from '../components/PermissionPrompt';

export function Scene() {
  const { beta, gamma, permissionState, requestPermission } =
    useDeviceOrientation();

  return (
    <>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
        <Environment preset="city" />
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <OpeningObject tiltX={beta} tiltY={gamma} />
      </Canvas>

      {permissionState === 'prompt' && (
        <PermissionPrompt onAccept={requestPermission} />
      )}
    </>
  );
}