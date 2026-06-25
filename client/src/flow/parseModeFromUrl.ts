import type { Mode } from '../modes/types';

const VALID_MODES: Mode[] = ['dating', 'friendship', 'professional', 'mix'];

export function parseModeFromUrl(): Mode {
  if (typeof window === 'undefined') return 'dating';
  const params = new URLSearchParams(window.location.search);
  const m = params.get('mode');
  if (m && (VALID_MODES as string[]).includes(m)) {
    return m as Mode;
  }
  return 'dating';
}