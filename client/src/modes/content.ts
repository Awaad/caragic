import type { ModeContent, Mode } from './types';

// Placeholder content. Real questions go here later.
// Keep the IDs stable — they become referenced from analytics and admin.
const datingContent: ModeContent = {
  mode: 'dating',
  rounds: [
    {
      type: 'choice',
      id: 'd1',
      question: 'Placeholder question one — replace me',
      options: [
        { id: 'a', label: 'Option A', revealText: 'Reveal text for A' },
        { id: 'b', label: 'Option B', revealText: 'Reveal text for B' },
      ],
    },
    {
      type: 'choice',
      id: 'd2',
      question: 'Placeholder question two — replace me',
      options: [
        { id: 'a', label: 'Option A', revealText: 'Reveal text for A' },
        { id: 'b', label: 'Option B', revealText: 'Reveal text for B' },
        { id: 'c', label: 'Option C', revealText: 'Reveal text for C' },
      ],
    },
    {
      type: 'capture',
      id: 'd3',
      prompt: 'Last one — would you rather:',
      declineLabel: 'Wonder how this would have gone',
      acceptLabel: 'Find out — drop your number',
      declineMessage: 'Fair. Have a good one.',
    },
  ],
  reveal: {
    name: 'Your Name',
    tagline: 'Glad you tapped that card.',
    links: [],
  },
};

const friendshipContent: ModeContent = {
  mode: 'friendship',
  rounds: [
    {
      type: 'choice',
      id: 'f1',
      question: 'Friendship placeholder',
      options: [
        { id: 'a', label: 'Option A', revealText: 'Reveal A' },
        { id: 'b', label: 'Option B', revealText: 'Reveal B' },
      ],
    },
  ],
  reveal: {
    name: 'Your Name',
    tagline: 'Nice to meet you.',
    links: [],
  },
};

const professionalContent: ModeContent = {
  mode: 'professional',
  rounds: [],
  reveal: {
    name: 'Your Name',
    tagline: 'Senior engineer.',
    links: [],
  },
};

const mixContent: ModeContent = {
  ...datingContent,
  mode: 'mix',
};

const allContent: Record<Mode, ModeContent> = {
  dating: datingContent,
  friendship: friendshipContent,
  professional: professionalContent,
  mix: mixContent,
};

export function getContentForMode(mode: Mode): ModeContent {
  return allContent[mode];
}