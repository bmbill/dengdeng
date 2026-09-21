/* 分享圖卡
 *
 * 兩種：
 *   一天的燈   —— 重點跟小卡一樣，善行是主角，燈是陪襯
 *   一片天空   —— 整群的，尤其是滿了那一刻
 *
 * 全部用 canvas 畫，不依賴任何外部服務——不用把你的紀錄
 * 送去別人的伺服器產圖。
 *
 * 景是 SVG 轉點陣後貼上去的，字一律用 canvas 寫：SVG 當成圖片載入時
 * 拿不到頁面的字型，整張卡的味道就沒了。
 */

import { renderLampFlat } from './lamp.js';
import { skySVG } from './sky.js';
import * as S from './store.js';

const W = 1080;
const H = 1350;
const PAD = 90;

const C = {
  paper: '#FAF6EC',
  ink: '#2B2620',
  muted: '#6E6456',
  faint: '#A0937F',
  line: '#EFE6D4',
  cinnabar: '#B04A31',
};

/** SVG 字串畫成可以貼到 canvas 的圖。 */
function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/** 中文沒有空格，所以逐字量寬度來斷行。 */
function wrap(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (line && ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * 畫出某一天的圖卡。
 * @returns {Promise<Blob>} PNG
 */
export async function makeShareCard(day) {
  const lamp = day.lamp;
  if (!lamp) throw new Error('這天還沒供燈');

  // 字體沒載完就畫，會退回系統字型，整張卡的味道就沒了
  try { await document.fonts.ready; } catch { /* 不支援就算了 */ }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);

  // 燈後面的光暈
  const cx = W / 2;
  const lampTop = 130;
  const lampH = 300;
  const glow = ctx.createRadialGradient(cx, lampTop + lampH * 0.42, 0, cx, lampTop + lampH * 0.42, 300);
  glow.addColorStop(0, 'rgba(251, 235, 200, 0.95)');
  glow.addColorStop(1, 'rgba(250, 246, 236, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, lampTop + lampH + 160);

  const img = await svgToImage(renderLampFlat(lamp, { size: 264 }));
  ctx.drawImage(img, cx - img.width / 2, lampTop, img.width, img.height);

  let y = lampTop + lampH + 76;

  // 燈名
  ctx.textAlign = 'center';
  ctx.fillStyle = C.cinnabar;
  ctx.font = '700 62px "Noto Serif TC", serif';
  ctx.fillText(lamp.name, cx, y);
  y += 64;

  // 分隔線
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 72;

  // ── 善行：這才是主角 ──
  //
  // 先量再畫。只寫一則的時候，內容會很短，若從分隔線往下直接排，
  // 中間會空一大塊，看起來像沒做完。所以先算出整塊多高，再置中。
  ctx.textAlign = 'left';
  const maxW = W - PAD * 2;
  const footTop = H - 200;

  const blocks = (day.entries || []).slice(0, 3).map((e) => {
    ctx.font = '400 42px "Noto Sans TC", sans-serif';
    const lines = wrap(ctx, e.text, maxW).slice(0, 4);
    return {
      label: `${S.KINDS[e.kind]?.name || '紀錄'}${e.pages ? ` · ${e.pages} 頁` : ''}`,
      lines,
      height: 46 + lines.length * 62 + 32,
    };
  });

  const blockH = blocks.reduce((a, b) => a + b.height, 0);
  y = Math.max(y, y + (footTop - y - blockH) / 2);

  for (const b of blocks) {
    ctx.fillStyle = C.faint;
    ctx.font = '500 28px "Noto Sans TC", sans-serif';
    ctx.fillText(b.label, PAD, y);
    y += 46;

    ctx.fillStyle = C.ink;
    ctx.font = '400 42px "Noto Sans TC", sans-serif';
    for (const line of b.lines) {
      ctx.fillText(line, PAD, y);
      y += 62;
    }
    y += 32;
  }

  // ── 頁尾 ──
  const me = S.me();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.muted;
  ctx.font = '400 30px "Noto Sans TC", sans-serif';
  ctx.fillText(
    [S.prettyDate(day.date).split(' ·')[0], me.name].filter(Boolean).join(' · '),
    cx, H - 128
  );

  ctx.fillStyle = C.faint;
  ctx.font = '600 30px "Noto Serif TC", serif';
  ctx.fillText('燈燈悅心', cx, H - 72);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('畫不出來'))), 'image/png');
  });
}

