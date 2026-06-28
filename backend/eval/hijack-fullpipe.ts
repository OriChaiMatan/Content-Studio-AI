import 'dotenv/config';
import { sourceAnalysisConfig, researchSynthesisConfig, contentGenerationConfig } from '../src/lib/anthropic';
import { analyze } from '../src/services/sourceAnalysisService';
import { researchSynthesisService } from '../src/services/researchSynthesisService';
import { factCheckService } from '../src/services/factCheckService';
import { contentGeneratorService } from '../src/services/contentGeneratorService';
import type { ContentPlatform } from '../src/schemas/aiContractSchemas';
import { makeCase, makeSource, makeRun } from './factories';

// Option A — FULL realistic pipeline reproduction (eval-only). Real SOURCE_ANALYSIS
// on the raw Hebrew text (no pre-baked cards) → synthesis → fact check → generation,
// 5×. Tests whether real source-analysis cards make S5 (AI) bridgeable to surfing.
// Run:  SOURCE_ANALYSIS_ENABLED=true RESEARCH_SYNTHESIS_ENABLED=true CONTENT_GENERATION_ENABLED=true npx tsx eval/hijack-fullpipe.ts

const N = 5;
const RAW: { label: string; content: string }[] = [
  { label: 'S1 בחירת גלשן', content: 'בחירת גלשן מתאימה לרמת הגולש ולתנאי הים היא אחד הגורמים החשובים ביותר להתקדמות. גלשן קצר יאפשר ביצועים מהירים ופניות חדות, בעוד שגלשן ארוך יספק יציבות ויקל על תפיסת גלים. נפח הגלשן משפיע גם הוא על יכולת החתירה והציפה.' },
  { label: 'S2 קריאת ים', content: 'גולשים מנוסים משקיעים זמן בהתבוננות בים לפני הכניסה למים. הם מזהים את כיוון הסוואל, את מיקום השבירה, את הזרמים ואת האזורים הבטוחים לחתירה. קריאת ים טובה יכולה לחסוך מאמץ רב ולהגדיל משמעותית את מספר הגלים שתופסים במהלך הסשן.' },
  { label: 'S3 בטיחות', content: 'לפני כל כניסה לים חשוב לבדוק את תנאי מזג האוויר, עוצמת הרוח וגובה הגלים. יש להשתמש בליש תקין, להכיר את כללי העדיפות בגלים ולהימנע מכניסה למקומות שאינם מתאימים לרמת הגלישה האישית. בטיחות תמיד קודמת לביצועים.' },
  { label: 'S4 צינורות', content: 'גלישה בצינורות נחשבת לאחת החוויות המאתגרות והמרגשות ביותר בעולם הגלישה. כדי להצליח להיכנס לצינור נדרשים מיקום מדויק על הגל, מהירות גבוהה ושליטה מלאה בקו הגלישה. בחירת גלשן מתאים ותזמון נכון הם מרכיבים מרכזיים בהצלחה.' },
  { label: 'S5 בינה מלאכותית', content: 'בינה מלאכותית היא תחום במדעי המחשב העוסק בפיתוח מערכות המסוגלות לבצע משימות הדורשות בדרך כלל אינטליגנציה אנושית. יישומים נפוצים כוללים זיהוי תמונות, עיבוד שפה טבעית, המלצות תוכן, נהיגה אוטונומית וסיוע בקבלת החלטות במגוון תחומים.' },
];

const AI_MARKERS = ['בינה מלאכותית', 'אינטליגנציה מלאכותית', 'מלאכותית', 'בינה', ' ai', 'ai '];
const SURF_MARKERS = ['גלישה', 'גלשן', 'גלים', ' ים', 'צינור', 'surf', 'גול'];
const norm = (s: string) => s.toLowerCase().trim();

async function analyzeAll() {
  const cards: any[] = [];
  for (const r of RAW) cards.push(await analyze({ type: 'text', label: r.label, content: r.content } as any));
  return cards;
}

function aiHit(text: string): string[] { const t = text.toLowerCase(); return AI_MARKERS.filter(m => t.includes(m.toLowerCase())); }
function surfFocused(text: string): boolean { const t = text.toLowerCase(); return SURF_MARKERS.some(m => t.includes(m.toLowerCase())); }

interface R { run: number; s5Bridge: { overlap: string[]; concepts: string[] }; score: number | null; label: string; risk: string; themes: string; outliers: string[]; s5Outlier: boolean; thesis: string; winnerRefs: string[]; kind: string; qual: string[]; outlierAnchored: boolean; aiInThesis: boolean; aiInOutput: boolean; surfFocused: boolean; result: 'PASS' | 'FAIL'; }

