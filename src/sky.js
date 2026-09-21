/* 夜空 —— 場景、會長出來的東西、以及畫成圖卡的那一版
 *
 * 這裡是「天空長什麼樣」的單一來源，畫面上的天空從這支出去。
 *
 * 景分兩層長：
 *
 *   這一片填了幾盞（0–108）  風 → 草 → 塔 → 月
 *   這個群一共供過幾盞        出家人 → 河燈 → 雁 → 滿天星
 *
 * 為什麼要兩層：一片天空上限就是 108 盞，所以只看「這一片」的話，
 * 49 以上幾乎沒東西可長，365 的滿天星在群組裡永遠不會出現。
 * 分開之後，新群的天空乾淨、老群的天空熟，而每一片還是從空長到滿。
 *
 * 底色則是第幾片天空決定的（三種循環），真實的節氣與時辰再疊一層：
 * 冬天飄雪、清晨天色轉淡。月相本來就跟外面同步，這是往下接同一件事。
 */

/* ── 場景 ──
 * 每一片天空換一種底。不用設定、不用改資料庫，而且「下一片是什麼」
 * 本身就是把這一片填滿的動力。 */

export const SCENES = [
  { key: 'night', name: '夜空' },
  { key: 'lake',  name: '湖面' },
  { key: 'valley', name: '山谷' },
];

/** 第幾片天空 → 哪一種底。第 1 片永遠是夜空。 */
export function sceneOf(skyNo = 1) {
  return SCENES[(Math.max(1, skyNo) - 1) % SCENES.length];
}

/* ── 會長出來的東西 ── */

/** 這一片自己的進度。每一片都從空走到滿，所以這幾樣會重來。 */
export const SKY_STAGES = [
  { at: 7,   cls: 'windy',  label: '燈會開始隨風飄' },
  { at: 21,  cls: 'reeds',  label: '岸邊長出草，偶爾有人走過' },
  { at: 49,  cls: 'pagoda', label: '遠處浮起一座塔，塔上偶爾亮燈' },
  { at: 108, cls: 'moon',   label: '天上出現月亮' },
];

/** 這個群一共供過幾盞。不會因為換了新的一片而清空。 */
export const LIFE_STAGES = [
  { at: 216,  cls: 'monk',  label: '有出家人經過，會停下來合掌' },
  { at: 324,  cls: 'lights', label: '水上漂起河燈' },
  { at: 540,  cls: 'geese', label: '偶爾有一行雁飛過' },
  { at: 1080, cls: 'stars', label: '滿天都是星' },
];

/**
 * 下一個會發生的事。
 * 兩層各找一個，取比較近的那個講——「再 6 盞」要是真的再 6 盞。
 */
export function nextMilestone(filled, reached = filled) {
  const a = SKY_STAGES.find((m) => filled < m.at);
  const b = LIFE_STAGES.find((m) => reached < m.at);
  const left = (m, n) => (m ? m.at - n : Infinity);
  if (left(a, filled) <= left(b, reached)) return a ? { ...a, left: a.at - filled } : null;
  return b ? { ...b, left: b.at - reached } : null;
}

/* ── 節氣與時辰 ──
 * 月亮已經跟真的月相同步了，這是往下接：冬天飄雪、清晨天色轉淡。
 * 只做這兩件，再多天空就不是天空了。 */

export function ambience(now = new Date()) {
  const h = now.getHours();
  const m = now.getMonth() + 1;
  return {
    tod: h >= 5 && h < 8 ? 'dawn' : h >= 17 && h < 19 ? 'dusk' : 'night',
    snow: m === 12 || m === 1 || m === 2,
  };
}

/**
 * 夜空那個容器要掛哪些 class。
 * @param {{filled:number, reached?:number, skyNo?:number, now?:Date}} ctx
 */
export function stageClasses(ctx) {
  const { filled = 0, reached = filled, skyNo = 1, now = new Date() } = ctx;
  const amb = ambience(now);
  return [
    `sc-${sceneOf(skyNo).key}`,
    `tod-${amb.tod}`,
    amb.snow ? 'snowy' : '',
    ...SKY_STAGES.filter((m) => filled >= m.at).map((m) => m.cls),
    ...LIFE_STAGES.filter((m) => reached >= m.at).map((m) => m.cls),
  ].filter(Boolean).join(' ');
}

/* ── 月相 ──
 * 關鍵是暗面不畫。用天空色的實心圓去切，等於在天空上蓋一塊不透明的
 * 深色圓，暗的那半看得見，而且會擋住後面的燈。 */

export function moonPhase(date = new Date()) {
  const ref = Date.UTC(2000, 0, 6, 18, 14);        // 一個已知的朔
  const syn = 29.530588853 * 86400000;             // 朔望月
  let p = ((date.getTime() - ref) % syn) / syn;
  if (p < 0) p += 1;
  return p;                                        // 0 是朔、0.5 是望
}

let moonSeq = 0;