/* ══════════════════ 一片天空 ══════════════════ */

/**
 * 整片共同燈海畫成一張圖。
 *
 * 位置、景、鎏金都跟畫面上那一片同一組座標（都來自 sky.js），
 * 所以分享出去的跟大家看到的是同一片天空，不是另外畫一張像的。
 *
 * 會動的東西挑一個瞬間定住：人剛好走進畫面、塔燈亮著。
 * 省略不畫的話，分享出去的天空會比真的那片空。
 */
export async function makeSkyCard({ info, spots, reached, groupName }) {
  try { await document.fonts.ready; } catch { /* 不支援就算了 */ }

  // 天空留 1010，底下 340 給字。字帶再窄一點，日期就會壓到落款上。
  const skyH = 1010;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0E1620';
  ctx.fillRect(0, 0, W, H);

  const scene = skySVG({
    layout: spots.map((p) => ({ x: p.x, y: p.y, glow: p.glow, lamp: p.it.lamp })),
    filled: info.filled,
    reached,
    skyNo: info.skyNo,
    height: skyH,
  });
  const img = await svgToImage(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${skyH}" viewBox="0 0 ${W} ${skyH}">${scene}</svg>`);
  ctx.drawImage(img, 0, 0, W, skyH);

  // 天空與字帶之間收一道，不然接縫是一條線
  const seam = ctx.createLinearGradient(0, skyH - 120, 0, skyH);
  seam.addColorStop(0, 'rgba(14, 22, 32, 0)');
  seam.addColorStop(1, '#0E1620');
  ctx.fillStyle = seam;
  ctx.fillRect(0, skyH - 120, W, 120);

  ctx.textAlign = 'center';
  const cx = W / 2;
  let y = skyH + 78;

  ctx.fillStyle = '#F2E6CC';
  ctx.font = '700 56px "Noto Serif TC", serif';
  ctx.fillText(groupName || '大家的燈海', cx, y);
  y += 58;

  ctx.fillStyle = '#F2C877';
  ctx.font = '400 34px "Noto Sans TC", sans-serif';
  ctx.fillText(
    `第 ${info.skyNo} 片天空 · ${info.isFull ? `滿了 ${info.filled} 盞` : `${info.filled} / ${info.size} 盞`}`,
    cx, y
  );
  y += 46;

  ctx.fillStyle = '#A9B5BF';
  ctx.font = '400 29px "Noto Sans TC", sans-serif';
  ctx.fillText(
    `${info.authors} 個人 · ${info.entries} 則紀錄${info.pages ? ` · ${info.pages} 頁經` : ''}`,
    cx, y
  );
  y += 42;
  ctx.fillText(skyRange(info), cx, y);

  ctx.fillStyle = '#6E7C8A';
  ctx.font = '600 28px "Noto Serif TC", serif';
  ctx.fillText('燈燈悅心', cx, H - 46);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('畫不出來'))), 'image/png');
  });
}

/** 這片天空涵蓋哪幾天。 */
function skyRange(info) {
  if (!info.fromDay) return '';
  const a = S.prettyDate(info.fromDay).split(' ·')[0];
  if (info.fromDay === info.toDay) return a;
  return `${a} – ${S.prettyDate(info.toDay).split(' ·')[0]}`;
}

export async function shareSky(ctx) {
  const blob = await makeSkyCard(ctx);
  return send(blob, `燈燈悅心-第${ctx.info.skyNo}片天空.png`);
}

/* ══════════════════ 送出去 ══════════════════ */

/**
 * 分享出去。
 * 手機上直接跳出 LINE 那排；不支援分享檔案的就存成圖片。
 * @returns 'shared' | 'saved' | 'cancelled'
 */
export async function shareCard(day) {
  const blob = await makeShareCard(day);
  return send(blob, `燈燈悅心-${day.date}.png`);
}

async function send(blob, name) {
  const file = new File([blob], name, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // 其他錯誤就退回存檔
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