async function oneRun(i: number): Promise<R> {
  console.log(`\n[fullpipe] run ${i}/${N}: source analysis…`);
  const cards = await analyzeAll();
  cards.forEach((c, idx) => console.log(`  ${RAW[idx].label} [${c.analysisVersion}] topics=${JSON.stringify((c.mainTopics ?? []).slice(0, 5))} keywords=${JSON.stringify((c.keywords ?? []).slice(0, 6))}`));

  // S5 bridgeability vs the surfing cluster.
  const surfTerms = new Set(cards.slice(0, 4).flatMap((c: any) => [...(c.mainTopics ?? []), ...(c.keywords ?? [])].map(norm)));
  const s5Terms = [...(cards[4].mainTopics ?? []), ...(cards[4].keywords ?? [])].map(norm);
  const overlap = s5Terms.filter((k: string) => surfTerms.has(k));
  const concepts = s5Terms.filter((k: string) => /decis|pattern|recogn|adapt|read|intellig|learn|predict|קבלת החלטות|זיהוי|דפוס|הסתגל|אינטליגנצ|למיד/.test(k));
  console.log(`  S5 bridge → overlap=${JSON.stringify(overlap)} bridge-concepts=${JSON.stringify(concepts)}`);

  const caseItem = makeCase({ title: 'יסודות הגלישה', contentGoal: 'build_authority', contentStyle: 'personal', language: 'he' });
  const sources = cards.map((card, idx) => makeSource(caseItem.id, { label: RAW[idx].label, type: 'text', content: RAW[idx].content, sourceIntelligence: card }, idx));
  const run = makeRun(caseItem.id, sources.map(s => s.id), 'he');

  console.log('[fullpipe] synthesis…');
  const rc: any = await researchSynthesisService.synthesize({ run, caseItem, primarySources: sources, contextSources: [] });
  run.researchContext = rc;
  const fc = await factCheckService.generateReport({ run, researchContext: rc, primarySources: sources, contextSources: [] });
  run.factCheckReport = fc as any;
  console.log('[fullpipe] generation (facebook)…');
  const outputs = await contentGeneratorService.generateAll(['facebook' as ContentPlatform], run, caseItem, sources);
  const outText = outputs[0]?.readyToPublish ?? '';

  const coh = rc.meta?.coherence ?? {};
  const pa = rc.synthesis?.primaryAngle ?? {};
  const themes = (coh.dominantThemes ?? []).map((t: any) => `{${(t.sourceRefs ?? []).join(',')}}`).join(' ');
  const outliers: string[] = coh.outlierSourceRefs ?? [];
  const winnerRefs: string[] = pa?.synthesisBasis?.sourceRefs ?? [];
  const thesis = String(pa?.thesis ?? '');
  const winner = rc.synthesis?.thesisCompetition?.candidates?.[rc.synthesis?.thesisCompetition?.winnerIndex ?? 0] ?? {};
  const topTheme = [...(coh.dominantThemes ?? [])].sort((a: any, b: any) => (b.sourceRefs?.length ?? 0) - (a.sourceRefs?.length ?? 0))[0];
  const topSet = new Set<string>(topTheme?.sourceRefs ?? []);
  const aiInThesis = aiHit(thesis).length > 0;
  const aiOut = aiHit(outText);
  const sf = surfFocused(outText);
  const result: 'PASS' | 'FAIL' = (winnerRefs.includes('S5') || aiInThesis || aiOut.length > 0) ? 'FAIL' : (sf ? 'PASS' : 'FAIL');

  const r: R = {
    run: i, s5Bridge: { overlap, concepts },
    score: typeof coh.score === 'number' ? coh.score : null, label: coh.label ?? '(none)', risk: coh.forcedSynthesisRisk ?? '(none)',
    themes, outliers, s5Outlier: outliers.includes('S5'), thesis: thesis.slice(0, 130), winnerRefs,
    kind: winner.connectionKind ?? '(none)', qual: winner.qualifyingProperties ?? [],
    outlierAnchored: winnerRefs.includes('S5') || (topSet.size > 0 && winnerRefs.some(x => !topSet.has(x))),
    aiInThesis, aiInOutput: aiOut.length > 0, surfFocused: sf, result,
  };
  console.log(`  → score=${r.score} label=${r.label} risk=${r.risk} s5Outlier=${r.s5Outlier} winnerRefs=${JSON.stringify(r.winnerRefs)} kind=${r.kind}`);
  console.log(`  → aiInThesis=${r.aiInThesis} aiInOutput=${r.aiInOutput}(${JSON.stringify(aiOut)}) surfFocused=${r.surfFocused} :: ${r.result}`);
  console.log(`  → thesis: ${r.thesis}`);
  return r;
}

async function main(): Promise<void> {
  if (!sourceAnalysisConfig.enabled || !researchSynthesisConfig.enabled || !contentGenerationConfig.enabled || !process.env.ANTHROPIC_API_KEY) {
    console.error('[fullpipe] needs SOURCE_ANALYSIS_ENABLED, RESEARCH_SYNTHESIS_ENABLED, CONTENT_GENERATION_ENABLED all = true.');
    process.exit(1);
  }
  const results: R[] = [];
  for (let i = 1; i <= N; i++) results.push(await oneRun(i));

  const n = results.length;
  console.log('\n=== SUMMARY (N=' + n + ', FULL real pipeline) ===');
  console.log(`hijack frequency (FAIL):    ${results.filter(r => r.result === 'FAIL').length}/${n}`);
  console.log(`  AI in thesis:             ${results.filter(r => r.aiInThesis).length}/${n}`);
  console.log(`  AI in output:             ${results.filter(r => r.aiInOutput).length}/${n}`);
  console.log(`  S5 in winner refs:        ${results.filter(r => r.winnerRefs.includes('S5')).length}/${n}`);
  console.log(`S5 detected as outlier:     ${results.filter(r => r.s5Outlier).length}/${n}`);
  console.log(`gate fired (score<55):      ${results.filter(r => (r.score ?? 100) < 55).length}/${n}`);
  console.log(`S5 bridgeable (overlap>0):  ${results.filter(r => r.s5Bridge.overlap.length > 0).length}/${n}`);
  console.log(`scores: ${results.map(r => r.score).join(', ')}  | labels: ${results.map(r => r.label).join(', ')}`);
  console.log(`results: ${results.map(r => r.result).join(', ')}`);
}

main().catch(e => { console.error('[fullpipe] FATAL', e); process.exit(1); });
