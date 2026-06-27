import { useThree } from '@react-three/fiber';

/**
 * Returns a scale factor for 3D UI panels based on viewport aspect.
 * Portrait phones get a smaller scale so panels don't overflow horizontally.
 */
export function useResponsiveScale(): number {
  const { size } = useThree();
  const aspect = size.width / size.height;

  // Portrait: aspect < 1. Scale down progressively as viewport gets narrower.
  if (aspect < 0.5) return 0.55;
  if (aspect < 0.7) return 0.7;
  if (aspect < 1) return 0.85;
  return 1;
}