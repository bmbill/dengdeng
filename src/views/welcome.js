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

        ${isOnlineMode() ? `
          <button class="btn ghost btn-full" style="margin-top:10px" data-restore>
            我換過手機了
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
  root.querySelector('[data-restore]')?.addEventListener('click', () => openRestore(done));

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

/**
 * 換手機：用接回碼把舊身分名下的東西接過來。
 *
 * 不問名字——名字連同燈和群一起接回來，再問一次只是多一道手續。
 */
function openRestore(done) {
  sheet(`
    <h2>接回舊手機的紀錄</h2>
    <p class="small" style="margin-top:6px">
      在舊手機的「我」分頁最下面，按「顯示接回碼」就看得到那 12 碼。
    </p>
    <input class="field" style="margin-top:14px;letter-spacing:.14em;text-align:center;font-size:1.1rem"
           maxlength="16" placeholder="K7M2-P4XQ-9RTN" aria-label="接回碼" data-code>
    <button class="btn btn-full" style="margin-top:16px" data-go>接回來</button>
    <p class="small" style="margin-top:12px">
      沒公開過的那幾則接不回來——它們從來沒離開過舊手機，那些要用備份檔。
    </p>
  `, (el) => {
    const codeInput = el.querySelector('[data-code]');
    const btn = el.querySelector('[data-go]');
    codeInput.focus();

    btn.addEventListener('click', async () => {
      const code = codeInput.value.trim();
      if (!code) return toast('貼上接回碼');

      btn.disabled = true;
      btn.textContent = '正在接…';
      try {
        const r = await SB.reclaimIdentity(code);
        S.setMe({ name: r.name });
        // 伺服器上有的燈拉回本機，不然新手機的「我的燈海」會是空的
        const n = await SB.pullMyLamps();
        await SB.myGroups();
        closeSheet();
        toast(`接回來了，${n} 盞燈、${r.groups} 個群`);
        done();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = '接回來';
        toast(e.message || '接不回來');
      }
    });
  });
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
