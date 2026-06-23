import { useEffect, useState, useCallback } from 'react';
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

  // Attach the orientation listener. Returns a cleanup function.
  const attachListener = useCallback(() => {
    const handler = (event: DeviceOrientationEvent) => {
      setOrientation({
        beta: event.beta ?? 0,
        gamma: event.gamma ?? 0,
      });
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  // On mount: detect whether we need explicit permission (iOS 13+).
  useEffect(() => {
    const DOE = getDeviceOrientationEventClass();

    if (!DOE) {
      // SSR or environment without orientation API
      setPermissionState('denied');
      return;
    }

    const needsPermission = typeof DOE.requestPermission === 'function';

    if (needsPermission) {
      // iOS — wait for a user gesture to call requestPermission()
      setPermissionState('prompt');
      return;
    }

    // Android / desktop — attach immediately
    const cleanup = attachListener();
    setPermissionState('granted');
    return cleanup;
  }, [attachListener]);

  // Called by the PermissionPrompt button on iOS.
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