import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  OrientationData,
  PermissionState,
  UseDeviceOrientationReturn,
} from '../types';
import { getDeviceOrientationEventClass } from '../types';

export function useDeviceOrientation(): UseDeviceOrientationReturn {
  const [orientation, setOrientation] = useState<OrientationData>({
    beta: 0,
    gamma: 0,
  });
  const [permissionState, setPermissionState] =
    useState<PermissionState>('unknown');

  // Capture the first reading as the "neutral" position
  const referenceRef = useRef<{ beta: number; gamma: number } | null>(null);

  const attachListener = useCallback(() => {
    const handler = (event: DeviceOrientationEvent) => {
      const rawBeta = event.beta ?? 0;
      const rawGamma = event.gamma ?? 0;

      // First reading becomes the reference point
      if (referenceRef.current === null) {
        referenceRef.current = { beta: rawBeta, gamma: rawGamma };
      }

      // Report deltas from the reference, clamped to a reasonable range
      const deltaBeta = clamp(rawBeta - referenceRef.current.beta, -45, 45);
      const deltaGamma = clamp(rawGamma - referenceRef.current.gamma, -45, 45);

      setOrientation({ beta: deltaBeta, gamma: deltaGamma });
    };

    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  useEffect(() => {
    const DOE = getDeviceOrientationEventClass();
    if (!DOE) {
      setPermissionState('denied');
      return;
    }

    const needsPermission = typeof DOE.requestPermission === 'function';
    if (needsPermission) {
      setPermissionState('prompt');
      return;
    }

    const cleanup = attachListener();
    setPermissionState('granted');
    return cleanup;
  }, [attachListener]);

  const requestPermission = useCallback(async () => {
    const DOE = getDeviceOrientationEventClass();
    if (!DOE?.requestPermission) {
      setPermissionState('denied');
      return;
    }
    try {
      const result = await DOE.requestPermission();
      if (result === 'granted') {
        attachListener();
        setPermissionState('granted');
      } else {
        setPermissionState('denied');
      }
    } catch {
      setPermissionState('denied');
    }
  }, [attachListener]);

  return {
    beta: orientation.beta,
    gamma: orientation.gamma,
    permissionState,
    requestPermission,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}