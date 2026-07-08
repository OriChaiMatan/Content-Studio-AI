// Copy/data constants ported from the approved Claude Design handoff
// (`design/lumai-landing-page-design 2/project/LumAI Landing Page.dc.html`).
// Single source of truth for the landing page's generative visuals.

export const SOURCE_DEFS = [
  { name: 'Reuters', x: '4%', y: '10%' },
  { name: 'Gartner.pdf', x: '2%', y: '38%' },
  { name: 'OpenAI Blog', x: '6%', y: '64%' },
  { name: 'Bloomberg', x: '30%', y: '4%' },
  { name: 'Cloudflare', x: '28%', y: '78%' },
];

export const OUTPUT_DEFS = [
  { name: 'LinkedIn', x: '76%', y: '10%' },
  { name: 'Facebook', x: '84%', y: '36%' },
  { name: 'Newsletter', x: '78%', y: '60%' },
  { name: 'Podcast', x: '84%', y: '84%' },
];

export const EVIDENCE_DEFS = [
  { text: 'PATTERN', x: '38%', y: '20%' },
  { text: 'TENSION', x: '58%', y: '24%' },
  { text: 'GAP', x: '40%', y: '70%' },
  { text: 'INSIGHT', x: '58%', y: '74%' },
];

export const THESIS_TEXT = '"The real shift is not more content. It is clearer thinking from the same research."';

export const THINK_SOURCE_DEFS = [
  { name: 'Reuters', type: 'Wire', mono: 'R', accent: '#FF8000', left: 10, top: 16, floatDur: '3.2s' },
  { name: 'Bloomberg', type: 'Wire', mono: 'B', accent: '#8892A6', left: 78, top: 10, floatDur: '4.1s' },
  { name: 'Gartner PDF', type: 'Research Report', mono: 'G', accent: '#4D82E8', left: 5, top: 55, floatDur: '3.7s' },
  { name: 'OpenAI Blog', type: 'Blog', mono: 'AI', accent: '#3FCFA0', left: 85, top: 50, floatDur: '4.4s' },
  { name: 'Cloudflare', type: 'Network', mono: '☁', accent: '#F6821F', left: 16, top: 82, floatDur: '3.5s' },
  { name: 'YouTube', type: 'Video', mono: '▶', accent: '#FF4D4D', left: 70, top: 80, floatDur: '4.8s' },
  { name: 'GitHub', type: 'Repo', mono: '</>', accent: '#B18CFF', left: 42, top: 8, floatDur: '3.9s' },
  { name: 'Research Papers', type: 'PDF', mono: 'R', accent: '#7C8BA6', left: 55, top: 88, floatDur: '4.6s' },
];

export const THINK_SIGNAL_DEFS = ['Searching contradictions...', 'Finding patterns...', 'Comparing evidence...', 'Building thesis...'];

export const THINK_OUTPUT_DEFS = [
  { icon: '💼', name: 'LinkedIn' },
  { icon: '👥', name: 'Facebook' },
  { icon: '✉️', name: 'Newsletter' },
  { icon: '🎙️', name: 'Podcast Script' },
];

export type ReasonSource = {
  name: string; mono: string; kind: string; tag: string; accent: string;
  survive: boolean; reject: string | null;
  base: { left: number; top: number }; ring: { left: number; top: number } | null;
  floatDur: string; caution?: string; cautionAt?: number;
};

