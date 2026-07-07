// /**
//  * @deprecated Content now comes from the API via useContent().
//  * Kept temporarily for reference; remove once API wiring has been
//  * validated against all four modes. parseModeFromUrl still uses the
//  * Mode type from ./types, which is unrelated to this file.
//  */

// import type { ModeContent } from './types';

// const datingContent: ModeContent = {
//   mode: 'dating',
//   rounds: [
//     {
//       id: 'dating-1',
//       type: 'choice',
//       question: "what's worse: being misunderstood, or being seen too clearly?",
//       options: [
//         {
//           id: 'misunderstood',
//           label: 'being misunderstood',
//           revealText: "yeah? so you'd rather be a mystery than be known. that's safer, sure.",
//         },
//         {
//           id: 'seen',
//           label: 'being seen too clearly',
//           revealText: "the real ones pick this. though usually it's less about being seen and more about who you'd let look.",
//         },
//       ],
//     },
//     {
//       id: 'dating-2',
//       type: 'choice',
//       question: 'when something feels too good, do you lean in or get suspicious?',
//       options: [
//         {
//           id: 'lean-in',
//           label: 'lean in',
//           revealText: "you trust the moment. brave or naive — depends who's watching.",
//         },
//         {
//           id: 'suspicious',
//           label: 'get suspicious',
//           revealText: "right. because you've been the one holding the bag before. that doesn't go away, does it.",
//         },
//       ],
//     },
//     {
//       id: 'dating-3',
//       type: 'choice',
//       question: 'would you rather be wanted desperately, or chosen quietly?',
//       options: [
//         {
//           id: 'wanted',
//           label: 'wanted desperately',
//           revealText: "you want the proof. someone breaking themselves a little to have you. that's not wrong — it's just expensive.",
//         },
//         {
//           id: 'chosen',
//           label: 'chosen quietly',
//           revealText: "you've been wanted loudly before and it wasn't enough. quiet feels like it might be the real thing this time.",
//         },
//       ],
//     },
//     {
//       id: 'capture-dating',
//       type: 'capture',
//       prompt: "okay. you've been honest with me. your turn to let me find you.",
//       acceptLabel: 'leave your number',
//       declineLabel: 'not yet',
//       declineMessage: 'fair. you know where i am.',
//     },
//   ],
//   reveal: {
//     name: 'abdelrahman',
//     tagline: '', // you'll write this
//     links: [],   // you'll add these
//   },
// };

// const mixContent: ModeContent = {
//   mode: 'mix',
//   rounds: [
//     {
//       id: 'mix-1',
//       type: 'choice',
//       question: "are you more interesting when you're winning, or when you're losing?",
//       options: [
//         {
//           id: 'winning',
//           label: 'winning',
//           revealText: "yeah. you sharpen when things are clicking. that energy is contagious — when you're in it.",
//         },
//         {
//           id: 'losing',
//           label: 'losing',
//           revealText: "you become real when you're losing. that's rarer than it sounds, and harder to be around.",
//         },
//       ],
//     },
//     {
//       id: 'mix-2',
//       type: 'choice',
//       question: 'do people end up telling you their secrets, or do you end up telling them yours?',
//       options: [
//         {
//           id: 'theirs',
//           label: 'they tell me theirs',
//           revealText: "you're the room people empty into. don't pretend you don't notice the asymmetry.",
//         },
//         {
//           id: 'mine',
//           label: 'i tell them mine',
//           revealText: "you spill first to make it safe. it works. it also means you're often the one who knows yourself less by the end.",
//         },
//       ],
//     },
//     {
//       id: 'mix-3',
//       type: 'choice',
//       question: 'what do you want more of, intensity or peace?',
//       options: [
//         {
//           id: 'intensity',
//           label: 'intensity',
//           revealText: "you'll burn through peace looking for the next thing. you know this about yourself.",
//         },
//         {
//           id: 'peace',
//           label: 'peace',
//           revealText: "you're tired. that's not a flaw — it's a season. don't let anyone hand you intensity dressed up as connection.",
//         },
//       ],
//     },
//     {
//       id: 'capture-mix',
//       type: 'capture',
//       prompt: 'you read the room well. whether this becomes something — or nothing — depends on what you do next.',
//       acceptLabel: 'leave your number',
//       declineLabel: 'maybe another time',
//       declineMessage: 'okay. friends, then. you know where i am.',
//     },
//   ],
//   reveal: {
//     name: 'abdelrahman',
//     tagline: '',
//     links: [],
//   },
// };

