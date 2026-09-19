/* 燈燈悅心 — 燈童的話與引文庫
 *
 * ⚠️ 這裡分成兩層，請不要混在一起：
 *
 *   1. SAYINGS — 燈童自己的話。這是 app 的語氣，不引用任何人，怎麼寫都不會出事。
 *   2. QUOTES  — 有出處的引文。每一條都必須對原典核過才能上線。
 *
 * 絕對不要讓 AI 生成「佛陀說」「祖師說」的句子填進 QUOTES。編造法語就是妄語，
 * 而且朋友之間傳開了收不回來。寧可只有十句真的，不要一百句假的。
 *
 * 每條 QUOTES 都帶 verified: false。你逐句核對過原文之後，把它改成 true，
 * 並在 checkedAt 填上日期。UI 只會顯示 verified === true 的引文。
 */

/** 燈童的話 —— app 自己的聲音，安全。依當天的情況挑。 */
export const SAYINGS = {
  // 一般的日子
  any: [
    '今天的燈，是你自己點的。',
    '這一盞不大，但它亮著。',
    '做了就是做了，不用再想它值多少。',
    '你今天讓某件事變得好一點點。',
    '四件小事湊起來，也是一天。',
  ],
  // 份量很足的日子
  full: [
    '今天做得真多，燈也比平常旺。',
    '這樣的一天不常有，記得它。',
    '你今天很用力，休息也是功課。',
  ],
  // 勉強撐起來的日子
  thin: [
    '很累還是點了一盞，這比做很多更難。',
    '少少的也算。明天還在。',
    '沒有人要求你今天一定要做什麼，是你自己來的。',
  ],
  // 斷了之後回來的日子
  back: [
    '空了幾天沒關係，燈海一直在等。',
    '回來了就好，前面的都還亮著。',
    '中斷不是從頭開始，是接著走。',
  ],
  // 誦經為主的日子
  sutra: [
    '一頁一頁翻過去，也是一頁一頁走過去。',
    '誦到哪裡不重要，坐下來才重要。',
  ],
  // 隨喜為主的日子
  joy: [
    '替別人高興的時候，你自己的燈也亮了。',
    '你今天看見了別人做的事，這本身就是一件事。',
  ],
};

/** 有出處的引文 —— 上線前必須逐句核對。 */
export const QUOTES = [
  {
    text: '初發心時，便成正覺。',
    source: '華嚴經',
    chapter: '梵行品',
    tradition: 'buddhist',
    verified: false,
    checkedAt: null,
  },
  {
    text: '諸惡莫作，眾善奉行，自淨其意，是諸佛教。',
    source: '法句經',
    chapter: '述佛品',
    note: '七佛通戒偈，另見《增一阿含經》。',
    tradition: 'buddhist',
    verified: false,
    checkedAt: null,
  },
  {
    text: '應無所住而生其心。',
    source: '金剛般若波羅蜜經',
    chapter: '莊嚴淨土分',
    tradition: 'buddhist',
    verified: false,
    checkedAt: null,
  },
  {
    text: '隨其心淨，則佛土淨。',
    source: '維摩詰所說經',
    chapter: '佛國品',
    tradition: 'buddhist',
    verified: false,
    checkedAt: null,
  },
  {
    text: '一切有為法，如夢幻泡影。',
    source: '金剛般若波羅蜜經',
    chapter: '應化非真分',
    tradition: 'buddhist',
    verified: false,
    checkedAt: null,
  },
  {
    text: '勿以惡小而為之，勿以善小而不為。',
    source: '三國志·蜀書·先主傳',
    chapter: '裴松之注引諸葛亮集',
    note: '劉備遺詔，非佛典。UI 會標成「典籍」而不是「經文」。',
    tradition: 'classic',
    verified: false,
    checkedAt: null,
  },
];

const RECENT_KEY = 'dd_recent_sayings';

function recent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function remember(line) {
  try {
    const list = [line, ...recent().filter((x) => x !== line)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* 無痕模式或關閉儲存時直接略過 */ }
}

/** 依當天狀況挑一句燈童的話，盡量不重複最近講過的。 */
export function sayingFor(day, ctx = {}) {
  const { streak = 0, gapDays = 0 } = ctx;
  const pool = [];

  if (gapDays >= 2) pool.push(...SAYINGS.back);

  // 上限 3 則，所以「寫滿」是 3 則，或誦經誦得多。
  const written = day.total || 0;
  if (written >= 3 || (day.pages || 0) >= 15) pool.push(...SAYINGS.full);
  if (written <= 1 && (day.pages || 0) < 5) pool.push(...SAYINGS.thin);
  if ((day.pages || 0) >= 8) pool.push(...SAYINGS.sutra);
  if ((day.joys || 0) >= 2 || (day.gratitude || 0) >= 2) pool.push(...SAYINGS.joy);
  pool.push(...SAYINGS.any);

  const seen = recent();
  const fresh = pool.filter((x) => !seen.includes(x));
  const from = fresh.length ? fresh : pool;
  const line = from[Math.floor(Math.random() * from.length)];
  remember(line);
  return line;
}

/** 只回傳核對過的引文。全部還沒核對就回 null，UI 那張卡就不出現。 */
export function quoteFor(dateStr) {
  const ok = QUOTES.filter((q) => q.verified);
  if (!ok.length) return null;
  // 用日期當索引，同一天永遠拿到同一句。
  const n = dateStr.split('-').reduce((a, p) => a + Number(p), 0);
  return ok[n % ok.length];
}

/** 引文出處要怎麼寫。 */
export function citationOf(q) {
  const label = q.tradition === 'buddhist' ? '經' : '典籍';
  const parts = [`《${q.source}》`];
  if (q.chapter) parts.push(`· ${q.chapter}`);
  return { text: parts.join(''), label };
}

/** 給你自己用的檢查：還有幾句沒核對。 */
export function unverifiedCount() {
  return QUOTES.filter((q) => !q.verified).length;
}
