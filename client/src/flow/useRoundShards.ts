import { useMemo } from 'react';
import { useFlow } from './useFlow';
import type { ShardState } from '../modes/types';

const TOTAL_SHARDS = 7;

export function useRoundShards(): { shards: ShardState[] } {
  const { phase, hasWarpedBefore } = useFlow();

  return useMemo(() => {
    const shards: ShardState[] = Array.from({ length: TOTAL_SHARDS }, () => ({
      role: hasWarpedBefore && (phase === 'round' || phase === 'capturing' || phase === 'reveal' || phase === 'warping')
        ? 'ambient'
        : 'idle',
    }));
    return { shards };
  }, [phase, hasWarpedBefore]);
}