/* 燈燈悅心 — 燈的生成與繪製
 *
 * 設計原則：顏色是你決定的，形制是運氣。
 *   燈身色 ← 當天哪一項做得最多（你的選擇）
 *   焰　色 ← 當天的份量與連續天數（你的努力）
 *   形　制 ← 加權隨機抽（驚喜），份量越足，抽到稀有形制的機率越高
 *
 * 所有燈都由同一支 renderLamp() 畫出來，不需要美術素材。
 */

/* ── 色盤（與 styles/tokens.css 同步） ── */

export const BOWLS = {
  // 善行點滴 —— 朱
  cinnabar:  { name: '朱砂', dark: '#C4553A', light: '#D8674C', foot: '#A9713F' },
  vermilion: { name: '銀朱', dark: '#D4644A', light: '#E37B60', foot: '#B0603F' },
  // 觀功念恩 —— 黃
  gamboge:   { name: '藤黃', dark: '#C9952F', light: '#DCAB4C', foot: '#A9713F' },
  orpiment:  { name: '雌黃', dark: '#B8862A', light: '#CC9C42', foot: '#96682C' },
  // 誦經 —— 青
  azurite:   { name: '石青', dark: '#43707F', light: '#557F8F', foot: '#3B5E6B' },
  indigo:    { name: '螺青', dark: '#3A4A6B', light: '#4C5D80', foot: '#2E3A55' },
  // 其他 —— 赭
  ochre:     { name: '赭石', dark: '#A9713F', light: '#BC854F', foot: '#8A6234' },
  earth:     { name: '土黃', dark: '#B08A4E', light: '#C49E63', foot: '#8F6E3A' },
  // 均衡 —— 綠
  malachite: { name: '石綠', dark: '#4F6F4C', light: '#627F5E', foot: '#3F5A3C' },
  moss:      { name: '苔綠', dark: '#6E8F6B', light: '#83A17F', foot: '#55724F' },
  // 一天之內寫了三種不同的事，才會遇到
  gold:      { name: '泥金', dark: '#C9A227', light: '#E0BC4A', foot: '#A07E1B' },
};

/* 一個色系兩個深淺：份量輕的是淡的那個，份量足的是深的。
 * 顏色仍然由「你寫什麼」決定，只是多了一層「寫多少」。 */
const BOWL_FAMILY = {
  deed:      ['cinnabar', 'vermilion'],
  gratitude: ['gamboge', 'orpiment'],
  sutra:     ['azurite', 'indigo'],
  note:      ['ochre', 'earth'],
  balanced:  ['moss', 'malachite'],
};

export const FLAMES = {
  gamboge:   { name: '藤黃焰', outer: '#D9A441', inner: '#C4553A', halo: '#F4D9A0' },
  cinnabar:  { name: '朱焰',   outer: '#C4553A', inner: '#F2C877', halo: '#F5A98A' },
  malachite: { name: '碧焰',   outer: '#6FB08C', inner: '#D9F0DF', halo: '#A8DCC0' },
  white:     { name: '白焰',   outer: '#EFE7D4', inner: '#9FD4E0', halo: '#BCE3EC' },
  azure:     { name: '青焰',   outer: '#6FA8C8', inner: '#E4F1F7', halo: '#A9D2E6' },
  violet:    { name: '紫焰',   outer: '#9B7BB8', inner: '#F0E4F5', halo: '#C9B0DC' },
};

/* ── 形制 ──
 * tier: common / uncommon / rare
 * 名字取自佛教燈供的實際形制，不是隨便編的。 */

