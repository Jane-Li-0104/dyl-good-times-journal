(() => {
  'use strict';
  const KEY = 'good-times-journal-dyl-v1';
  const MOODS = [
    ['😄', '開心'], ['🥰', '溫暖'], ['😌', '平靜'], ['😐', '普通'],
    ['😕', '困惑'], ['😢', '難過'], ['😠', '生氣'], ['😰', '焦慮'], ['😴', '疲倦']
  ];
  const QUADRANTS = [
    { id: 'red', label: '高能量 × 低愉悅', short: '緊張、焦慮', css: '#f9d8d4' },
    { id: 'yellow', label: '高能量 × 高愉悅', short: '快樂、興奮', css: '#ffe8b5' },
    { id: 'blue', label: '低能量 × 低愉悅', short: '難過、疲倦', css: '#dce3f4' },
    { id: 'green', label: '低能量 × 高愉悅', short: '平靜、放鬆', css: '#d9f1e7' }
  ];
  const VIEW_NAMES = { journal: '每日紀錄', review: '好時光探索', calendar: '生活日曆', guide: '使用指引' };
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pad = x => String(x).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateKey(d); };
  const monday = s => { const d = parseDate(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return dateKey(d); };
  const prettyDate = s => { const d = parseDate(s); return `${d.getMonth() + 1} 月 ${d.getDate()} 日`; };
  const countChars = text => [...String(text)].length;
  function uid() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
  const emptyEntry = () => ({ id: uid(), text: '', feelings: '', emoji: '', investment: 50, qtags: [], charge: [], drain: [], highlights: [] });
  let store = { version: 1, days: {} };
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && typeof d === 'object' && d.days && typeof d.days === 'object') store = d; } catch (_) { /* First visit, blocked storage or malformed old data. */ }
  let activeDate = dateKey(new Date());
  let reviewWeek = monday(activeDate);
  let calendarMonth = new Date(parseDate(activeDate).getFullYear(), parseDate(activeDate).getMonth(), 1);
  let expandedId = null;
  let currentView = 'journal';
  let toastTimer;

  function getDay(key, make = false) {
    if (!store.days[key] && make) store.days[key] = { entries: [emptyEntry(), emptyEntry(), emptyEntry()], summary: '' };
    const d = store.days[key];
    if (!d) return null;
    if (!Array.isArray(d.entries)) d.entries = [];
    if (make) while (d.entries.length < 3) d.entries.push(emptyEntry());
    if (typeof d.summary !== 'string') d.summary = '';
    return d;
  }
  function filled(d) { return (d?.entries || []).filter(e => String(e.text || '').trim()).length; }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
      $('#save-status').innerHTML = '<span class="save-dot"></span> 已在本機儲存';
    } catch (e) {
      $('#save-status').textContent = '⚠ 儲存失敗，請先下載備份';
    }
  }
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
  }
  function setView(view, scroll = true) {
    if (!VIEW_NAMES[view]) return;
    currentView = view;
    $$('.page').forEach(el => { const yes = el.id === `view-${view}`; el.hidden = !yes; el.classList.toggle('active-page', yes); });
    $$('.nav-link').forEach(el => { const yes = el.dataset.view === view; el.classList.toggle('active', yes); if (yes) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    $('#topbar-current').textContent = VIEW_NAMES[view];
    if (view === 'journal') renderJournal();
    if (view === 'review') renderReview();
    if (view === 'calendar') renderCalendar();
    if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // DAILY JOURNAL
  function renderJournal() {
    const d = getDay(activeDate, true);
    $('#journal-date').value = activeDate;
    $('#entries-container').innerHTML = d.entries.map((entry, i) => {
      const showFeelings = Boolean(entry.feelings?.trim());
      return `<article class="entry-card" data-id="${esc(entry.id)}">
        <div class="entry-header"><span class="entry-number">${pad(i + 1)}</span><strong class="entry-header-title">第 ${['一', '二', '三'][i] || i + 1} 件生活小事</strong>
        ${i > 2 ? `<button class="entry-delete" data-action="remove" aria-label="刪除這件事">移除</button>` : `<span class="entry-subtitle">A LITTLE MOMENT</span>`}</div>
        <label class="entry-label" for="event-text-${esc(entry.id)}">發生了什麼事？</label>
        <textarea class="entry-text" id="event-text-${esc(entry.id)}" data-field="text" maxlength="2000" placeholder="例如：今天下課後和朋友一起去散步，聊了最近各自的生活。">${esc(entry.text)}</textarea>
        <div class="entry-subrow"><div><div class="entry-label">當時的心情 <span class="small-light">（選 1 個 Emoji）</span></div><div class="emotion-row" role="group" aria-label="事件 ${i + 1} 心情">
        ${MOODS.map(([m, name]) => `<button class="emotion-btn ${entry.emoji === m ? 'selected' : ''}" data-mood="${m}" title="${name}" aria-label="${name}" aria-pressed="${entry.emoji === m}">${m}</button>`).join('')}</div></div>
        <div><div class="entry-label slider-top"><span>投入程度 <span title="這裡的投入是花費的時間、心力或體力，不等同於快樂或能量。">ⓘ</span></span><span class="slider-value">${Number(entry.investment ?? 50)} / 100</span></div>
        <input class="investment-range" type="range" min="0" max="100" step="1" value="${Number(entry.investment ?? 50)}" data-field="investment" aria-label="事件 ${i + 1} 投入程度"><div class="range-endpoints"><span>低投入</span><span>高投入</span></div></div></div>
        <button class="feelings-toggle" data-action="feelings" aria-expanded="${showFeelings}">${showFeelings ? '− 收起' : '＋ 補充'}當下的感受與想法</button>
        <div class="feelings-wrap" ${showFeelings ? '' : 'hidden'}><label class="sr-only" for="feelings-${esc(entry.id)}">當下的感受與想法</label><textarea class="entry-feelings" id="feelings-${esc(entry.id)}" data-field="feelings" maxlength="1500" placeholder="例如：剛開始覺得疲憊，但聊完心情放鬆了很多。">${esc(entry.feelings)}</textarea></div>
        <div class="entry-footer"><span>每一段經歷，都有值得被看見的部分。</span><span class="entry-saved">自動儲存</span></div>
      </article>`;
    }).join('');
    $('#daily-summary').value = d.summary;
    updateJournalStats();
  }
  function updateJournalStats() {
    const d = getDay(activeDate, true), n = filled(d), pct = Math.min(100, n / 3 * 100);
    $('#journal-progress-text').textContent = `已記錄 ${n} / 3 件事${n > 3 ? `（共 ${n} 件）` : ''}`;
    $('#journal-progress-bar').style.width = `${pct}%`;
    $('#summary-progress').textContent = `${n} / 3`;
    $('#summary-progress-bar').style.width = `${pct}%`;
    $('#summary-count').textContent = `${countChars(d.summary)} / 120`;
    $('#completion-hint').textContent = n < 3 ? '先寫下 3 件生活中的小事吧。' : d.summary.trim() ? '今天的心情與故事，已經被你留下。' : '三件小事已完成！再替今天寫一句總結吧。';
  }
  $('#entries-container').addEventListener('input', ev => {
    const card = ev.target.closest('.entry-card'); if (!card) return;
    const d = getDay(activeDate, true), entry = d.entries.find(e => e.id === card.dataset.id);
    if (!entry) return;
    const field = ev.target.dataset.field;
    if (field === 'text' || field === 'feelings') {
      // When the original event text changes, character offsets of old highlights become invalid.
      if (field === 'text' && entry.text !== ev.target.value && entry.highlights.length) entry.highlights = [];
      entry[field] = ev.target.value;
      updateJournalStats();
    } else if (field === 'investment') {
      entry.investment = Number(ev.target.value);
      $('.slider-value', card).textContent = `${entry.investment} / 100`;
    }
    persist();
  });
  $('#entries-container').addEventListener('click', ev => {
    const card = ev.target.closest('.entry-card'); if (!card) return;
    const d = getDay(activeDate, true), entry = d.entries.find(e => e.id === card.dataset.id); if (!entry) return;
    const mood = ev.target.closest('[data-mood]');
    if (mood) {
      entry.emoji = entry.emoji === mood.dataset.mood ? '' : mood.dataset.mood;
      $$('.emotion-btn', card).forEach(b => { const sel = entry.emoji === b.dataset.mood; b.classList.toggle('selected', sel); b.setAttribute('aria-pressed', String(sel)); });
      persist(); return;
    }
    const action = ev.target.closest('[data-action]')?.dataset.action;
    if (action === 'feelings') {
      const wrap = $('.feelings-wrap', card), btn = $('.feelings-toggle', card);
      wrap.hidden = !wrap.hidden; btn.setAttribute('aria-expanded', String(!wrap.hidden)); btn.textContent = wrap.hidden ? '＋ 補充當下的感受與想法' : '− 收起當下的感受與想法';
      if (!wrap.hidden) $('.entry-feelings', card).focus();
    }
    if (action === 'remove' && confirm('要移除這件紀錄嗎？')) {
      d.entries = d.entries.filter(e => e.id !== entry.id); persist(); renderJournal(); toast('已移除這件紀錄。');
    }
  });
  $('#add-entry').addEventListener('click', () => { const d = getDay(activeDate, true); if (d.entries.length >= 30) return toast('每天最多可記錄 30 件事。'); const e = emptyEntry(); d.entries.push(e); persist(); renderJournal(); $(`#event-text-${e.id}`)?.focus(); });
  $('#daily-summary').addEventListener('input', ev => { getDay(activeDate, true).summary = ev.target.value; persist(); updateJournalStats(); });
  $('#complete-day').addEventListener('click', () => {
    const d = getDay(activeDate, true); persist();
    if (filled(d) < 3) return toast('今天已經儲存。再寫下三件生活小事，就能完成課堂練習。');
    if (!d.summary.trim()) { $('#daily-summary').focus(); return toast('三件小事完成了！試著為今天下一個簡短註解吧。'); }
    toast('✧ 今天的紀錄完成了！謝謝你留下一點時間給自己。');
  });
  function shiftDate(n) { activeDate = addDays(activeDate, n); renderJournal(); }
  $('#journal-prev').addEventListener('click', () => shiftDate(-1));
  $('#journal-next').addEventListener('click', () => shiftDate(1));
  $('#journal-today').addEventListener('click', () => { activeDate = dateKey(new Date()); renderJournal(); });
  $('#journal-date').addEventListener('change', ev => { if (/^\d{4}-\d{2}-\d{2}$/.test(ev.target.value)) activeDate = ev.target.value; renderJournal(); });

  // WEEKLY REVIEW
  function weekEvents() {
    const list = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(reviewWeek, i), d = getDay(day);
      (d?.entries || []).forEach(e => { if (String(e.text || '').trim()) list.push({ e, day }); });
    }
    return list;
  }
  function getEntryById(id) { return weekEvents().find(r => r.e.id === id) || null; }
  function renderHighlighted(e) {
    const txt = String(e.text || '');
    const ranges = (Array.isArray(e.highlights) ? e.highlights : [])
      .filter(r => r && Number.isInteger(r.start) && Number.isInteger(r.end) && r.start >= 0 && r.start < r.end && r.end <= txt.length && QUADRANTS.some(q => q.id === r.color))
      .sort((a, b) => a.start - b.start);
    let html = '', pos = 0;
    for (const r of ranges) {
      if (r.start < pos) continue;
      html += esc(txt.slice(pos, r.start)) + `<mark class="hl-${r.color}">${esc(txt.slice(r.start, r.end))}</mark>`;
      pos = r.end;
    }
    return html + esc(txt.slice(pos));
  }
  function reflectionBody(e) {
    const qtags = Array.isArray(e.qtags) ? e.qtags : [];
    return `<div class="reflection-entry-body">
      <div class="reflect-note">${e.feelings?.trim() ? `<span class="reflect-detail-label">當時的感受與想法</span><div class="highlight-body">${esc(e.feelings)}</div>` : ''}</div>
      <span class="reflect-detail-label">① 圈出文字中的不同情緒</span>
      <div class="highlight-body selectable-highlight" data-entry-id="${esc(e.id)}" title="用滑鼠拖曳選取想標色的文字">${renderHighlighted(e)}</div>
      <div class="highlight-tools"><div class="mini-help">先用滑鼠選取上面的一段文字，再按一種顏色：</div>
      ${QUADRANTS.map(q => `<button class="marker-btn" data-color="${q.id}" data-entry-id="${esc(e.id)}" title="標記為 ${q.label}">${q.label}</button>`).join('')}
      <button class="clear-marker" data-action="clear-mark" data-entry-id="${esc(e.id)}">清除標記</button></div>
      <span class="reflect-detail-label">② 這件事有哪些情緒狀態？（可複選）</span>
      <div class="q-choices">${QUADRANTS.map(q => `<label class="q-choice ${qtags.includes(q.id) ? 'checked' : ''}"><input type="checkbox" data-quadrant="${q.id}" data-entry-id="${esc(e.id)}" ${qtags.includes(q.id) ? 'checked' : ''}><span class="swatch" style="background:${q.css}"></span>${q.label}</label>`).join('')}</div>
      <span class="reflect-detail-label">③ 拆解影響能量的元素</span>
      <div class="tag-columns">${[['charge', '🌱 充電元素', '例如：朋友的陪伴'], ['drain', '🪫 耗電元素', '例如：時間壓力']].map(([kind, title, placeholder]) => `<div class="tag-side ${kind}"><div class="tag-side-title">${title}</div><div class="tag-input-row"><input class="tag-input" data-tag-input="${kind}" data-entry-id="${esc(e.id)}" placeholder="${placeholder}" maxlength="60"><button class="tag-add" data-action="add-tag" data-kind="${kind}" data-entry-id="${esc(e.id)}" aria-label="新增${title}">＋</button></div><div class="tag-chip-list">${(e[kind] || []).map(t => `<span class="tag-chip">${esc(t)}<button data-action="remove-tag" data-kind="${kind}" data-tag="${esc(t)}" data-entry-id="${esc(e.id)}" aria-label="移除${esc(t)}">×</button></span>`).join('')}</div></div>`).join('')}</div>
      </div>`;
  }
  function renderReview() {
    const all = weekEvents(), end = addDays(reviewWeek, 6);
    $('#review-range').textContent = `${prettyDate(reviewWeek)} — ${prettyDate(end)}`;
    $('#review-count').textContent = `本週 ${all.length} 個事件`;
    if (!all.some(a => a.e.id === expandedId)) expandedId = all[0]?.e.id || null;
    $('#reflection-entries').innerHTML = all.length ? all.map(({ e, day }, index) => {
      const open = e.id === expandedId;
      const firstLine = e.text.trim().split('\n')[0];
      return `<article class="reflection-entry ${open ? 'open' : ''}" id="reflection-${esc(e.id)}"><button class="reflection-entry-head" data-action="toggle-reflection" data-id="${esc(e.id)}" aria-expanded="${open}"><span class="reflection-index">${pad(index + 1)}</span><span class="reflection-head-text"><div class="reflection-title">${esc(firstLine)}</div><div class="reflection-meta">${prettyDate(day)} · 投入 ${Number(e.investment ?? 50)} / 100 · ${esc(e.emoji || '尚未選 Emoji')}${e.qtags?.length ? ` · 已標記 ${e.qtags.length} 個象限` : ''}</div></span><span class="reflection-head-arrow">${open ? '⌃' : '⌄'}</span></button>${open ? reflectionBody(e) : ''}</article>`;
    }).join('') : `<div class="empty-reflection"><div class="empty-icon">☼</div><strong>這週還沒有可以回顧的事件</strong><br>先去「每日紀錄」寫下生活小事，或在使用指引載入示範資料。<br><button class="outline-btn" id="empty-go-journal">前往每日紀錄 ↗</button></div>`;
    renderQuadrant(all); renderInsights(all);
  }
  function renderQuadrant(all) {
    $$('.q-area').forEach(a => $$('.q-point', a).forEach(p => p.remove()));
    all.forEach(({e, day}, index) => {
      const qtags = (e.qtags || []).filter(q => QUADRANTS.some(qq => qq.id === q));
      qtags.forEach((q, qi) => {
        const area = $(`.q-area[data-q="${q}"]`); if (!area) return;
        const hash = Array.from(e.id + q).reduce((sum, ch) => (sum * 33 + ch.charCodeAt(0)) % 7919, 19);
        const left = 19 + ((hash + qi * 13) % 61), top = 30 + ((hash * 7 + qi * 19) % 47);
        const p = document.createElement('button'); p.className = 'q-point'; p.type = 'button';
        p.style.left = `calc(${left}% - 12px)`; p.style.top = `calc(${top}% - 12px)`;
        p.textContent = String(index + 1); p.title = `${prettyDate(day)} · ${e.text.slice(0, 50)}`;
        p.setAttribute('aria-label', `查看第 ${index + 1} 件：${e.text.slice(0, 30)}`); p.dataset.pointId = e.id;
        area.appendChild(p);
      });
    });
  }
  function frequencies(all, key) {
    const counts = new Map();
    all.forEach(({e}) => (e[key] || []).forEach(raw => { const t = raw.trim(); if (t) counts.set(t, (counts.get(t) || 0) + 1); }));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'));
  }
  function renderInsights(all) {
    $('#insight-tag-columns').innerHTML = [['charge', '🌱 充電元素'], ['drain', '🪫 耗電元素']].map(([kind, title]) => {
      const tags = frequencies(all, kind);
      return `<div><div class="insight-tags-head ${kind}">${title}</div>${tags.length ? tags.slice(0, 7).map(([text, n]) => `<div class="freq-tag ${kind}"><span>${esc(text)}</span><b>${n} 次</b></div>`).join('') : `<div class="empty-list">尚未整理出元素<br>到上方事件中加上標籤吧</div>`}</div>`;
    }).join('');
  }
  function setWeek(delta) { reviewWeek = addDays(reviewWeek, delta * 7); expandedId = null; renderReview(); }
  $('#review-prev').addEventListener('click', () => setWeek(-1));
  $('#review-next').addEventListener('click', () => setWeek(1));
  $('#review-current').addEventListener('click', () => { reviewWeek = monday(dateKey(new Date())); expandedId = null; renderReview(); });
  $('#reflection-entries').addEventListener('mousedown', ev => { if (ev.target.closest('.marker-btn')) ev.preventDefault(); });
  $('#reflection-entries').addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.matches('[data-tag-input]')) { ev.preventDefault(); addTag(ev.target.dataset.entryId, ev.target.dataset.tagInput); }
  });
  $('#reflection-entries').addEventListener('change', ev => {
    if (!ev.target.matches('[data-quadrant]')) return;
    const item = getEntryById(ev.target.dataset.entryId); if (!item) return;
    const e = item.e, q = ev.target.dataset.quadrant;
    e.qtags = Array.isArray(e.qtags) ? e.qtags : [];
    if (ev.target.checked && !e.qtags.includes(q)) e.qtags.push(q);
    if (!ev.target.checked) e.qtags = e.qtags.filter(x => x !== q);
    persist(); renderReview();
  });
  $('#reflection-entries').addEventListener('click', ev => {
    const toggle = ev.target.closest('[data-action="toggle-reflection"]');
    if (toggle) { expandedId = expandedId === toggle.dataset.id ? null : toggle.dataset.id; renderReflectionToggle(); return; }
    const marker = ev.target.closest('.marker-btn'); if (marker) { applyHighlight(marker.dataset.entryId, marker.dataset.color); return; }
    const action = ev.target.closest('[data-action]'); if (!action) return;
    if (action.dataset.action === 'clear-mark') { const item = getEntryById(action.dataset.entryId); if (item) { item.e.highlights = []; persist(); renderReview(); toast('已清除文字標記。'); } }
    if (action.dataset.action === 'add-tag') addTag(action.dataset.entryId, action.dataset.kind);
    if (action.dataset.action === 'remove-tag') {
      const item = getEntryById(action.dataset.entryId); if (!item) return;
      item.e[action.dataset.kind] = (item.e[action.dataset.kind] || []).filter(t => t !== action.dataset.tag);
      persist(); renderReview();
    }
    if (action.id === 'empty-go-journal') setView('journal');
  });
  // Separate collapse render so users may close the only currently expanded card.
  function renderReflectionToggle() {
    const current = expandedId;
    renderReview();
    if (current === null) {
      expandedId = null;
      $$('.reflection-entry').forEach(el => el.classList.remove('open'));
      $$('.reflection-entry-body').forEach(el => el.remove());
      $$('[data-action="toggle-reflection"]').forEach(b => { b.setAttribute('aria-expanded', 'false'); $('.reflection-head-arrow', b).textContent = '⌄'; });
    }
  }
  $('#reflection-entries').addEventListener('click', ev => {
    if (ev.target.closest('#empty-go-journal')) setView('journal');
  });
  $('#quadrant-grid').addEventListener('click', ev => {
    const pt = ev.target.closest('[data-point-id]'); if (!pt) return;
    expandedId = pt.dataset.pointId; renderReview();
    $(`#reflection-${expandedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  function applyHighlight(id, color) {
    const item = getEntryById(id); const body = $(`.selectable-highlight[data-entry-id="${id}"]`);
    if (!item || !body) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return toast('請先在事件文字上拖曳選取想標色的一段文字。');
    const range = selection.getRangeAt(0);
    if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return toast('請在同一件事件的文字中選取要標記的部分。');
    const a = document.createRange(); a.selectNodeContents(body); a.setEnd(range.startContainer, range.startOffset);
    const b = document.createRange(); b.selectNodeContents(body); b.setEnd(range.endContainer, range.endOffset);
    const start = a.toString().length, end = b.toString().length;
    if (start === end) return toast('請選取一小段文字。');
    const prev = Array.isArray(item.e.highlights) ? item.e.highlights : [];
    const retained = [];
    for (const x of prev) {
      if (x.end <= start || x.start >= end) retained.push(x);
      else { if (x.start < start) retained.push({ start: x.start, end: start, color: x.color }); if (x.end > end) retained.push({ start: end, end: x.end, color: x.color }); }
    }
    item.e.highlights = [...retained, { start, end, color }].sort((x, y) => x.start - y.start);
    selection.removeAllRanges();
    body.innerHTML = renderHighlighted(item.e);
    persist(); toast('已為選取文字加上顏色。');
  }
  function addTag(id, kind) {
    if (kind !== 'charge' && kind !== 'drain') return;
    const item = getEntryById(id); if (!item) return;
    const inp = $(`.tag-input[data-entry-id="${id}"][data-tag-input="${kind}"]`); if (!inp) return;
    const t = inp.value.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!t) return toast('寫下一個具體的充電或耗電元素吧。');
    item.e[kind] = Array.isArray(item.e[kind]) ? item.e[kind] : [];
    if (item.e[kind].includes(t)) return toast('這個元素已經記錄過囉。');
    if (item.e[kind].length >= 15) return toast('每件事件最多可加入 15 個元素。');
    item.e[kind].push(t); persist(); renderReview();
  }
  $('#copy-reflection').addEventListener('click', async () => {
    const all = weekEvents(); if (!all.length) return toast('這週還沒有事件可以整理。');
    const charge = frequencies(all, 'charge').slice(0, 5).map(x => x[0]);
    const drain = frequencies(all, 'drain').slice(0, 5).map(x => x[0]);
    const qcount = Object.fromEntries(QUADRANTS.map(q => [q.id, 0]));
    all.forEach(({e}) => (e.qtags || []).forEach(q => { if (q in qcount) qcount[q]++; }));
    const summary = [`【我的好時光日誌週回顧】`, `${reviewWeek} 至 ${addDays(reviewWeek, 6)}｜共 ${all.length} 件生活事件`, '',
      `充電元素：${charge.join('、') || '尚未填寫'}`, `耗電元素：${drain.join('、') || '尚未填寫'}`, '',
      '四色情緒標記次數（同一事件可複選）：', ...QUADRANTS.map(q => `${q.label}：${qcount[q.id]}`), '',
      '想進一步思考：哪些事件有共通點？有哪些高投入、低愉悅的時刻？'].join('\n');
    try { await navigator.clipboard.writeText(summary); toast('分享摘要已複製到剪貼簿；只有你決定貼到哪裡。'); }
    catch (_) { const ta = document.createElement('textarea'); ta.value = summary; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); toast(ok ? '分享摘要已複製。' : '無法存取剪貼簿，可用下載備份功能。'); }
  });

  // CALENDAR
  function renderCalendar() {
    const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
    $('#calendar-month-label').textContent = `${year} 年 ${month + 1} 月`;
    const start = new Date(year, month, 1), offset = (start.getDay() + 6) % 7;
    const first = new Date(year, month, 1 - offset), today = dateKey(new Date());
    $('#calendar-grid').innerHTML = Array.from({ length: 42 }, (_, n) => {
      const d = new Date(first); d.setDate(first.getDate() + n);
      const key = dateKey(d), day = getDay(key), nFilled = filled(day), other = d.getMonth() !== month;
      return `<button class="calendar-day ${other ? 'other-month' : ''} ${nFilled ? 'has-entry' : ''} ${key === today ? 'is-today' : ''}" data-date="${key}" title="${key}${nFilled ? ` 已記錄 ${nFilled} 件事` : ' 尚未記錄'}"><span class="calendar-day-number">${d.getDate()}</span>${nFilled ? `<span class="calendar-event-indicator">${nFilled} 件小事</span>` : ''}</button>`;
    }).join('');
  }
  $('#calendar-prev').addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth() - 1); renderCalendar(); });
  $('#calendar-next').addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth() + 1); renderCalendar(); });
  $('#calendar-current').addEventListener('click', () => { const t = new Date(); calendarMonth = new Date(t.getFullYear(), t.getMonth(), 1); renderCalendar(); });
  $('#calendar-grid').addEventListener('click', ev => { const day = ev.target.closest('[data-date]'); if (!day) return; activeDate = day.dataset.date; setView('journal'); });

  // EXPORT / IMPORT / DEMO
  $('#export-data').addEventListener('click', () => {
    const json = JSON.stringify({ ...store, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `拾光日誌備份-${dateKey(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast('日誌備份已準備下載。');
  });
  $('#import-data-btn').addEventListener('click', () => $('#import-data-file').click());
  $('#import-data-file').addEventListener('change', async ev => {
    const f = ev.target.files?.[0]; ev.target.value = ''; if (!f) return;
    if (f.size > 5_000_000) return toast('檔案太大，請選擇 5 MB 以下的日誌 JSON。');
    try {
      const raw = JSON.parse(await f.text());
      if (!raw || !raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) throw Error('格式不符');
      const safe = { version: 1, days: {} };
      for (const [key, day] of Object.entries(raw.days).slice(0, 4000)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !day || !Array.isArray(day.entries)) continue;
        const list = day.entries.slice(0, 30).map(e => {
          const text = String(e?.text || '').slice(0, 2000);
          return { id: uid(), text, feelings: String(e?.feelings || '').slice(0, 1500),
            emoji: MOODS.some(m => m[0] === e?.emoji) ? e.emoji : '',
            investment: Math.max(0, Math.min(100, Number(e?.investment) || 0)),
            qtags: Array.isArray(e?.qtags) ? [...new Set(e.qtags.filter(q => QUADRANTS.some(x => x.id === q)))].slice(0, 4) : [],
            charge: Array.isArray(e?.charge) ? e.charge.filter(x => typeof x === 'string').slice(0, 15).map(x => x.slice(0, 60)) : [],
            drain: Array.isArray(e?.drain) ? e.drain.filter(x => typeof x === 'string').slice(0, 15).map(x => x.slice(0, 60)) : [],
            highlights: Array.isArray(e?.highlights) ? e.highlights.filter(h => h && Number.isInteger(h.start) && Number.isInteger(h.end) && h.start >= 0 && h.end <= text.length && h.start < h.end && QUADRANTS.some(q => q.id === h.color)).slice(0, 500) : [] };
        });
        safe.days[key] = { summary: String(day.summary || '').slice(0, 120), entries: list };
      }
      if (!confirm('匯入會取代目前這個瀏覽器中「所有」日誌。確定繼續？\n建議先按「下載 JSON 備份」保存原本資料。')) return;
      store = safe; expandedId = null; persist(); setView('journal'); toast('已匯入日誌備份。');
    } catch (_) { toast('這不是有效的拾光日誌 JSON 備份。'); }
  });
  $('#clear-data').addEventListener('click', () => {
    if (!confirm('確定清空此瀏覽器所有日誌嗎？此操作無法復原，請先下載備份。')) return;
    if (!confirm('再確認一次：要永久清空本機目前所有紀錄嗎？')) return;
    store = { version: 1, days: {} }; expandedId = null; persist(); setView('journal'); toast('本機日誌已清空。');
  });
  $('#load-demo').addEventListener('click', () => {
    const prevWeek = addDays(monday(dateKey(new Date())), -7);
    const samples = [
      [ '和朋友一起在咖啡廳讀書，聊了最近讓自己煩惱的事。', '本來有些疲憊，但聊天後覺得被理解。', '🥰', 75, ['green','yellow'], ['朋友的陪伴', '有人傾聽'], [] ],
      [ '準備課堂報告，查資料時一直擔心時間不夠。', '很投入，也確實感到焦慮。', '😰', 95, ['red'], [], ['時間壓力', '不確定感'] ],
      [ '晚上散步時遇到好舒服的涼風。', '心裡慢慢安靜下來。', '😌', 45, ['green'], ['散步', '舒服的天氣'], [] ],
      [ '趕早八的課，早上沒吃早餐。', '頭昏昏的，整天都在想找時間休息。', '😴', 80, ['blue'], [], ['睡眠不足'] ],
      [ '和同學一起討論了很有趣的研究想法。', '有被激發出想繼續做下去的熱情。', '😄', 90, ['yellow'], ['共同討論', '新點子'], [] ],
      [ '在家整理房間，丟掉一些堆積很久的東西。', '雖然很累，但也有完成事情的成就感。', '😌', 70, ['blue','green'], ['完成小目標'], ['久站'] ]
    ];
    let added = 0;
    for (let i = 0; i < 6; i++) {
      const key = addDays(prevWeek, i), existing = getDay(key);
      if (filled(existing) > 0) continue;
      const d = getDay(key, true); d.summary = ['有點忙碌，但也有溫柔的片刻。','努力趕上進度的一天。','適合慢慢走路的一天。','需要好好休息的一天。','被新想法點亮的一天。','累累的，但心裡還是很踏實。'][i];
      d.entries = [0,1,2].map((j) => {
        const s = samples[(i * 3 + j) % samples.length];
        return { id: uid(), text: s[0], feelings: s[1], emoji: s[2], investment: s[3], qtags: [...s[4]], charge: [...s[5]], drain: [...s[6]], highlights: [] };
      });
      added++;
    }
    if (!added) return toast('上一週已有日誌，示範資料沒有覆蓋原有內容。');
    persist(); reviewWeek = prevWeek; expandedId = null; setView('review'); toast(`已加入上一週 ${added} 天的示範紀錄（不覆蓋既有內容）。`);
  });
  $$('.nav-link').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  renderJournal();
})();
