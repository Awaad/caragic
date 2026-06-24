import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer, Stars, Sparkles } from '@react-three/drei';
import { OpeningObject } from './objects/OpeningObject';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { PermissionPrompt } from '../components/PermissionPrompt';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

export function Scene() {
  const { beta, gamma, permissionState, requestPermission } =
    useDeviceOrientation();

  return (
    <>
      <Canvas 
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]} // cap pixel ratio — saves perf on retina
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
        >
        <ResponsiveCamera />
        <Environment background={false} resolution={256}>
            <Lightformer
                intensity={2}
                position={[5, 5, 5]}
                scale={[3, 3, 1]}
                color="#ffffff"
            />
            <Lightformer
                intensity={1.5}
                position={[-5, 3, -5]}
                scale={[3, 3, 1]}
                color="#88aaff"
            />
            <Lightformer
                intensity={1}
                position={[0, -5, 3]}
                scale={[5, 1, 1]}
                color="#ff88aa"
            />
        </Environment>
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <pointLight 
            position={[-5, -3, -5]} 
            intensity={0.4} 
            color="#7a9eff" 
        />
        <Stars
            radius={50}
            depth={50}
            count={3000}
            factor={4}
            saturation={0}
            fade
            speed={0.5}
            />

            <Sparkles
            count={40}
            scale={6}
            size={3}
            speed={0.3}
            color="#88aaff"
            opacity={0.6}
        />
        <OpeningObject tiltX={beta} tiltY={gamma} />
        <EffectComposer>
            <Bloom
                intensity={1.4}
                luminanceThreshold={0.6}
                luminanceSmoothing={0.9}
                mipmapBlur
            />
        </EffectComposer>
      </Canvas>

      {permissionState === 'prompt' && (
        <PermissionPrompt onAccept={requestPermission} />
      )}
    </>
  );
}


import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    // Pull the camera back on narrow viewports so the gem feels right
    const aspect = size.width / size.height;
    const distance = aspect < 1 ? 6 : 5;
    camera.position.z = distance;
    camera.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}