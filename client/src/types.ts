// ------------------------------------------------------------
// 1. HOOK TYPES
// ------------------------------------------------------------
export type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied';

export interface OrientationData {
  beta: number;
  gamma: number;
}

export interface UseDeviceOrientationReturn extends OrientationData {
  permissionState: PermissionState;
  requestPermission: () => Promise<void>;
}

// ------------------------------------------------------------
// 2. COMPONENT PROPS
// ------------------------------------------------------------
export interface OpeningObjectProps {
  tiltX: number;
  tiltY: number;
}

export interface PermissionPromptProps {
  onAccept: () => void;
}

// ------------------------------------------------------------
// 3. iOS DeviceOrientationEvent helper
// ------------------------------------------------------------
// iOS 13+ adds a static requestPermission() to DeviceOrientationEvent
// that lib.dom.d.ts doesn't know about. We type it locally rather than
// trying to merge with the global (which TS doesn't allow for `var` decls).
type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export function getDeviceOrientationEventClass():
  | DeviceOrientationEventWithPermission
  | undefined {
  if (typeof DeviceOrientationEvent === 'undefined') return undefined;
  return DeviceOrientationEvent as DeviceOrientationEventWithPermission;
}