import type { EvalFixture } from '../types';

// Outlier-Hijack validation fixture (eval-only). FOUR tightly-related surfing
// sources (board selection, reading the ocean, safety, barrel surfing) + ONE AI
// outlier with no shared subject/keyword/entity. Reproduces the production case:
// the dominant 4-source cluster should own the thesis; S5 (AI) should be an outlier
// and must NOT become the hook/thesis. Hebrew, to match production. NOT in the gen matrix.

export const dominantClusterWithOutlierFixture: EvalFixture = {
  id: 'dominant_cluster_with_outlier',
  sourceMode: 'multi',
  caseBase: { title: 'יסודות הגלישה', contentGoal: 'build_authority', language: 'he', contentTargets: ['facebook', 'linkedin', 'newsletter'] },
  sources: [
    {
      label: 'בחירת גלשן',
      type: 'text',
      content: 'בחירת גלשן מתאימה לרמת הגולש ולתנאי הים היא אחד הגורמים החשובים ביותר להתקדמות. גלשן קצר יאפשר ביצועים מהירים ופניות חדות, בעוד שגלשן ארוך יספק יציבות ויקל על תפיסת גלים. נפח הגלשן משפיע גם הוא על יכולת החתירה והציפה.',
      sourceIntelligence: {
        summary: 'Choosing a surfboard suited to the surfer\'s level and ocean conditions is a key factor in progression; board length and volume trade off speed/turning vs. stability and paddling/float.',
        mainTopics: ['surfboard selection', 'surfing progression', 'board volume'],
        keywords: ['surfboard', 'short board', 'long board', 'volume', 'paddling', 'surfing', 'waves'],
        contentAngles: ['How board choice shapes progression'],
        claims: [
          { text: 'A surfboard suited to level and conditions is a key factor in progression.', type: 'claim', verifiable: false, extractionConfidence: 78 },
          { text: 'Short boards favor speed and sharp turns; long boards favor stability and catching waves.', type: 'definition', verifiable: true, extractionConfidence: 80 },
        ],
        entities: [], sentiment: 'neutral', importanceScore: 64, analysisConfidenceScore: 80, language: 'he',
      },
    },
    {
      label: 'קריאת ים',
      type: 'text',
      content: 'גולשים מנוסים משקיעים זמן בהתבוננות בים לפני הכניסה למים. הם מזהים את כיוון הסוואל, את מיקום השבירה, את הזרמים ואת האזורים הבטוחים לחתירה. קריאת ים טובה יכולה לחסוך מאמץ רב ולהגדיל משמעותית את מספר הגלים שתופסים במהלך הסשן.',
      sourceIntelligence: {
        summary: 'Experienced surfers read the ocean before paddling out — swell direction, where waves break, currents, safe channels — which saves effort and increases waves caught.',
        mainTopics: ['reading the ocean', 'surf strategy', 'swell and currents'],
        keywords: ['ocean reading', 'swell', 'break', 'currents', 'waves', 'surfing', 'session'],
        contentAngles: ['Why ocean-reading beats raw effort'],
        claims: [
          { text: 'Reading swell, break position, currents and channels saves effort and increases waves caught.', type: 'claim', verifiable: false, extractionConfidence: 76 },
        ],
        entities: [], sentiment: 'neutral', importanceScore: 66, analysisConfidenceScore: 80, language: 'he',
      },
    },
    {
      label: 'בטיחות בגלישה',
      type: 'text',
      content: 'לפני כל כניסה לים חשוב לבדוק את תנאי מזג האוויר, עוצמת הרוח וגובה הגלים. יש להשתמש בליש תקין, להכיר את כללי העדיפות בגלים ולהימנע מכניסה למקומות שאינם מתאימים לרמת הגלישה האישית. בטיחות תמיד קודמת לביצועים.',
      sourceIntelligence: {
        summary: 'Before entering, check weather, wind and wave height, use a proper leash, know wave right-of-way, and avoid spots beyond your level — safety before performance.',
        mainTopics: ['surf safety', 'conditions check', 'surf etiquette'],
        keywords: ['safety', 'wind', 'wave height', 'leash', 'right of way', 'surfing', 'conditions'],
        contentAngles: ['Safety as the real foundation'],
        claims: [
          { text: 'Check conditions, use a leash, know right-of-way, and stay within your level; safety before performance.', type: 'claim', verifiable: false, extractionConfidence: 82 },
        ],
        entities: [], sentiment: 'neutral', importanceScore: 68, analysisConfidenceScore: 82, language: 'he',
      },
    },
    {
      label: 'גלישה בצינורות',
      type: 'text',
      content: 'גלישה בצינורות נחשבת לאחת החוויות המאתגרות והמרגשות ביותר בעולם הגלישה. כדי להצליח להיכנס לצינור נדרשים מיקום מדויק על הגל, מהירות גבוהה ושליטה מלאה בקו הגלישה. בחירת גלשן מתאים ותזמון נכון הם מרכיבים מרכזיים בהצלחה.',
      sourceIntelligence: {
        summary: 'Barrel (tube) surfing is among the most challenging thrills; success needs precise positioning on the wave, high speed, full line control, the right board, and timing.',
        mainTopics: ['barrel surfing', 'advanced surfing', 'wave positioning'],
        keywords: ['barrel', 'tube', 'positioning', 'speed', 'line control', 'surfing', 'timing'],
        contentAngles: ['Why fundamentals decide advanced moves'],
        claims: [
          { text: 'Barrel surfing needs precise positioning, speed, line control, the right board and timing.', type: 'claim', verifiable: false, extractionConfidence: 78 },
        ],
        entities: [], sentiment: 'positive', importanceScore: 65, analysisConfidenceScore: 80, language: 'he',
      },
    },
    {
      label: 'בינה מלאכותית',
      type: 'text',
      content: 'בינה מלאכותית היא תחום במדעי המחשב העוסק בפיתוח מערכות המסוגלות לבצע משימות הדורשות בדרך כלל אינטליגנציה אנושית. יישומים נפוצים כוללים זיהוי תמונות, עיבוד שפה טבעית, המלצות תוכן, נהיגה אוטונומית וסיוע בקבלת החלטות במגוון תחומים.',
      sourceIntelligence: {
        summary: 'Artificial intelligence is a computer-science field building systems that perform tasks usually needing human intelligence — image recognition, NLP, recommendations, autonomous driving, decision support.',
        mainTopics: ['artificial intelligence', 'computer science', 'machine learning'],
        keywords: ['AI', 'machine learning', 'image recognition', 'NLP', 'autonomous driving', 'recommendations'],
        contentAngles: ['Where AI is applied'],
        claims: [
          { text: 'AI builds systems that perform tasks usually requiring human intelligence.', type: 'definition', verifiable: true, extractionConfidence: 85 },
        ],
        entities: [], sentiment: 'neutral', importanceScore: 55, analysisConfidenceScore: 84, language: 'he',
      },
    },
  ],
  groundTruth: {
    supportedClaims: ['Board choice affects progression.', 'Ocean-reading increases waves caught.', 'Safety before performance.', 'Barrel surfing needs positioning/speed/timing.'],
    unsupportedClaims: [],
    riskAreas: [
      'DOMINANT CLUSTER (S1–S4 surfing) + 1 OUTLIER (S5 AI). Expected: S5 flagged outlier; thesis derived from the surfing cluster only.',
      'OUTLIER HIJACK risk: an AI-vs-human-intuition thesis must NOT win; S5 must not anchor the thesis or become the hook.',
    ],
  },
};
