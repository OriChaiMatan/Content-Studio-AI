// Intent-only validation (no image gen — OpenAI billing-blocked). Proves the new
// aesthetic direction at the concept source: keynote-style systems/environments,
// no soldiers/firefighters/fortresses/lighthouses/lone-heroes.
import { extractVisualIntent } from './visualIntentService.mjs';

const FIELDS = [
  { id: 'ai', thesis: 'Compute capacity is the new oil of the AI economy.', reframe: 'Whoever controls GPUs and power controls the pace of AI.', hook: 'Models are commoditizing. Compute is not.', keyInsight: 'Energy and silicon scarcity now gate AI progress, not ideas.', title: 'Compute is the new oil', lang: 'en' },
  { id: 'cyber', thesis: 'Assume the breach already happened; defense is about containment now.', reframe: 'Prevention is dead; resilience and rapid response win.', hook: 'You are not trying to keep them out anymore.', keyInsight: 'Attackers are already inside; speed of detection is the real moat.', title: 'The breach already happened', lang: 'en' },
  { id: 'leadership', thesis: 'A leader’s silence is itself a decision with consequences.', reframe: 'Not speaking sets direction as loudly as speaking.', hook: 'Your team is reading the things you do not say.', keyInsight: 'Ambiguity from the top compounds into misalignment below.', title: 'Silence is a decision', lang: 'en' },
  { id: 'healthcare', thesis: 'Medicine is shifting from treating illness to predicting and preventing it.', reframe: 'The hospital of the future intervenes before symptoms appear.', hook: 'The biggest breakthroughs happen before you feel sick.', keyInsight: 'Continuous data turns care from reactive to anticipatory.', title: 'Medicine is becoming predictive', lang: 'en' },
  { id: 'finance', thesis: 'Abundant liquidity masks the real risk building underneath markets.', reframe: 'Calm markets are where the next crisis quietly accumulates.', hook: 'The danger is loudest when everything feels calm.', keyInsight: 'Cheap capital hides fragility until liquidity suddenly withdraws.', title: 'Liquidity hides the risk', lang: 'en' },
  { id: 'strategy', thesis: 'Durable competitive moats are built during downturns, not booms.', reframe: 'Recessions are when winners quietly pull away.', hook: 'The next decade’s leaders are deciding their fate now.', keyInsight: 'Discipline under pressure compounds into structural advantage.', title: 'Moats are built in downturns', lang: 'en' },
];

const BANNED = /soldier|firefighter|fortress|castle|lighthouse|flag|knight|war|battle|hero|medieval|sword/i;
for (const f of FIELDS) {
  const { intent, source } = await extractVisualIntent(f);
  const flag = BANNED.test(intent) ? '  <-- CLICHE DETECTED' : '';
  console.log(`[${f.id}] (${source}) ${intent}${flag}`);
}
