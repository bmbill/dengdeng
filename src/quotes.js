/* 燈燈悅心 — 開獎時說話的那幾位
 *
 * ⚠️ 這裡分成兩層，請不要混在一起：
 *
 *   1. VOICES — 這幾個角色自己的話。全部是為這個 app 寫的，
 *      不引用任何人，所以怎麼寫都不會出事。
 *   2. QUOTES — 有出處的引文。每一條都必須對原典核過才能上線。
 *
 * 絕對不要讓 AI 生成「佛陀說」「祖師說」的句子填進 QUOTES。
 * 編造法語就是妄語，而且朋友之間傳開了收不回來。
 * 寧可只有十句真的，不要一百句假的。
 *
 * 這也是為什麼五個角色都是虛構的東西——燈、掃地的、貓、石獅、蓮花。
 * 沒有一個是真實存在的人，所以不會冒名任何人。
 *
 * ── 角色的分工 ──
 *
 *   燈童    溫暖、直接。陪你的那個。
 *   掃地的  短、務實、帶點自嘲。做事的人的語氣。
 *   寺裡的貓 慵懶、吐槽。你太用力的時候，牠讓你鬆下來。
 *   門口的石獅 話少、時間尺度大。你急的時候，牠不急。
 *   池裡的蓮 緩慢，講生長。看不出進度的日子是牠的。
 *
 * 每位 20 句，共 100 句。要加就往對應的角色底下加，
 * 但先讀幾句原本的，抓一下那個人的語氣——五種聲音混在一起就沒意思了。
 */

/* ── 角色的長相 ──
 * 一律 64×64，圓底，跟 app 其他地方同一套扁平畫法。 */