export const REASON_SOURCES: ReasonSource[] = [
  { name: 'Reuters', mono: 'R', kind: 'Newswire', tag: 'Breaking News', accent: '#FF8000', survive: true, reject: null, base: { left: 6, top: 10 }, ring: { left: 22, top: 20 }, floatDur: '5.2s' },
  { name: 'Bloomberg', mono: 'B', kind: 'Financial News', tag: 'Markets', accent: '#8892A6', survive: true, reject: null, base: { left: 68, top: 6 }, ring: { left: 74, top: 22 }, floatDur: '6.1s', caution: 'Needs Verification', cautionAt: 0.35 },
  { name: 'OpenAI', mono: 'AI', kind: 'Research Lab', tag: 'Frontier AI', accent: '#3FCFA0', survive: true, reject: null, base: { left: 38, top: 4 }, ring: { left: 26, top: 64 }, floatDur: '5.7s' },
  { name: 'Cloudflare', mono: 'CF', kind: 'Technical Blog', tag: 'Infrastructure', accent: '#F6821F', survive: false, reject: 'Vendor Claim', base: { left: 4, top: 42 }, ring: null, floatDur: '5.4s' },
  { name: 'GitHub', mono: 'GH', kind: 'Repository', tag: 'Open Source', accent: '#B18CFF', survive: false, reject: 'Duplicate', base: { left: 82, top: 36 }, ring: null, floatDur: '5.9s' },
  { name: 'Research Paper', mono: 'RP', kind: 'Academic · Nature', tag: 'Peer Reviewed', accent: '#7C8BA6', survive: true, reject: null, base: { left: 14, top: 70 }, ring: { left: 70, top: 66 }, floatDur: '6.4s' },
  { name: 'YouTube', mono: 'YT', kind: 'Conference Talk', tag: 'Video', accent: '#FF4D4D', survive: false, reject: 'Opinion', base: { left: 58, top: 72 }, ring: null, floatDur: '5.6s' },
  { name: 'Gartner', mono: 'G', kind: 'Analyst Report', tag: 'Market Research', accent: '#4D82E8', survive: true, reject: null, base: { left: 90, top: 64 }, ring: { left: 50, top: 16 }, floatDur: '6.6s', caution: 'Conflicting Claim', cautionAt: 0.6 },
  { name: 'TechCrunch', mono: 'TC', kind: 'Tech News', tag: 'Commentary', accent: '#3FB950', survive: false, reject: 'Opinion', base: { left: 30, top: 88 }, ring: null, floatDur: '6.2s' },
  { name: 'McKinsey', mono: 'M', kind: 'Consulting Report', tag: 'Strategy', accent: '#0B4F9C', survive: false, reject: 'Vendor Claim', base: { left: 74, top: 86 }, ring: null, floatDur: '5.8s' },
  { name: 'Forrester', mono: 'F', kind: 'Analyst Report', tag: 'Market Research', accent: '#5B4EE0', survive: false, reject: 'Duplicate', base: { left: 4, top: 84 }, ring: null, floatDur: '6.3s' },
  { name: 'Wikipedia', mono: 'W', kind: 'Reference', tag: 'General', accent: '#8892A6', survive: false, reject: 'Weak Evidence', base: { left: 92, top: 10 }, ring: null, floatDur: '5.5s' },
  { name: 'Reddit Thread', mono: 'r/', kind: 'Forum', tag: 'Anecdotal', accent: '#FF6B4A', survive: false, reject: 'Opinion', base: { left: 20, top: 30 }, ring: null, floatDur: '5.9s' },
  { name: 'MIT Review', mono: 'MR', kind: 'Academic', tag: 'Peer Reviewed', accent: '#7C8BA6', survive: true, reject: null, base: { left: 48, top: 88 }, ring: { left: 50, top: 82 }, floatDur: '6.5s' },
  { name: 'Product Hunt', mono: 'PH', kind: 'Community', tag: 'Launch Buzz', accent: '#DA552F', survive: false, reject: 'Low Confidence', base: { left: 62, top: 20 }, ring: null, floatDur: '5.3s' },
  { name: 'Newsletter', mono: 'NL', kind: 'Independent', tag: 'Opinion', accent: '#4D82E8', survive: false, reject: 'Opinion', base: { left: 8, top: 58 }, ring: null, floatDur: '6.0s' },
  { name: 'Crunchbase', mono: 'CB', kind: 'Data Provider', tag: 'Company Data', accent: '#0288D1', survive: false, reject: 'Outdated', base: { left: 86, top: 50 }, ring: null, floatDur: '5.7s' },
  { name: 'IEEE Paper', mono: 'IE', kind: 'Academic', tag: 'Peer Reviewed', accent: '#7C8BA6', survive: false, reject: 'Duplicate', base: { left: 42, top: 48 }, ring: null, floatDur: '6.1s' },
];

export const REASON_CONNECTIONS = [
  { from: 'Reuters', to: 'CENTER', label: 'Supports', color: '#4D82E8' },
  { from: 'Bloomberg', to: 'CENTER', label: 'Consensus', color: '#3FCFA0' },
  { from: 'OpenAI', to: 'CENTER', label: 'Emerging Pattern', color: '#F5C242' },
  { from: 'Research Paper', to: 'CENTER', label: 'Contradicts', color: '#FF6B6B' },
];

export const REASON_CAPTIONS = ['Comparing claims…', 'Evaluating evidence…', 'Cross-referencing…', 'Checking confidence…', 'Finding consensus…'];
export const SYNTHESIS_CENTER = { left: 50, top: 44 };

export const CAPTURE_CENTER = { left: 50, top: 50 };
export const CAPTURE_ORIGINS = [
  { key: 'app', label: 'LumAI App', pos: { left: 50, top: 7 }, accent: '#4D82E8', items: ['Research Report', 'Gartner Report'] },
  { key: 'ext', label: 'Chrome Extension', pos: { left: 87.5, top: 50 }, accent: '#8A97AD', items: ['Reuters Article', 'Cloudflare Blog'] },
  { key: 'tg', label: 'Telegram', pos: { left: 50, top: 93 }, accent: '#4D82E8', items: ['AI News', 'Whitepaper PDF'] },
  { key: 'wa', label: 'WhatsApp', pos: { left: 12.5, top: 50 }, accent: '#3FCFA0', items: ['URL', 'Market Analysis'] },
];
export const CAPTURE_CYCLE_MS = 1400;
export const CAPTURE_STATUS_TIERS = [
  { min: 0, text: 'Collecting Knowledge…' },
  { min: 4, text: 'Preparing Analysis…' },
  { min: 7, text: 'Ready for Synthesis' },
];