export const FORMS = {
  round:   { name: '圓缽燈', tier: 'common' },
  square:  { name: '方座燈', tier: 'common' },
  tall:    { name: '高足燈', tier: 'common' },
  petal:   { name: '蓮瓣燈', tier: 'common' },

  tripod:  { name: '三足燈', tier: 'common' },
  tile:    { name: '瓦燈',   tier: 'common' },

  double:  { name: '雙層燈', tier: 'uncommon' },
  pond:    { name: '蓮池燈', tier: 'uncommon' },
  banner:  { name: '幡燈',   tier: 'uncommon' },
  handle:  { name: '提燈',   tier: 'uncommon' },

  cloud:   { name: '雲座燈', tier: 'uncommon' },
  bell:    { name: '鈴燈',   tier: 'uncommon' },
  fish:    { name: '雙魚燈', tier: 'uncommon' },

  pagoda:  { name: '塔燈',   tier: 'rare' },
  seven:   { name: '七層燈', tier: 'rare' },
  mani:    { name: '摩尼燈', tier: 'rare' },
  eternal: { name: '長明燈', tier: 'rare' },
  tree:    { name: '燈樹',   tier: 'rare' },
  boat:    { name: '法船燈', tier: 'rare' },
  wheel:   { name: '法輪燈', tier: 'rare' },
};

export const TIER_LABEL = { common: '常見', uncommon: '少見', rare: '難得' };

/* ── 燈身紋樣 ──
 *
 * 這個不是抽的，是「誰供的」決定的：同一個人的燈永遠同一種紋。
 *
 * 為什麼要有它：形制和顏色都由當天做了什麼決定，所以一群人
 * 做同樣的事就會供出一模一樣的燈。紋樣讓每個人的燈認得出來——
 * 在共同燈海裡點開，一眼就知道是誰的。 */

export const PATTERNS = {
  plain:  { name: '素面' },
  lotus:  { name: '蓮紋' },
  cloud:  { name: '雲紋' },
  key:    { name: '迴紋' },
  bead:   { name: '連珠' },
};

const PATTERN_KEYS = Object.keys(PATTERNS);

const PATTERN_ART = {
  plain: '',
  lotus: '<path d="M13.5 39.4q4.2 3.4 8.5 0M22 39.4q4.2 3.4 8.5 0" stroke="var(--light)" stroke-width="1.1" fill="none" opacity=".62" stroke-linecap="round"/>',
  cloud: '<path d="M12 39.8q2.5-2.2 5 0t5 0 5 0 5 0" stroke="var(--light)" stroke-width="1.1" fill="none" opacity=".62" stroke-linecap="round"/>',
  key:   [0, 1, 2, 3].map((i) => `<rect x="${13 + i * 4.8}" y="38.4" width="3.2" height="3.2" rx=".6" stroke="var(--light)" stroke-width="1" fill="none" opacity=".6"/>`).join(''),
  bead:  [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${13 + i * 3.4}" cy="40" r="1.05" fill="var(--light)" opacity=".62"/>`).join(''),
};

/** 同一個人永遠同一種紋。 */
export function patternFor(ownerId) {
  return PATTERN_KEYS[hash(String(ownerId || '')) % PATTERN_KEYS.length];
}

/* ── 決定色 ── */

/**
 * 燈身色。
 *
 * 色系由「你寫什麼」決定，深淺由「寫多少」決定——
 * 顏色仍然不是抽的，只是多了一層層次，
 * 不然一群人做同樣的事就會供出一模一樣的燈。
 */
export function bowlFor(day) {
  // 一天之內寫了三種不同的事，是難得的一天，給泥金。
  if ((day.kinds || 0) >= 3) return 'gold';

  // 誦經用頁數折算，不然一則 30 頁跟一則善行會被當成一樣重。
  const weighted = [
    ['deed',      day.deeds || 0],
    ['gratitude', day.gratitude || 0],
    ['sutra',     Math.max(day.sutras || 0, (day.pages || 0) / 5)],
    ['note',      day.notes || 0],
  ].sort((a, b) => b[1] - a[1]);

  const [top, second] = weighted;
  const deep = depthOf(day) >= 0.5 ? 1 : 0;

  if (top[1] <= 0) return BOWL_FAMILY.balanced[deep];
  if (second[1] > 0 && second[1] >= top[1] * 0.8) return BOWL_FAMILY.balanced[deep];
  return BOWL_FAMILY[top[0]][deep];
}

/**
 * 焰色。
 *
 * 連續天數只在「剛好走到倍數」那一天變色——不是「連滿 49 天之後
 * 每一盞都是紫焰」。後者會讓夜空在最該豐富的時候變成單色，
 * 而且那個顏色也不再代表什麼，因為它天天都在。
 *
 * 現在白焰大約每 7 天一次、青焰每 21 天、紫焰每 49 天，
 * 是那一天的標記，不是之後的狀態。
 */
export function flameFor(day, streak) {
  const n = streak || 0;
  if (n > 0 && n % 49 === 0) return 'violet';
  if (n > 0 && n % 21 === 0) return 'azure';
  if (n > 0 && n % 7 === 0) return 'white';
  if ((day.joys || 0) >= 3) return 'malachite';
  if ((day.total || 0) >= 3 || (day.pages || 0) >= 10) return 'cinnabar';
  return 'gamboge';
}

/**
 * 0~1 的「今天做得多滿」，用來調整稀有形制的機率。
 *
 * 一則就有 0.23 左右——足夠開獎，只是稀有的機會低一點。
 * 這是唯一「多做有差」的地方，而且只影響機率，不影響能不能供燈。
 *
 * 上限 3 則，所以寫滿 3 則就到頂了，不會有「再多寫一點」的無底洞。
 */
export function depthOf(day) {
  const byEntries = Math.min(1, (day.total || 0) / 3);
  const byPages = Math.min(1, (day.pages || 0) / 15);
  const byJoys = Math.min(1, (day.joys || 0) / 3);
  return byEntries * 0.6 + byPages * 0.25 + byJoys * 0.15;
}

/* ── 抽形制 ── */

function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** 同一個 seed 永遠抽出同一盞燈，所以重新整理不會換獎。 */
function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickForm(seed, depth) {
  // 做得越滿，稀有形制的權重越高，但永遠不保證。
  const tierWeight = {
    common:   100 - 40 * depth,
    uncommon: 34 + 20 * depth,
    rare:     9 + 20 * depth,
  };
  const entries = Object.entries(FORMS);
  const weights = entries.map(([, f]) => tierWeight[f.tier]);
  const total = weights.reduce((a, b) => a + b, 0);

  let roll = rng(seed)() * total;
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return entries[i][0];
  }
  return entries[0][0];
}