const art = {
  lamp: () => `
    <circle cx="32" cy="32" r="32" fill="#F3EADA"/>
    <path d="M32 36c-8.5 0-14 5.6-15 13.2-.4 3 1 4.8 3.8 4.8h22.4c2.8 0 4.2-1.8 3.8-4.8C46 41.6 40.5 36 32 36z" fill="#C4553A"/>
    <path d="M32 36c-2.6 0-4.9.4-6.8 1.2L32 45l6.8-7.8c-1.9-.8-4.2-1.2-6.8-1.2z" fill="#EBD3AE"/>
    <circle cx="32" cy="24" r="12.4" fill="#F1D8B4"/>
    <path d="M25.6 24.4q2.4-2.8 4.8 0" stroke="#2B2620" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M33.6 24.4q2.4-2.8 4.8 0" stroke="#2B2620" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M29.8 29.2q2.2 1.9 4.4 0" stroke="#2B2620" stroke-width="1.9" stroke-linecap="round"/>
    <circle cx="23.4" cy="27.6" r="2.4" fill="#E2A08C" opacity=".75"/>
    <circle cx="40.6" cy="27.6" r="2.4" fill="#E2A08C" opacity=".75"/>`,

  sweeper: () => `
    <circle cx="32" cy="32" r="32" fill="#EFE7DA"/>
    <path d="M45 52L36 30" stroke="#A9713F" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M40 26c4-2 8-1.6 10 1.6-2.6 2.6-6.6 3-10-1.6z" fill="#C9A87A"/>
    <path d="M30 37c-8 0-13.2 5.2-14.2 12.4-.4 2.8 1 4.6 3.6 4.6h21.2c2.6 0 4-1.8 3.6-4.6C43.2 42.2 38 37 30 37z" fill="#8A6234"/>
    <path d="M30 37c-2.4 0-4.6.4-6.4 1.1L30 45l6.4-6.9c-1.8-.7-4-1.1-6.4-1.1z" fill="#D8C5A6"/>
    <circle cx="30" cy="25.4" r="12" fill="#EFD3AC"/>
    <path d="M23.6 25.6h5" stroke="#2B2620" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M31.6 25.6h5" stroke="#2B2620" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M27.6 30.6q2.4 1.6 4.8 0" stroke="#2B2620" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M18.6 21.6q3-3.4 6.4-1.8" stroke="#B8AA96" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M41.4 21.6q-3-3.4-6.4-1.8" stroke="#B8AA96" stroke-width="1.7" stroke-linecap="round"/>`,

  cat: () => `
    <circle cx="32" cy="32" r="32" fill="#EDE6DC"/>
    <path d="M17 24l1.6-10 9 6z" fill="#8A8073"/>
    <path d="M47 24l-1.6-10-9 6z" fill="#8A8073"/>
    <path d="M19.4 22.6l.9-5.4 4.8 3.2z" fill="#E2A08C"/>
    <path d="M44.6 22.6l-.9-5.4-4.8 3.2z" fill="#E2A08C"/>
    <ellipse cx="32" cy="34" rx="17" ry="15" fill="#9A9184"/>
    <path d="M24 32.6q2.6-3 5.2 0" stroke="#2B2620" stroke-width="2" stroke-linecap="round"/>
    <path d="M34.8 32.6q2.6-3 5.2 0" stroke="#2B2620" stroke-width="2" stroke-linecap="round"/>
    <path d="M32 37.4l-2 1.6 2 1.4 2-1.4z" fill="#E2A08C"/>
    <path d="M32 40.4v1.8M32 42.2q-2.4 2-4.6.4M32 42.2q2.4 2 4.6.4" stroke="#2B2620" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <path d="M13 34h6M13 38.6l6-1.4M51 34h-6M51 38.6l-6-1.4" stroke="#C4BCB0" stroke-width="1.4" stroke-linecap="round"/>`,

  lion: () => `
    <circle cx="32" cy="32" r="32" fill="#E6E2DA"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
      const x = (32 + Math.cos(a) * 16).toFixed(1);
      const y = (33 + Math.sin(a) * 16).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="9" fill="#8F887C"/>`;
    }).join('')}
    <circle cx="32" cy="33" r="14" fill="#C7C1B5"/>
    <path d="M23.8 27.4q3.2-2.2 6-.6" stroke="#6E675C" stroke-width="2.1" stroke-linecap="round"/>
    <path d="M40.2 27.4q-3.2-2.2-6-.6" stroke="#6E675C" stroke-width="2.1" stroke-linecap="round"/>
    <circle cx="26.6" cy="31.6" r="2.9" fill="#2B2620"/>
    <circle cx="37.4" cy="31.6" r="2.9" fill="#2B2620"/>
    <path d="M32 35.8l-3.6 3h7.2z" fill="#7E776C"/>
    <path d="M32 38.8v2.2" stroke="#7E776C" stroke-width="2" stroke-linecap="round"/>
    <path d="M32 41q-3.4 2.6-6-.2" stroke="#7E776C" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M32 41q3.4 2.6 6-.2" stroke="#7E776C" stroke-width="2" stroke-linecap="round" fill="none"/>`,

  lotus: () => `
    <circle cx="32" cy="32" r="32" fill="#E7EFEA"/>
    <ellipse cx="32" cy="50" rx="20" ry="4.5" fill="#9FBE9C" opacity=".5"/>
    ${[[-62, '#D79AAA'], [62, '#D79AAA'], [-31, '#E8AFBC'], [31, '#E8AFBC'], [0, '#F5C6D1']]
      .map(([deg, fill]) =>
        `<path d="M32 45C27 38 25.5 29 32 20C38.5 29 37 38 32 45Z" fill="${fill}" transform="rotate(${deg} 32 45)"/>`
      ).join('')}
    <ellipse cx="32" cy="42" rx="6" ry="4.4" fill="#EFD39A"/>`,
};

function avatar(key, size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">${art[key]()}</svg>`;
}

/* ── 五個角色，各 20 句 ── */

