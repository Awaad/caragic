import { useMemo } from 'react';
import { useFlow } from './useFlow';
import { getContentForMode } from '../modes/content';
import type { ShardState } from '../modes/types';

const TOTAL_SHARDS = 6;
const INVITATION_SHARD_INDEX = 0;

interface UseRoundShardsResult {
  shards: ShardState[];
  activeCount: number;
}

/**
 * Given the current flow state, computes the role of each shard.
 * Active shards are wired to round options; ambient shards are decorative.
 *
 * Round vs phase logic:
 *  - opening/cracking/shattering/warping: all shards 'idle'
 *  - round (choice type): N active shards (matching options), rest ambient
 *  - capturing/reveal: all shards 'ambient' (companion present but not interactive)
 *  - closed: all 'idle'
 */
export function useRoundShards(
  selectedOptionId: string | null,
): UseRoundShardsResult {
  const { mode, phase, roundIndex, roundStarted } = useFlow();

  return useMemo(() => {
    const content = getContentForMode(mode);
    const currentRound = content.rounds[roundIndex];

    const shards: ShardState[] = Array.from({ length: TOTAL_SHARDS }, () => ({
      role: 'idle',
    }));

    if (phase === 'capturing' || phase === 'reveal') {
      for (const s of shards) s.role = 'ambient';
      return { shards, activeCount: 0 };
    }

    if (phase !== 'round' || !currentRound) {
      return { shards, activeCount: 0 };
    }

    // Round phase but not started yet — show the invitation shard
    if (!roundStarted) {
      shards[INVITATION_SHARD_INDEX] = { role: 'invitation' };
      // Other shards remain idle (orbiting in background)
      return { shards, activeCount: 0 };
    }

    // Round started — only show choice shards
    if (currentRound.type !== 'choice') {
      return { shards, activeCount: 0 };
    }

    const options = currentRound.options;
    const activeCount = options.length;

    for (let i = 0; i < shards.length; i++) {
      if (i < activeCount) {
        const option = options[i];
        shards[i] = {
          role: 'active',
          optionId: option.id,
          isSelected: selectedOptionId === option.id,
          isDimmed:
            selectedOptionId !== null && selectedOptionId !== option.id,
        };
      } else {
        shards[i] = { role: 'ambient' };
      }
    }

    return { shards, activeCount };
  }, [mode, phase, roundIndex, selectedOptionId, roundStarted]);
}