/**
 * 依當天的紀錄產生一盞燈。
 * @param {{date:string, deeds:number, pages:number, joys:number, notes:number}} day
 * @param {{streak:number, isFirstEver:boolean, seedSalt:string}} ctx
 */
export function makeLamp(day, ctx = {}) {
  const { streak = 0, isFirstEver = false, seedSalt = '' } = ctx;
  const depth = depthOf(day);
  const form = pickForm(`${day.date}|${seedSalt}`, depth);
  const bowl = bowlFor(day);
  const flame = flameFor(day, streak);

  return {
    date: day.date,
    form, bowl, flame,
    pattern: patternFor(seedSalt),
    tier: FORMS[form].tier,
    // 第一盞永遠叫「初發心燈」，那一刻值得一個專屬的名字。
    name: isFirstEver ? '初發心燈' : FORMS[form].name,
  };
}

/* ── 繪製 ──
 * viewBox 0 0 44 50：焰在上（y 5~25），缽口 y=31，缽底 y≈43.6，座 y=45.5。
 * 每個形制回傳 behind（畫在缽後面）與 front（畫在缽前面）兩段。 */

const FORM_ART = {
  round: () => ({ behind: '', front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>' }),

  square: () => ({
    behind: '',
    front: '<rect x="12" y="43.4" width="20" height="4.4" rx="1.6" fill="var(--foot)"/>',
  }),

  tall: () => ({
    behind: '',
    front: '<path d="M22 43v3.4" stroke="var(--foot)" stroke-width="3" stroke-linecap="round"/>'
         + '<ellipse cx="22" cy="47.4" rx="8.5" ry="2.2" fill="var(--foot)"/>',
  }),

  petal: () => ({
    behind: '<path d="M8 31c-3.4-1.4-5.6-3.6-6.4-6.6 3.4.3 6 2.4 6.4 6.6z" fill="var(--light)"/>'
          + '<path d="M36 31c3.4-1.4 5.6-3.6 6.4-6.6-3.4.3-6 2.4-6.4 6.6z" fill="var(--light)"/>',
    front: '<path d="M11 33.5c-1.8 2.6-2.2 5.2-1.2 7.8 2.4-1.6 3.6-4 3.4-7.2z" fill="var(--light)"/>'
         + '<path d="M33 33.5c1.8 2.6 2.2 5.2 1.2 7.8-2.4-1.6-3.6-4-3.4-7.2z" fill="var(--light)"/>'
         + '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  tripod: () => ({
    behind: '',
    front: '<path d="M13.5 43.4l-2.4 4.4M22 44v4M30.5 43.4l2.4 4.4" stroke="var(--foot)" stroke-width="2.3" stroke-linecap="round"/>',
  }),

  tile: () => ({
    behind: '',
    front: '<path d="M8.5 43.6h27l2.8 4.2H5.7z" fill="var(--foot)"/>',
  }),

  cloud: () => ({
    behind: '',
    front: '<circle cx="13.5" cy="46.2" r="4.4" fill="var(--light)"/>'
         + '<circle cx="22" cy="45.4" r="5.4" fill="var(--light)"/>'
         + '<circle cx="30.5" cy="46.2" r="4.4" fill="var(--light)"/>',
  }),

  bell: () => ({
    behind: '',
    front: '<path d="M8.6 38v5.4M35.4 38v5.4" stroke="var(--foot)" stroke-width="1.3" stroke-linecap="round"/>'
         + '<path d="M6 48.4c0-2 1.2-3.4 2.6-3.4s2.6 1.4 2.6 3.4z" fill="var(--light)"/>'
         + '<path d="M32.8 48.4c0-2 1.2-3.4 2.6-3.4s2.6 1.4 2.6 3.4z" fill="var(--light)"/>'
         + '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  fish: () => ({
    behind: '<path d="M4.5 33.5c3.4-3.4 6.8-4 9.4-1.6-1.6 3.4-5 4.8-9.4 3.4z" fill="#9FD4E0"/>'
          + '<path d="M39.5 33.5c-3.4-3.4-6.8-4-9.4-1.6 1.6 3.4 5 4.8 9.4 3.4z" fill="#9FD4E0"/>'
          + '<circle cx="7.6" cy="33.4" r=".9" fill="#3B5E6B"/><circle cx="36.4" cy="33.4" r=".9" fill="#3B5E6B"/>',
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  tree: () => ({
    behind: '<path d="M22 30V13M22 20l-8-5M22 20l8-5M22 26l-6.5-4M22 26l6.5-4" stroke="var(--foot)" stroke-width="1.6" stroke-linecap="round" fill="none"/>'
          + [[14, 15], [30, 15], [15.5, 22], [28.5, 22], [22, 12]].map(([x, y]) =>
              `<circle cx="${x}" cy="${y}" r="2.4" fill="var(--flame-outer)" opacity=".9"/>`).join(''),
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  boat: () => ({
    behind: '',
    front: '<path d="M3.5 43.4h37c-1.8 4.6-7.4 7-18.5 7S5.3 48 3.5 43.4z" fill="var(--foot)"/>'
         + '<path d="M9 46.4h26" stroke="var(--light)" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>',
  }),

  wheel: () => ({
    behind: '<circle cx="22" cy="19" r="15" stroke="var(--flame-halo)" stroke-width="1.8" fill="none" opacity=".6"/>'
          + '<circle cx="22" cy="19" r="4.6" stroke="var(--flame-halo)" stroke-width="1.5" fill="none" opacity=".6"/>'
          + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const a = (Math.PI * 2 * i) / 8;
              const x1 = (22 + Math.cos(a) * 5).toFixed(1);
              const y1 = (19 + Math.sin(a) * 5).toFixed(1);
              const x2 = (22 + Math.cos(a) * 14.4).toFixed(1);
              const y2 = (19 + Math.sin(a) * 14.4).toFixed(1);
              return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="var(--flame-halo)" stroke-width="1.3" opacity=".5"/>`;
            }).join(''),
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  double: () => ({
    behind: '',
    front: '<path d="M11.5 44h21c0 3.4-4.7 5.5-10.5 5.5S11.5 47.4 11.5 44z" fill="var(--foot)"/>',
  }),

  pond: () => ({
    behind: '<path d="M4.5 30.5c2.6-1.6 5.4-2.4 8.4-2.4-1.6 2.6-3.9 4.5-6.9 5.6-1.5.6-2.6-2.3-1.5-3.2z" fill="#9FBE9C"/>'
          + '<path d="M39.5 30.5c-2.6-1.6-5.4-2.4-8.4-2.4 1.6 2.6 3.9 4.5 6.9 5.6 1.5.6 2.6-2.3 1.5-3.2z" fill="#9FBE9C"/>',
    front: '<path d="M6 46.5c4.5-1.6 9.8-2.4 16-2.4s11.5.8 16 2.4" stroke="#6E8F6B" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  }),

  banner: () => ({
    behind: '',
    front: '<path d="M10 43.5c0 3.5-.6 5.4-1.8 6 -1.2-.6-1.8-2.5-1.8-6z" fill="var(--light)"/>'
         + '<path d="M37.6 43.5c0 3.5-.6 5.4-1.8 6 -1.2-.6-1.8-2.5-1.8-6z" fill="var(--light)"/>'
         + '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  handle: () => ({
    behind: '<path d="M10 30C10 20 15 15 22 15s12 5 12 15" stroke="var(--foot)" stroke-width="2" fill="none" stroke-linecap="round"/>',
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  pagoda: () => ({
    behind: '<path d="M22 2.5l9 5.5H13z" fill="var(--dark)"/>'
          + '<path d="M22 8.5l7.5 4.5h-15z" fill="var(--light)"/>',
    front: '<path d="M10 43.8h24l-2.5 4.4h-19z" fill="var(--foot)"/>',
  }),

  seven: () => ({
    behind: [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const a = (-Math.PI * 0.82) + (Math.PI * 0.64 * i) / 6;
      const x = (22 + Math.cos(a) * 17).toFixed(1);
      const y = (30 + Math.sin(a) * 15).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="1.9" fill="var(--flame-outer)" opacity=".85"/>`;
    }).join(''),
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  mani: () => ({
    behind: '<circle cx="22" cy="17" r="13.5" fill="var(--flame-halo)" opacity=".3"/>'
          + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
              const x1 = (22 + Math.cos(a) * 15.5).toFixed(1);
              const y1 = (17 + Math.sin(a) * 15.5).toFixed(1);
              const x2 = (22 + Math.cos(a) * 19).toFixed(1);
              const y2 = (17 + Math.sin(a) * 19).toFixed(1);
              return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="var(--flame-outer)" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`;
            }).join(''),
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  eternal: () => ({
    behind: '<circle cx="22" cy="19" r="16" stroke="var(--flame-halo)" stroke-width="1.6" fill="none" opacity=".55"/>'
          + '<circle cx="22" cy="19" r="19.5" stroke="var(--flame-halo)" stroke-width="1" fill="none" opacity=".3"/>',
    front: '<path d="M11.5 44h21c0 3.4-4.7 5.5-10.5 5.5S11.5 47.4 11.5 44z" fill="var(--foot)"/>'
         + '<path d="M17 47h10" stroke="var(--light)" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>',
  }),
};

/**
 * 把一盞燈畫成 SVG 字串。
 * @param {{form:string, bowl:string, flame:string}} lamp
 * @param {{size?:number, lit?:boolean}} opts lit=false 畫成未點亮的灰燈
 */
export function renderLamp(lamp, opts = {}) {
  const { size = 120, lit = true } = opts;
  const b = BOWLS[lamp.bowl] || BOWLS.cinnabar;
  const f = FLAMES[lamp.flame] || FLAMES.gamboge;
  const art = (FORM_ART[lamp.form] || FORM_ART.round)();

  const vars = lit
    ? `--dark:${b.dark};--light:${b.light};--foot:${b.foot};--flame-outer:${f.outer};--flame-halo:${f.halo}`
    : '--dark:#DDD2BE;--light:#E6DDCB;--foot:#CFC2AA;--flame-outer:#DDD2BE;--flame-halo:#E6DDCB';

  const flame = lit
    ? `<ellipse cx="22" cy="17" rx="10.5" ry="14" fill="${f.halo}" opacity=".45"/>
       <path d="M22 5.5c4.4 6 6.8 9.3 6.8 12.9a6.8 6.8 0 0 1-13.6 0c0-3.6 2.4-6.9 6.8-12.9z" fill="${f.outer}"/>
       <path d="M22 13.6c2.1 3.3 3.1 5 3.1 6.6a3.1 3.1 0 0 1-6.2 0c0-1.6 1-3.3 3.1-6.6z" fill="${f.inner}"/>`
    : '';

  // xmlns 是必要的：內嵌在 HTML 裡沒差，但把這串 SVG 當成圖片載入
  // （分享圖卡會這樣做）時，少了它整張圖就不會 render。
  // 紋樣畫在缽身上。舊資料沒有這個欄位，就當素面。
  const pattern = lit ? (PATTERN_ART[lamp.pattern] || '') : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 50 / 44)}" viewBox="0 0 44 50" fill="none" style="${vars}" role="img" aria-label="${lamp.name || '燈'}">
    ${art.behind}
    ${flame}
    <path d="M8 31h28c0 7.8-6.3 12.6-14 12.6S8 38.8 8 31z" fill="var(--dark)"/>
    <path d="M8 31h28c0 2.5-.7 4.7-1.9 6.5H9.9C8.7 35.7 8 33.5 8 31z" fill="var(--light)"/>
    ${pattern}
    ${art.front}
  </svg>`;
}

/**
 * 把 CSS 變數換成實際顏色。
 * 畫到 canvas 的時候需要 —— SVG 被當成圖片載入時沒有外部樣式表，
 * var(--dark) 這種寫法會變成沒有顏色。
 */
export function renderLampFlat(lamp, opts = {}) {
  const b = BOWLS[lamp.bowl] || BOWLS.cinnabar;
  const f = FLAMES[lamp.flame] || FLAMES.gamboge;
  return renderLamp(lamp, opts)
    .replace(/var\(--dark\)/g, b.dark)
    .replace(/var\(--light\)/g, b.light)
    .replace(/var\(--foot\)/g, b.foot)
    .replace(/var\(--flame-outer\)/g, f.outer)
    .replace(/var\(--flame-halo\)/g, f.halo);
}

/**
 * 隨喜越多，燈越亮。
 *
 * 刻意用開根號做遞減：0 個隨喜到 3 個，亮度差很有感；
 * 20 個到 40 個，幾乎看不出來。這樣它是「那邊有件事值得看」的指引，
 * 而不是一個藏起來的排行榜——沒有人能靠衝隨喜把自己的燈燒成太陽。
 *
 * @returns 0~1
 */
export function glowOf(joyCount) {
  const n = Math.max(0, joyCount || 0);
  return Math.min(1, Math.sqrt(n / 12));
}

/**
 * 燈海裡的小光點，只有暈和芯，不畫燈身。
 * @param {number} px 基準大小（依稀有度）
 * @param {number} glow 0~1，來自 glowOf()
 */
export function renderSpark(lamp, px, glow = 0) {
  const f = FLAMES[lamp.flame] || FLAMES.gamboge;
  const g = Math.max(0, Math.min(1, glow));

  const core = px * (1 + 0.5 * g);
  const halo = Math.round(core * (3.2 + 2.6 * g));
  const haloAlpha = (0.85 + 0.15 * g).toFixed(2);

  return `<span class="halo${g > 0.45 ? ' bright' : ''}" style="width:${halo}px;height:${halo}px;opacity:${haloAlpha};background:radial-gradient(circle, ${f.halo} 0%, transparent 70%)"></span>
          <span style="position:relative;display:block;width:${core.toFixed(1)}px;height:${core.toFixed(1)}px;border-radius:50%;background:${f.outer};box-shadow:0 0 ${(core * g * 1.4).toFixed(1)}px ${f.halo}"></span>`;
}
