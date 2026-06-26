import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { OpeningObject } from './objects/OpeningObject';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { PermissionPrompt } from '../components/PermissionPrompt';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { NebulaBackdrop } from './shaders/nebula/NebulaBackdrop';
import { Fragments } from './objects/Fragments';
import { WarpCamera } from './transitions/WarpCamera';
import { BurstFlash } from './transitions/BurstFlash';
import { WarpVolume } from './transitions/WarpVolume';
import { WarpStars } from './transitions/WarpStars';
import { Companion } from './objects/Companion';
import { CaptureForm3D } from './ui/CaptureForm3D';
import { Reveal3D } from './ui/Reveal3D';
import { RoundPanel } from './ui/RoundPanel';


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
        <WarpCamera />
        <NebulaBackdrop />

        <WarpStars />
        <WarpVolume />
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
        <ambientLight intensity={0.2} />
        <directionalLight position={[4, 6, 3]} intensity={3} color="#ffffff" />
        <pointLight 
            position={[3, 2, 4]} 
            intensity={2.5} 
            color="#ffffff" 
            distance={8}
        />
        <OpeningObject tiltX={beta} tiltY={gamma} />
        <Companion />
        <RoundPanel />
        <CaptureForm3D />
        <Reveal3D />
        <Fragments />
        <BurstFlash />
        
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