/** 月亮的 SVG 內容（不含外框），40×40 的座標系。 */
export function moonArt(date = new Date()) {
  const p = moonPhase(date);
  const cosT = Math.cos(2 * Math.PI * p);
  // 亮的比例。全黑的朔留一點點，不然「天上出現月亮」會看不到東西。
  const k = Math.max(0.055, (1 - cosT) / 2);
  const waxing = p < 0.5;                          // 上弦：北半球亮在右邊
  const gibbous = k > 0.5;
  const rx = (Math.abs(cosT) * 20).toFixed(2);
  const id = `mn${++moonSeq}`;
  const half = `M20 0A20 20 0 0 ${waxing ? 1 : 0} 20 40Z`;

  return `<mask id="${id}">
      <rect width="40" height="40" fill="#000"/>
      <path d="${half}" fill="#fff"/>
      <ellipse cx="20" cy="20" rx="${rx}" ry="20" fill="${gibbous ? '#fff' : '#000'}"/>
    </mask>
    <circle cx="20" cy="20" r="20" fill="#E8E2D2" mask="url(#${id})"/>`;
}

/* ── 幾何：草、塔、山、人、船 ──
 * 都回傳純 path，DOM 和圖卡共用同一組形狀。 */

/**
 * 岸邊的草。
 * 剪影，不是一根根線條——線條在深色天空上看起來像刮痕。
 * 分遠近兩層：遠的矮、淺、密，近的高、深、疏，只有一層會很平。
 */
export function grassPath(count, maxH, salt) {
  const W = 320;
  const step = W / count;
  let d = 'M0 40';
  for (let i = 0; i < count; i++) {
    const x = i * step;
    // 瘦而高才像草。寬而尖會變成松林。
    const w = step * (0.42 + ((i * 7 + salt) % 5) * 0.09);
    const h = maxH * (0.5 + ((i * 13 + salt) % 9) / 11);
    const lean = (((i * 5 + salt) % 7) - 3) * (w * 0.55);
    const tip = x + w / 2 + lean;
    d += ` L${x.toFixed(1)} 40`
       + ` Q${(x + w * 0.1 + lean * 0.4).toFixed(1)} ${(40 - h * 0.55).toFixed(1)} ${tip.toFixed(1)} ${(40 - h).toFixed(1)}`
       + ` Q${(x + w * 0.9 + lean * 0.4).toFixed(1)} ${(40 - h * 0.45).toFixed(1)} ${(x + w).toFixed(1)} 40`;
  }
  return `${d} L${W} 40 Z`;
}

export const PAGODA_ART = `
  <path d="M40 4l20 12H20z"/><path d="M26 16h28v10H26z"/>
  <path d="M40 26l24 12H16z"/><path d="M24 38h32v12H24z"/>
  <path d="M40 50l28 14H12z"/><path d="M22 64h36v22H22z"/>
  <path d="M8 86h64v10H8z"/>`;

/** 遠山。山谷那一景的底，兩層疊出深度。 */
export const RANGE_FAR = 'M0 40 L38 14 L62 26 L96 4 L130 24 L162 12 L196 30 L232 10 L268 28 L300 16 L320 30 L320 40 Z';
export const RANGE_NEAR = 'M0 40 L26 26 L58 34 L88 20 L124 34 L158 24 L188 36 L226 22 L258 34 L292 26 L320 36 L320 40 Z';

/** 走路的人。頭要露出草，整個埋在草裡就看不出是人。 */
export const WALKER_ART = `
  <circle cx="8" cy="4.2" r="3.2"/>
  <path d="M8 7.6c-2.8 0-4.4 2.2-4.9 7L2 24h12l-1.1-9.4c-.5-4.8-2.1-7-4.9-7z"/>`;

/**
 * 出家人。
 * 跟走路的人要一眼分得出來：光頭、袈裟下襬比較寬、手在胸前合掌。
 * 合掌是這個剪影的重點，所以手的那一塊要挖出來看得見。
 */
export const MONK_ART = `
  <circle cx="9" cy="4" r="3.4"/>
  <path d="M9 7.4c-3.2 0-5 2.4-5.6 7.4L2 26h14l-1.4-11.2c-.6-5-2.4-7.4-5.6-7.4z"/>
  <path d="M9 10.4l2.6 4.4H6.4z" fill="#0E1620" opacity=".55"/>`;

/** 河燈。一盞小小的，飄在水上。 */
export const BOAT_ART = `
  <path d="M1 7h14l-2.2 4H3.2z"/>
  <path d="M8 0.6c1.7 2.2 2.5 3.4 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1.2.8-2.4 2.5-4.6z" fill="#F0C479"/>`;

/** 一行雁。單數隻，兩邊不對稱，才不像箭號。 */
export const GEESE = [
  { x: 0, y: 0, s: 1 }, { x: 9, y: 5, s: .9 }, { x: 18, y: 10, s: .82 },
  { x: -9, y: 6, s: .9 }, { x: -18, y: 12, s: .8 }, { x: -27, y: 19, s: .72 },
];

