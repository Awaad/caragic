import type { Mode, ModeContent } from '../modes/types';


// ModeContent and Round are already typed in client/src/modes/types.ts;
// we re-export so api consumers don't need to know they live there.
export type { Mode, ModeContent };

// Backend returns rounds keyed by slug. The shape is otherwise compatible
// with the existing ModeContent type, slug becomes Round.id, no client
// remapping needed.

export type ContentResponse = ModeContent;