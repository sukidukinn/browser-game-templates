(() => {
  const cfg = window.TETRIS_ONLINE_CONFIG || {};
  const panel = document.getElementById('online-panel');
  const sendBtn = document.getElementById('send-score');
  const loginBtn = document.getElementById('github-login');
  const logoutBtn = document.getElementById('logout');
  const closeBtn = document.getElementById('close-online');
  const periodEl = document.getElementById('rank-period');
  const refreshBtn = document.getElementById('refresh-ranking');
  const statusEl = document.getElementById('online-status');
  const authEl = document.getElementById('auth-status');
  const commentEl = document.getElementById('comment');
  const urlEl = document.getElementById('referral-url');
  const nameEl = document.getElementById('player-name');
  const scoreOut = document.getElementById('debug-score');
  const linesOut = document.getElementById('debug-lines');
  const levelOut = document.getElementById('debug-level');
  const timeOut = document.getElementById('debug-time');
  const tbody = document.getElementById('ranking-body');
  const myRankEl = document.getElementById('my-rank');

  let client = null;
  let session = null;
  let lastSubmitted = null;

  function configured() {
    return cfg.supabaseUrl && !cfg.supabaseUrl.includes('YOUR_PROJECT_REF') &&
      cfg.supabasePublishableKey && !cfg.supabasePublishableKey.includes('YOUR_PUBLISHABLE_KEY');
  }

  function getClient() {
    if (!configured()) return null;
    if (!client) client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  function snapshot() {
    return window.TetrisOnlineBridge?.getSnapshot?.() || { score: 0, lines: 0, level: 1, elapsedMs: 0 };
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function updateSnapshot() {
    const s = snapshot();
    scoreOut.textContent = s.score;
    linesOut.textContent = s.lines;
    levelOut.textContent = s.level;
    timeOut.textContent = formatTime(s.elapsedMs);
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

  function updateAuthUI() {
    const loggedIn = !!session?.user;
    const meta = session?.user?.user_metadata || {};
    authEl.textContent = loggedIn ? `GitHubログイン: ${meta.user_name || meta.preferred_username || meta.name || 'OK'}` : '未ログイン（スコア送信は可能）';
    loginBtn.hidden = loggedIn;
    logoutBtn.hidden = !loggedIn;
    commentEl.disabled = !loggedIn;
    urlEl.disabled = !loggedIn;
    document.getElementById('login-note').hidden = loggedIn;
    if (loggedIn && !nameEl.value) nameEl.value = meta.user_name || meta.preferred_username || meta.name || '';
  }

  function startOfPeriod(period) {
    const d = new Date();
    if (period === 'week') {
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      d.setHours(0,0,0,0);
      return d.toISOString();
    }
    if (period === 'month') {
      d.setDate(1); d.setHours(0,0,0,0);
      return d.toISOString();
    }
    return null;
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
      .order('created_at', { ascending: true })
      .limit(10);
    if (since) q = q.gte('created_at', since);
    const { data, error } = await q;
    if (error) return setStatus(`ランキング取得失敗: ${error.message}`, true);

    tbody.replaceChildren();
    (data || []).forEach((row, i) => {
      const tr = document.createElement('tr');
      const rank = document.createElement('td'); rank.textContent = String(i + 1);
      const name = document.createElement('td');
      if (row.referral_url) {
        const a = document.createElement('a'); a.href = row.referral_url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = row.player_name || 'Player';
        name.appendChild(a);
      } else name.textContent = row.player_name || 'Player';
      if (row.comment) { const c = document.createElement('small'); c.textContent = row.comment; name.appendChild(document.createElement('br')); name.appendChild(c); }
      const sc = document.createElement('td'); sc.textContent = String(row.score);
      const tm = document.createElement('td'); tm.textContent = formatTime(row.play_time_ms);
      tr.append(rank, name, sc, tm); tbody.appendChild(tr);
    });

    if (lastSubmitted) {
      let c = sb.from('game_scores').select('id', { count: 'exact', head: true })
        .eq('game_slug', cfg.gameSlug).gt('score', lastSubmitted.score);
      if (since) c = c.gte('created_at', since);
      const { count, error: countError } = await c;
      myRankEl.textContent = countError ? '順位取得失敗' : `今回の順位: ${(count || 0) + 1}位 / ${period === 'week' ? '今週' : period === 'month' ? '今月' : '歴代'}`;
    } else {
      myRankEl.textContent = 'Send後に今回の順位を表示します。';
    }
    setStatus('ランキング更新完了');
  }

  async function sendScore() {
    const sb = getClient();
    if (!sb) return setStatus('先にsupabase-config.jsを設定してください。', true);
    const s = snapshot();
    const loggedIn = !!session?.user;
    const referral = safeUrl(urlEl.value);
    if (loggedIn && urlEl.value.trim() && !referral) return setStatus('誘導URLは http:// または https:// のURLを入力してください。', true);

    const payload = {
      game_slug: cfg.gameSlug,
      user_id: loggedIn ? session.user.id : null,
      player_name: (nameEl.value.trim() || 'Anonymous').slice(0, 32),
      score: Math.max(0, Math.floor(s.score)),
      lines: Math.max(0, Math.floor(s.lines)),
      level: Math.max(1, Math.floor(s.level)),
      play_time_ms: Math.max(0, Math.floor(s.elapsedMs)),
      comment: loggedIn && commentEl.value.trim() ? commentEl.value.trim().slice(0, 160) : null,
      referral_url: loggedIn ? referral : null
    };

    sendBtn.disabled = true;
    setStatus('送信中...');
    const { data, error } = await sb.from('game_scores').insert(payload).select('id,score').single();
    sendBtn.disabled = false;
    if (error) return setStatus(`送信失敗: ${error.message}`, true);
    lastSubmitted = { id: data.id, score: data.score };
    setStatus('送信しました。ランキングを更新します。');
    await refreshRanking();
  }

  async function initAuth() {
    const sb = getClient();
    if (!sb) { updateAuthUI(); return; }
    const { data } = await sb.auth.getSession();
    session = data.session;
    updateAuthUI();
    sb.auth.onAuthStateChange((_event, nextSession) => { session = nextSession; updateAuthUI(); });
  }

  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyD') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) updateSnapshot();
  });

  closeBtn.addEventListener('click', () => panel.hidden = true);
  sendBtn.addEventListener('click', sendScore);
  refreshBtn.addEventListener('click', refreshRanking);
  periodEl.addEventListener('change', () => { if (lastSubmitted) refreshRanking(); });
  loginBtn.addEventListener('click', async () => {
    const sb = getClient();
    if (!sb) return setStatus('先にSupabase設定を完了してください。', true);
    await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin + window.location.pathname } });
  });
  logoutBtn.addEventListener('click', async () => { const sb = getClient(); if (sb) await sb.auth.signOut(); });
  initAuth();
})();