export const GOOSE_ART = 'M0 3q3-3.2 5.4 0Q3 1.6 0 3ZM0 3q-3-3.2-5.4 0Q-3 1.6 0 3Z';

/* ══════════════════ 畫面上的那一片 ══════════════════
 *
 * DOM 版。會動的東西（風、走過的人、閃的塔燈、飄的雪）靠 CSS 動畫，
 * 這裡只負責把元素放進去。 */

/** 夜空裡那些「長出來」的東西。 */
export function sceneryHTML(ctx) {
  const { filled = 0, reached = filled, skyNo = 1, now = new Date() } = ctx;
  const scene = sceneOf(skyNo).key;
  const amb = ambience(now);

  return `
    ${scene === 'lake' ? '<span class="sky-water" aria-hidden="true"></span>' : ''}
    ${scene === 'valley' ? `<svg class="sky-range" viewBox="0 0 320 40" preserveAspectRatio="none" aria-hidden="true">
      <path class="range-far" d="${RANGE_FAR}"/><path class="range-near" d="${RANGE_NEAR}"/>
    </svg>` : ''}

    ${filled >= 108 ? `<span class="sky-moon"><svg viewBox="0 0 40 40" aria-hidden="true">${moonArt(now)}</svg></span>` : ''}
    ${reached >= 1080 ? starField() : ''}
    ${reached >= 540 ? geese() : ''}

    ${filled >= 49 ? `<svg class="sky-pagoda" viewBox="0 0 80 96" fill="none" aria-hidden="true">
      ${PAGODA_ART}
      <rect class="tower-lamp a" x="35" y="69" width="10" height="11" rx="1.4"/>
      <rect class="tower-lamp b" x="36" y="41" width="8" height="7" rx="1.2"/>
    </svg>` : ''}

    ${reached >= 324 ? riverLights() : ''}
    ${filled >= 21 ? walker() + reeds() : ''}
    ${reached >= 216 ? monk() : ''}
    ${amb.snow ? snowField() : ''}
  `;
}

function starField() {
  return [...Array(26)].map((_, i) => {
    const x = (8 + 84 * ((i * 0.7548776662) % 1)).toFixed(1);
    const y = (6 + 56 * ((i * 0.5698402909) % 1)).toFixed(1);
    const s = (0.8 + (i % 3) * 0.5).toFixed(1);
    return `<span class="sky-star" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:${(i % 7) * 0.6}s"></span>`;
  }).join('');
}

/** 冬天才有。飄得慢，而且不能多——雪一多就看不到燈了。 */
function snowField() {
  return [...Array(22)].map((_, i) => {
    const x = ((i * 37.7) % 100).toFixed(1);
    const s = (1.4 + (i % 3) * 0.7).toFixed(1);
    return `<span class="sky-snow" style="left:${x}%;width:${s}px;height:${s}px;`
         + `animation-duration:${(11 + (i % 5) * 3).toFixed(0)}s;animation-delay:-${(i * 1.7).toFixed(1)}s"></span>`;
  }).join('');
}

/**
 * 偶爾有人走過。
 * 一趟走完大約 35 秒，但整個循環是 4 分鐘——多數時候畫面上沒有人，
 * 你偶爾抬頭才會看到有個影子在走。常常出現就不稀奇了。
 */
function walker() {
  return `<span class="sky-walker" aria-hidden="true">
    <svg viewBox="0 0 16 26" fill="none">${WALKER_ART}</svg>
  </span>`;
}

/**
 * 出家人經過，走到中間會停下來合掌。
 *
 * 比走路的人更少見（六分半一趟），停的那幾秒是這個元素的重點——
 * 一直走過去就只是另一個路人。
 */
function monk() {
  return `<span class="sky-monk" aria-hidden="true">
    <svg viewBox="0 0 18 28" fill="none">${MONK_ART}</svg>
  </span>`;
}

/** 水上的河燈。飄的方向跟風一致，不然畫面會打架。 */
function riverLights() {
  return [0, 1, 2].map((i) => `<span class="sky-river r${i}" aria-hidden="true">
    <svg viewBox="0 0 16 12" fill="none">${BOAT_ART}</svg>
  </span>`).join('');
}

/** 一行雁。飛很久才一趟，飛過去就沒了。 */
function geese() {
  return `<span class="sky-geese" aria-hidden="true">
    <svg viewBox="-34 -6 60 32" fill="none">
      ${GEESE.map((g) => `<g transform="translate(${g.x} ${g.y}) scale(${g.s})"><path d="${GOOSE_ART}"/></g>`).join('')}
    </svg>
  </span>`;
}

function reeds() {
  return `<svg class="sky-reeds" viewBox="0 0 320 40" preserveAspectRatio="none" fill="none" aria-hidden="true">
    <path class="grass-far" d="${grassPath(40, 24, 0)}"/>
    <path class="grass-near" d="${grassPath(26, 37, 4)}"/>
  </svg>`;
}