export const VOICES = {
  /* 溫暖、直接。陪你的那個。 */
  lamp: {
    name: '燈童',
    art: (size = 38) => avatar('lamp', size),
    lines: {
      any: [
        '今天的燈，是你自己點的。',
        '這一盞不大，但它亮著。',
        '做了就是做了，不用再想它值多少。',
        '你今天讓某件事變得好一點點。',
        '一件小事湊起來，也是一天。',
        '我把它收好了，明天還在。',
        '你走過來了，今天就沒有白過。',
        '沒有人看到也沒關係，我看到了。',
      ],
      full: [
        '今天做得真多，燈也比平常旺。',
        '這樣的一天不常有，記得它。',
        '你今天很用力，休息也是功課。',
      ],
      thin: [
        '很累還是點了一盞，這比做很多更難。',
        '少少的也算。明天還在。',
        '沒有人要求你今天一定要做什麼，是你自己來的。',
      ],
      back: [
        '空了幾天沒關係，燈海一直在等。',
        '回來了就好，前面的都還亮著。',
      ],
      sutra: [
        '一頁一頁翻過去，也是一頁一頁走過去。',
        '誦到哪裡不重要，坐下來才重要。',
      ],
      joy: [
        '替別人高興的時候，你自己的燈也亮了。',
        '你今天看見了別人做的事，這本身就是一件事。',
      ],
    },
  },

  /* 短、務實、帶點自嘲。做事的人的語氣。 */
  sweeper: {
    name: '掃地的',
    art: (size = 38) => avatar('sweeper', size),
    lines: {
      any: [
        '掃了一輩子地，也沒掃完。照樣掃。',
        '做事的人不太說話。你今天做了。',
        '地會髒，人會忘。所以每天都要來一次。',
        '這種事沒有做完的一天，只有做過的一天。',
        '別想太多，明天還要掃。',
        '我年輕的時候，也以為一次掃乾淨就好。',
        '手上有事做，心就不太亂。',
        '一把掃帚能做的事不多，但也不少。',
      ],
      full: [
        '今天掃得挺乾淨。歇著吧。',
        '做這麼多，等一下記得吃飯。',
        '起勁是好事。別逞強。',
      ],
      thin: [
        '掃一角也是掃。',
        '我有幾天也只是站著，沒動手。',
        '累的時候少做一點，比硬撐強。',
      ],
      back: [
        '幾天沒看到你。掃帚我放著沒收。',
        '回來就接著做，不用從頭算。',
      ],
      sutra: [
        '念的時候別想著念完。',
        '坐下來那一下，最難。',
      ],
      joy: [
        '看別人做得好，自己也順眼一點。',
        '替人高興不花力氣，但不是人人做得到。',
      ],
    },
  },

  /* 慵懶、吐槽。你太用力的時候，牠讓你鬆下來。 */
  cat: {
    name: '寺裡的貓',
    art: (size = 38) => avatar('cat', size),
    lines: {
      any: [
        '喵。我看到了，你可以去休息了。',
        '你們人做一點小事還要記下來。挺好的。',
        '我睡了一整天，你至少做了一件事。',
        '不錯啦。我今天只翻了個身。',
        '這種事我不懂，但你看起來挺開心。',
        '你又來了。我這邊位子還空著。',
        '寫完了嗎？那可以摸我了。',
        '人忙來忙去，貓看來看去。各有各的事。',
      ],
      full: [
        '哇，今天很拼。你確定不用睡一下？',
        '做這麼多，比我一個月動的還多。',
        '好啦好啦，你很厲害。我要睡了。',
      ],
      thin: [
        '一件就一件，我一件都沒有。',
        '今天懶懶的？我天天這樣。',
        '你已經比我努力了。',
      ],
      back: [
        '你去哪了？我位子都沒挪。',
        '回來啦。地板還是那塊地板。',
      ],
      sutra: [
        '你們念那個，我聽著會想睡。挺好的。',
        '那本書你翻得比我舔毛還慢。',
      ],
      joy: [
        '替別人高興這個我懂。有人給牠飯，我也替牠高興。',
        '你今天心情不錯，我看得出來。',
      ],
    },
  },

  /* 話少、時間尺度大。你急的時候，牠不急。 */
  lion: {
    name: '門口的石獅',
    art: (size = 38) => avatar('lion', size),
    lines: {
      any: [
        '我站在這裡很久了。今天記得你。',
        '來來去去的人很多。停下來做一件事的不多。',
        '石頭不動，人在動。這樣就好。',
        '一天。就一天。加起來才是別的東西。',
        '我不會說什麼好話。但我記得。',
        '你進來的時候，跟出去的時候，不太一樣。',
        '這扇門開了很多年。今天也開著。',
        '慢一點沒有關係。石頭比誰都慢。',
      ],
      full: [
        '今天的你，走得比平常重一些。',
        '做得多，不代表要做得久。',
        '我看過很多人這樣衝，也看過他們停下來。',
      ],
      thin: [
        '少，不是沒有。',
        '風大的日子，站著就夠了。',
        '我有時候一整年只是在下雨。',
      ],
      back: [
        '門沒關。從來沒關過。',
        '你不在的時候，這裡也沒有變。',
      ],
      sutra: [
        '那些字刻在石頭上也是一樣的。慢慢來。',
        '一頁。再一頁。石頭就是這樣被磨的。',
      ],
      joy: [
        '看見別人好，是難的。你做到了。',
        '一個人亮，跟一群人亮，不一樣。',
      ],
    },
  },

  /* 緩慢，講生長。看不出進度的日子是牠的。 */
  lotus: {
    name: '池裡的蓮',
    art: (size = 38) => avatar('lotus', size),
    lines: {
      any: [
        '我在水底下待了很久才開。你也不用急。',
        '今天長了一點點。看不出來的那種。',
        '泥巴裡也長得出來。這是我唯一會的事。',
        '水面下的事沒有人看得到。但它在發生。',
        '一天開不了花。一天可以往上一點。',
        '你今天做的事，明年才會知道是什麼。',
        '沒有一朵花是突然開的。',
        '根在動的時候，上面很安靜。',
      ],
      full: [
        '今天水動得厲害。你做了不少。',
        '長太快的會折。慢慢來。',
        '這樣的一天，根會記得。',
      ],
      thin: [
        '陰天也是在長。',
        '今天只是浮著，也沒關係。',
        '有幾天我什麼都沒做，只是泡在水裡。',
      ],
      back: [
        '水一直在這裡。',
        '你離開的時候，我也還在長。',
      ],
      sutra: [
        '一頁一頁，像水一層一層漫上來。',
        '聲音會沉到水底，慢慢化開。',
      ],
      joy: [
        '旁邊那朵開了，我也跟著亮一點。',
        '一池子開了，比一朵好看。',
      ],
    },
  },
};