export const REASON_INSIGHT_WORDS = 'The future of AI depends on preserving the economics of original knowledge.'.split(' ');

export const REASON_OUTCOMES = [
  { name: 'LinkedIn Post', mono: 'in', accent: '#0A66C2', preview: "AI didn't just change search. It changed who pays for knowledge." },
  { name: 'Newsletter', mono: '✉', accent: '#4D82E8', preview: "This week's biggest takeaway: the real bottleneck in AI isn't models." },
  { name: 'Podcast Script', mono: '🎙', accent: '#3FCFA0', preview: 'Intro: everyone talks about intelligence. The real story is discernment.' },
  { name: 'Facebook Post', mono: 'f', accent: '#1877F2', preview: 'Most people miss the real story behind AI — the pattern across 9 sources.' },
];

export const REASON_STAGE_COPY = ['Collecting evidence', 'Removing noise', 'Finding patterns', 'Discovering the insight', 'One insight. Multiple outcomes'];

export const PROBLEM_SOURCE_POS = [
  { left: 4, top: 12 }, { left: 74, top: 8 }, { left: 2, top: 58 }, { left: 80, top: 55 },
  { left: 14, top: 84 }, { left: 66, top: 82 }, { left: 40, top: 4 }, { left: 88, top: 70 },
];

export const PROBLEM_SIGNAL_DEFS = [
  { text: 'Contradiction detected', left: 30, top: 20, delay: '0s' },
  { text: 'Supporting evidence', left: 62, top: 30, delay: '0.3s' },
  { text: 'Weak assumption', left: 18, top: 50, delay: '0.6s' },
  { text: 'Consensus forming', left: 55, top: 62, delay: '0.9s' },
  { text: 'Outlier found', left: 36, top: 78, delay: '1.2s' },
  { text: 'Emerging pattern', left: 68, top: 12, delay: '1.5s' },
];

export const FAQ_DEFS = [
  { q: 'Is LumAI just another AI writing tool?', a: 'No. LumAI does not start from a blank prompt. It starts from your sources and builds a thesis from them. The output is not generic because the analysis is not generic — it is grounded in your specific research.' },
  { q: 'How is it different from ChatGPT?', a: "ChatGPT generates text from a prompt. LumAI reasons across your sources. ChatGPT doesn't know what your research says — it generates plausible-sounding content regardless. LumAI produces outputs specifically and defensibly grounded in the sources you provide." },
  { q: 'Can I generate podcast episodes?', a: 'Yes. LumAI generates a complete single-narrator episode from your sources: research pack, thesis formation, full script, research notes, and an episode reading view with chapter navigation.' },
  { q: 'Does LumAI create audio files?', a: 'Not yet. LumAI creates the episode script and research notes. The script is written to professional narration standards. Audio synthesis is planned for a future release.' },
  { q: 'Does LumAI support Hebrew?', a: 'Yes. Hebrew-language sources and outputs are fully supported, including right-to-left formatting. This is a core capability.' },
  { q: 'What sources can I add?', a: 'Web pages, articles, PDFs, reports, and raw URLs. The more diverse and independent your sources, the deeper the analysis.' },
  { q: 'How long does generation take?', a: 'Research runs take 2–4 minutes. Podcast episodes take 5–10 minutes depending on source depth. Progress is visible throughout.' },
  { q: 'Is there a free plan?', a: 'Yes. Start free without a credit card — full thinking engine access, LinkedIn, Facebook, Newsletter and Podcast outputs.' },
];

export const USE_CASE_DEFS = [
  { icon: '🛡', title: 'Cybersecurity commentary', body: 'A breach happens. You have 12 articles. LumAI finds the analytical angle, not just what happened.' },
  { icon: '📊', title: 'Market analysis', body: 'Earnings calls, analyst notes, quarterly reports — synthesized into the thesis the data actually supports.' },
  { icon: '👤', title: 'Executive thought leadership', body: 'Your opinions, your reading, given structure that builds authority rather than just presence.' },
  { icon: '📣', title: 'Product marketing', body: 'Competitive intelligence turned into content that argues why the category is moving your way.' },
  { icon: '✉️', title: 'Newsletter creation', body: 'From research dump to fully-argued issue, every week, without the four-hour synthesis session.' },
  { icon: '🎙️', title: 'Podcast scripting', body: 'From topic to complete episode with thesis, structure and research notes. Without a production team.' },
  { icon: '↗', title: 'Research-driven social', body: 'Academic papers and reports turned into LinkedIn posts that make the argument, not just cite the finding.' },
  { icon: '📈', title: 'Analyst briefings', body: 'Dense source material transformed into structured arguments for stakeholder communication.' },
];

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
export const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