// const friendshipContent: ModeContent = {
//   mode: 'friendship',
//   rounds: [
//     {
//       id: 'friendship-1',
//       type: 'choice',
//       question: 'are you the friend who plans everything, or the one who shows up to whatever?',
//       options: [
//         {
//           id: 'planner',
//           label: 'plans everything',
//           revealText: "you're the reason your group still hangs out. they'd be on three different couches without you.",
//         },
//         {
//           id: 'shows-up',
//           label: 'shows up to whatever',
//           revealText: "you make the planners feel useful. that's its own kind of work. also you're more spontaneous than your friends give you credit for.",
//         },
//       ],
//     },
//     {
//       id: 'friendship-2',
//       type: 'choice',
//       question: 'in a group, are you the one keeping things light, or the one asking the real question?',
//       options: [
//         {
//           id: 'light',
//           label: 'keeping it light',
//           revealText: "you read the room and adjust. that's not avoidance — that's care. though you probably wish someone asked you the real question sometimes.",
//         },
//         {
//           id: 'real',
//           label: 'asking the real question',
//           revealText: "you can't help it. people either love this about you or find it exhausting — there's no middle ground, and you've made peace with that.",
//         },
//       ],
//     },
//     {
//       id: 'friendship-3',
//       type: 'choice',
//       question: 'would you rather have one friend who really gets you, or three who you can call about anything?',
//       options: [
//         {
//           id: 'one-deep',
//           label: 'one who gets me',
//           revealText: "you'd rather be deeply understood than widely available. that's harder to find but worth holding out for.",
//         },
//         {
//           id: 'three-wide',
//           label: 'three to call',
//           revealText: "you've figured out that one person can't be everything. spread the weight. that's wisdom most people learn the hard way.",
//         },
//       ],
//     },
//     {
//       id: 'capture-friendship',
//       type: 'capture',
//       prompt: 'if you ever want to actually do this — the asking real questions, the showing up — leave your number.',
//       acceptLabel: 'leave your number',
//       declineLabel: 'maybe later',
//       declineMessage: "no pressure. people who'd vibe with you are rarer than they should be.",
//     },
//   ],
//   reveal: {
//     name: 'abdelrahman',
//     tagline: '',
//     links: [],
//   },
// };

// const professionalContent: ModeContent = {
//   mode: 'professional',
//   rounds: [
//     {
//       id: 'professional-1',
//       type: 'choice',
//       question: "when a project's in trouble, do you focus on what's broken or on what's still working?",
//       options: [
//         {
//           id: 'broken',
//           label: "what's broken",
//           revealText: "you go to the wound. it's the right instinct under deadline — but the people working on what's still working don't always feel seen.",
//         },
//         {
//           id: 'working',
//           label: "what's still working",
//           revealText: 'you stabilize first. saves projects from death spirals. but sometimes the broken thing needed to break, and protecting it costs more than letting it fail.',
//         },
//       ],
//     },
//     {
//       id: 'professional-2',
//       type: 'choice',
//       question: 'when you disagree with a decision, do you push hard or wait and see?',
//       options: [
//         {
//           id: 'push',
//           label: 'push hard',
//           revealText: "you'd rather lose the argument than not have it. people respect this — even the ones who roll their eyes.",
//         },
//         {
//           id: 'wait',
//           label: 'wait and see',
//           revealText: "you're playing a longer game. it works, until the thing you waited on becomes the thing you have to live with.",
//         },
//       ],
//     },
//     {
//       id: 'professional-3',
//       type: 'choice',
//       question: 'what does a good day at work actually feel like — momentum, or mastery?',
//       options: [
//         {
//           id: 'momentum',
//           label: 'momentum',
//           revealText: "you need things to be moving. you'd rather ship imperfect and iterate than perfect in a vacuum. fast companies need this; slow ones break you.",
//         },
//         {
//           id: 'mastery',
//           label: 'mastery',
//           revealText: "you want the thing to be good, not just done. that's increasingly rare. it also means you need to choose where you work very carefully — most places don't have time for your standard.",
//         },
//       ],
//     },
//     {
//       id: 'capture-professional',
//       type: 'capture',
//       prompt: 'if any of that landed — if you want to keep this conversation going past today — drop your number.',
//       acceptLabel: 'drop your number',
//       declineLabel: 'not now',
//       declineMessage: "understood. the card stays. you've got it if you need it.",
//     },
//   ],
//   reveal: {
//     name: 'abdelrahman',
//     tagline: '',
//     links: [],
//   },
// };

// export function getContentForMode(mode: string): ModeContent {
//   switch (mode) {
//     case 'dating':
//       return datingContent;
//     case 'friendship':
//       return friendshipContent;
//     case 'professional':
//       return professionalContent;
//     case 'mix':
//       return mixContent;
//     default:
//       return friendshipContent;
//   }
// }