export const VOICE_KEYS = Object.keys(VOICES);

/* ── 挑一句 ── */

const RECENT_LINES = 'dd_recent_sayings';
const RECENT_VOICE = 'dd_recent_voice';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 無痕模式 */ }
}

/** 當天的情況符合哪幾種語氣。'any' 永遠墊底，所以一定挑得到話。 */
function moodsOf(day, ctx = {}) {
  const { gapDays = 0 } = ctx;
  const moods = [];

  if (gapDays >= 2) moods.push('back');

  const written = day.total || 0;
  if (written >= 3 || (day.pages || 0) >= 15) moods.push('full');
  if (written <= 1 && (day.pages || 0) < 5) moods.push('thin');
  if ((day.pages || 0) >= 8) moods.push('sutra');
  if ((day.joys || 0) >= 2 || (day.gratitude || 0) >= 2) moods.push('joy');

  moods.push('any');
  return moods;
}

/**
 * 今天誰來說話。
 * 輪流，但避開上一次講話的那位——連兩天同一個人會顯得這裡只有一個角色。
 */
function pickVoice() {
  const last = read(RECENT_VOICE, null);
  const pool = VOICE_KEYS.filter((k) => k !== last);
  const key = pool[Math.floor(Math.random() * pool.length)] || VOICE_KEYS[0];
  write(RECENT_VOICE, key);
  return key;
}

/**
 * 依當天狀況挑一位角色和一句話。
 * @returns {{ key:string, voice:object, line:string }}
 */
export function sayingFor(day, ctx = {}) {
  const key = pickVoice();
  const voice = VOICES[key];
  const moods = moodsOf(day, ctx);

  const pool = moods.flatMap((m) => voice.lines[m] || []);
  const seen = read(RECENT_LINES, []);
  const fresh = pool.filter((x) => !seen.includes(x));
  const from = fresh.length ? fresh : pool;
  const line = from[Math.floor(Math.random() * from.length)];

  write(RECENT_LINES, [line, ...seen.filter((x) => x !== line)].slice(0, 30));
  return { key, voice, line };
}

/** 總共幾句。給你自己看的。 */
export function sayingCount() {
  return VOICE_KEYS.reduce(
    (n, k) => n + Object.values(VOICES[k].lines).reduce((a, arr) => a + arr.length, 0),
    0
  );
}

/* ── 有出處的引文 ── 上線前必須逐句核對 ── */

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

/** 只回傳核對過的引文。全部還沒核對就回 null，UI 那張卡就不出現。 */
export function quoteFor(dateStr) {
  const ok = QUOTES.filter((q) => q.verified);
  if (!ok.length) return null;
  const n = dateStr.split('-').reduce((a, p) => a + Number(p), 0);
  return ok[n % ok.length];
}

/** 引文出處要怎麼寫。 */
export function citationOf(q) {
  const parts = [`《${q.source}》`];
  if (q.chapter) parts.push(`· ${q.chapter}`);
  return { text: parts.join(''), label: q.tradition === 'buddhist' ? '經' : '典籍' };
}

/** 給你自己用的檢查：還有幾句沒核對。 */
export function unverifiedCount() {
  return QUOTES.filter((q) => !q.verified).length;
}
