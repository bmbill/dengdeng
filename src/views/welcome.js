/* 第一次打開
 *
 * 只問一件事：要叫你什麼。
 * 不做導覽、不做分頁教學——這個 app 的門檻本來就低到不需要教，
 * 多問一句都是在消耗人家剛進來的那點興致。
 *
 * 帶著邀請連結進來的人（?j=CODE）會走另一條路：
 * 取完名字直接進群，不用自己再找一次輸入框。
 */

import * as S from '../store.js';
import * as SB from '../supabase.js';
import { esc, sheet, closeSheet, toast } from '../ui.js';
import { renderLamp } from '../lamp.js';
import { isOnlineMode } from '../config.js';

export function render(root, done, invite = null) {
  const invited = Boolean(invite && isOnlineMode());

  root.innerHTML = `
    <div class="welcome">
      <div class="welcome-top">
        <div class="welcome-lamp">
          ${renderLamp({ form: 'petal', bowl: 'cinnabar', flame: 'gamboge' }, { size: 116 })}
        </div>
        <h1>燈燈悅心</h1>
        <p class="welcome-lede">
          隨手記一則善行，<br>一天供一盞燈。
        </p>
        ${invited ? `
          <div class="welcome-invite">
            <span class="tag rare">收到一張邀請</span>
            <p class="small" style="margin-top:8px">取好名字就會自動加入。</p>
          </div>` : ''}
      </div>

      <div class="welcome-form">
        <label class="welcome-label" for="nameInput">要怎麼稱呼你？</label>
        <input id="nameInput" class="field" maxlength="12" autocomplete="nickname"
               placeholder="例：王福智" data-name>
        <p class="small" style="margin-top:10px">
          同行看到的就是這個名字，之後隨時可以改。
        </p>

        <button class="btn btn-full" style="margin-top:18px" data-go disabled>
          ${invited ? '加入並開始' : '開始'}
        </button>

        ${!invited && isOnlineMode() ? `
          <button class="btn ghost btn-full" style="margin-top:10px" data-code>
            朋友給了我邀請碼
          </button>` : ''}

        <button class="welcome-skip" data-skip>之後再說</button>
      </div>
    </div>
  `;

  const input = root.querySelector('[data-name]');
  const goBtn = root.querySelector('[data-go]');

  const sync = () => { goBtn.disabled = !input.value.trim(); };
  input.addEventListener('input', sync);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) submit();
  });

  goBtn.addEventListener('click', submit);
  root.querySelector('[data-skip]').addEventListener('click', () => finish('', done));
  root.querySelector('[data-code]')?.addEventListener('click', () => openCode(input, done));

  // 手機上自動彈鍵盤會把版面推掉，讓使用者自己點。
  if (window.matchMedia('(min-width: 600px)').matches) input.focus();

  async function submit() {
    const name = input.value.trim();
    if (!name) return;

    if (!invited) return finish(name, done);

    // 帶邀請碼進來的：先存名字再加入，不然對方看到的會是「無名」。
    goBtn.disabled = true;
    goBtn.textContent = '正在加入…';
    S.setMe({ name });
    try {
      await SB.syncProfile();
      const g = await SB.joinGroup(invite);
      toast(`加入了「${g.name}」`);
    } catch (e) {
      // 加入失敗不該把人卡在門口。名字已經存了，進去之後還能再試。
      toast(e.message || '加入失敗，可以稍後在同行分頁再試');
    }
    done();
  }
}

function finish(name, done) {
  S.setMe({ name: name.trim() });
  if (name.trim() && isOnlineMode()) {
    // 背景同步，不擋畫面。失敗了下次進同行分頁會再試一次。
    SB.syncProfile().catch(() => {});
  }
  done();
}

/** 手動輸入邀請碼。先存名字再加入，不然對方看到的會是「無名」。 */
function openCode(input, done) {
  sheet(`
    <h2>加入同行</h2>
    <p class="small" style="margin-top:6px">貼上朋友給你的 8 碼邀請碼。</p>
    <input class="field" style="margin-top:14px;letter-spacing:.2em;text-align:center;font-size:1.2rem"
           maxlength="8" placeholder="ABCD2345" aria-label="邀請碼" data-code>
    <button class="btn btn-full" style="margin-top:16px" data-join>加入</button>
  `, (el) => {
    const codeInput = el.querySelector('[data-code]');
    codeInput.focus();

    el.querySelector('[data-join]').addEventListener('click', async () => {
      const code = codeInput.value.trim();
      if (!code) return toast('貼上邀請碼');

      const name = input.value.trim();
      if (name) S.setMe({ name });

      try {
        await SB.syncProfile();
        const g = await SB.joinGroup(code);
        closeSheet();
        toast(`加入了「${esc(g.name)}」`);
        done();
      } catch (e) {
        toast(e.message || '加入失敗');
      }
    });
  });
}
