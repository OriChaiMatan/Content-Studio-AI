// Content/timeline constants ported from InteractiveProductDemo.dc.html.

export const ITEMS6 = [
  { name: 'Reuters article', type: 'URL', accent: '#FF8000', mono: 'R' },
  { name: 'OpenAI blog', type: 'Article', accent: '#3FCFA0', mono: 'AI' },
  { name: 'Gartner report', type: 'Report', accent: '#4D82E8', mono: 'G' },
  { name: 'PDF research paper', type: 'PDF', accent: '#B18CFF', mono: 'PDF' },
  { name: 'WhatsApp note', type: 'Note', accent: '#25D366', mono: 'W' },
  { name: 'Chrome-saved page', type: 'Saved page', accent: '#8892A6', mono: 'C' },
];

export const ROW_TOPS = [16, 32, 48, 64, 80, 96].map((v) => 6 + v * 0.86);

export const STEPS5 = [
  { label: 'Reading sources', detail: 'Scanning every source for claims and evidence.' },
  { label: 'Filtering noise', detail: 'Removing opinion, duplicates and weak claims.' },
  { label: 'Finding conflicts', detail: 'Surfacing where sources disagree.' },
  { label: 'Identifying patterns', detail: 'Connecting recurring signals across sources.' },
  { label: 'Building thesis', detail: 'Forming one clear point of view.' },
];

export const DEMO_THESIS_TEXT = 'The future of AI depends on preserving the economics of original knowledge.';

export const OUTPUTS4 = [
  { name: 'LinkedIn', mono: 'in', accent: '#0A66C2', preview: "AI didn't just change search. It changed who pays for knowledge." },
  { name: 'Facebook', mono: 'f', accent: '#1877F2', preview: 'Most people miss the real story behind AI.' },
  { name: 'Newsletter', mono: '✉', accent: '#4D82E8', preview: "This week's biggest takeaway on AI economics." },
  { name: 'Podcast', mono: '🎙', accent: '#3FCFA0', preview: 'Intro: everyone talks about intelligence.' },
];

// Early cinematic scenes (Collect/Organize/Analyze/Thesis/Outputs) were paced
// too fast for the viewer to read before cutting to the next scene, so each
// got +1.5-2.5s of dwell time (durations: 4.0->5.5, 3.5->5.5, 5.0->7.5,
// 4.0->6.0, 3.5->5.0). Product UI scenes (Pipeline/Review/Image Gen/Library)
// keep their original durations — only their start times shift later to
// follow the extended early scenes.
// Collect's internal chip motion (arrival, hold, travel) needed more room to
// read as deliberate rather than rushed, so its own duration grew by another
// 1.5s (5.5->7.0s). Every later scene keeps its exact original duration —
// only their start times shift later by that same 1.5s.
export const DEMO_TIMELINE = {
  s1: [0, 7000], s2: [7000, 12500], s3: [12500, 20000], s4: [20000, 26000],
  s5: [26000, 31000], s6: [31000, 40500], s7: [40500, 48000], s8: [48000, 57500],
  s9: [57500, 61500], final: [61500, Infinity],
} as const;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
export const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
// Gentle accelerate-then-decelerate curve — used for the Collect scene's
// source-chip travel so it reads as a deliberate arrival rather than a snap
// (easeOutExpo is nearly all-deceleration: fast out of the gate, hard stop).
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const sceneCut = (t: number, start: number, end: number) => (t >= start && t < end ? 1 : 0);
