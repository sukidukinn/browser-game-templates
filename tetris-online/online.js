(() => {
  const cfg = window.TETRIS_ONLINE_CONFIG || {};
  const panel = document.getElementById('online-panel');
  const sendBtn = document.getElementById('send-score');
  const closeBtn = document.getElementById('close-online');
  const periodEl = document.getElementById('rank-period');
  const refreshBtn = document.getElementById('refresh-ranking');
  const statusEl = document.getElementById('online-status');
  const commentEl = document.getElementById('comment');
  const urlEl = document.getElementById('referral-url');
  const nameEl = document.getElementById('player-name');
  const scoreEl = document.getElementById('debug-score');
  const linesEl = document.getElementById('debug-lines');
  const levelEl = document.getElementById('debug-level');
  const timeEl = document.getElementById('debug-time');
  const tbody = document.getElementById('ranking-body');
  const myRankEl = document.getElementById('my-rank');
  const copyGameBtn = document.getElementById('copy-game-state');

  let client = null;
  let lastSubmitted = null;

  function configured() {
    return cfg.supabaseUrl && !cfg.supabaseUrl.includes('YOUR_PROJECT_REF') &&
      cfg.supabasePublishableKey && !cfg.supabasePublishableKey.includes('YOUR_PUBLISHABLE_KEY');
  }

  function getClient() {
    if (!configured()) return null;
    if (!client) client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    return client;
  }

  function snapshot() {
    return window.TetrisOnlineBridge?.getSnapshot?.() || { score: 0, lines: 0, level: 1, elapsedMs: 0 };
  }

  function clampInt(value, min, max) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function parseTimeToMs(value) {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return clampInt(raw, 0, 86400) * 1000;
    const parts = raw.split(':').map(v => Number.parseInt(v, 10));
    if (parts.some(v => !Number.isFinite(v) || v < 0)) return 0;
    let seconds = 0;
    if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else return 0;
    return clampInt(seconds, 0, 86400) * 1000;
  }

  function setTimeFromMs(ms) {
    timeEl.value = formatTime(ms);
  }

  function copyGameState() {
    const s = snapshot();
    scoreEl.value = String(s.score);
    linesEl.value = String(s.lines);
    levelEl.value = String(s.level);
    setTimeFromMs(s.elapsedMs);
    setStatus('現在のゲーム値をデバッグ欄へコピーしました。ここから自由に編集できます。');
  }

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', isError);
  }

  function safeUrl(value) {
    if (!value.trim()) return null;
    try {
      const u = new URL(value.trim());
      if (!['http:', 'https:'].includes(u.protocol)) return null;
      return u.href;
    } catch { return null; }
  }

  function startOfPeriod(period) {
    const d = new Date();
    if (period === 'week') {
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    if (period === 'month') {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    return null;
  }

  function applyStep(button) {
    const target = document.getElementById(button.dataset.target);
    if (!target) return;
    const delta = Number(button.dataset.delta || 0);
    if (target === timeEl) {
      const next = Math.max(0, parseTimeToMs(timeEl.value) + delta * 1000);
      setTimeFromMs(next);
      return;
    }
    const min = Number(target.min || 0);
    const max = Number(target.max || Number.MAX_SAFE_INTEGER);
    target.value = String(Math.min(max, Math.max(min, clampInt(target.value, min, max) + delta)));
  }

  async function refreshRanking() {
    const sb = getClient();
    if (!sb) return setStatus('supabase-config.js にProject URLとPublishable keyを設定してください。', true);
    setStatus('ランキング取得中...');
    const period = periodEl.value;
    const since = startOfPeriod(period);
    let q = sb.from('game_scores')
      .select('id,player_name,score,lines,level,play_time_ms,comment,referral_url,created_at')
      .eq('game_slug', cfg.gameSlug)
      .order('score', { ascending: false })
      .order('play_time_ms', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(20);
    if (since) q = q.gte('created_at', since);
    const { data, error } = await q;
    if (error) return setStatus(`ランキング取得失敗: ${error.message}`, true);

    tbody.replaceChildren();
    (data || []).forEach((row, i) => {
      const tr = document.createElement('tr');
      if (lastSubmitted?.id === row.id) tr.classList.add('my-row');
      const rank = document.createElement('td'); rank.textContent = String(i + 1);
      const name = document.createElement('td');
      if (row.referral_url) {
        const a = document.createElement('a');
        a.href = row.referral_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = row.player_name || 'Player';
        name.appendChild(a);
      } else name.textContent = row.player_name || 'Player';
      if (row.comment) {
        const c = document.createElement('small'); c.textContent = row.comment;
        name.appendChild(document.createElement('br')); name.appendChild(c);
      }
      const sc = document.createElement('td'); sc.textContent = String(row.score);
      const tm = document.createElement('td'); tm.textContent = formatTime(row.play_time_ms);
      const ln = document.createElement('td'); ln.textContent = String(row.lines);
      const lv = document.createElement('td'); lv.textContent = String(row.level);
      tr.append(rank, name, sc, tm, ln, lv); tbody.appendChild(tr);
    });

    if (lastSubmitted) {
      // Higher score ranks first. For equal scores, shorter time ranks first.
      let betterScore = sb.from('game_scores').select('id', { count: 'exact', head: true })
        .eq('game_slug', cfg.gameSlug)
        .gt('score', lastSubmitted.score);
      let sameScoreFaster = sb.from('game_scores').select('id', { count: 'exact', head: true })
        .eq('game_slug', cfg.gameSlug)
        .eq('score', lastSubmitted.score)
        .lt('play_time_ms', lastSubmitted.play_time_ms);
      if (since) {
        betterScore = betterScore.gte('created_at', since);
        sameScoreFaster = sameScoreFaster.gte('created_at', since);
      }
      const [a, b] = await Promise.all([betterScore, sameScoreFaster]);
      if (a.error || b.error) myRankEl.textContent = '順位取得失敗';
      else {
        const rank = (a.count || 0) + (b.count || 0) + 1;
        myRankEl.textContent = `今回の順位: ${rank}位 / ${period === 'week' ? '今週' : period === 'month' ? '今月' : '歴代'}（Score↓ / 同点はTime↑）`;
      }
    } else {
      myRankEl.textContent = 'Send後に今回の順位を表示します。';
    }
    setStatus('ランキング更新完了');
  }

  async function sendScore() {
    const sb = getClient();
    if (!sb) return setStatus('先にsupabase-config.jsを設定してください。', true);

    const referral = safeUrl(urlEl.value);
    if (urlEl.value.trim() && !referral) return setStatus('誘導URLは http:// または https:// のURLを入力してください。', true);

    const payload = {
      game_slug: cfg.gameSlug,
      user_id: null,
      player_name: (nameEl.value.trim() || 'Anonymous').slice(0, 32),
      score: clampInt(scoreEl.value, 0, 100000000),
      lines: clampInt(linesEl.value, 0, 1000000),
      level: clampInt(levelEl.value, 1, 100000),
      play_time_ms: parseTimeToMs(timeEl.value),
      comment: commentEl.value.trim() ? commentEl.value.trim().slice(0, 160) : null,
      referral_url: referral
    };

    // Normalize fields so what the user sees is exactly what will be sent.
    scoreEl.value = String(payload.score);
    linesEl.value = String(payload.lines);
    levelEl.value = String(payload.level);
    setTimeFromMs(payload.play_time_ms);

    sendBtn.disabled = true;
    setStatus('送信中...');
    const { data, error } = await sb.from('game_scores')
      .insert(payload)
      .select('id,score,play_time_ms')
      .single();
    sendBtn.disabled = false;
    if (error) return setStatus(`送信失敗: ${error.message}`, true);
    lastSubmitted = { id: data.id, score: data.score, play_time_ms: data.play_time_ms };
    setStatus('送信しました。ランキングを更新します。');
    await refreshRanking();
  }

  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyD') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !scoreEl.dataset.initialized) {
      copyGameState();
      scoreEl.dataset.initialized = '1';
    }
  });

  document.querySelectorAll('[data-target][data-delta]').forEach(btn => {
    btn.addEventListener('click', () => applyStep(btn));
  });
  closeBtn.addEventListener('click', () => panel.hidden = true);
  copyGameBtn.addEventListener('click', copyGameState);
  sendBtn.addEventListener('click', sendScore);
  refreshBtn.addEventListener('click', refreshRanking);
  periodEl.addEventListener('change', () => { if (lastSubmitted) refreshRanking(); });
})();
