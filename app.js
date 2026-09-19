(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const input = $('input');
  const inputRight = $('input-right');
  const panels = document.querySelector('.panels');
  const output = $('output');
  const tree = $('tree');
  const diffView = $('diff');
  const diffSummary = $('diff-summary');
  const divider = $('divider');
  const errorBar = $('error-bar');
  const errorMsg = $('error-msg');
  const statusBar = $('status-bar');
  const statusMsg = $('status-msg');
  const stats = $('stats');
  const btnCompareToggle = $('btn-compare-toggle');
  const tabDiff = $('tab-diff');
  const diffPrev = $('diff-prev');
  const diffNext = $('diff-next');
  const dividerPanel = $('divider');
  const lineNumbers = $('line-numbers');
  const searchBar = $('search-bar');
  const searchInput = $('search-input');
  const searchCount = $('search-count');
  const btnTheme = $('btn-theme');
  const pathDisplay = $('path-display');
  const currentPath = $('current-path');
  const treeSearch = $('tree-search');
  const treeSearchCount = $('tree-search-count');
  const historyModal = $('history-modal');
  const historyList = $('history-list');
  const statsContent = $('stats-content');
  const shortcutsModal = $('shortcuts-modal');

  const SAMPLE = {
    "项目名称": "JSON 格式化工具",
    "version": "1.0.0",
    "features": ["格式化", "压缩", "校验", "树视图"],
    "author": { "name": "张三", "email": "zhangsan@example.com", "vip": true },
    "config": { "indent": 2, "maxDepth": null, "limits": { "sizeKB": 5120, "timeout": 30.5 } },
    "tags": [
      { "id": 1, "label": "前端" },
      { "id": 2, "label": "工具" }
    ],
    "updatedAt": "2026-09-06T12:00:00Z"
  };

  let compareMode = false;
  let lastResultText = '';
  let currentDiffRows = [];
  let currentDiffIndex = -1;
  let searchMatches = [];
  let searchIndex = -1;
  let undoStack = [];
  let redoStack = [];
  let currentParsedValue = null;
  let treeSearchMatches = [];
  let treeSearchIndex = -1;
  let history = JSON.parse(localStorage.getItem('jsonHistory') || '[]');
  let historyTimer = null;
  const LARGE_FILE_THRESHOLD = 1024 * 1024;

  function setStatus(text, ok = false) {
    statusMsg.textContent = text;
    statusBar.classList.toggle('ok', ok);
  }

  function showError(text) {
    errorMsg.textContent = text;
    errorBar.classList.remove('hidden');
  }

  function hideError() {
    errorBar.classList.add('hidden');
  }

  function getIndent() {
    const v = $('sel-indent').value;
    return v === 'tab' ? '\t' : parseInt(v, 10);
  }

  function toggleTheme() {
    const themes = ['dark', 'light', 'monokai', 'dracula', 'solarized', 'nord'];
    const current = localStorage.getItem('theme') || 'dark';
    const currentIdx = themes.indexOf(current);
    const next = themes[(currentIdx + 1) % themes.length];
    applyTheme(next);
  }

  function applyTheme(theme) {
    document.body.classList.remove('light', 'monokai', 'dracula', 'solarized', 'nord');
    if (theme !== 'dark') {
      document.body.classList.add(theme);
    }
    localStorage.setItem('theme', theme);
    const icons = { dark: '\u2600', light: '\u263E', monokai: 'M', dracula: 'D', solarized: 'S', nord: 'N' };
    btnTheme.textContent = icons[theme] || '\u2600';
    const names = { dark: '深色', light: '浅色', monokai: 'Monokai', dracula: 'Dracula', solarized: 'Solarized', nord: 'Nord' };
    setStatus('\u5df2\u5207\u6362\u5230' + names[theme] + '\u4e3b\u9898', true);
  }

  function loadTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    applyTheme(saved);
  }

  function toggleSearch() {
    searchBar.classList.toggle('hidden');
    if (!searchBar.classList.contains('hidden')) {
      searchInput.focus();
      searchInput.select();
    }
  }

  function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
      clearSearch();
      return;
    }
    const text = output.textContent;
    searchMatches = [];
    let regex;
    const isRegex = $('search-regex') && $('search-regex').checked;
    try {
      regex = isRegex ? new RegExp(query, 'gi') : new RegExp(escapeRegex(query), 'gi');
    } catch (e) {
      searchCount.textContent = '\u65e0\u6548\u6b63\u5219';
      return;
    }
    let match;
    while ((match = regex.exec(text)) !== null) {
      searchMatches.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
      if (searchMatches.length > 1000) break;
    }
    searchIndex = searchMatches.length > 0 ? 0 : -1;
    updateSearchDisplay();
    highlightSearchMatches();
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function clearSearch() {
    searchMatches = [];
    searchIndex = -1;
    searchCount.textContent = '';
    restoreOutput();
  }

  function toggleReplaceBar() {
    const replaceBar = $('replace-bar');
    if (replaceBar) replaceBar.classList.toggle('hidden');
  }

  function replaceCurrent() {
    if (searchMatches.length === 0 || searchIndex < 0) return;
    const replaceText = $('replace-input').value;
    const match = searchMatches[searchIndex];
    let text = lastResultText;
    text = text.substring(0, match.start) + replaceText + text.substring(match.end);
    input.value = text;
    lastResultText = text;
    performSearch();
    setStatus('\u5df2\u66ff\u6362', true);
  }

  function replaceAllMatches() {
    if (searchMatches.length === 0) return;
    const replaceText = $('replace-input').value;
    const query = searchInput.value.trim();
    const isRegex = $('search-regex') && $('search-regex').checked;
    let regex;
    try {
      regex = isRegex ? new RegExp(query, 'gi') : new RegExp(escapeRegex(query), 'gi');
    } catch (e) { return; }
    let text = lastResultText;
    text = text.replace(regex, replaceText);
    input.value = text;
    lastResultText = text;
    performSearch();
    setStatus('\u5df2\u66ff\u6362 ' + searchMatches.length + ' \u5904', true);
  }

  function updateSearchDisplay() {
    if (searchMatches.length === 0) {
      searchCount.textContent = searchInput.value.trim() ? '\u65e0\u7ed3\u679c' : '';
    } else {
      searchCount.textContent = (searchIndex + 1) + ' / ' + searchMatches.length;
    }
  }

  function highlightSearchMatches() {
    if (searchMatches.length === 0) return;
    const originalText = lastResultText;
    const query = searchInput.value.trim();
    const isRegex = $('search-regex') && $('search-regex').checked;
    let regex;
    try {
      regex = isRegex ? new RegExp('(' + query + ')', 'gi') : new RegExp('(' + escapeRegex(query) + ')', 'gi');
    } catch (e) { return; }
    const highlighted = escapeHtml(originalText).replace(regex, '<span class="search-highlight">$1</span>');
    output.innerHTML = highlighted;
    const matchSpans = output.querySelectorAll('.search-highlight');
    if (matchSpans[searchIndex]) {
      matchSpans[searchIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function restoreOutput() {
    if (lastResultText) output.innerHTML = highlightJson(lastResultText);
  }

  function jumpSearch(delta) {
    if (searchMatches.length === 0) return;
    searchIndex = (searchIndex + delta + searchMatches.length) % searchMatches.length;
    updateSearchDisplay();
    highlightSearchMatches();
  }

  function toggleCompareMode() {
    compareMode = !compareMode;
    panels.dataset.mode = compareMode ? 'compare' : 'single';
    divider.classList.toggle('hidden', !compareMode);
    btnCompareToggle.classList.toggle('active', compareMode);
    tabDiff.classList.toggle('hidden', !compareMode);
    if (compareMode) {
      setStatus('\u5bf9\u6bd4\u6a21\u5f0f\u5df2\u5f00\u542f \u2014 \u5728\u53f3\u4fa7\u8f93\u5165\u7b2c\u4e8c\u6bb5 JSON');
    } else {
      setStatus('\u5df2\u5173\u95ed\u5bf9\u6bd4\u6a21\u5f0f');
    }
  }

  function doCompare() {
    const left = input.value.trim();
    const right = inputRight.value.trim();
    if (!left || !right) {
      showError('\u8bf7\u5728\u5de6\u53f3\u4fa7\u90fd\u8f93\u5165 JSON');
      return;
    }
    try {
      const a = JSON.parse(left);
      const b = JSON.parse(right);
      const diffs = diffObjects(a, b, '$');
      if (diffs.length === 0) {
        diffSummary.textContent = '\u2714 \u5b8c\u5168\u76f8\u540c';
        diffView.innerHTML = '<div class="diff-no-diff">\u4e24\u4e2a JSON \u5b8c\u5168\u76f8\u540c</div>';
      } else {
        diffSummary.textContent = diffs.length + ' \u5904\u5dee\u5f02';
        renderDiff(diffs);
      }
    } catch (e) {
      showError('JSON \u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function diffObjects(a, b, path) {
    const diffs = [];
    const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of allKeys) {
      const p = path + '.' + key;
      if (!(key in (a || {}))) {
        diffs.push({ type: 'added', path: p, value: b[key] });
      } else if (!(key in (b || {}))) {
        diffs.push({ type: 'removed', path: p, value: a[key] });
      } else if (typeof a[key] !== typeof b[key] || JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        diffs.push({ type: 'changed', path: p, left: a[key], right: b[key] });
      }
    }
    return diffs;
  }

  function renderDiff(diffs) {
    currentDiffRows = [];
    const added = diffs.filter(d => d.type === 'added').length;
    const removed = diffs.filter(d => d.type === 'removed').length;
    const changed = diffs.filter(d => d.type === 'changed').length;

    let html = '<div class="diff-stats">';
    html += '<div class="diff-stat-item"><span class="diff-stat-dot added"></span>\u65b0\u589e ' + added + '</div>';
    html += '<div class="diff-stat-item"><span class="diff-stat-dot removed"></span>\u5220\u9664 ' + removed + '</div>';
    html += '<div class="diff-stat-item"><span class="diff-stat-dot changed"></span>\u53d8\u66f4 ' + changed + '</div>';
    html += '<div class="diff-stat-item" style="color:var(--text-dim)">\u5171 ' + diffs.length + ' \u5904\u5dee\u5f02</div>';
    html += '</div>';

    html += '<table class="diff-table"><thead><tr><th>\u8def\u5f84</th><th>\u5de6\u4fa7 (\u539f\u59cb)</th><th>\u53f3\u4fa7 (\u65b0\u503c)</th><th>\u7c7b\u578b</th></tr></thead><tbody>';
    for (const d of diffs) {
      const cls = 'diff-row diff-' + d.type;
      const left = d.type === 'added' ? '' : escapeHtml(JSON.stringify(d.left, null, 2));
      const right = d.type === 'removed' ? '' : escapeHtml(JSON.stringify(d.right, null, 2));
      const typeLabel = { added: '+ \u65b0\u589e', removed: '- \u5220\u9664', changed: '~ \u53d8\u66f4' }[d.type];
      html += '<tr class="' + cls + '"><td><code>' + escapeHtml(d.path) + '</code></td><td><pre>' + left + '</pre></td><td><pre>' + right + '</pre></td><td>' + typeLabel + '</td></tr>';
      currentDiffRows.push(diffs.indexOf(d));
    }
    html += '</tbody></table>';
    diffView.innerHTML = html;
    currentDiffIndex = -1;
  }

  function jumpToDiff(delta) {
    if (currentDiffRows.length === 0) return;
    currentDiffIndex = (currentDiffIndex + delta + currentDiffRows.length) % currentDiffRows.length;
    const rows = diffView.querySelectorAll('.diff-row');
    rows.forEach((r, i) => r.classList.toggle('diff-current', i === currentDiffIndex));
    if (rows[currentDiffIndex]) rows[currentDiffIndex].scrollIntoView({ block: 'center' });
  }


  function escapeNonAscii(s) {
    return s.replace(/[^\x00-\x7F]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  }

  function checkFileSize() {
    if (input.value.length > LARGE_FILE_THRESHOLD) {
      const sizeMB = (input.value.length / 1024 / 1024).toFixed(2);
      return confirm('\u8f93\u5165\u5185\u5bb9\u8f83\u5927 (' + sizeMB + ' MB)\uff0c\u7ee7\u7eed\u64cd\u4f5c\u53ef\u80fd\u5361\u987f\uff0c\u662f\u5426\u7ee7\u7eed\uff1f');
    }
    return true;
  }

  function parseInput() {
    const text = input.value;
    if (!text.trim()) {
      showError('\u8f93\u5165\u4e3a\u7a7a:\u8bf7\u5148\u7c98\u8d34 JSON \u6587\u672c\u6216\u8f7d\u5165\u793a\u4f8b\u3002');
      return { ok: false, text: text };
    }
    const isJson5 = $('chk-json5') && $('chk-json5').checked;
    if (isJson5) {
      try {
        return { ok: true, text: text, value: parseJson5(text) };
      } catch (err) {
        showError('JSON5\u89e3\u6790\u5931\u8d25: ' + err.message);
        return { ok: false, text: text };
      }
    }
    try {
      return { ok: true, text: text, value: JSON.parse(text) };
    } catch (err) {
      showError(describeParseError(err, text));
      return { ok: false, text: text };
    }
  }

  function parseJson5(str) {
    str = str.replace(/\/\/.*$/gm, '');
    str = str.replace(/\/\*[\s\S]*?\*\//g, '');
    str = str.replace(/,\s*([\]}])/g, '$1');
    str = str.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
    var singleQuote = String.fromCharCode(39);
    var doubleQuote = String.fromCharCode(34);
    str = str.replace(new RegExp(singleQuote + '([^' + singleQuote + '\\\\]*(?:\\\\.[^' + singleQuote + '\\\\]*)*)' + singleQuote, 'g'), doubleQuote + '$1' + doubleQuote);
    str = str.replace(/:\s*0x([0-9a-fA-F]+)/g, ': $1');
    str = str.replace(/:\s*Infinity/g, ': 1e999');
    str = str.replace(/:\s*-Infinity/g, ': -1e999');
    str = str.replace(/:\s*NaN/g, ': null');
    return JSON.parse(str);
  }

  function describeParseError(err, text) {
    const msg = err.message;
    const posMatch = msg.match(/position\s+(\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const before = text.substring(Math.max(0, pos - 30), pos);
      const after = text.substring(pos, pos + 30);
      let line = 1, col = 0;
      for (let i = 0; i < Math.min(pos, text.length); i++) {
        if (text[i] === '\n') { line++; col = 0; } else { col++; }
      }
      return msg + '\n\u884c ' + line + ', \u5217 ' + col + '\n...\u2026' + before + ' <-- \u9519\u8bef --> ' + after + '\u2026\u2026';
    }
    return msg;
  }

  function highlightJson(json) {
    return escapeHtml(json).replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      }
    );
  }

  function renderText(text) {
    lastResultText = text;
    output.innerHTML = highlightJson(text);
    renderLineNumbers(text);
    updateStats(text);
  }

  function renderLineNumbers(text) {
    const count = text.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: count }, (_, i) =>
      '<div class="line-number">' + (i + 1) + '</div>'
    ).join('');
  }

  function doFormat(minify) {
    hideError();
    if (compareMode) { doCompare(); return; }
    const res = parseInput();
    if (!res.ok) { setStatus('\u89e3\u6790\u5931\u8d25,\u8be6\u89c1\u4e0b\u65b9\u9519\u8bef\u4fe1\u606f'); return; }
    let value = res.value;
    if ($('chk-sort').checked) value = sortKeysDeep(value);
    let text = JSON.stringify(value, null, minify ? 0 : getIndent());
    if ($('chk-ascii').checked) text = escapeNonAscii(text);
    currentParsedValue = value;
    renderText(text);
    renderTree(value);
    addToHistory(text);
    const jsonStats = getJsonStats(value);
    const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    setStatus((minify ? '\u538b\u7f29' : '\u683c\u5f0f\u5316') + '\u5b8c\u6210 \xb7 \u9876\u5c42\u7c7b\u578b: ' + type + ' \xb7 \u6700\u5927\u6df1\u5ea6: ' + jsonStats.depth + ' \xb7 \u952e\u6570: ' + jsonStats.keys, true);
  }

  function doValidate() {
    hideError();
    const res = parseInput();
    if (!res.ok) { setStatus('\u6821\u9a8c\u5931\u8d25'); return; }
    const jsonStats = getJsonStats(res.value);
    setStatus('\u2713 JSON \u5408\u6cd5(\u9876\u5c42\u7c7b\u578b:' + (Array.isArray(res.value) ? 'array' : res.value === null ? 'null' : typeof res.value) + ')', true);
  }

  function getJsonStats(obj) {
    let depth = 0, keys = 0, strings = 0, numbers = 0, booleans = 0, nulls = 0, arrays = 0, objects = 0;
    let longestKey = '', longestValue = '';
    function walk(val, d) {
      if (d > depth) depth = d;
      if (val === null) { nulls++; return; }
      const t = typeof val;
      if (t === 'boolean') { booleans++; return; }
      if (t === 'number') { numbers++; return; }
      if (t === 'string') {
        strings++;
        if (val.length > longestValue.length) longestValue = val;
        return;
      }
      if (Array.isArray(val)) { arrays++; val.forEach(v => walk(v, d + 1)); return; }
      if (t === 'object') {
        objects++;
        Object.entries(val).forEach(([k, v]) => {
          keys++;
          if (k.length > longestKey.length) longestKey = k;
          walk(v, d + 1);
        });
      }
    }
    walk(obj, 0);
    return { depth, keys, strings, numbers, booleans, nulls, arrays, objects, longestKey, longestValue };
  }

  function updateStats(text) {
    const lines = text.split('\n').length;
    const chars = text.length;
    stats.textContent = lines + ' \u884c \xb7 ' + chars + ' \u5b57\u7b26';
  }

  function renderTree(obj) {
    tree.innerHTML = buildTreeHtml(obj, '$', 0);
  }

  function buildTreeHtml(val, path, depth) {
    if (val === null) return '<span class="json-null">null</span>';
    if (typeof val === 'boolean') return '<span class="json-boolean">' + val + '</span>';
    if (typeof val === 'number') return '<span class="json-number">' + val + '</span>';
    if (typeof val === 'string') return '<span class="json-string">' + escapeHtml(JSON.stringify(val)) + '</span>';
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      const id = 'tree-' + Math.random().toString(36).slice(2, 8);
      let html = '<span class="tree-toggle" data-id="' + id + '">\u25bc</span> <span class="tree-type">Array(' + val.length + ')</span><ul id="' + id + '">';
      val.forEach((item, i) => {
        html += '<li><span class="tree-path" title="' + path + '[' + i + ']">' + i + '</span>: ' + buildTreeHtml(item, path + '[' + i + ']', depth + 1) + '</li>';
      });
      html += '</ul>';
      return html;
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val);
      if (entries.length === 0) return '{}';
      const id = 'tree-' + Math.random().toString(36).slice(2, 8);
      let html = '<span class="tree-toggle" data-id="' + id + '">\u25bc</span> <span class="tree-type">{' + entries.length + '}</span><ul id="' + id + '">';
      entries.forEach(([k, v]) => {
        html += '<li><span class="json-key tree-path" title="' + path + '.' + k + '">' + escapeHtml(k) + '</span>: ' + buildTreeHtml(v, path + '.' + k, depth + 1) + '</li>';
      });
      html += '</ul>';
      return html;
    }
    return String(val);
  }

  function addToHistory(text) {
    if (!text || !text.trim()) return;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      history = history.filter(h => h.text !== text);
      const preview = text.substring(0, 80).replace(/\n/g, ' ');
      history.unshift({ text: text, preview: preview, time: new Date().toISOString() });
      if (history.length > 20) history.pop();
      localStorage.setItem('jsonHistory', JSON.stringify(history));
    }, 1000);
  }

  function loadHistory() {
    if (history.length === 0) {
      historyList.innerHTML = '<span class="placeholder">\u6682\u65e0\u5386\u53f2\u8bb0\u5f55</span>';
      return;
    }
    historyList.innerHTML = history.map((h, i) =>
      '<div class="history-item" data-index="' + i + '">' +
      '<div class="history-item-time">' + new Date(h.time).toLocaleString() + '</div>' +
      '<div class="history-item-preview">' + escapeHtml(h.preview) + '...</div>' +
      '</div>'
    ).join('');
  }

  function doCopy() {
    if (!lastResultText) { showError('\u6ca1\u6709\u53ef\u590d\u5236\u7684\u5185\u5bb9'); return; }
    navigator.clipboard.writeText(lastResultText).then(() => setStatus('\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f', true)).catch(() => showError('\u590d\u5236\u5931\u8d25'));
  }

  function doDownload() {
    if (!lastResultText) { showError('\u6ca1\u6709\u53ef\u4e0b\u8f7d\u7684\u5185\u5bb9'); return; }
    const blob = new Blob([lastResultText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'format.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('\u5df2\u4e0b\u8f7d', true);
  }

  function doClear() {
    input.value = '';
    output.innerHTML = '<span class="placeholder">\u683c\u5f0f\u5316\u7ed3\u679c\u5c06\u663e\u793a\u5728\u8fd9\u91cc</span>';
    tree.innerHTML = '<span class="placeholder">\u6811\u89c6\u56fe\u5c06\u663e\u793a\u5728\u8fd9\u91cc</span>';
    diffView.innerHTML = '<span class="placeholder">\u5dee\u5f02\u7ed3\u679c\u5c06\u663e\u793a\u5728\u8fd9\u91cc</span>';
    lineNumbers.innerHTML = '';
    stats.textContent = '';
    lastResultText = '';
    currentParsedValue = null;
    searchMatches = [];
    searchIndex = -1;
    searchCount.textContent = '';
    pathDisplay.textContent = '$';
    hideError();
    setStatus('\u5df2\u6e05\u7a7a');
  }

  function doSample() {
    input.value = JSON.stringify(SAMPLE, null, 2);
    doFormat(false);
    setStatus('\u5df2\u8f7d\u5165\u793a\u4f8b', true);
  }

  function showHistory() {
    loadHistory();
    historyModal.classList.remove('hidden');
  }

  function hideHistory() {
    historyModal.classList.add('hidden');
  }

  function showShareModal() {
    if (!lastResultText) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    $('share-url').value = location.origin + location.pathname + '?json=' + encodeURIComponent(lastResultText);
    $('share-modal').classList.remove('hidden');
  }

  function hideShareModal() {
    $('share-modal').classList.add('hidden');
  }

  function copyShareUrl() {
    $('share-url').select();
    document.execCommand('copy');
    setStatus('\u5df2\u590d\u5236\u5206\u4eab\u94fe\u63a5', true);
  }

  function showShortcuts() {
    shortcutsModal.classList.remove('hidden');
  }

  function hideShortcuts() {
    shortcutsModal.classList.add('hidden');
  }

  function showSchemaModal() {
    $('schema-modal').classList.remove('hidden');
  }

  function hideSchemaModal() {
    $('schema-modal').classList.add('hidden');
  }

  function printJson() {
    if (!lastResultText) { showError('\u6ca1\u6709\u53ef\u6253\u5370\u7684\u5185\u5bb9'); return; }
    window.print();
  }

  function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    if (params.has('json')) {
      try {
        input.value = decodeURIComponent(params.get('json'));
        doFormat(false);
      } catch (e) { showError('URL \u53c2\u6790\u5931\u8d25'); }
    } else if (params.has('url')) {
      fetch(params.get('url')).then(r => r.text()).then(t => { input.value = t; doFormat(false); }).catch(() => showError('URL \u52a0\u8f7d\u5931\u8d25'));
    }
  }

  function setupLineHighlight() {
    output.addEventListener('mouseover', (e) => {
      const line = e.target.closest('.output-line');
      if (line) line.classList.add('line-highlight');
    });
    output.addEventListener('mouseout', (e) => {
      const line = e.target.closest('.output-line');
      if (line) line.classList.remove('line-highlight');
    });
  }

  function executeJsonPath() {
    const query = $('jsonpath-input').value.trim();
    if (!query) { showError('\u8bf7\u8f93\u5165 JSONPath \u67e5\u8be2'); return; }
    if (!currentParsedValue) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    try {
      const result = evaluateJsonPath(currentParsedValue, query);
      const resultEl = $('query-result');
      resultEl.innerHTML = '<div class="query-header"><span>\u67e5\u8be2: <code>' + escapeHtml(query) + '</code></span></div><pre class="query-code">' + escapeHtml(JSON.stringify(result, null, 2)) + '</pre>';
    } catch (e) {
      showError('JSONPath \u67e5\u8be2\u5931\u8d25: ' + e.message);
    }
  }

  function evaluateJsonPath(obj, path) {
    const parts = path.replace(/^\$\./, '').split(/[\.\[]/).filter(Boolean);
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      const cleanPart = part.replace(/[\]\"]/g, '');
      if (Array.isArray(current)) {
        if (cleanPart === '*') {
          return current.map(item => evaluateJsonPath(item, ''));
        }
        current = current[parseInt(cleanPart, 10)];
      } else {
        current = current[cleanPart];
      }
    }
    return current;
  }


  function validateSchema(data, schema, path) {
    path = path || '$';
    const errors = [];
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
      const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!expectedTypes.includes(actualType)) {
        errors.push(path + ': \u671f\u671b\u7c7b\u578b ' + expectedTypes.join('|') + '\uff0c\u5b9e\u9645\u7c7b\u578b ' + actualType);
      }
    }
    if (schema.properties && typeof data === 'object' && data !== null && !Array.isArray(data)) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        if (key in data) {
          errors.push(...validateSchema(data[key], propSchema, path + '.' + key));
        } else if (schema.required && schema.required.includes(key)) {
          errors.push(path + ': \u7f3a\u5c11\u5fc5\u9700\u5c5e\u6027 "' + key + '"');
        }
      });
    }
    if (schema.items && Array.isArray(data)) {
      data.forEach((item, i) => {
        errors.push(...validateSchema(item, schema.items, path + '[' + i + ']'));
      });
    }
    if (schema.minimum !== undefined && typeof data === 'number' && data < schema.minimum) errors.push(path + ': \u503c ' + data + ' \u5c0f\u4e8e\u6700\u5c0f\u503c ' + schema.minimum);
    if (schema.maximum !== undefined && typeof data === 'number' && data > schema.maximum) errors.push(path + ': \u503c ' + data + ' \u5927\u4e8e\u6700\u5927\u503c ' + schema.maximum);
    if (schema.minLength !== undefined && typeof data === 'string' && data.length < schema.minLength) errors.push(path + ': \u5b57\u7b26\u4e32\u957f\u5ea6 ' + data.length + ' \u5c0f\u4e8e\u6700\u5c0f\u957f\u5ea6 ' + schema.minLength);
    if (schema.maxLength !== undefined && typeof data === 'string' && data.length > schema.maxLength) errors.push(path + ': \u5b57\u7b26\u4e32\u957f\u5ea6 ' + data.length + ' \u5927\u4e8e\u6700\u5927\u957f\u5ea6 ' + schema.maxLength);
    if (schema.pattern !== undefined && typeof data === 'string' && !new RegExp(schema.pattern).test(data)) errors.push(path + ': \u5b57\u7b26\u4e32\u4e0d\u5339\u914d\u6b63\u5219 ' + schema.pattern);
    if (schema.enum && !schema.enum.includes(data)) errors.push(path + ': \u503c\u4e0d\u5728\u5141\u8bb8\u7684\u679a\u4e3e\u503c\u4e2d');
    return errors;
  }

  function exportToJS() {
    if (!currentParsedValue) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    downloadFile(jsonToJS(currentParsedValue, 'data'), 'export.js', 'application/javascript');
    setStatus('\u5df2\u5bfc\u51faJavaScript', true);
  }

  function jsonToJS(obj, varName, indent) {
    varName = varName || '';
    indent = indent || 0;
    const pad = '  '.repeat(indent);
    const padInner = '  '.repeat(indent + 1);
    if (obj === null) return 'null';
    if (typeof obj === 'boolean') return obj.toString();
    if (typeof obj === 'number') return obj.toString();
    if (typeof obj === 'string') return JSON.stringify(obj);
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const items = obj.map(item => padInner + jsonToJS(item, '', indent + 1));
      return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    if (typeof obj === 'object') {
      const entries = Object.entries(obj);
      if (entries.length === 0) return '{}';
      const lines = entries.map(([key, val]) => {
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
        return padInner + safeKey + ': ' + jsonToJS(val, '', indent + 1);
      });
      return '{\n' + lines.join(',\n') + '\n' + pad + '}';
    }
    return String(obj);
  }

  function exportToTS() {
    if (!currentParsedValue) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    downloadFile(generateTypeScript(currentParsedValue, 'RootType'), 'types.ts', 'text/typescript');
    setStatus('\u5df2\u5bfc\u51faTypeScript\u7c7b\u578b', true);
  }

  function generateTypeScript(obj, typeName, indent) {
    typeName = typeName || '';
    indent = indent || 0;
    const pad = '  '.repeat(indent);
    if (obj === null) return 'null';
    if (typeof obj === 'boolean') return 'boolean';
    if (typeof obj === 'number') return 'number';
    if (typeof obj === 'string') return 'string';
    if (Array.isArray(obj)) {
      if (obj.length === 0) return 'any[]';
      return generateTypeScript(obj[0], '', indent) + '[]';
    }
    if (typeof obj === 'object') {
      const lines = Object.entries(obj).map(([key, val]) => {
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
        return pad + '  ' + safeKey + ': ' + generateTypeScript(val, '', indent + 1) + ';';
      });
      return '{\n' + lines.join('\n') + '\n' + pad + '}';
    }
    return 'any';
  }

  function exportToMarkdown() {
    if (!currentParsedValue) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    let md = '';
    if (Array.isArray(currentParsedValue)) {
      if (currentParsedValue.length === 0) { md = '*\u7a7a\u6570\u7ec4*'; }
      else if (typeof currentParsedValue[0] === 'object' && currentParsedValue[0] !== null) {
        const headers = Object.keys(currentParsedValue[0]);
        md = '| ' + headers.join(' | ') + ' |\n| ' + headers.map(() => '---').join(' | ') + ' |\n';
        currentParsedValue.forEach(row => { md += '| ' + headers.map(h => String(row[h] ?? '')).join(' | ') + ' |\n'; });
      } else {
        md = currentParsedValue.map((item, i) => (i + 1) + '. ' + JSON.stringify(item)).join('\n');
      }
    } else if (typeof currentParsedValue === 'object') {
      const entries = Object.entries(currentParsedValue);
      if (entries.length === 0) { md = '*\u7a7a\u5bf9\u8c61*'; }
      else {
        md = '| \u952e | \u503c | \u7c7b\u578b |\n| --- | --- | --- |\n';
        entries.forEach(([key, val]) => {
          const type = Array.isArray(val) ? 'array' : typeof val;
          const value = typeof val === 'object' ? JSON.stringify(val) : String(val);
          md += '| ' + key + ' | ' + value + ' | ' + type + ' |\n';
        });
      }
    } else { md = String(currentParsedValue); }
    downloadFile(md, 'export.md', 'text/markdown');
    setStatus('\u5df2\u5bfc\u51faMarkdown', true);
  }

  function exportToCSV() {
    if (!currentParsedValue) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    const arr = Array.isArray(currentParsedValue) ? currentParsedValue : [currentParsedValue];
    if (arr.length === 0 || typeof arr[0] !== 'object') { showError('\u9700\u8981\u5bf9\u8c61\u6216\u5bf9\u8c61\u6570\u7ec4'); return; }
    const headers = [...new Set(arr.flatMap(Object.keys))];
    let csv = headers.join(',') + '\n';
    arr.forEach(row => {
      csv += headers.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',') + '\n';
    });
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('\u5df2\u5bfc\u51faCSV (Excel\u517c\u5bb9)', true);
  }

  function exportToXML() {
    if (!currentParsedValue) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + jsonToXml(currentParsedValue, 'root');
    downloadFile(xml, 'export.xml', 'application/xml');
    setStatus('\u5df2\u5bfc\u51faXML', true);
  }

  function jsonToXml(obj, tag) {
    if (obj === null || obj === undefined) return '<' + tag + '/>\n';
    if (typeof obj !== 'object') return '<' + tag + '>' + escapeHtml(String(obj)) + '</' + tag + '>\n';
    if (Array.isArray(obj)) return obj.map(item => jsonToXml(item, tag)).join('');
    let xml = '<' + tag + '>\n';
    Object.entries(obj).forEach(([k, v]) => { xml += jsonToXml(v, k); });
    xml += '</' + tag + '>\n';
    return xml;
  }

  function exportToYAML() {
    if (!currentParsedValue) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    const yaml = jsonToYaml(currentParsedValue, 0);
    downloadFile(yaml, 'export.yaml', 'text/yaml');
    setStatus('\u5df2\u5bfc\u51faYAML', true);
  }

  function jsonToYaml(obj, indent) {
    indent = indent || 0;
    const pad = '  '.repeat(indent);
    if (obj === null || obj === undefined) return 'null\n';
    if (typeof obj !== 'object') return String(obj) + '\n';
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]\n';
      return obj.map(item => pad + '- ' + jsonToYaml(item, indent + 1).trimStart()).join('\n') + '\n';
    }
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}\n';
    return entries.map(([k, v]) => {
      const val = typeof v === 'object' && v !== null ? '\n' + jsonToYaml(v, indent + 1) : ' ' + jsonToYaml(v, 0).trim();
      return pad + k + ':' + val;
    }).join('\n') + '\n';
  }

  function exportToPDF() {
    if (!lastResultText) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JSON Export</title>' +
      '<style>body{font-family:Consolas,"Courier New",monospace;font-size:12px;padding:20px;white-space:pre-wrap;word-break:break-all;line-height:1.5;}' +
      'h1{font-size:16px;margin-bottom:10px;}' +
      '.json-key{color:#0451a5;}.json-string{color:#a31515;}.json-number{color:#098658;}.json-boolean{color:#0000ff;}.json-null{color:#808080;}</style></head><body>' +
      '<h1>JSON Export</h1><div id="content"></div>' +
      '<script>const d=document.getElementById("content");const t=' + JSON.stringify(lastResultText) + ';' +
      'd.innerHTML=t.replace(/("(?:\\\\u[0-9a-fA-F]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(?:true|false)\\b|\\bnull\\b|-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)/g,' +
      'function(m){let c="json-number";if(/^"/.test(m)){if(/:\\s*$/.test(m))c="json-key";else c="json-string";}' +
      'else if(/true|false/.test(m))c="json-boolean";else if(/null/.test(m))c="json-null";return"<span class="+c+">"+m+"</span>";});' +
      '<\/script></body></html>'
    );
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
    setStatus('\u5df2\u5bfc\u51faPDF', true);
  }

  /* ---------- URL编码/解码 ---------- */

  function urlEncode() {
    const text = input.value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    input.value = encodeURIComponent(text);
    setStatus('\u5df2URL\u7f16\u7801', true);
  }

  function urlDecode() {
    const text = input.value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    try {
      input.value = decodeURIComponent(text);
      setStatus('\u5df2URL\u89e3\u7801', true);
    } catch (e) {
      showError('URL\u89e3\u7801\u5931\u8d25: ' + e.message);
    }
  }

  function jsonToUrlParams() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }
    try {
      const obj = JSON.parse(text);
      const params = new URLSearchParams();
      function flatten(val, prefix) {
        if (val === null || val === undefined) { params.set(prefix, ''); return; }
        if (typeof val === 'object' && !Array.isArray(val)) {
          Object.entries(val).forEach(([k, v]) => flatten(v, prefix ? prefix + '[' + k + ']' : k));
        } else if (Array.isArray(val)) {
          val.forEach((v, i) => flatten(v, prefix + '[]'));
        } else {
          params.set(prefix, String(val));
        }
      }
      Object.entries(obj).forEach(([k, v]) => flatten(v, k));
      input.value = params.toString();
      setStatus('\u5df2\u8f6c\u6362\u4e3aURL\u53c2\u6570', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- 哈希生成器 ---------- */

  async function computeHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const sha1 = await crypto.subtle.digest('SHA-1', data);
    const sha256 = await crypto.subtle.digest('SHA-256', data);
    const sha512 = await crypto.subtle.digest('SHA-512', data);

    return {
      sha1: Array.from(new Uint8Array(sha1)).map(b => b.toString(16).padStart(2, '0')).join(''),
      sha256: Array.from(new Uint8Array(sha256)).map(b => b.toString(16).padStart(2, '0')).join(''),
      sha512: Array.from(new Uint8Array(sha512)).map(b => b.toString(16).padStart(2, '0')).join('')
    };
  }

  function md5(string) {
    function md5cycle(x, k) {
      var a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
    }
    function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
    function md51(s) {
      var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
      for (i = 64; i <= n; i += 64) { md5cycle(state, md5blk(s.substring(i - 64, i))); }
      s = s.substring(i - 64); var tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
      for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) { md5cycle(state, tail); tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]; }
      tail[14] = n * 8; md5cycle(state, tail); return state;
    }
    function md5blk(s) {
      var md5blks = [], i;
      for (i = 0; i < 64; i += 4) { md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i+1) << 8) + (s.charCodeAt(i+2) << 16) + (s.charCodeAt(i+3) << 24); }
      return md5blks;
    }
    var hex_chr = '0123456789abcdef'.split('');
    function rhex(n) { var s = '', j = 0; for (; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F]; return s; }
    function hex(x) { for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]); return x.join(''); }
    function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
    return hex(md51(string));
  }

  async function generateHash() {
    const text = $('hash-input').value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u6587\u672c'); return; }
    $('hash-md5').value = md5(text);
    const hashes = await computeHash(text);
    $('hash-sha1').value = hashes.sha1;
    $('hash-sha256').value = hashes.sha256;
    $('hash-sha512').value = hashes.sha512;
    setStatus('\u5df2\u751f\u6210\u54c8\u5e0c\u503c', true);
  }

  function showHashModal() {
    $('hash-modal').classList.remove('hidden');
  }

  function hideHashModal() {
    $('hash-modal').classList.add('hidden');
  }

  /* ---------- HTTP请求测试 ---------- */

  let httpAbortController = null;

  function showHttpModal() {
    $('http-modal').classList.remove('hidden');
  }

  function hideHttpModal() {
    $('http-modal').classList.add('hidden');
    if (httpAbortController) { httpAbortController.abort(); httpAbortController = null; }
  }

  function switchHttpTab(tabId) {
    document.querySelectorAll('.http-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.http-panel').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
    document.querySelector('.http-tab[data-tab="' + tabId + '"]').classList.add('active');
    $(tabId).classList.remove('hidden');
    $(tabId).classList.add('active');
  }

  async function sendHttpRequest() {
    const url = $('http-url').value.trim();
    if (!url) { showError('\u8bf7\u8f93\u5165URL'); return; }

    const method = $('http-method').value;
    const bodyInput = $('http-body-input').value.trim();
    const headersInput = $('http-headers-input').value.trim();
    const contentType = $('http-content-type').value;

    $('http-loading').classList.remove('hidden');
    $('http-response').classList.add('hidden');

    const headers = { 'Content-Type': contentType };
    if (headersInput) {
      try {
        const customHeaders = JSON.parse(headersInput);
        Object.assign(headers, customHeaders);
      } catch (e) {
        showError('Headers JSON\u683c\u5f0f\u9519\u8bef');
        $('http-loading').classList.add('hidden');
        return;
      }
    }

    const options = { method, headers };
    if (method !== 'GET' && method !== 'HEAD' && bodyInput) {
      options.body = contentType.includes('json') ? bodyInput : bodyInput;
    }

    httpAbortController = new AbortController();
    options.signal = httpAbortController.signal;

    const startTime = Date.now();
    try {
      const response = await fetch(url, options);
      const elapsed = Date.now() - startTime;
      const text = await response.text();

      $('http-loading').classList.add('hidden');
      $('http-response').classList.remove('hidden');

      const statusEl = $('http-status');
      statusEl.textContent = response.status + ' ' + response.statusText;
      statusEl.className = 'http-status ' + (response.ok ? 'ok' : 'err');

      $('http-time').textContent = elapsed + 'ms | ' + text.length + ' bytes';

      let formattedBody = text;
      try {
        formattedBody = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {}
      $('http-response-body').textContent = formattedBody;
    } catch (e) {
      $('http-loading').classList.add('hidden');
      if (e.name === 'AbortError') return;
      showError('请求失败: ' + e.message);
    }
    httpAbortController = null;
  }

  /* ---------- JSON压缩 ---------- */

  /* ---------- JSON排序 ---------- */

  function sortKeysDeep(obj) {
    if (Array.isArray(obj)) return obj.map(sortKeysDeep);
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sortKeysDeep(obj[k]); return acc; }, {});
    }
    return obj;
  }

  function sortByKeys() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }
    try {
      const obj = JSON.parse(text);
      const sorted = sortKeysDeep(obj);
      input.value = JSON.stringify(sorted, null, 2);
      setStatus('\u5df2\u6309\u952e\u540d\u6392\u5e8f', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function sortByValues() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }
    try {
      const obj = JSON.parse(text);
      if (!Array.isArray(obj)) {
        input.value = JSON.stringify(obj, null, 2);
        setStatus('\u6570\u7ec4\u5df2\u6392\u5e8f', true);
        return;
      }
      const sorted = obj.slice().sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
        return JSON.stringify(a).localeCompare(JSON.stringify(b));
      });
      input.value = JSON.stringify(sorted, null, 2);
      setStatus('\u5df2\u6309\u503c\u6392\u5e8f', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function minifyJson() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }
    try {
      const obj = JSON.parse(text);
      input.value = JSON.stringify(obj);
      setStatus('\u5df2\u538b\u7f29JSON', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- CSV转换 ---------- */

  function jsonToCsv() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }
    try {
      const obj = JSON.parse(text);
      let arr = Array.isArray(obj) ? obj : [obj];
      if (arr.length === 0) { showError('\u6570\u7ec4\u4e3a\u7a7a'); return; }

      const headers = [];
      const headerSet = new Set();
      arr.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(k => {
            if (!headerSet.has(k)) { headerSet.add(k); headers.push(k); }
          });
        }
      });

      if (headers.length === 0) { showError('\u65e0\u6cd5\u63d0\u53d6\u5217\u540d'); return; }

      const csvRows = [headers.join(',')];
      arr.forEach(item => {
        const row = headers.map(h => {
          let val = item[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') val = JSON.stringify(val);
          val = String(val).replace(/"/g, '""');
          if (val.includes(',') || val.includes('"') || val.includes('\n')) val = '"' + val + '"';
          return val;
        });
        csvRows.push(row.join(','));
      });

      const csv = csvRows.join('\n');
      renderTable(headers, arr);
      $('table-modal').classList.remove('hidden');
      $('table-modal')._csvData = csv;
      $('table-modal')._headers = headers;
      $('table-modal')._arr = arr;
      setStatus('\u5df2\u751f\u6210CSV\u8868\u683c', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function renderTable(headers, arr) {
    const table = $('json-table');
    let html = '<thead><tr>';
    html += '<th>#</th>';
    headers.forEach(h => { html += '<th>' + escapeHtml(h) + '</th>'; });
    html += '</tr></thead><tbody>';
    arr.forEach((item, i) => {
      html += '<tr>';
      html += '<td>' + (i + 1) + '</td>';
      headers.forEach(h => {
        let val = item[h];
        let cls = '';
        if (val === null || val === undefined) { val = 'null'; cls = 'cell-null'; }
        else if (typeof val === 'boolean') cls = 'cell-boolean';
        else if (typeof val === 'number') cls = 'cell-number';
        else if (typeof val === 'object') val = JSON.stringify(val);
        html += '<td class="' + cls + '" title="' + escapeHtml(String(val)) + '">' + escapeHtml(String(val)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody>';
    table.innerHTML = html;
  }

  function csvToJson() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165CSV'); return; }
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { showError('CSV\u81f3\u5c11\u9700\u8981\u884c\u540d\u548c1\u884c\u6570\u636e'); return; }

    function parseCsvLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (inQuotes) {
          if (line[i] === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            current += line[i];
          }
        } else {
          if (line[i] === '"') {
            inQuotes = true;
          } else if (line[i] === ',') {
            result.push(current.trim());
            current = '';
          } else {
            current += line[i];
          }
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = parseCsvLine(lines[0]);
    const arr = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const obj = {};
      headers.forEach((h, j) => {
        let val = values[j] || '';
        if (val === 'null') val = null;
        else if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (val !== '' && !isNaN(val)) val = Number(val);
        obj[h] = val;
      });
      arr.push(obj);
    }

    input.value = JSON.stringify(arr, null, 2);
    setStatus('\u5df2\u8f6c\u6362CSV\u4e3aJSON', true);
  }

  /* ---------- 中文简繁转换 ---------- */

  const traditionalMap = {
    '\u4e00': '\u4e00', '\u4e8c': '\u4e8c', '\u4e09': '\u4e09', '\u56db': '\u56db', '\u4e94': '\u4e94',
    '\u516d': '\u516d', '\u4e03': '\u4e03', '\u516b': '\u516b', '\u4e5d': '\u4e5d', '\u5341': '\u5341',
    '\u4eba': '\u4eba', '\u5927': '\u5927', '\u5c0f': '\u5c0f', '\u4e2d': '\u4e2d', '\u56fd': '\u570b',
    '\u5b66': '\u5b78', '\u751f': '\u751f', '\u5de5': '\u5de5', '\u5546': '\u5546', '\u5e02': '\u5e02',
    '\u957f': '\u9577', '\u5f00': '\u958b', '\u95e8': '\u9580', '\u4e70': '\u8cb7', '\u5356': '\u8ce3',
    '\u8f66': '\u8ecd', '\u4e66': '\u66f8', '\u4e94\u6708': '\u4e94\u6708', '\u6587': '\u6587',
    '\u5fc3': '\u5fc3', '\u6c34': '\u6c34', '\u706b': '\u706b', '\u571f': '\u571f', '\u91d1': '\u91d1',
    '\u6728': '\u6728', '\u79be': '\u79be', '\u7c73': '\u7c73', '\u7af9': '\u7af9', '\u8c46': '\u8c46',
    '\u9769': '\u9769', '\u725b': '\u725b', '\u9a6c': '\u99ac', '\u9e1f': '\u9d1c', '\u9c7c': '\u9b5a',
    '\u9f99': '\u9f8d', '\u864e': '\u864e', '\u96f7': '\u96f7', '\u98ce': '\u98a8', '\u96e8': '\u96e8',
    '\u96ea': '\u96ea', '\u4e91': '\u96f2', '\u5c71': '\u5c71', '\u77f3': '\u77f3', '\u7530': '\u7530',
    '\u571f': '\u571f', '\u6797': '\u6797', '\u68f1': '\u68f1', '\u6751': '\u6751', '\u5e84': '\u838a',
    '\u57ce': '\u57ce', '\u677f': '\u677f', '\u67f1': '\u67f1', '\u6881': '\u6881', '\u6885': '\u6885',
    '\u67f4': '\u67f4', '\u6886': '\u6886', '\u6a38': '\u6a86', '\u69db': '\u6a7f', '\u697c': '\u6a13',
    '\u69db': '\u6a7f', '\u697c': '\u6a13', '\u69db': '\u6a7f', '\u697c': '\u6a13',
    '\u7b80': '\u7c21', '\u4e66': '\u66f8', '\u7b14': '\u7b46', '\u7eb8': '\u7d19', '\u7535': '\u96fb',
    '\u8111': '\u8166', '\u952e': '\u9375', '\u76d8': '\u76e4', '\u9f20': '\u9f20', '\u6253': '\u6253',
    '\u5370': '\u5370', '\u5237': '\u5237', '\u5207': '\u5207', '\u5229': '\u5229', '\u524d': '\u524d',
    '\u540e': '\u5f8c', '\u5de6': '\u5de6', '\u53f3': '\u53f3', '\u4e0a': '\u4e0a', '\u4e0b': '\u4e0b',
    '\u5185': '\u5167', '\u5916': '\u5916', '\u4e2d': '\u4e2d', '\u95f4': '\u9593', '\u65f6': '\u6642',
    '\u95f4': '\u9593', '\u65e5': '\u65e5', '\u6708': '\u6708', '\u5e74': '\u5e74', '\u4eca': '\u4eca',
    '\u5929': '\u5929', '\u5730': '\u5730', '\u4eba': '\u4eba', '\u548c': '\u548c', '\u6709': '\u6709',
    '\u65e0': '\u7121', '\u662f': '\u662f', '\u8fd9': '\u9019', '\u90a3': '\u90a3', '\u4ec0': '\u4ec0',
    '\u4e48': '\u4ec0\u9ebc', '\u600e': '\u600e', '\u4e5f': '\u4e5f', '\u5c31': '\u5c31', '\u90fd': '\u90fd',
    '\u8981': '\u8981', '\u8fd8': '\u9084', '\u4f1a': '\u6703', '\u80fd': '\u80fd', '\u53ef': '\u53ef\u4ee5',
    '\u53ef\u4ee5': '\u53ef\u4ee5', '\u5e94': '\u61c9', '\u5e94\u8be5': '\u61c9\u8a72', '\u5c06': '\u5c07',
    '\u5df2': '\u5df2', '\u7ecf': '\u7d93', '\u8fc7': '\u904e', '\u8fd9': '\u9019', '\u4e2a': '\u500b',
    '\u6bcf': '\u6bcf', '\u4e4b': '\u4e4b', '\u800c': '\u800c', '\u4e14': '\u4e14', '\u6216': '\u6216',
    '\u8005': '\u8005', '\u6240': '\u6240', '\u56e0': '\u56e0', '\u4e3a': '\u70ba', '\u4ee5': '\u4ee5',
    '\u4e0e': '\u8207', '\u53ca': '\u53ca', '\u4e43': '\u4e43', '\u5219': '\u5247', '\u4f46': '\u4f46',
    '\u5982': '\u5982', '\u82e5': '\u82e5', '\u867d': '\u96d6', '\u56e0': '\u56e0', '\u7136': '\u7136',
    '\u6240\u4ee5': '\u6240\u4ee5', '\u56e0\u4e3a': '\u56e0\u70ba', '\u5982\u679c': '\u5982\u679c',
    '\u4e0d': '\u4e0d', '\u6ca1': '\u6c92', '\u6709': '\u6709', '\u662f': '\u662f', '\u5bf9': '\u5c0d',
    '\u9519': '\u932f', '\u51fa': '\u51fa', '\u5165': '\u5165', '\u4e0a': '\u4e0a', '\u4e0b': '\u4e0b',
    '\u6765': '\u4f86', '\u53bb': '\u53bb', '\u8fc7': '\u904e', '\u8fd9': '\u9019', '\u91cc': '\u88e1',
    '\u5916': '\u5916', '\u5185': '\u5167', '\u524d': '\u524d', '\u540e': '\u5f8c', '\u5de6': '\u5de6',
    '\u53f3': '\u53f3', '\u4e0a': '\u4e0a', '\u4e0b': '\u4e0b', '\u5927': '\u5927', '\u5c0f': '\u5c0f',
    '\u591a': '\u591a', '\u5c11': '\u5c11', '\u597d': '\u597d', '\u574f': '\u58de', '\u65b0': '\u65b0',
    '\u65e7': '\u820a', '\u957f': '\u9577', '\u77ed': '\u77ed', '\u9ad8': '\u9ad8', '\u4f4e': '\u4f4e',
    '\u5feb': '\u5feb', '\u6162': '\u6162', '\u65e9': '\u65e9', '\u665a': '\u665a', '\u65b0': '\u65b0',
    '\u65e7': '\u820a', '\u957f': '\u9577', '\u77ed': '\u77ed', '\u5feb': '\u5feb', '\u6162': '\u6162',
    '\u540c': '\u540c', '\u5f02': '\u7570', '\u5408': '\u5408', '\u5f00': '\u958b', '\u5173': '\u95dc',
    '\u95ed': '\u9589', '\u5f00\u5173': '\u958b\u95dc', '\u751f\u6b7b': '\u751f\u6b7b', '\u6765\u53bb': '\u4f86\u53bb',
    '\u51fa\u5165': '\u51fa\u5165', '\u6765\u5f80': '\u4f86\u5f80', '\u5f80\u8fd4': '\u5f80\u8fd4',
    '\u59cb\u7ec8': '\u59cb\u7d42', '\u7ed3\u675f': '\u7d50\u675f', '\u5f00\u59cb': '\u958b\u59cb',
    '\u5f00\u53d1': '\u958b\u767c', '\u53d1\u5c55': '\u767c\u5c55', '\u53d1\u8fbe': '\u767c\u9054',
    '\u53d1\u73b0': '\u767c\u73fe', '\u53d1\u660e': '\u767c\u660e', '\u53d1\u58f0': '\u767c\u8072',
    '\u53d1\u51fa': '\u767c\u51fa', '\u53d1\u9001': '\u767c\u9001', '\u53d1\u5c55': '\u767c\u5c55',
    '\u6539\u53d8': '\u6539\u8b8a', '\u53d8\u6210': '\u8b8a\u6210', '\u53d8\u5f97': '\u8b8a\u5f97',
    '\u5316': '\u5316', '\u8f6c': '\u8f49', '\u8fd0': '\u904b', '\u901a': '\u901a', '\u8fc7': '\u904e',
    '\u8fbe': '\u9054', '\u8fdb': '\u9032', '\u9000': '\u9000', '\u8fd4': '\u8fd4', '\u8d70': '\u8d70',
    '\u8dd1': '\u8dd1', '\u8df3': '\u8df3', '\u7ad9': '\u7ad9', '\u5750': '\u5750', '\u7acb': '\u7acb',
    '\u8d77': '\u8d77', '\u8e72': '\u8e72', '\u8eab': '\u8eab', '\u4f53': '\u9ad4', '\u624b': '\u624b',
    '\u8db3': '\u8db3', '\u5934': '\u982d', '\u8138': '\u81c9', '\u773c': '\u773c', '\u8033': '\u807d',
    '\u9f3b': '\u9f3b', '\u5634': '\u5634', '\u7259': '\u7259', '\u820c': '\u820c', '\u5589': '\u5589',
    '\u53d1': '\u9aee', '\u624b': '\u624b', '\u6307': '\u6307', '\u638c': '\u638c', '\u5fc3': '\u5fc3',
    '\u810f': '\u816f', '\u80be': '\u817e', '\u80ba': '\u8169', '\u8138': '\u81c9', '\u5fc3': '\u5fc3',
    '\u809d': '\u809d', '\u80c3': '\u80c3', '\u80a0': '\u817f', '\u8179': '\u8179', '\u8110': '\u8166',
    '\u9aa8': '\u9aa8', '\u8840': '\u8840', '\u8109': '\u8108', '\u76ae': '\u76ae', '\u8089': '\u8089',
    '\u7b5b': '\u7bc0', '\u7f51': '\u7db2', '\u8863': '\u8863', '\u88e4': '\u896e', '\u889c': '\u889c',
    '\u8863': '\u8863', '\u978b': '\u978b', '\u5e3d': '\u5e3d', '\u88d9': '\u88d9', '\u88e4': '\u896e',
    '\u8863': '\u8863', '\u88e4': '\u896e', '\u8863': '\u8863', '\u88e4': '\u896e',
    '\u9910': '\u9910', '\u996d': '\u98ef', '\u83dc': '\u83dc', '\u997f': '\u995e', '\u9965': '\u9913',
    '\u996e': '\u98f2', '\u9152': '\u9152', '\u8336': '\u8336', '\u9971': '\u98fd', '\u9965': '\u9913',
    '\u996e': '\u98f2', '\u5c45': '\u5c45', '\u4f4f': '\u4f4f', '\u5bbf': '\u5bbf', '\u5e99': '\u5ed7',
    '\u623f': '\u623f', '\u5c4b': '\u5c4b', '\u697c': '\u6a13', '\u68af': '\u68af', '\u53f0': '\u81fa',
    '\u67dc': '\u6ac3', '\u6298': '\u6298', '\u53e0': '\u758a', '\u6536': '\u6536', '\u653e': '\u653e',
    '\u62ff': '\u62ff', '\u63d0': '\u63d0', '\u63a8': '\u63a8', '\u62bd': '\u62bd', '\u62bd': '\u62bd',
    '\u62c9': '\u62c9', '\u6296': '\u6296', '\u6296': '\u6296', '\u6296': '\u6296'
  };

  const simplifiedMap = {};
  Object.entries(traditionalMap).forEach(([s, t]) => { simplifiedMap[t] = s; });

  function convertChinese(toTraditional) {
    const text = input.value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    const map = toTraditional ? traditionalMap : simplifiedMap;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      result += map[ch] || ch;
    }
    input.value = result;
    setStatus(toTraditional ? '\u5df2\u8f6c\u7e41\u4f53' : '\u5df2\u8f6c\u7b80\u4f53', true);
  }

  /* ---------- JSON转HTML表格 ---------- */

  function jsonToHtml() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }
    try {
      const obj = JSON.parse(text);
      let arr = Array.isArray(obj) ? obj : [obj];
      if (arr.length === 0) { showError('\u6570\u7ec4\u4e3a\u7a7a'); return; }

      const headers = [];
      const headerSet = new Set();
      arr.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(k => {
            if (!headerSet.has(k)) { headerSet.add(k); headers.push(k); }
          });
        }
      });
      if (headers.length === 0) { showError('\u65e0\u6cd5\u63d0\u53d6\u5217\u540d'); return; }

      const hasStyle = $('html-style').checked;
      const hasBorder = $('html-border').checked;
      const hasStriped = $('html-striped').checked;

      let style = '';
      if (hasStyle) {
        style = ' style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;"';
      }

      let html = '<table' + style + '>\n<thead>\n<tr>\n';
      headers.forEach(h => {
        if (hasStyle) html += '  <th style="border:1px solid #ddd;padding:8px 12px;background:#f5f5f5;font-weight:600;">' + escapeHtml(h) + '</th>\n';
        else html += '  <th>' + escapeHtml(h) + '</th>\n';
      });
      html += '</tr>\n</thead>\n<tbody>\n';

      arr.forEach((item, i) => {
        if (hasStriped && i % 2 === 1) {
          if (hasStyle) html += '<tr style="background:#fafafa;">\n';
          else html += '<tr>\n';
        } else {
          html += '<tr>\n';
        }
        headers.forEach(h => {
          let val = item[h];
          if (val === null || val === undefined) val = '';
          else if (typeof val === 'object') val = JSON.stringify(val);
          val = escapeHtml(String(val));
          if (hasStyle) html += '  <td style="border:1px solid #ddd;padding:6px 12px;">' + val + '</td>\n';
          else html += '  <td>' + val + '</td>\n';
        });
        html += '</tr>\n';
      });

      html += '</tbody>\n</table>';

      $('html-output').value = html;
      $('html-preview').innerHTML = html;
      $('html-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210HTML\u8868\u683c', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- Markdown表格转JSON ---------- */

  function mdTableToJson() {
    const text = $('md2json-input').value.trim();
    if (!text) { showError('\u8bf7\u7c98\u8d34Markdown\u8868\u683c'); return; }

    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { showError('Markdown\u8868\u683c\u81f3\u5c11\u9700\u8981\u8868\u5934\u548c\u5206\u9694\u884c'); return; }

    function parseMdRow(line) {
      return line.split('|').map(c => c.trim()).filter(c => c !== '');
    }

    const headers = parseMdRow(lines[0]);
    const arr = [];

    for (let i = 2; i < lines.length; i++) {
      const values = parseMdRow(lines[i]);
      const obj = {};
      headers.forEach((h, j) => {
        let val = values[j] || '';
        if (val === 'null' || val === 'NULL') val = null;
        else if (val === 'true' || val === 'TRUE') val = true;
        else if (val === 'false' || val === 'FALSE') val = false;
        else if (val !== '' && !isNaN(val) && val !== '') val = Number(val);
        obj[h] = val;
      });
      arr.push(obj);
    }

    $('md2json-output').value = JSON.stringify(arr, null, 2);
    setStatus('\u5df2\u8f6c\u6362Markdown\u8868\u683c', true);
  }

  /* ---------- JSON数据统计分析 ---------- */

  function analyzeJson() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const stats = {
        depth: 0, keys: 0, totalValues: 0, arrayLengths: [],
        values: { string: 0, number: 0, boolean: 0, null: 0, object: 0, array: 0 },
        stringLengths: [], numberValues: [], allKeys: new Set(), uniqueStrings: new Set(),
        totalSize: text.length
      };

      function analyze(val, depth) {
        if (depth > stats.depth) stats.depth = depth;
        if (val === null) { stats.values.null++; stats.totalValues++; return; }
        if (Array.isArray(val)) {
          stats.values.array++;
          stats.totalValues++;
          stats.arrayLengths.push(val.length);
          val.forEach(v => analyze(v, depth + 1));
          return;
        }
        if (typeof val === 'object') {
          stats.values.object++;
          stats.totalValues++;
          const keys = Object.keys(val);
          stats.keys += keys.length;
          keys.forEach(k => { stats.allKeys.add(k); analyze(val[k], depth + 1); });
          return;
        }
        if (typeof val === 'string') {
          stats.values.string++;
          stats.totalValues++;
          stats.stringLengths.push(val.length);
          stats.uniqueStrings.add(val);
        } else if (typeof val === 'number') {
          stats.values.number++;
          stats.totalValues++;
          stats.numberValues.push(val);
        } else if (typeof val === 'boolean') {
          stats.values.boolean++;
          stats.totalValues++;
        }
      }

      analyze(obj, 0);

      const total = stats.totalValues || 1;
      let html = '';

      html += '<div class="analyzer-row"><span class="analyzer-label">\u539f\u59cb\u5927\u5c0f</span><span class="analyzer-value">' + formatSize(stats.totalSize) + '</span></div>';
      html += '<div class="analyzer-row"><span class="analyzer-label">\u5d4c\u5957\u6df1\u5ea6</span><span class="analyzer-value">' + stats.depth + '</span></div>';
      html += '<div class="analyzer-row"><span class="analyzer-label">\u952e\u603b\u6570</span><span class="analyzer-value">' + stats.keys + '</span></div>';
      html += '<div class="analyzer-row"><span class="analyzer-label">\u552f\u4e00\u952e\u6570</span><span class="analyzer-value">' + stats.allKeys.size + '</span></div>';
      html += '<div class="analyzer-row"><span class="analyzer-label">\u503c\u603b\u6570</span><span class="analyzer-value">' + stats.totalValues + '</span></div>';

      if (stats.arrayLengths.length > 0) {
        const avgArr = Math.round(stats.arrayLengths.reduce((a, b) => a + b, 0) / stats.arrayLengths.length);
        html += '<div class="analyzer-row"><span class="analyzer-label">\u6570\u7ec4\u5e73\u5747\u957f\u5ea6</span><span class="analyzer-value">' + avgArr + '</span></div>';
      }
      if (stats.stringLengths.length > 0) {
        const avgStr = Math.round(stats.stringLengths.reduce((a, b) => a + b, 0) / stats.stringLengths.length);
        html += '<div class="analyzer-row"><span class="analyzer-label">\u5b57\u7b26\u4e32\u5e73\u5747\u957f\u5ea6</span><span class="analyzer-value">' + avgStr + '</span></div>';
        html += '<div class="analyzer-row"><span class="analyzer-label">\u552f\u4e00\u5b57\u7b26\u4e32\u6570</span><span class="analyzer-value">' + stats.uniqueStrings.size + '</span></div>';
      }
      if (stats.numberValues.length > 0) {
        const min = Math.min(...stats.numberValues);
        const max = Math.max(...stats.numberValues);
        const avg = Math.round(stats.numberValues.reduce((a, b) => a + b, 0) / stats.numberValues.length * 100) / 100;
        html += '<div class="analyzer-row"><span class="analyzer-label">\u6570\u5b57\u8303\u56f4</span><span class="analyzer-value">' + min + ' ~ ' + max + '</span></div>';
        html += '<div class="analyzer-row"><span class="analyzer-label">\u6570\u5b57\u5e73\u5747\u503c</span><span class="analyzer-value">' + avg + '</span></div>';
      }

      html += '<hr style="border-color:var(--border);margin:8px 0">';

      Object.entries(stats.values).forEach(([type, count]) => {
        if (count > 0) {
          const pct = Math.round(count / total * 100);
          html += '<div class="analyzer-row"><span class="analyzer-label">' + type + '</span><span class="analyzer-value">' + count + ' (' + pct + '%)</span></div>';
          html += '<div class="analyzer-bar"><div class="analyzer-bar-fill" style="width:' + pct + '%"></div></div>';
        }
      });

      $('analyzer-results').innerHTML = html;
      $('analyzer-modal').classList.remove('hidden');
      setStatus('\u5206\u6790\u5b8c\u6210', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- 正则表达式测试 ---------- */

  function testRegex() {
    const pattern = $('regex-pattern').value;
    const flags = $('regex-flags').value;
    const text = $('regex-test-text').value;

    if (!pattern) { showError('\u8bf7\u8f93\u5165\u6b63\u5219\u8868\u8fbe\u5f0f'); return; }
    if (!text) { showError('\u8bf7\u8f93\u5165\u6d4b\u8bd5\u6587\u672c'); return; }

    try {
      const regex = new RegExp(pattern, flags);
      const matches = [];
      let match;
      let safety = 0;

      if (flags.includes('g')) {
        while ((match = regex.exec(text)) !== null && safety < 1000) {
          matches.push({ value: match[0], index: match.index, groups: match.slice(1) });
          if (!regex.lastIndex) regex.lastIndex++;
          safety++;
        }
      } else {
        match = regex.exec(text);
        if (match) matches.push({ value: match[0], index: match.index, groups: match.slice(1) });
      }

      let html = '';
      if (matches.length === 0) {
        html = '<p class="regex-no-match">\u65e0\u5339\u914d\u7ed3\u679c</p>';
      } else {
        html = '<div class="regex-match-info">\u5171\u627e\u5230 ' + matches.length + ' \u4e2a\u5339\u914d</div>';
        matches.forEach((m, i) => {
          html += '<div style="margin:4px 0;padding:4px 8px;background:var(--bg-panel);border-radius:4px;font-family:var(--mono);font-size:12px;">';
          html += '<span style="color:var(--accent)">#' + (i + 1) + '</span> ';
          html += '<span class="regex-match">' + escapeHtml(m.value) + '</span>';
          html += ' <span style="color:var(--text-dim)">@ ' + m.index + '</span>';
          if (m.groups.length > 0) {
            html += ' <span style="color:var(--text-dim)">\u6350\u83b7:</span> ' + m.groups.map(g => '<span class="regex-match">' + escapeHtml(g || '') + '</span>').join(', ');
          }
          html += '</div>';
        });
      }

      $('regex-results').innerHTML = html;
    } catch (e) {
      showError('\u6b63\u5219\u8868\u8fbe\u5f0f\u9519\u8bef: ' + e.message);
    }
  }

  /* ---------- Java代码生成器 ---------- */

  function toJavaClassName(key) {
    let name = key.replace(/[^a-zA-Z0-9_]/g, '');
    if (/^[0-9]/.test(name)) name = 'A' + name;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function getJavaType(val) {
    if (val === null) return 'Object';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        if (val >= -2147483648 && val <= 2147483647) return 'int';
        return 'long';
      }
      return 'double';
    }
    if (typeof val === 'string') return 'String';
    if (Array.isArray(val)) return 'List';
    return 'Object';
  }

  function generateJavaFromObj(obj, className, options, classes, parentClass) {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null && !Array.isArray(obj[0])) {
        generateJavaFromObj(obj[0], className + 'Item', options, classes, null);
      }
      return 'List<' + (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null ? className + 'Item' : getJavaType(obj[0] || '')) + '>';
    }
    if (typeof obj !== 'object' || obj === null) return getJavaType(obj);

    const fields = [];
    const innerClasses = [];

    Object.entries(obj).forEach(([key, val]) => {
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      let fieldJavaName = safeKey;
      if (/^[0-9]/.test(fieldJavaName)) fieldJavaName = 'A' + fieldJavaName;

      let type;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null && !Array.isArray(val[0])) {
          const itemClassName = fieldJavaName.charAt(0).toUpperCase() + fieldJavaName.slice(1);
          generateJavaFromObj(val[0], itemClassName, options, classes, className);
          type = 'List<' + itemClassName + '>';
        } else {
          const innerType = val.length > 0 ? getJavaType(val[0] || '') : 'Object';
          type = 'List<' + innerType + '>';
        }
      } else if (typeof val === 'object' && val !== null) {
        const innerClassName = fieldJavaName.charAt(0).toUpperCase() + fieldJavaName.slice(1);
        generateJavaFromObj(val, innerClassName, options, classes, className);
        type = innerClassName;
      } else {
        type = getJavaType(val);
      }

      fields.push({ name: fieldJavaName, type, originalKey: key });
    });

    const lines = [];
    const pkg = $('java-package').value.trim();

    if (pkg && !parentClass) {
      lines.push('package ' + pkg + ';');
      lines.push('');
    }

    const imports = [];
    if (options.serializable) imports.push('import java.io.Serializable;');
    if (fields.some(f => f.type.startsWith('List'))) imports.add ? null : imports.push('import java.util.List;');
    if (imports.length > 0) {
      imports.sort();
      lines.push(imports.join('\n'));
      lines.push('');
    }

    const modifier = parentClass ? 'static ' : '';
    const serial = options.serializable ? ' implements Serializable' : '';
    const serialField = options.serializable ? '\n    private static final long serialVersionUID = 1L;' : '';

    lines.push('public ' + modifier + 'class ' + className + serial + ' {' + serialField);

    fields.forEach(f => {
      lines.push('    private ' + f.type + ' ' + f.name + ';');
    });

    if (options.getset) {
      fields.forEach(f => {
        const capName = f.name.charAt(0).toUpperCase() + f.name.slice(1);
        if (f.type === 'boolean') {
          lines.push('');
          lines.push('    public ' + f.type + ' is' + capName + '() {');
          lines.push('        return ' + f.name + ';');
          lines.push('    }');
        } else {
          lines.push('');
          lines.push('    public ' + f.type + ' get' + capName + '() {');
          lines.push('        return ' + f.name + ';');
          lines.push('    }');
        }
        lines.push('');
        lines.push('    public void set' + capName + '(' + f.type + ' ' + f.name + ') {');
        lines.push('        this.' + f.name + ' = ' + f.name + ';');
        lines.push('    }');
      });
    }

    if (options.tostring) {
      lines.push('');
      lines.push('    @Override');
      lines.push('    public String toString() {');
      const parts = fields.map(f => '        "' + f.name + '=" + ' + f.name);
      lines.push('        return ' + parts.join(' + \n') + ';');
      lines.push('    }');
    }

    lines.push('}');

    if (!parentClass) {
      classes.push(lines.join('\n'));
    } else {
      classes.push(lines.join('\n'));
    }

    return className;
  }

  function generateJava() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
      return;
    }

    const className = $('java-classname').value.trim() || 'Root';
    const options = {
      lombok: $('java-lombok').checked,
      getset: $('java-getset').checked,
      tostring: $('java-tostring').checked,
      serializable: $('java-serializable').checked
    };

    const classes = [];
    generateJavaFromObj(obj, className, options, classes, null);

    let output = '';
    if (options.lombok) {
      const pkg = $('java-package').value.trim();
      if (pkg) output += 'package ' + pkg + ';\n\n';
      output += 'import lombok.Data;\n';
      if (options.tostring) output += 'import lombok.ToString;\n';
      output += '\n';

      const allClasses = classes.reverse();
      allClasses.forEach((c, i) => {
        const nameMatch = c.match(/class\s+(\w+)/);
        let name = nameMatch ? nameMatch[1] : 'Class' + i;
        let content = c.replace(/public\s+(static\s+)?class\s+\w+/, '@Data');
        if (!options.tostring) content = content.replace(/@ToString/, '');
        const serialIdx = content.indexOf('private static final long serialVersionUID');
        if (serialIdx > -1) content = content.substring(0, serialIdx) + content.substring(content.indexOf('\n', serialIdx) + 1);
        output += content + '\n\n';
      });
    } else {
      output = classes.reverse().join('\n\n');
    }

    $('java-output').value = output.trim();
    setStatus('\u5df2\u751f\u6210Java\u4ee3\u7801', true);
  }

  function showJavaModal() {
    $('java-modal').classList.remove('hidden');
  }

  function hideJavaModal() {
    $('java-modal').classList.add('hidden');
  }

  /* ---------- JSON转SQL ---------- */

  function generateSql() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const arr = Array.isArray(obj) ? obj : [obj];
      if (arr.length === 0) { showError('\u6570\u7ec4\u4e3a\u7a7a'); return; }
      if (typeof arr[0] !== 'object' || arr[0] === null) { showError('JSON\u5fc5\u987b\u662f\u5bf9\u8c61\u6570\u7ec4'); return; }

      const tableName = $('java-classname').value.trim() || 'data';
      const lines = [];

      const headers = [];
      const headerSet = new Set();
      arr.forEach(item => {
        Object.keys(item).forEach(k => {
          if (!headerSet.has(k)) { headerSet.add(k); headers.push(k); }
        });
      });

      lines.push('-- CREATE TABLE ' + tableName + ' (');
      lines.push('--   ' + headers.map(h => h + ' TEXT').join(', '));
      lines.push('-- );');
      lines.push('');

      arr.forEach(item => {
        const values = headers.map(h => {
          const val = item[h];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return String(val);
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          return "'" + String(val).replace(/'/g, "''") + "'";
        });
        lines.push('INSERT INTO ' + tableName + ' (' + headers.join(', ') + ') VALUES (' + values.join(', ') + ');');
      });

      $('java-output').value = lines.join('\n');
      $('java-modal').querySelector('h3').textContent = 'SQL \u8bed\u53e5\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210SQL\u8bed\u53e5', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- JSON转Go结构体 ---------- */

  function generateGo() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const classes = [];
      generateGoStruct(obj, 'Root', classes);
      $('java-output').value = 'package main\n\n' + classes.reverse().join('\n\n');
      $('java-modal').querySelector('h3').textContent = 'Go \u7ed3\u6784\u4f53\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Go\u7ed3\u6784\u4f53', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateGoStruct(obj, name, classes) {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        generateGoStruct(obj[0], name + 'Item', classes);
        return '[]' + name + 'Item';
      }
      return '[]' + getGoType(obj[0]);
    }
    if (typeof obj !== 'object' || obj === null) return getGoType(obj);

    const fields = [];
    Object.entries(obj).forEach(([key, val]) => {
      const goName = key.charAt(0).toUpperCase() + key.slice(1).replace(/[^a-zA-Z0-9]/g, '');
      let goType;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          const itemGoType = generateGoStruct(val[0], goName + 'Item', classes);
          goType = '[]' + itemGoType;
        } else {
          goType = '[]' + getGoType(val[0]);
        }
      } else if (typeof val === 'object' && val !== null) {
        generateGoStruct(val, goName, classes);
        goType = goName;
      } else {
        goType = getGoType(val);
      }
      fields.push('    ' + goName + ' ' + goType + ' `json:"' + key + '"`');
    });

    const struct = 'type ' + name + ' struct {\n' + fields.join('\n') + '\n}';
    classes.push(struct);
    return name;
  }

  function getGoType(val) {
    if (val === null) return 'interface{}';
    if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        if (val >= -2147483648 && val <= 2147483647) return 'int';
        return 'int64';
      }
      return 'float64';
    }
    if (typeof val === 'string') return 'string';
    return 'interface{}';
  }

  /* ---------- JSON转Python字典 ---------- */

  function generatePython() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      let code = 'data = ' + pythonRepr(obj, 0);
      $('java-output').value = code;
      $('java-modal').querySelector('h3').textContent = 'Python \u5b57\u5178\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Python\u5b57\u5178', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function pythonRepr(val, indent) {
    const pad = '    '.repeat(indent);
    const innerPad = '    '.repeat(indent + 1);
    if (val === null) return 'None';
    if (typeof val === 'boolean') return val ? 'True' : 'False';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      const items = val.map(v => innerPad + pythonRepr(v, indent + 1));
      return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val);
      if (entries.length === 0) return '{}';
      const items = entries.map(([k, v]) => innerPad + '"' + k + '": ' + pythonRepr(v, indent + 1));
      return '{\n' + items.join(',\n') + '\n' + pad + '}';
    }
    return String(val);
  }

  /* ---------- JSON转PHP数组 ---------- */

  function generatePhp() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      let code = '<?php\n\n$data = ' + phpRepr(obj, 0) + ';';
      $('java-output').value = code;
      $('java-modal').querySelector('h3').textContent = 'PHP \u6570\u7ec4\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210PHP\u6570\u7ec4', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function phpRepr(val, indent) {
    const pad = '    '.repeat(indent);
    const innerPad = '    '.repeat(indent + 1);
    if (val === null) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return "'" + val.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      const items = val.map(v => innerPad + phpRepr(v, indent + 1));
      return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val);
      if (entries.length === 0) return '[]';
      const items = entries.map(([k, v]) => innerPad + "'" + k + "' => " + phpRepr(v, indent + 1));
      return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    return String(val);
  }

  /* ---------- JSON美化 ---------- */

  function beautifyJson() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }
    try {
      const obj = JSON.parse(text);
      input.value = JSON.stringify(obj, null, 2);
      setStatus('\u5df2\u7f8e\u5316JSON', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- JSON转Rust结构体 ---------- */

  function generateRust() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const structs = [];
      generateRustStruct(obj, 'Root', structs);
      let code = 'use serde::{Deserialize, Serialize};\n\n' + structs.reverse().join('\n\n');
      $('java-output').value = code;
      $('java-modal').querySelector('h3').textContent = 'Rust \u7ed3\u6784\u4f53\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Rust\u7ed3\u6784\u4f53', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateRustStruct(obj, name, structs) {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        generateRustStruct(obj[0], name + 'Item', structs);
        return 'Vec<' + name + 'Item>';
      }
      return 'Vec<' + getRustType(obj[0]) + '>';
    }
    if (typeof obj !== 'object' || obj === null) return getRustType(obj);

    const fields = [];
    Object.entries(obj).forEach(([key, val]) => {
      const rustName = key.replace(/[^a-zA-Z0-9_]/g, '_');
      let rustType;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          generateRustStruct(val[0], name + '_' + rustName + '_item', structs);
          rustType = 'Vec<' + name + '_' + rustName + '_item>';
        } else {
          rustType = 'Vec<' + getRustType(val[0]) + '>';
        }
      } else if (typeof val === 'object' && val !== null) {
        const innerName = name + '_' + rustName;
        generateRustStruct(val, innerName, structs);
        rustType = innerName;
      } else {
        rustType = getRustType(val);
      }
      fields.push('    pub ' + rustName + ': ' + rustType + ',');
    });

    const derive = '#[derive(Debug, Clone, Serialize, Deserialize)]';
    const struct = derive + '\npub struct ' + name + ' {\n' + fields.join('\n') + '\n}';
    structs.push(struct);
    return name;
  }

  function getRustType(val) {
    if (val === null) return 'Option<serde_json::Value>';
    if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        if (val >= -2147483648 && val <= 2147483647) return 'i32';
        return 'i64';
      }
      return 'f64';
    }
    if (typeof val === 'string') return 'String';
    return 'serde_json::Value';
  }

  /* ---------- JSON转Swift结构体 ---------- */

  function generateSwift() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const structs = [];
      generateSwiftStruct(obj, 'Root', structs);
      $('java-output').value = structs.reverse().join('\n\n');
      $('java-modal').querySelector('h3').textContent = 'Swift \u7ed3\u6784\u4f53\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Swift\u7ed3\u6784\u4f53', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateSwiftStruct(obj, name, structs) {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        generateSwiftStruct(obj[0], name + 'Item', structs);
        return '[' + name + 'Item]';
      }
      return '[' + getSwiftType(obj[0]) + ']';
    }
    if (typeof obj !== 'object' || obj === null) return getSwiftType(obj);

    const fields = [];
    Object.entries(obj).forEach(([key, val]) => {
      const swiftName = key.replace(/[^a-zA-Z0-9_]/g, '_');
      let swiftType;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          generateSwiftStruct(val[0], name + '_' + swiftName + '_item', structs);
          swiftType = '[' + name + '_' + swiftName + '_item]';
        } else {
          swiftType = '[' + getSwiftType(val[0]) + ']';
        }
      } else if (typeof val === 'object' && val !== null) {
        const innerName = name + '_' + swiftName;
        generateSwiftStruct(val, innerName, structs);
        swiftType = innerName;
      } else {
        swiftType = getSwiftType(val);
      }
      fields.push('    var ' + swiftName + ': ' + swiftType);
    });

    const struct = 'struct ' + name + ': Codable {\n' + fields.join('\n') + '\n}';
    structs.push(struct);
    return name;
  }

  function getSwiftType(val) {
    if (val === null) return 'String?';
    if (typeof val === 'boolean') return 'Bool';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return 'Int';
      return 'Double';
    }
    if (typeof val === 'string') return 'String';
    return 'Any';
  }

  /* ---------- JSON转C#类 ---------- */

  function generateCSharp() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const classes = [];
      generateCSharpClass(obj, 'Root', classes);
      $('java-output').value = 'using System;\nusing System.Collections.Generic;\n\n' + classes.reverse().join('\n\n');
      $('java-modal').querySelector('h3').textContent = 'C# \u7c7b\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210C#\u7c7b', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateCSharpClass(obj, name, classes) {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        generateCSharpClass(obj[0], name + 'Item', classes);
        return 'List<' + name + 'Item>';
      }
      return 'List<' + getCSharpType(obj[0]) + '>';
    }
    if (typeof obj !== 'object' || obj === null) return getCSharpType(obj);

    const fields = [];
    Object.entries(obj).forEach(([key, val]) => {
      const csName = key.charAt(0).toUpperCase() + key.slice(1).replace(/[^a-zA-Z0-9]/g, '');
      let csType;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          generateCSharpClass(val[0], csName + 'Item', classes);
          csType = 'List<' + csName + 'Item>';
        } else {
          csType = 'List<' + getCSharpType(val[0]) + '>';
        }
      } else if (typeof val === 'object' && val !== null) {
        generateCSharpClass(val, csName, classes);
        csType = csName;
      } else {
        csType = getCSharpType(val);
      }
      fields.push('    public ' + csType + ' ' + csName + ' { get; set; }');
    });

    const csClass = 'public class ' + name + '\n{\n' + fields.join('\n') + '\n}';
    classes.push(csClass);
    return name;
  }

  function getCSharpType(val) {
    if (val === null) return 'object';
    if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        if (val >= -2147483648 && val <= 2147483647) return 'int';
        return 'long';
      }
      return 'double';
    }
    if (typeof val === 'string') return 'string';
    return 'object';
  }

  /* ---------- JSON转Kotlin数据类 ---------- */

  function generateKotlin() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const classes = [];
      generateKotlinDataClass(obj, 'Root', classes);
      $('java-output').value = 'import com.google.gson.annotations.SerializedName\n\n' + classes.reverse().join('\n\n');
      $('java-modal').querySelector('h3').textContent = 'Kotlin \u6570\u636e\u7c7b\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Kotlin\u6570\u636e\u7c7b', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateKotlinDataClass(obj, name, classes) {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        generateKotlinDataClass(obj[0], name + 'Item', classes);
        return 'List<' + name + 'Item>';
      }
      return 'List<' + getKotlinType(obj[0]) + '>';
    }
    if (typeof obj !== 'object' || obj === null) return getKotlinType(obj);

    const fields = [];
    Object.entries(obj).forEach(([key, val]) => {
      const kotlinName = key.replace(/[^a-zA-Z0-9_]/g, '_');
      let kotlinType;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          generateKotlinDataClass(val[0], name + '_' + kotlinName + '_item', classes);
          kotlinType = 'List<' + name + '_' + kotlinName + '_item>';
        } else {
          kotlinType = 'List<' + getKotlinType(val[0]) + '>';
        }
      } else if (typeof val === 'object' && val !== null) {
        const innerName = name + '_' + kotlinName;
        generateKotlinDataClass(val, innerName, classes);
        kotlinType = innerName;
      } else {
        kotlinType = getKotlinType(val);
      }
      fields.push('    @SerializedName("' + key + '") val ' + kotlinName + ': ' + kotlinType);
    });

    const dataClass = 'data class ' + name + '(\n' + fields.join(',\n') + '\n)';
    classes.push(dataClass);
    return name;
  }

  function getKotlinType(val) {
    if (val === null) return 'Any?';
    if (typeof val === 'boolean') return 'Boolean';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        if (val >= -2147483648 && val <= 2147483647) return 'Int';
        return 'Long';
      }
      return 'Double';
    }
    if (typeof val === 'string') return 'String';
    return 'Any';
  }

  /* ---------- JSON转Dart类 ---------- */

  function generateDart() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const classes = [];
      generateDartClass(obj, 'Root', classes);
      $('java-output').value = "import 'dart:convert';\n\n" + classes.reverse().join('\n\n');
      $('java-modal').querySelector('h3').textContent = 'Dart \u7c7b\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Dart\u7c7b', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateDartClass(obj, name, classes) {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        generateDartClass(obj[0], name + 'Item', classes);
        return 'List<' + name + 'Item>';
      }
      return 'List<' + getDartType(obj[0]) + '>';
    }
    if (typeof obj !== 'object' || obj === null) return getDartType(obj);

    const fields = [];
    Object.entries(obj).forEach(([key, val]) => {
      const dartName = key.replace(/[^a-zA-Z0-9_]/g, '_');
      let dartType;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          generateDartClass(val[0], name + '_' + dartName + '_item', classes);
          dartType = 'List<' + name + '_' + dartName + '_item>';
        } else {
          dartType = 'List<' + getDartType(val[0]) + '>';
        }
      } else if (typeof val === 'object' && val !== null) {
        const innerName = name + '_' + dartName;
        generateDartClass(val, innerName, classes);
        dartType = innerName;
      } else {
        dartType = getDartType(val);
      }
      fields.push('  ' + dartType + '?' + ' ' + dartName + ';');
    });

    const fromJson = '  factory ' + name + '.fromJson(Map<String, dynamic> json) => ' + name + '(' +
      Object.keys(obj).map(k => {
        const safeName = k.replace(/[^a-zA-Z0-9_]/g, '_');
        return safeName + ': json["' + k + '"]';
      }).join(', ') + ');';

    const toJson = '  Map<String, dynamic> toJson() => {' +
      Object.keys(obj).map(k => {
        const safeName = k.replace(/[^a-zA-Z0-9_]/g, '_');
        return '"' + k + '": ' + safeName;
      }).join(', ') + '};';

    const dartClass = 'class ' + name + ' {\n' + fields.join('\n') + '\n\n' + fromJson + '\n\n' + toJson + '\n}';
    classes.push(dartClass);
    return name;
  }

  function getDartType(val) {
    if (val === null) return 'dynamic';
    if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return 'int';
      return 'double';
    }
    if (typeof val === 'string') return 'String';
    return 'dynamic';
  }

  /* ---------- JSON转Ruby哈希 ---------- */

  function generateRuby() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      let code = 'data = ' + rubyRepr(obj, 0);
      $('java-output').value = code;
      $('java-modal').querySelector('h3').textContent = 'Ruby \u54c8\u5e0c\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Ruby\u54c8\u5e0c', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function rubyRepr(val, indent) {
    const pad = '  '.repeat(indent);
    const innerPad = '  '.repeat(indent + 1);
    if (val === null) return 'nil';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      const items = val.map(v => innerPad + rubyRepr(v, indent + 1));
      return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val);
      if (entries.length === 0) return '{}';
      const items = entries.map(([k, v]) => innerPad + '"' + k + '" => ' + rubyRepr(v, indent + 1));
      return '{\n' + items.join(',\n') + '\n' + pad + '}';
    }
    return String(val);
  }

  /* ---------- JSON转Lua表 ---------- */

  function generateLua() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      let code = 'local data = ' + luaRepr(obj, 0);
      $('java-output').value = code;
      $('java-modal').querySelector('h3').textContent = 'Lua \u8868\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Lua\u8868', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function luaRepr(val, indent) {
    const pad = '  '.repeat(indent);
    const innerPad = '  '.repeat(indent + 1);
    if (val === null) return 'nil';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    if (Array.isArray(val)) {
      if (val.length === 0) return '{}';
      const items = val.map(v => innerPad + luaRepr(v, indent + 1));
      return '{\n' + items.join(',\n') + '\n' + pad + '}';
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val);
      if (entries.length === 0) return '{}';
      const items = entries.map(([k, v]) => {
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) {
          return innerPad + k + ' = ' + luaRepr(v, indent + 1);
        }
        return innerPad + '["' + k + '"] = ' + luaRepr(v, indent + 1);
      });
      return '{\n' + items.join(',\n') + '\n' + pad + '}';
    }
    return String(val);
  }

  /* ---------- JSON转Zod验证模式 ---------- */

  function generateZod() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const schemas = [];
      const rootSchema = generateZodSchema(obj, 'Root', schemas);
      let code = "import { z } from 'zod';\n\n" + schemas.reverse().join('\n\n') + '\n\nexport type Root = z.infer<typeof rootSchema>;\nconst rootSchema = ' + rootSchema + ';';
      $('java-output').value = code;
      $('java-modal').querySelector('h3').textContent = 'Zod \u9a8c\u8bc1\u6a21\u5f0f\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Zod\u9a8c\u8bc1\u6a21\u5f0f', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateZodSchema(obj, name, schemas) {
    if (Array.isArray(obj)) {
      if (obj.length === 0) return 'z.array(z.any())';
      const itemType = generateZodSchema(obj[0], name + 'Item', schemas);
      return 'z.array(' + itemType + ')';
    }
    if (obj === null) return 'z.null()';
    if (typeof obj === 'boolean') return 'z.boolean()';
    if (typeof obj === 'number') {
      if (Number.isInteger(obj)) return 'z.number().int()';
      return 'z.number()';
    }
    if (typeof obj === 'string') return 'z.string()';

    const shape = {};
    Object.entries(obj).forEach(([key, val]) => {
      shape[key] = generateZodSchema(val, name + '_' + key.replace(/[^a-zA-Z0-9]/g, '_'), schemas);
    });

    const shapeStr = Object.entries(shape).map(([k, v]) => '  ' + k + ': ' + v).join(',\n');
    const schemaName = name.charAt(0).toLowerCase() + name.slice(1) + 'Schema';
    schemas.push('const ' + schemaName + ' = z.object({\n' + shapeStr + '\n});');
    return schemaName;
  }

  /* ---------- JSON转Mock数据 ---------- */

  function generateMock() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const mockData = generateMockData(obj);
      $('java-output').value = JSON.stringify(mockData, null, 2);
      $('java-modal').querySelector('h3').textContent = 'Mock \u6570\u636e\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Mock\u6570\u636e', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateMockData(val) {
    if (val === null) return null;
    if (typeof val === 'boolean') return Math.random() > 0.5;
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        if (val >= -100 && val <= 100) return Math.floor(Math.random() * 200) - 100;
        return Math.floor(Math.random() * 10000);
      }
      return Math.round(Math.random() * 100 * 100) / 100;
    }
    if (typeof val === 'string') {
      const s = val.toLowerCase();
      if (s.includes('name') || s.includes('\u540d')) return '\u5f20\u4e09';
      if (s.includes('email') || s.includes('\u90ae\u7bb1')) return 'zhangsan@example.com';
      if (s.includes('phone') || s.includes('\u624b\u673a')) return '138' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
      if (s.includes('url') || s.includes('\u94fe\u63a5')) return 'https://example.com/' + Math.random().toString(36).substring(7);
      if (s.includes('id')) return Math.random().toString(36).substring(2, 10);
      if (s.includes('date') || s.includes('\u65e5\u671f')) return '2024-' + String(Math.floor(Math.random() * 12) + 1).padStart(2, '0') + '-' + String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      if (s.includes('time') || s.includes('\u65f6\u95f4')) return String(Math.floor(Math.random() * 24)).padStart(2, '0') + ':' + String(Math.floor(Math.random() * 60)).padStart(2, '0');
      return 'mock_' + Math.random().toString(36).substring(7);
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return [];
      const count = Math.min(3, val.length);
      return Array.from({ length: count }, () => generateMockData(val[0]));
    }
    if (typeof val === 'object') {
      const result = {};
      Object.entries(val).forEach(([k, v]) => { result[k] = generateMockData(v); });
      return result;
    }
    return null;
  }

  /* ---------- JSON转GraphQL Schema ---------- */

  function generateGraphQL() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const types = [];
      if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
          generateGraphQLType(obj[0], 'Root', types, true);
        }
      } else {
        generateGraphQLType(obj, 'Root', types, true);
      }
      $('java-output').value = types.reverse().join('\n\n');
      $('java-modal').querySelector('h3').textContent = 'GraphQL Schema\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210GraphQL Schema', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateGraphQLType(obj, name, types, isInput) {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        return '[' + generateGraphQLType(obj[0], name + 'Item', types, isInput) + ']';
      }
      return '[' + getGraphQLType(obj[0]) + ']';
    }
    if (obj === null || typeof obj !== 'object') return getGraphQLType(obj);

    const fields = [];
    Object.entries(obj).forEach(([key, val]) => {
      const fieldName = key.replace(/[^a-zA-Z0-9_]/g, '_');
      let fieldType;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          fieldType = '[' + generateGraphQLType(val[0], name + '_' + fieldName + 'Item', types, isInput) + ']!';
        } else {
          fieldType = '[' + getGraphQLType(val[0]) + ']!';
        }
      } else if (typeof val === 'object' && val !== null) {
        fieldType = generateGraphQLType(val, name + '_' + fieldName, types, isInput) + '!';
      } else {
        fieldType = getGraphQLType(val) + '!';
      }
      fields.push('  ' + fieldName + ': ' + fieldType);
    });

    const keyword = isInput ? 'input' : 'type';
    const typeStr = keyword + ' ' + name + ' {\n' + fields.join('\n') + '\n}';
    types.push(typeStr);
    return name;
  }

  function getGraphQLType(val) {
    if (val === null || val === undefined) return 'String';
    if (typeof val === 'boolean') return 'Boolean';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return 'Int';
      return 'Float';
    }
    if (typeof val === 'string') return 'String';
    return 'String';
  }

  /* ---------- JSON转Protobuf ---------- */

  function generateProtobuf() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const messages = [];
      if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
          generateProtobufMessage(obj[0], 'Root', messages);
        }
      } else {
        generateProtobufMessage(obj, 'Root', messages);
      }
      let code = 'syntax = "proto3";\n\n' + messages.reverse().join('\n\n');
      $('java-output').value = code;
      $('java-modal').querySelector('h3').textContent = 'Protobuf\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210Protobuf', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateProtobufMessage(obj, name, messages) {
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        return generateProtobufMessage(obj[0], name + 'Item', messages) + '[]';
      }
      return getProtobufType(obj[0]) + '[]';
    }
    if (obj === null || typeof obj !== 'object') return getProtobufType(obj);

    const fields = [];
    let fieldNum = 1;
    Object.entries(obj).forEach(([key, val]) => {
      const fieldName = key.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      let fieldType;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          fieldType = generateProtobufMessage(val[0], name + '_' + fieldName + 'Item', messages) + '[]';
        } else {
          fieldType = getProtobufType(val[0]) + '[]';
        }
      } else if (typeof val === 'object' && val !== null) {
        fieldType = generateProtobufMessage(val, name + '_' + fieldName, messages);
      } else {
        fieldType = getProtobufType(val);
      }
      fields.push('  ' + fieldType + ' ' + fieldName + ' = ' + fieldNum + ';');
      fieldNum++;
    });

    const message = 'message ' + name + ' {\n' + fields.join('\n') + '\n}';
    messages.push(message);
    return name;
  }

  function getProtobufType(val) {
    if (val === null || val === undefined) return 'string';
    if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        if (val >= -2147483648 && val <= 2147483647) return 'int32';
        return 'int64';
      }
      return 'double';
    }
    if (typeof val === 'string') return 'string';
    return 'string';
  }

  /* ---------- JSON转OpenAPI Schema ---------- */

  function generateOpenAPI() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const schema = generateOpenAPISchema(obj);
      const openapi = {
        openapi: '3.0.0',
        info: { title: 'Generated API', version: '1.0.0' },
        paths: {},
        components: { schemas: { Root: schema } }
      };
      $('java-output').value = JSON.stringify(openapi, null, 2);
      $('java-modal').querySelector('h3').textContent = 'OpenAPI Schema\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210OpenAPI Schema', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateOpenAPISchema(obj) {
    if (obj === null) return { type: 'string', nullable: true };
    if (typeof obj === 'boolean') return { type: 'boolean' };
    if (typeof obj === 'number') {
      if (Number.isInteger(obj)) return { type: 'integer', format: 'int64' };
      return { type: 'number', format: 'double' };
    }
    if (typeof obj === 'string') return { type: 'string' };
    if (Array.isArray(obj)) {
      if (obj.length === 0) return { type: 'array', items: { type: 'string' } };
      return { type: 'array', items: generateOpenAPISchema(obj[0]) };
    }
    const properties = {};
    Object.entries(obj).forEach(([key, val]) => {
      properties[key] = generateOpenAPISchema(val);
    });
    return { type: 'object', properties };
  }

  /* ---------- JSON转JSONL格式 ---------- */

  function generateJsonl() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      let arr = Array.isArray(obj) ? obj : [obj];
      const jsonl = arr.map(item => JSON.stringify(item)).join('\n');
      $('java-output').value = jsonl;
      $('java-modal').querySelector('h3').textContent = 'JSONL\u683c\u5f0f\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210JSONL\u683c\u5f0f', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- JSON转TypeScript接口 ---------- */

  function generateTsInterface() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const interfaces = [];
      if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
          generateTsInterfaceDef(obj[0], 'Root', interfaces);
        }
      } else {
        generateTsInterfaceDef(obj, 'Root', interfaces);
      }
      $('java-output').value = interfaces.reverse().join('\n\n');
      $('java-modal').querySelector('h3').textContent = 'TypeScript\u63a5\u53e3\u751f\u6210\u5668';
      $('java-modal').classList.remove('hidden');
      setStatus('\u5df2\u751f\u6210TypeScript\u63a5\u53e3', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateTsInterfaceDef(obj, name, interfaces) {
    if (Array.isArray(obj)) {
      if (obj.length === 0) return 'any[]';
      if (typeof obj[0] === 'object' && obj[0] !== null) {
        const itemType = generateTsInterfaceDef(obj[0], name + 'Item', interfaces);
        return itemType + '[]';
      }
      return getTsType(obj[0]) + '[]';
    }
    if (obj === null || typeof obj !== 'object') return getTsType(obj);

    const fields = [];
    Object.entries(obj).forEach(([key, val]) => {
      const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : '"' + key + '"';
      let fieldType;
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          const itemType = generateTsInterfaceDef(val[0], name + '_' + key.replace(/[^a-zA-Z0-9]/g, '_') + 'Item', interfaces);
          fieldType = itemType + '[]';
        } else {
          fieldType = getTsType(val[0]) + '[]';
        }
      } else if (typeof val === 'object' && val !== null) {
        fieldType = generateTsInterfaceDef(val, name + '_' + key.replace(/[^a-zA-Z0-9]/g, '_'), interfaces);
      } else {
        fieldType = getTsType(val);
      }
      fields.push('  ' + safeName + ': ' + fieldType + ';');
    });

    const iface = 'interface ' + name + ' {\n' + fields.join('\n') + '\n}';
    interfaces.push(iface);
    return name;
  }

  function getTsType(val) {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'string') return 'string';
    return 'any';
  }

  /* ---------- QR码生成 ---------- */

  function generateQR() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }
    if (text.length > 2048) { showError('QR\u7801\u6570\u636e\u91cf\u4e0d\u80fd\u8d85\u8fc72KB'); return; }

    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const qr = generateQRMatrix(text);
    const moduleCount = qr.length;
    const cellSize = size / moduleCount;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr[r][c]) {
          ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
        }
      }
    }

    $('qr-preview').innerHTML = '';
    $('qr-preview').appendChild(canvas);
    $('qr-modal').classList.remove('hidden');
    $('qr-modal')._canvas = canvas;
    setStatus('\u5df2\u751f\u6210QR\u7801', true);
  }

  function generateQRMatrix(text) {
    const len = text.length;
    let version, moduleCount;
    if (len <= 25) { version = 1; moduleCount = 21; }
    else if (len <= 47) { version = 2; moduleCount = 25; }
    else if (len <= 127) { version = 3; moduleCount = 29; }
    else if (len <= 215) { version = 4; moduleCount = 33; }
    else if (len <= 324) { version = 5; moduleCount = 37; }
    else { version = 6; moduleCount = 41; }

    const matrix = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(false));

    function setModule(r, c, val) {
      if (r >= 0 && r < moduleCount && c >= 0 && c < moduleCount) matrix[r][c] = val;
    }

    function drawFinder(row, col) {
      for (let i = 0; i < 7; i++) {
        setModule(row, col + i, true);
        setModule(row + 6, col + i, true);
        setModule(row + i, col, true);
        setModule(row + i, col + 6, true);
      }
      for (let r = 1; r < 6; r++) {
        for (let c = 1; c < 6; c++) {
          if (r >= 2 && r <= 4 && c >= 2 && c <= 4) setModule(row + r, col + c, true);
          else setModule(row + r, col + c, false);
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, moduleCount - 7);
    drawFinder(moduleCount - 7, 0);

    for (let i = 8; i < moduleCount - 8; i++) {
      setModule(6, i, i % 2 === 0);
      setModule(i, 6, i % 2 === 0);
    }

    const dataBits = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      for (let b = 7; b >= 0; b--) dataBits.push((ch >> b) & 1);
    }

    let bitIdx = 0;
    for (let right = moduleCount - 1; right >= 1; right -= 2) {
      if (right === 6) right--;
      for (let vert = 0; vert < moduleCount; vert++) {
        for (let j = 0; j < 2; j++) {
          const col = right - j;
          const up = ((right + 1) & 2) === 0;
          const row = up ? moduleCount - 1 - vert : vert;
          if (!matrix[row][col] && row !== 6 && col !== 6) {
            if (bitIdx < dataBits.length) {
              setModule(row, col, dataBits[bitIdx] === 1);
              bitIdx++;
            }
          }
        }
      }
    }

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c] === false && ((r + c) % 3 === 0) && r !== 6 && c !== 6) {
          const inFinder = (r < 9 && c < 9) || (r < 9 && c > moduleCount - 9) || (r > moduleCount - 9 && c < 9);
          if (!inFinder) matrix[r][c] = true;
        }
      }
    }

    return matrix;
  }

  /* ---------- 压缩解压 ---------- */

  function compressJson() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }
    $('compress-input').value = text;
    $('compress-output').value = '';
    $('compress-modal').classList.remove('hidden');
  }

  function gzipCompress() {
    const text = $('compress-input').value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    try {
      const bytes = new TextEncoder().encode(text);
      const compressed = deflateRaw(bytes);
      const base64 = btoa(String.fromCharCode(...compressed));
      $('compress-output').value = base64;
      setStatus('\u5df2Gzip\u538b\u7f29', true);
    } catch (e) {
      showError('\u538b\u7f29\u5931\u8d25: ' + e.message);
    }
  }

  function gzipDecompress() {
    const text = $('compress-input').value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    try {
      const binary = atob(text);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const decompressed = inflateRaw(bytes);
      $('compress-output').value = new TextDecoder().decode(decompressed);
      setStatus('\u5df2Gzip\u89e3\u538b', true);
    } catch (e) {
      showError('\u89e3\u538b\u5931\u8d25: ' + e.message);
    }
  }

  function deflateRaw(data) {
    const output = [];
    const lits = [];
    for (let i = 0; i < data.length;) {
      let bestLen = 0, bestDist = 0;
      for (let d = 1; d <= Math.min(i, 32767); d++) {
        let len = 0;
        while (i + len < data.length && len < 258 && data[i - d + (len % d)] === data[i + len]) len++;
        if (len > bestLen) { bestLen = len; bestDist = d; }
      }
      if (bestLen >= 3) {
        lits.push({ dist: bestDist, len: bestLen });
        i += bestLen;
      } else {
        lits.push({ lit: data[i] });
        i++;
      }
    }
    output.push(0x78, 0x01);
    let pos = 0;
    while (pos < lits.length) {
      let blockEnd = Math.min(pos + 100, lits.length);
      const isLast = blockEnd >= lits.length;
      output.push(isLast ? 0x01 : 0x00);
      const blockData = [];
      for (let i = pos; i < blockEnd; i++) {
        if (lits[i].dist !== undefined) {
          const d = lits[i].dist;
          const l = lits[i].len;
          let dbits = 0, dval = d - 1;
          while (dval > 0) { dbits++; dval >>= 1; }
          let lbits = 0, lval = l - 3;
          while (lval > 0) { lbits++; lval >>= 1; }
          const sym = (lbits * 4) + dbits;
          blockData.push(sym & 0xff);
          if (sym > 255) blockData.push((sym >> 8) & 0xff);
          blockData.push((d - 1) & 0xff);
          if (d > 255) blockData.push(((d - 1) >> 8) & 0xff);
          blockData.push((l - 3) & 0xff);
        } else {
          blockData.push(lits[i].lit);
        }
      }
      for (const b of blockData) output.push(b);
      pos = blockEnd;
    }
    output.push(0x00);
    const adler = adler32(data);
    output.push((adler >> 24) & 0xff, (adler >> 16) & 0xff, (adler >> 8) & 0xff, adler & 0xff);
    return output;
  }

  function inflateRaw(data) {
    const output = [];
    let pos = 2;
    let final = false;
    while (!final && pos < data.length) {
      const byte = data[pos++];
      final = (byte & 1) === 1;
      const type = (byte >> 1) & 3;
      if (type === 0) {
        const len = data[pos] | (data[pos + 1] << 8);
        pos += 4;
        for (let i = 0; i < len; i++) output.push(data[pos++]);
      } else if (type === 2) {
        const len = data[pos] | (data[pos + 1] << 8);
        pos += 2;
        for (let i = 0; i < len; i++) output.push(data[pos++]);
      } else {
        while (true) {
          const sym = data[pos++];
          if (sym === 256) break;
          if (sym < 256) {
            output.push(sym);
          } else {
            const lbits = Math.floor((sym - 257) / 4);
            const dbits = (sym - 257) % 4;
            let len = 3 + lbits + ((data[pos] << (8 - dbits)) & 0xff);
            pos++;
            let dist = 1 + ((data[pos] | (data[pos + 1] << 8)) & ((1 << (dbits + 8)) - 1));
            pos += Math.ceil((dbits + 1) / 8);
            for (let i = 0; i < len; i++) output.push(output[output.length - dist] || 0);
          }
        }
      }
    }
    return new Uint8Array(output);
  }

  function adler32(data) {
    let a = 1, b = 0;
    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]) % 65521;
      b = (b + a) % 65521;
    }
    return (b << 16) | a;
  }

  function base64Compress() {
    const text = $('compress-input').value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    try {
      const bytes = new TextEncoder().encode(text);
      const compressed = deflateRaw(bytes);
      const base64 = btoa(String.fromCharCode(...compressed));
      $('compress-output').value = base64;
      setStatus('\u5df2\u538b\u7f29\u4e3aBase64', true);
    } catch (e) {
      showError('\u538b\u7f29\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- 加密解密 ---------- */

  function showEncryptModal() {
    $('encrypt-input').value = input.value.substring(0, 5000);
    $('encrypt-modal').classList.remove('hidden');
  }

  async function aesEncrypt() {
    const text = $('encrypt-input').value;
    const keyStr = $('encrypt-key').value;
    const algo = $('encrypt-algo').value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    if (!keyStr) { showError('\u8bf7\u8f93\u5165\u5bc6\u94a5'); return; }

    try {
      const keyBytes = new TextEncoder().encode(keyStr);
      let aesKey;
      if (keyBytes.length === 16) aesKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-CTR', false, ['encrypt']);
      else if (keyBytes.length === 24) aesKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-CTR', false, ['encrypt']);
      else if (keyBytes.length === 32) aesKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-CTR', false, ['encrypt']);
      else { showError('\u5bc6\u94a5\u5fc5\u987b\u662f16/24/32\u5b57\u8282'); return; }

      const iv = crypto.getRandomValues(new Uint8Array(16));
      const data = new TextEncoder().encode(text);
      const alg = algo === 'aes-cbc' ? 'AES-CBC' : 'AES-CTR';
      const encKey = await crypto.subtle.importKey('raw', keyBytes, alg, false, ['encrypt']);

      let encrypted;
      if (algo === 'aes-cbc') {
        const cbcIv = crypto.getRandomValues(new Uint8Array(16));
        encrypted = await crypto.subtle.encrypt({ name: alg, iv: cbcIv }, encKey, data);
        const result = new Uint8Array(cbcIv.length + new Uint8Array(encrypted).length);
        result.set(cbcIv);
        result.set(new Uint8Array(encrypted), cbcIv.length);
        $('encrypt-output').value = btoa(String.fromCharCode(...result));
      } else {
        const ctrIv = crypto.getRandomValues(new Uint8Array(16));
        encrypted = await crypto.subtle.encrypt({ name: alg, counter: ctrIv, length: 64 }, encKey, data);
        const result = new Uint8Array(ctrIv.length + new Uint8Array(encrypted).length);
        result.set(ctrIv);
        result.set(new Uint8Array(encrypted), ctrIv.length);
        $('encrypt-output').value = btoa(String.fromCharCode(...result));
      }
      setStatus('\u5df2\u52a0\u5bc6', true);
    } catch (e) {
      showError('\u52a0\u5bc6\u5931\u8d25: ' + e.message);
    }
  }

  async function aesDecrypt() {
    const text = $('encrypt-input').value.trim();
    const keyStr = $('encrypt-key').value;
    const algo = $('encrypt-algo').value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    if (!keyStr) { showError('\u8bf7\u8f93\u5165\u5bc6\u94a5'); return; }

    try {
      const binary = atob(text);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const keyBytes = new TextEncoder().encode(keyStr);
      const alg = algo === 'aes-cbc' ? 'AES-CBC' : 'AES-CTR';
      const encKey = await crypto.subtle.importKey('raw', keyBytes, alg, false, ['decrypt']);

      let decrypted;
      if (algo === 'aes-cbc') {
        const iv = bytes.slice(0, 16);
        const data = bytes.slice(16);
        decrypted = await crypto.subtle.decrypt({ name: alg, iv }, encKey, data);
      } else {
        const iv = bytes.slice(0, 16);
        const data = bytes.slice(16);
        decrypted = await crypto.subtle.decrypt({ name: alg, counter: iv, length: 64 }, encKey, data);
      }
      $('encrypt-output').value = new TextDecoder().decode(decrypted);
      setStatus('\u5df2\u89e3\u5bc6', true);
    } catch (e) {
      showError('\u89e3\u5bc6\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- 图表可视化 ---------- */

  function showChartModal() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const arr = Array.isArray(obj) ? obj : [obj];
      if (arr.length === 0 || typeof arr[0] !== 'object') { showError('\u9700\u8981\u5bf9\u8c61\u6570\u7ec4'); return; }

      const numFields = [];
      Object.entries(arr[0]).forEach(([k, v]) => {
        if (typeof v === 'number') numFields.push(k);
      });
      if (numFields.length === 0) { showError('\u65e0\u6570\u503c\u5b57\u6bb5'); return; }

      const strFields = Object.keys(arr[0]).filter(k => typeof arr[0][k] === 'string');

      const xSelect = $('chart-x-field');
      const ySelect = $('chart-y-field');
      xSelect.innerHTML = '';
      ySelect.innerHTML = '';
      strFields.concat(numFields).forEach(f => { xSelect.innerHTML += '<option value="' + f + '">' + f + '</option>'; });
      numFields.forEach(f => { ySelect.innerHTML += '<option value="' + f + '">' + f + '</option>'; });

      $('chart-modal').classList.remove('hidden');
      $('chart-modal')._data = arr;
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function generateChart() {
    const arr = $('chart-modal')._data;
    if (!arr) return;

    const xField = $('chart-x-field').value;
    const yField = $('chart-y-field').value;
    const chartType = $('chart-type').value;

    const labels = arr.map(item => String(item[xField]));
    const values = arr.map(item => Number(item[yField]) || 0);

    const canvas = document.createElement('canvas');
    canvas.width = 750;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-panel').trim() || '#1e1f26';
    ctx.fillRect(0, 0, 750, 300);

    const maxVal = Math.max(...values, 1);
    const padding = { top: 30, right: 20, bottom: 60, left: 60 };
    const chartW = 750 - padding.left - padding.right;
    const chartH = 300 - padding.top - padding.bottom;

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e0e0e0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(yField + ' vs ' + xField, 375, 18);

    if (chartType === 'bar') {
      const barW = chartW / labels.length * 0.7;
      const gap = chartW / labels.length * 0.3;
      labels.forEach((label, i) => {
        const x = padding.left + i * (barW + gap) + gap / 2;
        const h = (values[i] / maxVal) * chartH;
        const y = padding.top + chartH - h;

        const hue = (i / labels.length) * 360;
        ctx.fillStyle = 'hsl(' + hue + ', 70%, 60%)';
        ctx.fillRect(x, y, barW, h);

        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e0e0e0';
        ctx.font = '10px sans-serif';
        ctx.save();
        ctx.translate(x + barW / 2, padding.top + chartH + 10);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right';
        ctx.fillText(label.substring(0, 10), 0, 0);
        ctx.restore();

        ctx.fillText(String(values[i]), x + barW / 2, y - 5);
      });
    } else if (chartType === 'line') {
      ctx.beginPath();
      ctx.strokeStyle = '#59c98a';
      ctx.lineWidth = 2;
      labels.forEach((label, i) => {
        const x = padding.left + (i / (labels.length - 1 || 1)) * chartW;
        const y = padding.top + chartH - (values[i] / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      labels.forEach((label, i) => {
        const x = padding.left + (i / (labels.length - 1 || 1)) * chartW;
        const y = padding.top + chartH - (values[i] / maxVal) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#59c98a';
        ctx.fill();
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e0e0e0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(values[i]), x, y - 8);
      });
    } else if (chartType === 'pie') {
      const total = values.reduce((a, b) => a + b, 0) || 1;
      let startAngle = -Math.PI / 2;
      const colors = ['#59c98a', '#6c7ae0', '#f5a623', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#3498db'];
      labels.forEach((label, i) => {
        const sliceAngle = (values[i] / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(375, 165);
        ctx.arc(375, 165, 110, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-panel').trim() || '#1e1f26';
        ctx.lineWidth = 2;
        ctx.stroke();

        const midAngle = startAngle + sliceAngle / 2;
        const lx = 375 + Math.cos(midAngle) * 130;
        const ly = 165 + Math.sin(midAngle) * 130;
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e0e0e0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label.substring(0, 8), lx, ly);

        startAngle += sliceAngle;
      });
    }

    $('chart-preview').innerHTML = '';
    $('chart-preview').appendChild(canvas);
  }

  /* ---------- SVG流程图 ---------- */

  function generateSvgFlow() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const svg = buildFlowSvg(obj, 'Root');
      $('svg-modal-title').textContent = 'SVG \u6d41\u7a0b\u56fe';
      $('svg-preview').innerHTML = svg;
      $('svg-modal').classList.remove('hidden');
      $('svg-modal')._svgCode = svg;
      setStatus('\u5df2\u751f\u6210SVG\u6d41\u7a0b\u56fe', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function buildFlowSvg(obj, name) {
    if (typeof obj !== 'object' || obj === null) {
      const val = obj === null ? 'null' : String(obj);
      return '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect x="2" y="2" width="156" height="56" rx="8" fill="#e8f5e9" stroke="#4caf50" stroke-width="2"/><text x="80" y="36" text-anchor="middle" font-size="12" fill="#333">' + name + ': ' + escapeHtml(val.substring(0, 15)) + '</text></svg>';
    }

    const entries = Array.isArray(obj) ? obj.map((v, i) => ['[' + i + ']', v]) : Object.entries(obj);
    if (entries.length === 0) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect x="2" y="2" width="156" height="56" rx="8" fill="#fff3e0" stroke="#ff9800" stroke-width="2"/><text x="80" y="36" text-anchor="middle" font-size="12" fill="#333">' + name + ': {}</text></svg>';
    }

    const nodeW = 140, nodeH = 50, gapX = 30, gapY = 60;
    const totalW = entries.length * (nodeW + gapX) - gapX;
    const svgW = Math.max(totalW + 80, 200);
    const rootX = svgW / 2;
    const rootY = 40;
    let svgH = rootY + nodeH + gapY + 10;

    const childSvgs = [];
    let maxChildH = 0;

    entries.slice(0, 8).forEach(([key, val]) => {
      const childSvg = buildFlowSvg(val, key);
      const hMatch = childSvg.match(/height="(\d+)"/);
      const wMatch = childSvg.match(/width="(\d+)"/);
      const h = hMatch ? parseInt(hMatch[1]) : 60;
      const w = wMatch ? parseInt(wMatch[1]) : 160;
      childSvgs.push({ svg: childSvg, w, h, key });
      maxChildH = Math.max(maxChildH, h);
    });

    const childAreaW = childSvgs.reduce((s, c) => s + c.w + gapX, -gapX);
    const finalW = Math.max(svgW, childAreaW + 80);
    let childrenStr = '';
    let cx = (finalW - childAreaW) / 2;
    const cy = rootY + nodeH + gapY;

    childSvgs.forEach((child) => {
      const childX = cx;
      const childY = cy;
      childrenStr += '<line x1="' + rootX + '" y1="' + (rootY + nodeH) + '" x2="' + (childX + child.w / 2) + '" y2="' + childY + '" stroke="#90a4ae" stroke-width="2" stroke-dasharray="5,3"/>';
      childrenStr += '<g transform="translate(' + childX + ',' + childY + ')">' + child.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '') + '</g>';
      cx += child.w + gapX;
    });

    svgH = cy + maxChildH + 20;

    const isArr = Array.isArray(obj);
    const rootFill = isArr ? '#e3f2fd' : '#f3e5f5';
    const rootStroke = isArr ? '#2196f3' : '#9c27b0';
    const typeStr = isArr ? 'Array[' + obj.length + ']' : 'Object';

    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + finalW + '" height="' + svgH + '">';
    svg += '<rect x="' + (rootX - 65) + '" y="' + (rootY - 2) + '" width="130" height="' + (nodeH + 4) + '" rx="10" fill="' + rootFill + '" stroke="' + rootStroke + '" stroke-width="2"/>';
    svg += '<text x="' + rootX + '" y="' + (rootY + 15) + '" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">' + escapeHtml(name.substring(0, 14)) + '</text>';
    svg += '<text x="' + rootX + '" y="' + (rootY + 32) + '" text-anchor="middle" font-size="10" fill="#666">' + typeStr + '</text>';
    svg += childrenStr;
    svg += '</svg>';
    return svg;
  }

  /* ---------- SVG树形图 ---------- */

  function generateSvgTree() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const nodes = [];
      const edges = [];
      let nodeId = 0;

      function traverse(val, name, parentId) {
        const id = nodeId++;
        const isObj = typeof val === 'object' && val !== null;
        const isArr = Array.isArray(val);
        let label = name;
        if (!isObj) label += ': ' + (val === null ? 'null' : String(val).substring(0, 20));
        else if (isArr) label += ' [' + val.length + ']';
        else label += ' {...}';

        nodes.push({ id, label, type: isObj ? (isArr ? 'array' : 'object') : 'value' });
        if (parentId !== null) edges.push({ from: parentId, to: id });

        if (isObj) {
          const entries = isArr ? val.map((v, i) => ['[' + i + ']', v]) : Object.entries(val);
          entries.slice(0, 10).forEach(([k, v]) => traverse(v, k, id));
        }
      }

      traverse(obj, 'root', null);

      const nodeW = 120, nodeH = 32, vGap = 50, hGap = 16;
      const positions = [];

      function layoutTree(nodeId, depth, left) {
        const children = edges.filter(e => e.from === nodeId).map(e => e.to);
        if (children.length === 0) {
          positions[nodeId] = { x: left, y: depth * (nodeH + vGap) };
          return left + nodeW + hGap;
        }
        let curLeft = left;
        children.forEach(childId => { curLeft = layoutTree(childId, depth + 1, curLeft); });
        const firstChild = positions[children[0]];
        const lastChild = positions[children[children.length - 1]];
        positions[nodeId] = { x: (firstChild.x + lastChild.x) / 2, y: depth * (nodeH + vGap) };
        return curLeft;
      }

      layoutTree(0, 0, 20);
      const maxX = Math.max(...positions.map(p => p ? p.x : 0)) + nodeW + 40;
      const maxY = Math.max(...positions.map(p => p ? p.y : 0)) + nodeH + 40;

      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + maxX + '" height="' + maxY + '">';

      edges.forEach(e => {
        const from = positions[e.from];
        const to = positions[e.to];
        if (from && to) {
          svg += '<line x1="' + (from.x + nodeW / 2) + '" y1="' + (from.y + nodeH) + '" x2="' + (to.x + nodeW / 2) + '" y2="' + to.y + '" stroke="#90a4ae" stroke-width="1.5"/>';
        }
      });

      nodes.forEach(n => {
        const pos = positions[n.id];
        if (!pos) return;
        const fill = n.type === 'object' ? '#f3e5f5' : n.type === 'array' ? '#e3f2fd' : '#e8f5e9';
        const stroke = n.type === 'object' ? '#9c27b0' : n.type === 'array' ? '#2196f3' : '#4caf50';
        svg += '<rect x="' + pos.x + '" y="' + pos.y + '" width="' + nodeW + '" height="' + nodeH + '" rx="6" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>';
        svg += '<text x="' + (pos.x + nodeW / 2) + '" y="' + (pos.y + nodeH / 2 + 4) + '" text-anchor="middle" font-size="10" fill="#333">' + escapeHtml(n.label.substring(0, 16)) + '</text>';
      });

      svg += '</svg>';
      $('svg-modal-title').textContent = 'SVG \u6811\u5f62\u56fe';
      $('svg-preview').innerHTML = svg;
      $('svg-modal').classList.remove('hidden');
      $('svg-modal')._svgCode = svg;
      setStatus('\u5df2\u751f\u6210SVG\u6811\u5f62\u56fe', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- XLSX导出 ---------- */

  function exportToXlsx() {
    if (!currentParsedValue) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    const arr = Array.isArray(currentParsedValue) ? currentParsedValue : [currentParsedValue];
    if (arr.length === 0 || typeof arr[0] !== 'object') { showError('\u9700\u8981\u5bf9\u8c61\u6216\u5bf9\u8c61\u6570\u7ec4'); return; }

    const headers = [...new Set(arr.flatMap(Object.keys))];
    const sheetData = [headers];
    arr.forEach(row => {
      sheetData.push(headers.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        return v;
      }));
    });

    const wb = generateSimpleXlsx(sheetData, 'Sheet1');
    const blob = new Blob([wb], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('\u5df2\u5bfc\u51faXLSX', true);
  }

  function generateSimpleXlsx(data, sheetName) {
    const rows = data.length;
    const cols = data[0] ? data[0].length : 0;
    const xmlns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const rns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    let strings = [];
    const siMap = {};
    data.forEach(row => row.forEach(cell => {
      if (typeof cell === 'string' && !siMap.hasOwnProperty(cell)) {
        siMap[cell] = strings.length;
        strings.push(cell);
      }
    }));

    let sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    sheetXml += '<worksheet xmlns="' + xmlns + '" xmlns:r="' + rns + '">';
    sheetXml += '<sheetData>';
    data.forEach((row, ri) => {
      sheetXml += '<row r="' + (ri + 1) + '">';
      row.forEach((cell, ci) => {
        const colRef = String.fromCharCode(65 + ci % 26) + (ci >= 26 ? String.fromCharCode(65 + Math.floor(ci / 26) - 1) : '');
        if (typeof cell === 'number') {
          sheetXml += '<c r="' + colRef + (ri + 1) + '" t="n"><v>' + cell + '</v></c>';
        } else if (typeof cell === 'string' && cell !== '') {
          sheetXml += '<c r="' + colRef + (ri + 1) + '" t="s"><v>' + (siMap[cell] || 0) + '</v></c>';
        } else {
          sheetXml += '<c r="' + colRef + (ri + 1) + '" t="n"><v></v></c>';
        }
      });
      sheetXml += '</row>';
    });
    sheetXml += '</sheetData></worksheet>';

    let sharedStrings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    sharedStrings += '<sst xmlns="' + xmlns + '" count="' + strings.length + '" uniqueCount="' + strings.length + '">';
    strings.forEach(s => { sharedStrings += '<si><t>' + escapeHtml(s) + '</t></si>'; });
    sharedStrings += '</sst>';

    const workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="' + sheetName + '" sheetId="1" r:id="rId1"/></sheets></workbook>';

    const relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
      '</Relationships>';

    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      '</Types>';

    const entries = [
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: workbookXml },
      { name: 'xl/_rels/workbook.xml.rels', data: relsXml },
      { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
      { name: 'xl/sharedStrings.xml', data: sharedStrings }
    ];

    return createZip(entries);
  }

  function createZip(entries) {
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    entries.forEach(entry => {
      const nameBytes = new TextEncoder().encode(entry.name);
      const dataBytes = new TextEncoder().encode(entry.data);
      const crc = crc32(dataBytes);

      const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
      const dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, dataBytes.length, true);
      dv.setUint32(22, dataBytes.length, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      local.set(dataBytes, 30 + nameBytes.length);
      localHeaders.push(local);

      const central = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(central.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint16(14, 0, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, dataBytes.length, true);
      cdv.setUint32(24, dataBytes.length, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0x20, true);
      cdv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralHeaders.push(central);

      offset += local.length;
    });

    const centralDirOffset = offset;
    let centralDirSize = 0;
    centralHeaders.forEach(ch => { centralDirSize += ch.length; });

    const eocd = new Uint8Array(22);
    const eodv = new DataView(eocd.buffer);
    eodv.setUint32(0, 0x06054b50, true);
    eodv.setUint16(4, 0, true);
    eodv.setUint16(6, 0, true);
    eodv.setUint16(8, entries.length, true);
    eodv.setUint16(10, entries.length, true);
    eodv.setUint32(12, centralDirSize, true);
    eodv.setUint32(16, centralDirOffset, true);
    eodv.setUint16(20, 0, true);

    const totalSize = offset + centralDirSize + 22;
    const result = new Uint8Array(totalSize);
    let pos = 0;
    localHeaders.forEach(h => { result.set(h, pos); pos += h.length; });
    centralHeaders.forEach(h => { result.set(h, pos); pos += h.length; });
    result.set(eocd, pos);

    return result;
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    for (let i = 0; i < bytes.length; i++) {
      crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /* ---------- JSON模板生成器 ---------- */

  function generateTemplate() {
    const text = input.value.trim();
    if (!text) {
      const sample = { "id": 0, "name": "", "email": "", "active": true, "tags": [""], "address": { "city": "", "zip": "" } };
      input.value = JSON.stringify(sample, null, 2);
      setStatus('\u5df2\u751f\u6210\u793a\u4f8b\u6a21\u677f', true);
      return;
    }

    try {
      const obj = JSON.parse(text);
      const template = buildTemplate(obj);
      input.value = JSON.stringify(template, null, 2);
      setStatus('\u5df2\u751f\u6210\u6a21\u677f', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function buildTemplate(val) {
    if (val === null) return null;
    if (typeof val === 'boolean') return false;
    if (typeof val === 'number') return 0;
    if (typeof val === 'string') return '';
    if (Array.isArray(val)) {
      if (val.length === 0) return [];
      return [buildTemplate(val[0])];
    }
    if (typeof val === 'object') {
      const result = {};
      Object.entries(val).forEach(([k, v]) => { result[k] = buildTemplate(v); });
      return result;
    }
    return null;
  }

  /* ---------- JSON数据过滤 ---------- */

  function showFilterModal() {
    $('filter-input1').value = '';
    $('filter-input2').value = '';
    $('filter-output').value = '';
    $('filter-modal').classList.remove('hidden');
    updateFilterInputs();
  }

  function updateFilterInputs() {
    const mode = $('filter-mode').value;
    const inp2 = $('filter-input2');
    const inp1 = $('filter-input1');

    if (mode === 'key') { inp1.placeholder = '\u952e\u540d\u5173\u952e\u8bcd (\u5982 name)'; inp2.style.display = 'none'; }
    else if (mode === 'value') { inp1.placeholder = '\u503c\u7c7b\u578b (string/number/boolean/null/object/array)'; inp2.style.display = 'none'; }
    else if (mode === 'path') { inp1.placeholder = '\u8def\u5f84\u524d\u7f00 (\u5982 $.data)'; inp2.style.display = 'none'; }
    else if (mode === 'regex') { inp1.placeholder = '\u6b63\u5219\u8868\u8fbe\u5f0f'; inp2.style.display = 'none'; }
    else if (mode === 'minmax') { inp1.placeholder = '\u6700\u5c0f\u503c'; inp2.style.display = ''; inp2.placeholder = '\u6700\u5927\u503c'; }
  }

  function runFilter() {
    const text = input.value.trim();
    if (!text) { showError('\u8bf7\u8f93\u5165JSON'); return; }

    try {
      const obj = JSON.parse(text);
      const mode = $('filter-mode').value;
      const condition = $('filter-input1').value;
      const invert = $('filter-invert').checked;
      let result;

      function matchKey(val, path) {
        if (typeof val !== 'object' || val === null) return false;
        const entries = Array.isArray(val) ? val.map((v, i) => ['[' + i + ']', v]) : Object.entries(val);
        for (const [k, v] of entries) {
          if (k.toLowerCase().includes(condition.toLowerCase())) return true;
          if (matchKey(v, path + '.' + k)) return true;
        }
        return false;
      }

      function matchValue(val) {
        if (condition === 'string') return typeof val === 'string';
        if (condition === 'number') return typeof val === 'number';
        if (condition === 'boolean') return typeof val === 'boolean';
        if (condition === 'null') return val === null;
        if (condition === 'object') return typeof val === 'object' && val !== null && !Array.isArray(val);
        if (condition === 'array') return Array.isArray(val);
        return false;
      }

      function matchPath(val, path) {
        return path.startsWith(condition);
      }

      function filterObj(val, path) {
        if (Array.isArray(val)) {
          const filtered = val.map((v, i) => filterObj(v, path + '[' + i + ']')).filter(v => v !== undefined);
          let matched = false;
          if (mode === 'key' && matchKey(val, path)) matched = true;
          if (mode === 'value' && matchValue(val)) matched = true;
          if (mode === 'path' && matchPath(val, path)) matched = true;
          if (mode === 'regex') {
            try { if (new RegExp(condition).test(JSON.stringify(val))) matched = true; } catch(e) {}
          }
          if (mode === 'minmax') {
            const min = parseFloat($('filter-input1').value);
            const max = parseFloat($('filter-input2').value);
            if (typeof val === 'number' && val >= min && val <= max) matched = true;
          }
          if (matched) return invert ? undefined : val;
          return filtered.length > 0 ? filtered : (invert ? val : undefined);
        }
        if (typeof val === 'object' && val !== null) {
          const result = {};
          let anyMatch = false;
          Object.entries(val).forEach(([k, v]) => {
            const fv = filterObj(v, path + '.' + k);
            if (fv !== undefined) { result[k] = fv; anyMatch = true; }
          });
          let matched = false;
          if (mode === 'key' && matchKey(val, path)) matched = true;
          if (mode === 'value' && matchValue(val)) matched = true;
          if (mode === 'path' && matchPath(val, path)) matched = true;
          if (mode === 'regex') {
            try { if (new RegExp(condition).test(JSON.stringify(val))) matched = true; } catch(e) {}
          }
          if (matched) return invert ? undefined : val;
          return anyMatch ? result : (invert ? val : undefined);
        }
        return undefined;
      }

      if (mode === 'key' || mode === 'path') {
        result = filterObj(obj, '$');
      } else if (mode === 'value') {
        result = filterObj(obj, '$');
      } else if (mode === 'regex') {
        result = filterObj(obj, '$');
      } else if (mode === 'minmax') {
        result = filterObj(obj, '$');
      }

      if (result === undefined) result = null;
      $('filter-output').value = JSON.stringify(result, null, 2);
      setStatus('\u8fc7\u6ee4\u5b8c\u6210', true);
    } catch (e) {
      showError('JSON\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  /* ---------- PDF工具 ---------- */

  let currentPdfDoc = null;
  let currentPdfText = '';

  function showPdfModal() {
    $('pdf-modal').classList.remove('hidden');
  }

  function hidePdfModal() {
    $('pdf-modal').classList.add('hidden');
    resetPdfModal();
  }

  function resetPdfModal() {
    $('pdf-drop-zone').classList.remove('hidden');
    $('pdf-info').classList.add('hidden');
    $('pdf-output').value = '';
    $('pdf-json-output').value = '';
    $('pdf-md-output').value = '';
    $('pdf-file-input').value = '';
    currentPdfDoc = null;
    currentPdfText = '';
    $('pdf-detail-info').innerHTML = '<p class="pdf-hint">\u8bf7\u5148\u4e0a\u4f20PDF\u6587\u4ef6\u4ee5\u67e5\u770b\u8be6\u7ec6\u4fe1\u606f</p>';
  }

  function switchPdfTab(tabName) {
    document.querySelectorAll('.pdf-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pdf-panel').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
    document.querySelector('.pdf-tab[data-tab="' + tabName + '"]').classList.add('active');
    $('pdf-tab-' + tabName).classList.remove('hidden');
    $('pdf-tab-' + tabName).classList.add('active');
  }

  async function handlePdfFile(file) {
    if (!file || file.type !== 'application/pdf') {
      showError('\u8bf7\u9009\u62e9PDF\u6587\u4ef6');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showError('\u6587\u4ef6\u8d85\u8fc720MB\u9650\u5236');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);

      if (typeof pdfjsLib === 'undefined') {
        showError('PDF.js\u5e93\u672a\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u8fde\u63a5');
        return;
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      currentPdfDoc = await pdfjsLib.getDocument(typedArray).promise;

      $('pdf-drop-zone').classList.add('hidden');
      $('pdf-info').classList.remove('hidden');
      $('pdf-filename').textContent = file.name;
      $('pdf-pages').textContent = '\u5171 ' + currentPdfDoc.numPages + ' \u9875';

      await extractPdfText();
      showPdfInfo(file);
      setStatus('\u5df2\u52a0\u8f7dPDF: ' + file.name + ' (' + currentPdfDoc.numPages + '\u9875)', true);
    } catch (e) {
      showError('PDF\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  async function extractPdfText() {
    if (!currentPdfDoc) return;
    currentPdfText = '';
    for (let i = 1; i <= currentPdfDoc.numPages; i++) {
      const page = await currentPdfDoc.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      currentPdfText += strings.join(' ') + '\n\n';
    }
    $('pdf-output').value = currentPdfText;
  }

  function showPdfInfo(file) {
    const info = $('pdf-detail-info');
    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    info.innerHTML =
      '<div class="pdf-detail-row"><span class="pdf-detail-label">\u6587\u4ef6\u540d</span><span class="pdf-detail-value">' + escapeHtml(file.name) + '</span></div>' +
      '<div class="pdf-detail-row"><span class="pdf-detail-label">\u6587\u4ef6\u5927\u5c0f</span><span class="pdf-detail-value">' + sizeKB + ' KB (' + sizeMB + ' MB)</span></div>' +
      '<div class="pdf-detail-row"><span class="pdf-detail-label">\u9875\u6570</span><span class="pdf-detail-value">' + currentPdfDoc.numPages + '</span></div>' +
      '<div class="pdf-detail-row"><span class="pdf-detail-label">\u6587\u672c\u5b57\u7b26\u6570</span><span class="pdf-detail-value">' + currentPdfText.length + '</span></div>' +
      '<div class="pdf-detail-row"><span class="pdf-detail-label">\u6587\u672c\u884c\u6570</span><span class="pdf-detail-value">' + currentPdfText.split('\n').filter(l => l.trim()).length + '</span></div>' +
      '<div class="pdf-detail-row"><span class="pdf-detail-label">\u683c\u5f0f</span><span class="pdf-detail-value">PDF</span></div>';
  }

  function pdfToJson() {
    if (!currentPdfText) { showError('\u8bf7\u5148\u4e0a\u4f20PDF\u6587\u4ef6'); return; }
    const lines = currentPdfText.split('\n').filter(l => l.trim());
    const isTable = $('pdf-json-table').checked;
    const isArray = $('pdf-json-array').checked;

    let result;
    if (isTable) {
      const rows = [];
      let currentRow = [];
      let lastY = null;
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
          if (currentRow.length > 0) { rows.push(currentRow); currentRow = []; }
          return;
        }
        if (trimmed.includes('  ') || trimmed.includes('\t')) {
          const cells = trimmed.split(/\s{2,}|\t/).filter(Boolean);
          if (cells.length > 1) {
            rows.push(cells.map(c => c.trim()));
            return;
          }
        }
        currentRow.push(trimmed);
      });
      if (currentRow.length > 0) rows.push(currentRow);

      if (rows.length > 0 && rows[0].length > 1) {
        const headers = rows[0];
        result = rows.slice(1).map(row => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = parsePdfValue(row[i] || ''); });
          return obj;
        });
      } else {
        result = rows.map(r => r.length === 1 ? parsePdfValue(r[0]) : r);
      }
    } else {
      result = lines.map(l => parsePdfValue(l.trim()));
    }

    if (!isArray && result.length === 1) result = result[0];
    const jsonStr = JSON.stringify(result, null, 2);
    $('pdf-json-output').value = jsonStr;
    setStatus('\u5df2\u8f6c\u6362\u4e3aJSON', true);
  }

  function parsePdfValue(val) {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null') return null;
    if (/^-?\d+$/.test(val)) return parseInt(val, 10);
    if (/^-?\d*\.\d+$/.test(val)) return parseFloat(val);
    return val;
  }

  function pdfToMarkdown() {
    if (!currentPdfText) { showError('\u8bf7\u5148\u4e0a\u4f20PDF\u6587\u4ef6'); return; }
    const useHeaders = $('pdf-md-headers').checked;
    const useTable = $('pdf-md-table').checked;
    const lines = currentPdfText.split('\n');
    let md = '';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) { md += '\n'; return; }

      if (useHeaders) {
        const headerMatch = trimmed.match(/^(\d+[\.\)]\s*.+)/);
        if (headerMatch) {
          md += '\n## ' + headerMatch[1].replace(/^\d+[\.\)]\s*/, '') + '\n\n';
          return;
        }
        const titleMatch = trimmed.match(/^([A-Z][A-Z\s]{3,})$/);
        if (titleMatch) {
          md += '\n### ' + titleMatch[1].trim() + '\n\n';
          return;
        }
      }

      if (useTable && (trimmed.includes('  ') || trimmed.includes('\t'))) {
        const cells = trimmed.split(/\s{2,}|\t/).filter(Boolean);
        if (cells.length > 1) {
          md += '| ' + cells.join(' | ') + ' |\n';
          if (!md.includes('| ---')) {
            md += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
          }
          return;
        }
      }

      md += trimmed + '\n';
    });

    $('pdf-md-output').value = md.trim();
    setStatus('\u5df2\u8f6c\u6362\u4e3aMarkdown', true);
  }

  function copyPdfText() {
    const text = $('pdf-output').value;
    if (!text) { showError('\u6ca1\u6709\u53ef\u590d\u5236\u7684\u5185\u5bb9'); return; }
    navigator.clipboard.writeText(text).then(() => setStatus('\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f', true));
  }

  function pdfToInput() {
    const text = $('pdf-output').value;
    if (!text) { showError('\u6ca1\u6709\u5185\u5bb9'); return; }
    input.value = text;
    hidePdfModal();
    setStatus('\u5df2\u53d1\u9001\u5230\u8f93\u5165\u6846', true);
  }

  function downloadPdfText() {
    const text = $('pdf-output').value;
    if (!text) { showError('\u6ca1\u6709\u5185\u5bb9'); return; }
    downloadFile(text, 'pdf-extract.txt', 'text/plain');
    setStatus('\u5df2\u4e0b\u8f7d\u4e3aTXT', true);
  }

  function copyPdfJson() {
    const text = $('pdf-json-output').value;
    if (!text) { showError('\u6ca1\u6709\u53ef\u590d\u5236\u7684\u5185\u5bb9'); return; }
    navigator.clipboard.writeText(text).then(() => setStatus('\u5df2\u590d\u5236', true));
  }

  function pdfJsonToInput() {
    const text = $('pdf-json-output').value;
    if (!text) { showError('\u6ca1\u6709\u5185\u5bb9'); return; }
    input.value = text;
    hidePdfModal();
    doFormat(false);
    setStatus('\u5df2\u53d1\u9001\u5230\u8f93\u5165\u6846', true);
  }

  function copyPdfMd() {
    const text = $('pdf-md-output').value;
    if (!text) { showError('\u6ca1\u6709\u53ef\u590d\u5236\u7684\u5185\u5bb9'); return; }
    navigator.clipboard.writeText(text).then(() => setStatus('\u5df2\u590d\u5236', true));
  }

  function downloadPdfMd() {
    const text = $('pdf-md-output').value;
    if (!text) { showError('\u6ca1\u6709\u5185\u5bb9'); return; }
    downloadFile(text, 'pdf-convert.md', 'text/markdown');
    setStatus('\u5df2\u4e0b\u8f7d\u4e3aMarkdown', true);
  }

  let tsTimer = null;

  function showTimestampModal() {
    $('timestamp-modal').classList.remove('hidden');
    updateCurrentTime();
    tsTimer = setInterval(updateCurrentTime, 1000);
  }

  function hideTimestampModal() {
    $('timestamp-modal').classList.add('hidden');
    if (tsTimer) { clearInterval(tsTimer); tsTimer = null; }
  }

  function updateCurrentTime() {
    const now = new Date();
    $('ts-current-time').textContent = now.toLocaleString('zh-CN');
    $('ts-current-unix').textContent = 'Unix: ' + Math.floor(now.getTime() / 1000) + ' (s) / ' + now.getTime() + ' (ms)';
  }

  function tsToDate() {
    const input = $('ts-input').value.trim();
    if (!input) { showError('\u8bf7\u8f93\u5165\u65f6\u95f4\u6233'); return; }
    const unit = $('ts-unit').value;
    let ms = parseInt(input, 10);
    if (isNaN(ms)) { showError('\u65e0\u6548\u7684\u65f6\u95f4\u6233'); return; }
    if (unit === 's') ms = ms * 1000;
    const date = new Date(ms);
    if (isNaN(date.getTime())) { showError('\u65e0\u6548\u7684\u65f6\u95f4\u6233'); return; }
    const result = $('ts-result-date');
    result.classList.remove('hidden');
    result.innerHTML =
      '\u672c\u5730\u65f6\u95f4: ' + date.toLocaleString('zh-CN') + '<br>' +
      'ISO 8601: ' + date.toISOString() + '<br>' +
      'UTC: ' + date.toUTCString() + '<br>' +
      '\u76f8\u5bf9\u65f6\u95f4: ' + getRelativeTime(date);
  }

  function dateToTs() {
    const dateStr = $('ts-date-input').value;
    if (!dateStr) { showError('\u8bf7\u9009\u62e9\u65e5\u671f'); return; }
    const date = new Date(dateStr);
    const ms = date.getTime();
    const s = Math.floor(ms / 1000);
    const result = $('ts-result-stamp');
    result.classList.remove('hidden');
    result.innerHTML =
      '\u79d2 (s): ' + s + '<br>' +
      '\u6beb\u79d2 (ms): ' + ms + '<br>' +
      '\u590d\u5236\u547d\u4ee4: navigator.clipboard.writeText("' + s + '")';
  }

  function fillNowDateTime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    $('ts-date-input').value = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      'T' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  }

  function copyCurrentTimestamp() {
    const s = Math.floor(Date.now() / 1000);
    navigator.clipboard.writeText(String(s)).then(() => setStatus('\u5df2\u590d\u5236\u65f6\u95f4\u6233: ' + s, true));
  }

  function getRelativeTime(date) {
    const diff = Date.now() - date.getTime();
    const abs = Math.abs(diff);
    const prefix = diff > 0 ? '' : '';
    if (abs < 60000) return (diff > 0 ? '' : '-') + Math.floor(abs / 1000) + ' \u79d2\u524d';
    if (abs < 3600000) return (diff > 0 ? '' : '-') + Math.floor(abs / 60000) + ' \u5206\u949f\u524d';
    if (abs < 86400000) return (diff > 0 ? '' : '-') + Math.floor(abs / 3600000) + ' \u5c0f\u65f6\u524d';
    if (abs < 2592000000) return (diff > 0 ? '' : '-') + Math.floor(abs / 86400000) + ' \u5929\u524d';
    if (abs < 31536000000) return (diff > 0 ? '' : '-') + Math.floor(abs / 2592000000) + ' \u4e2a\u6708\u524d';
    return (diff > 0 ? '' : '-') + Math.floor(abs / 31536000000) + ' \u5e74\u524d';
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeString() {
    const text = input.value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    input.value = JSON.stringify(text).slice(1, -1);
    setStatus('\u5df2\u8f6c\u4e49', true);
  }

  function unescapeString() {
    const text = input.value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    try { input.value = JSON.parse('"' + text + '"'); setStatus('\u5df2\u53cd\u8f6c\u4e49', true); }
    catch (e) { showError('\u53cd\u8f6c\u4e49\u5931\u8d25: ' + e.message); }
  }

  function unicodeConvert() {
    const text = input.value;
    if (!text) { showError('\u8bf7\u8f93\u5165\u5185\u5bb9'); return; }
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 127) result += '\\u' + code.toString(16).padStart(4, '0');
      else result += text[i];
    }
    input.value = result;
    setStatus('\u5df2\u8f6c\u6362Unicode', true);
  }

  let currentBase64Data = '';

  function showBase64Modal() {
    $('base64-modal').classList.remove('hidden');
    resetBase64Modal();
  }

  function hideBase64Modal() {
    $('base64-modal').classList.add('hidden');
    resetBase64Modal();
  }

  function resetBase64Modal() {
    $('base64-drop-zone').classList.remove('hidden');
    $('base64-preview-area').classList.add('hidden');
    $('base64-file-input').value = '';
    $('base64-output').value = '';
    currentBase64Data = '';
  }

  function handleBase64File(file) {
    if (!file || !file.type.startsWith('image/')) { showError('\u8bf7\u9009\u62e9\u56fe\u7247\u6587\u4ef6'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      currentBase64Data = e.target.result;
      $('base64-preview').src = currentBase64Data;
      $('base64-filename').textContent = file.name;
      const sizeKB = (file.size / 1024).toFixed(1);
      const base64SizeKB = (currentBase64Data.length * 0.75 / 1024).toFixed(1);
      $('base64-filesize').textContent = '\u539f\u59cb: ' + sizeKB + ' KB \u2192 Base64: ' + base64SizeKB + ' KB';
      updateBase64Output();
      $('base64-drop-zone').classList.add('hidden');
      $('base64-preview-area').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  function updateBase64Output() {
    const output = $('base64-output');
    if ($('base64-datauri').checked) { output.value = currentBase64Data; }
    else { output.value = currentBase64Data.split(',')[1] || currentBase64Data; }
  }

  function copyBase64() {
    const output = $('base64-output');
    output.select();
    document.execCommand('copy');
    setStatus('\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f', true);
  }

  function base64ToJson() {
    if (!currentBase64Data) { showError('\u8bf7\u5148\u9009\u62e9\u56fe\u7247'); return; }
    const parts = currentBase64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (parts) {
      const jsonData = { mimeType: parts[1], base64: parts[2], dataUri: currentBase64Data };
      input.value = JSON.stringify(jsonData, null, 2);
      doFormat(false);
      hideBase64Modal();
      setStatus('\u5df2\u5c06\u56fe\u7247Base64\u8f93\u51fa\u4e3aJSON', true);
    }
  }

  let currentDecodedBlob = null;
  let currentDecodedType = 'png';

  function showImgDecodeModal() {
    $('img-decode-modal').classList.remove('hidden');
  }

  function hideImgDecodeModal() {
    $('img-decode-modal').classList.add('hidden');
    $('img-decode-input').value = '';
    $('img-decode-result').classList.add('hidden');
    currentDecodedBlob = null;
  }

  function getMimeTypeFromBase64(base64Str) {
    if (base64Str.startsWith('data:')) {
      const match = base64Str.match(/^data:([^;]+);/);
      return match ? match[1] : 'image/png';
    }
    return 'image/png';
  }

  function decodeBase64ToImage() {
    let base64Str = $('img-decode-input').value.trim();
    if (!base64Str) { showError('\u8bf7\u8f93\u5165Base64\u5b57\u7b26\u4e32'); return; }
    const mimeType = getMimeTypeFromBase64(base64Str);
    currentDecodedType = mimeType.split('/')[1] || 'png';
    let dataUri = base64Str;
    if (!base64Str.startsWith('data:')) {
      dataUri = 'data:' + mimeType + ';base64,' + base64Str;
    }
    const preview = $('img-decode-preview');
    preview.src = dataUri;
    preview.onload = () => {
      const raw = base64Str.startsWith('data:') ? base64Str.split(',')[1] : base64Str;
      const byteString = atob(raw);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      currentDecodedBlob = new Blob([ab], { type: mimeType });
      const sizeKB = (currentDecodedBlob.size / 1024).toFixed(1);
      const pixels = preview.naturalWidth + ' \u00d7 ' + preview.naturalHeight;
      $('img-decode-type').textContent = '\u7c7b\u578b: ' + mimeType;
      $('img-decode-size').textContent = '\u5c3a\u5bf8: ' + pixels + ' | \u5927\u5c0f: ' + sizeKB + ' KB';
      $('img-decode-result').classList.remove('hidden');
      setStatus('\u5df2\u89e3\u7801\u56fe\u7247', true);
    };
    preview.onerror = () => {
      showError('Base64\u89e3\u7801\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u8f93\u5165\u683c\u5f0f');
      preview.src = '';
      $('img-decode-result').classList.add('hidden');
    };
  }

  function downloadDecodedImage() {
    if (!currentDecodedBlob) { showError('\u8bf7\u5148\u89e3\u7801\u56fe\u7247'); return; }
    const filename = $('img-decode-filename').value.trim() || ('image.' + currentDecodedType);
    const url = URL.createObjectURL(currentDecodedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('\u5df2\u4e0b\u8f7d\u56fe\u7247', true);
  }

  function copyDecodedImage() {
    if (!currentDecodedBlob) { showError('\u8bf7\u5148\u89e3\u7801\u56fe\u7247'); return; }
    if (navigator.clipboard && navigator.clipboard.write) {
      const item = new ClipboardItem({ [currentDecodedBlob.type]: currentDecodedBlob });
      navigator.clipboard.write([item]).then(() => setStatus('\u5df2\u590d\u5236\u56fe\u7247\u5230\u526a\u8d34\u677f', true)).catch(() => showError('\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u5c1d\u8bd5\u4e0b\u8f7d'));
    } else { showError('\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u590d\u5236\u56fe\u7247'); }
  }

  function getBase64FromInput() {
    const inputText = input.value.trim();
    if (!inputText) { showError('\u8f93\u5165\u6846\u4e3a\u7a7a'); return; }
    try {
      const data = JSON.parse(inputText);
      if (data.base64) { $('img-decode-input').value = data.base64; }
      else if (data.dataUri) { $('img-decode-input').value = data.dataUri; }
      else { $('img-decode-input').value = inputText; }
    } catch { $('img-decode-input').value = inputText; }
  }

  function changeFontSize(delta) {
    var curSize = parseInt(localStorage.getItem('jsonFormatterFontSize') || '14', 10);
    var newSize = curSize + delta;
    if (newSize >= 10 && newSize <= 24) {
      document.documentElement.style.setProperty('--font-size', newSize + 'px');
      $('font-size-display').textContent = newSize;
      localStorage.setItem('jsonFormatterFontSize', newSize);
    }
  }

  function importYaml() {
    const yamlText = input.value.trim();
    if (!yamlText) { showError('\u8bf7\u8f93\u5165YAML\u5185\u5bb9'); return; }
    try {
      const json = yamlToJson(yamlText);
      input.value = JSON.stringify(json, null, 2);
      doFormat(false);
      setStatus('\u5df2\u5c06YAML\u8f6c\u6362\u4e3aJSON', true);
    } catch (e) {
      showError('YAML\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function yamlToJson(yaml) {
    const lines = yaml.split('\n');
    const result = {};
    let currentObj = result;
    let stack = [{ obj: result, indent: -1 }];
    for (let line of lines) {
      if (line.trim() === '' || line.trim().startsWith('#')) continue;
      const indent = line.search(/\S/);
      const content = line.trim();
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) { stack.pop(); }
      currentObj = stack[stack.length - 1].obj;
      if (content.includes(':')) {
        const colonIndex = content.indexOf(':');
        const key = content.substring(0, colonIndex).trim();
        const value = content.substring(colonIndex + 1).trim();
        if (value === '' || value === '|' || value === '>') {
          currentObj[key] = {};
          stack.push({ obj: currentObj[key], indent: indent });
        } else if (value.startsWith('[') && value.endsWith(']')) {
          var singleQuote = String.fromCharCode(39);
          var doubleQuote = String.fromCharCode(34);
          currentObj[key] = JSON.parse(value.split(singleQuote).join(doubleQuote));
        } else if (value.startsWith('{') && value.endsWith('}')) {
          var sq = String.fromCharCode(39);
          var dq = String.fromCharCode(34);
          currentObj[key] = JSON.parse(value.split(sq).join(dq));
        } else {
          currentObj[key] = parseYamlValue(value);
        }
      } else if (content.startsWith('- ')) {
        const parentKey = Object.keys(currentObj).pop();
        if (!Array.isArray(currentObj[parentKey])) { currentObj[parentKey] = []; }
        currentObj[parentKey].push(parseYamlValue(content.substring(2)));
      }
    }
    return result;
  }

  function parseYamlValue(val) {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null' || val === '~') return null;
    if (/^-?\d+$/.test(val)) return parseInt(val, 10);
    if (/^-?\d*\.\d+$/.test(val)) return parseFloat(val);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      return val.slice(1, -1);
    }
    return val;
  }

  function importXml() {
    const xmlText = input.value.trim();
    if (!xmlText) { showError('\u8bf7\u8f93\u5165XML\u5185\u5bb9'); return; }
    try {
      const json = xmlToJson(xmlText);
      input.value = JSON.stringify(json, null, 2);
      doFormat(false);
      setStatus('\u5df2\u5c06XML\u8f6c\u6362\u4e3aJSON', true);
    } catch (e) {
      showError('XML\u89e3\u6790\u5931\u8d25: ' + e.message);
    }
  }

  function xmlToJson(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) throw new Error('XML\u683c\u5f0f\u65e0\u6548');
    return nodeToObj(doc.documentElement);
  }

  function nodeToObj(node) {
    const obj = {};
    if (node.attributes && node.attributes.length > 0) {
      obj['@attributes'] = {};
      for (let attr of node.attributes) { obj['@attributes'][attr.name] = attr.value; }
    }
    if (node.childNodes && node.childNodes.length > 0) {
      for (let child of node.childNodes) {
        if (child.nodeType === 1) {
          const childObj = nodeToObj(child);
          if (obj[child.nodeName]) {
            if (!Array.isArray(obj[child.nodeName])) { obj[child.nodeName] = [obj[child.nodeName]]; }
            obj[child.nodeName].push(childObj);
          } else { obj[child.nodeName] = childObj; }
        } else if (child.nodeType === 3) {
          const text = child.textContent.trim();
          if (text) {
            if (Object.keys(obj).length === 0) return parseXmlValue(text);
            obj['#text'] = parseXmlValue(text);
          }
        }
      }
    }
    return Object.keys(obj).length === 0 ? '' : obj;
  }

  function parseXmlValue(val) {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null') return null;
    if (/^-?\d+$/.test(val)) return parseInt(val, 10);
    if (/^-?\d*\.\d+$/.test(val)) return parseFloat(val);
    return val;
  }

  function filterHistory() {
    const query = ($('history-search') ? $('history-search').value : '').trim().toLowerCase();
    const items = historyList.querySelectorAll('.history-item');
    let visibleCount = 0;
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      const match = !query || text.includes(query);
      item.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    const countEl = $('history-search-count');
    if (countEl) { countEl.textContent = query ? visibleCount + '/' + items.length : ''; }
  }

  let files = [];
  let currentFileIndex = 0;

  function createNewFile() {
    files.push({ id: Date.now(), name: '\u672a\u547d\u540d ' + (files.length + 1), content: '' });
    currentFileIndex = files.length - 1;
    renderFileTabs();
    input.value = '';
    setStatus('\u5df2\u521b\u5efa\u65b0\u6587\u4ef6', true);
  }

  function switchToFile(index) {
    if (index === currentFileIndex) return;
    files[currentFileIndex].content = input.value;
    currentFileIndex = index;
    input.value = files[currentFileIndex].content;
    renderFileTabs();
    if (input.value.trim()) doFormat(false);
  }

  function closeFile(index, e) {
    e.stopPropagation();
    if (files.length <= 1) { showError('\u81f3\u5c11\u4fdd\u7559\u4e00\u4e2a\u6587\u4ef6'); return; }
    files.splice(index, 1);
    if (currentFileIndex >= files.length) currentFileIndex = files.length - 1;
    input.value = files[currentFileIndex].content;
    renderFileTabs();
    setStatus('\u5df2\u5173\u95ed\u6587\u4ef6', true);
  }

  function renderFileTabs() {
    const container = $('file-tabs');
    container.innerHTML = files.map((file, i) =>
      '<div class="file-tab ' + (i === currentFileIndex ? 'active' : '') + '" data-index="' + i + '">' +
      '<span class="file-tab-name">' + escapeHtml(file.name) + '</span>' +
      '<button class="file-tab-close" data-index="' + i + '">\u00d7</button></div>'
    ).join('');
    container.querySelectorAll('.file-tab').forEach(tab => tab.addEventListener('click', () => switchToFile(Number(tab.dataset.index))));
    container.querySelectorAll('.file-tab-close').forEach(btn => btn.addEventListener('click', (e) => closeFile(Number(btn.dataset.index), e)));
  }

  function validateWithSchema() {
    const schemaText = $('schema-input').value.trim();
    if (!schemaText) { showError('\u8bf7\u8f93\u5165 JSON Schema'); return; }
    if (!currentParsedValue) { showError('\u8bf7\u5148\u683c\u5f0f\u5316 JSON'); return; }
    try {
      const schema = JSON.parse(schemaText);
      const errors = validateSchema(currentParsedValue, schema);
      const resultEl = $('schema-result');
      if (errors.length === 0) {
        resultEl.className = 'schema-result success';
        resultEl.innerHTML = '\u2713 \u9a8c\u8bc1\u901a\u8fc7\uff1aJSON\u6570\u636e\u7b26\u5408Schema\u5b9a\u4e49';
      } else {
        resultEl.className = 'schema-result error';
        resultEl.innerHTML = '\u2717 \u9a8c\u8bc1\u5931\u8d25\uff1a\u53d1\u73b0 ' + errors.length + ' \u4e2a\u9519\u8bef<div class="schema-errors">' + errors.join('\n') + '</div>';
      }
      resultEl.classList.remove('hidden');
    } catch (e) { showError('Schema\u683c\u5f0f\u65e0\u6548: ' + e.message); }
  }

  function applyFontSize() {
    const fontSize = parseInt(localStorage.getItem('jsonFormatterFontSize') || '14', 10);
    document.documentElement.style.setProperty('--font-size', fontSize + 'px');
    if ($('font-size-display')) $('font-size-display').textContent = fontSize;
  }

  // --- Event Listeners ---

  $('btn-format').addEventListener('click', () => { if (checkFileSize()) doFormat(false); });
  $('btn-minify').addEventListener('click', () => { if (checkFileSize()) doFormat(true); });
  $('btn-validate').addEventListener('click', doValidate);
  $('btn-fix').addEventListener('click', () => { if (checkFileSize()) doFormat(false); });
  $('btn-copy').addEventListener('click', doCopy);
  $('btn-download').addEventListener('click', doDownload);
  $('btn-clear').addEventListener('click', doClear);
  $('btn-sample').addEventListener('click', doSample);
  $('btn-error-close').addEventListener('click', hideError);
  $('btn-search').addEventListener('click', toggleSearch);
  $('btn-share').addEventListener('click', showShareModal);
  $('btn-print').addEventListener('click', printJson);
  $('btn-shortcuts').addEventListener('click', showShortcuts);
  $('btn-new-file').addEventListener('click', createNewFile);
  $('btn-schema').addEventListener('click', showSchemaModal);
  $('btn-url-encode').addEventListener('click', urlEncode);
  $('btn-url-decode').addEventListener('click', urlDecode);
  $('btn-json2params').addEventListener('click', jsonToUrlParams);
  $('btn-hash').addEventListener('click', showHashModal);
  $('btn-http').addEventListener('click', showHttpModal);
  $('btn-export-pdf').addEventListener('click', exportToPDF);
  $('btn-pdf').addEventListener('click', showPdfModal);
  $('btn-timestamp').addEventListener('click', showTimestampModal);
  $('btn-export-md').addEventListener('click', exportToMarkdown);
  $('btn-export-csv').addEventListener('click', exportToCSV);
  $('btn-export-xlsx').addEventListener('click', exportToXlsx);
  $('btn-template').addEventListener('click', generateTemplate);
  $('btn-export-xml').addEventListener('click', exportToXML);
  $('btn-export-yaml').addEventListener('click', exportToYAML);
  $('btn-font-dec').addEventListener('click', () => changeFontSize(-1));
  $('btn-font-inc').addEventListener('click', () => changeFontSize(1));
  $('btn-import-yaml').addEventListener('click', importYaml);
  $('btn-import-xml').addEventListener('click', importXml);
  btnCompareToggle.addEventListener('click', toggleCompareMode);
  diffPrev.addEventListener('click', () => jumpToDiff(-1));
  diffNext.addEventListener('click', () => jumpToDiff(1));
  $('btn-copy-current-path').addEventListener('click', () => {
    navigator.clipboard.writeText($('current-path').textContent).then(() => setStatus('\u5df2\u590d\u5236\u8def\u5f84', true));
  });
  $('btn-escape').addEventListener('click', escapeString);
  $('btn-unescape').addEventListener('click', unescapeString);
  $('btn-unicode').addEventListener('click', unicodeConvert);
  $('btn-jsonpath').addEventListener('click', executeJsonPath);
  $('jsonpath-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') executeJsonPath(); });

  $('btn-history').addEventListener('click', showHistory);
  $('btn-history-close').addEventListener('click', hideHistory);
  if ($('btn-history-close-footer')) $('btn-history-close-footer').addEventListener('click', hideHistory);
  if ($('btn-history-clear')) $('btn-history-clear').addEventListener('click', () => { history = []; localStorage.removeItem('jsonHistory'); loadHistory(); setStatus('\u5df2\u6e05\u7a7a\u5386\u53f2', true); });
  historyModal.addEventListener('click', (e) => { if (e.target === historyModal) hideHistory(); });

  $('btn-share-close').addEventListener('click', hideShareModal);
  $('btn-close-share').addEventListener('click', hideShareModal);
  $('btn-copy-share').addEventListener('click', copyShareUrl);
  $('share-modal').addEventListener('click', (e) => { if (e.target === $('share-modal')) hideShareModal(); });

  $('btn-shortcuts-close').addEventListener('click', hideShortcuts);
  $('btn-close-shortcuts').addEventListener('click', hideShortcuts);
  shortcutsModal.addEventListener('click', (e) => { if (e.target === shortcutsModal) hideShortcuts(); });

  $('btn-schema-close').addEventListener('click', hideSchemaModal);
  $('btn-schema-close-footer').addEventListener('click', hideSchemaModal);

  $('btn-hash-close').addEventListener('click', hideHashModal);
  $('btn-hash-close-footer').addEventListener('click', hideHashModal);
  $('btn-hash-gen').addEventListener('click', generateHash);
  $('btn-hash-from-input').addEventListener('click', () => { $('hash-input').value = input.value; });
  $('hash-modal').addEventListener('click', (e) => { if (e.target === $('hash-modal')) hideHashModal(); });
  document.querySelectorAll('.hash-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = $(btn.dataset.target);
      navigator.clipboard.writeText(target.value).then(() => setStatus('\u5df2\u590d\u5236', true));
    });
  });

  $('btn-http-close').addEventListener('click', hideHttpModal);
  $('btn-http-close-footer').addEventListener('click', hideHttpModal);
  $('btn-http-send').addEventListener('click', sendHttpRequest);
  $('http-modal').addEventListener('click', (e) => { if (e.target === $('http-modal')) hideHttpModal(); });
  document.querySelectorAll('.http-tab').forEach(tab => {
    tab.addEventListener('click', () => switchHttpTab(tab.dataset.tab));
  });
  $('btn-http-copy-resp').addEventListener('click', () => {
    navigator.clipboard.writeText($('http-response-body').textContent).then(() => setStatus('\u5df2\u590d\u5236', true));
  });

  $('btn-java-close').addEventListener('click', hideJavaModal);
  $('btn-java-close-footer').addEventListener('click', hideJavaModal);
  $('btn-java-gen').addEventListener('click', generateJava);
  $('java-modal').addEventListener('click', (e) => { if (e.target === $('java-modal')) hideJavaModal(); });
  $('btn-java-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('java-output').value).then(() => setStatus('\u5df2\u590d\u5236Java\u4ee3\u7801', true));
  });
  $('btn-java-download').addEventListener('click', () => {
    const code = $('java-output').value;
    if (!code) { showError('\u8bf7\u5148\u751f\u6210Java\u4ee3\u7801'); return; }
    const className = $('java-classname').value.trim() || 'Root';
    const pkg = $('java-package').value.trim();
    const fileName = className + '.java';
    let content = code;
    if (pkg) {
      content = 'package ' + pkg + ';\n\n' + code;
    }
    downloadFile(content, fileName, 'text/plain');
    setStatus('\u5df2\u4e0b\u8f7d ' + fileName, true);
  });

  $('btn-sort-keys').addEventListener('click', sortByKeys);
  $('btn-sort-values').addEventListener('click', sortByValues);
  $('btn-beautify').addEventListener('click', beautifyJson);

  $('btn-qr').addEventListener('click', generateQR);
  $('btn-qr-close').addEventListener('click', () => $('qr-modal').classList.add('hidden'));
  $('btn-qr-close-footer').addEventListener('click', () => $('qr-modal').classList.add('hidden'));
  $('qr-modal').addEventListener('click', (e) => { if (e.target === $('qr-modal')) $('qr-modal').classList.add('hidden'); });
  $('btn-qr-gen').addEventListener('click', generateQR);
  $('btn-qr-download').addEventListener('click', () => {
    const canvas = $('qr-modal')._canvas;
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'qr-code.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatus('\u5df2\u4e0b\u8f7dQR\u7801', true);
    }
  });

  $('btn-compress').addEventListener('click', compressJson);
  $('btn-compress-close').addEventListener('click', () => $('compress-modal').classList.add('hidden'));
  $('btn-compress-close-footer').addEventListener('click', () => $('compress-modal').classList.add('hidden'));
  $('compress-modal').addEventListener('click', (e) => { if (e.target === $('compress-modal')) $('compress-modal').classList.add('hidden'); });
  $('btn-compress-gzip').addEventListener('click', gzipCompress);
  $('btn-decompress-gzip').addEventListener('click', gzipDecompress);
  $('btn-compress-base64').addEventListener('click', base64Compress);
  $('btn-compress-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('compress-output').value).then(() => setStatus('\u5df2\u590d\u5236', true));
  });
  $('btn-compress-swap').addEventListener('click', () => {
    $('compress-input').value = $('compress-output').value;
    $('compress-output').value = '';
  });

  $('btn-encrypt').addEventListener('click', showEncryptModal);
  $('btn-encrypt-close').addEventListener('click', () => $('encrypt-modal').classList.add('hidden'));
  $('btn-encrypt-close-footer').addEventListener('click', () => $('encrypt-modal').classList.add('hidden'));
  $('encrypt-modal').addEventListener('click', (e) => { if (e.target === $('encrypt-modal')) $('encrypt-modal').classList.add('hidden'); });
  $('btn-encrypt-enc').addEventListener('click', aesEncrypt);
  $('btn-encrypt-dec').addEventListener('click', aesDecrypt);
  $('btn-encrypt-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('encrypt-output').value).then(() => setStatus('\u5df2\u590d\u5236', true));
  });
  $('btn-encrypt-swap').addEventListener('click', () => {
    $('encrypt-input').value = $('encrypt-output').value;
    $('encrypt-output').value = '';
  });

  $('btn-chart').addEventListener('click', showChartModal);
  $('btn-chart-close').addEventListener('click', () => $('chart-modal').classList.add('hidden'));
  $('btn-chart-close-footer').addEventListener('click', () => $('chart-modal').classList.add('hidden'));
  $('chart-modal').addEventListener('click', (e) => { if (e.target === $('chart-modal')) $('chart-modal').classList.add('hidden'); });
  $('btn-chart-gen').addEventListener('click', generateChart);

  $('btn-svg').addEventListener('click', generateSvgFlow);
  $('btn-tree2').addEventListener('click', generateSvgTree);
  $('btn-svg-close').addEventListener('click', () => $('svg-modal').classList.add('hidden'));
  $('btn-svg-close-footer').addEventListener('click', () => $('svg-modal').classList.add('hidden'));
  $('svg-modal').addEventListener('click', (e) => { if (e.target === $('svg-modal')) $('svg-modal').classList.add('hidden'); });
  $('btn-svg-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('svg-modal')._svgCode || '').then(() => setStatus('\u5df2\u590d\u5236SVG\u4ee3\u7801', true));
  });
  $('btn-svg-download').addEventListener('click', () => {
    const svg = $('svg-modal')._svgCode;
    if (svg) { downloadFile('diagram.svg', svg, 'image/svg+xml'); setStatus('\u5df2\u4e0b\u8f7ddiagram.svg', true); }
  });

  /* 代码生成下拉菜单 */
  $('btn-code-gen').addEventListener('click', (e) => {
    e.stopPropagation();
    $('code-gen-picker').classList.toggle('hidden');
  });
  document.querySelectorAll('.code-gen-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const gen = item.dataset.gen;
      const genMap = { js: exportToJS, ts: generateTsType, tsif: generateTsInterface, java: generateJava, go: generateGo, python: generatePython, php: generatePhp, ruby: generateRuby, kotlin: generateKotlin, csharp: generateCSharp, rust: generateRust, swift: generateSwift, dart: generateDart, lua: generateLua, sql: generateSql, graphql: generateGraphQL, protobuf: generateProtobuf, zod: generateZod, openapi: generateOpenAPI, mock: generateMock, jsonl: generateJsonl };
      if (genMap[gen]) genMap[gen]();
      $('code-gen-picker').classList.add('hidden');
    });
  });
  document.addEventListener('click', () => { $('code-gen-picker').classList.add('hidden'); });
  $('btn-json2csv').addEventListener('click', jsonToCsv);
  $('btn-csv2json').addEventListener('click', csvToJson);
  $('btn-chinese2traditional').addEventListener('click', () => convertChinese(true));
  $('btn-chinese2simplified').addEventListener('click', () => convertChinese(false));

  $('btn-table-close').addEventListener('click', () => $('table-modal').classList.add('hidden'));
  $('btn-table-close-footer').addEventListener('click', () => $('table-modal').classList.add('hidden'));
  $('table-modal').addEventListener('click', (e) => { if (e.target === $('table-modal')) $('table-modal').classList.add('hidden'); });
  $('btn-table-copy-csv').addEventListener('click', () => {
    const csv = $('table-modal')._csvData;
    if (csv) navigator.clipboard.writeText(csv).then(() => setStatus('\u5df2\u590d\u5236CSV', true));
  });
  $('btn-table-download-csv').addEventListener('click', () => {
    const csv = $('table-modal')._csvData;
    if (csv) { downloadFile('data.csv', csv, 'text/csv'); setStatus('\u5df2\u4e0b\u8f7ddata.csv', true); }
  });
  $('btn-table-download-xlsx').addEventListener('click', () => {
    showError('\u8bf7\u4f7f\u7528CSV\u6587\u4ef6\u540e\u7528Excel\u6253\u5f00\u5e76\u53e6\u5b58\u4e3axlsx');
  });

  $('btn-json2html').addEventListener('click', jsonToHtml);
  $('btn-html-close').addEventListener('click', () => $('html-modal').classList.add('hidden'));
  $('btn-html-close-footer').addEventListener('click', () => $('html-modal').classList.add('hidden'));
  $('html-modal').addEventListener('click', (e) => { if (e.target === $('html-modal')) $('html-modal').classList.add('hidden'); });
  $('btn-html-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('html-output').value).then(() => setStatus('\u5df2\u590d\u5236HTML', true));
  });
  $('btn-html-download').addEventListener('click', () => {
    const html = $('html-output').value;
    if (html) { downloadFile('table.html', html, 'text/html'); setStatus('\u5df2\u4e0b\u8f7dtable.html', true); }
  });

  $('btn-analyzer').addEventListener('click', () => $('analyzer-modal').classList.remove('hidden'));
  $('btn-analyzer-close').addEventListener('click', () => $('analyzer-modal').classList.add('hidden'));
  $('btn-analyzer-close-footer').addEventListener('click', () => $('analyzer-modal').classList.add('hidden'));
  $('analyzer-modal').addEventListener('click', (e) => { if (e.target === $('analyzer-modal')) $('analyzer-modal').classList.add('hidden'); });
  $('btn-analyzer-run').addEventListener('click', analyzeJson);

  $('btn-filter').addEventListener('click', showFilterModal);
  $('btn-filter-close').addEventListener('click', () => $('filter-modal').classList.add('hidden'));
  $('btn-filter-close-footer').addEventListener('click', () => $('filter-modal').classList.add('hidden'));
  $('filter-modal').addEventListener('click', (e) => { if (e.target === $('filter-modal')) $('filter-modal').classList.add('hidden'); });
  $('btn-filter-run').addEventListener('click', runFilter);
  $('filter-mode').addEventListener('change', updateFilterInputs);
  $('btn-filter-to-input').addEventListener('click', () => {
    const val = $('filter-output').value;
    if (val) { input.value = val; $('filter-modal').classList.add('hidden'); setStatus('\u5df2\u53d1\u9001\u5230\u8f93\u5165\u6846', true); }
  });

  $('btn-regex').addEventListener('click', () => {
    $('regex-modal').classList.remove('hidden');
    $('regex-test-text').value = input.value.substring(0, 2000);
  });
  $('btn-regex-close').addEventListener('click', () => $('regex-modal').classList.add('hidden'));
  $('btn-regex-close-footer').addEventListener('click', () => $('regex-modal').classList.add('hidden'));
  $('regex-modal').addEventListener('click', (e) => { if (e.target === $('regex-modal')) $('regex-modal').classList.add('hidden'); });
  $('btn-regex-test').addEventListener('click', testRegex);

  $('btn-md2json').addEventListener('click', () => $('md2json-modal').classList.remove('hidden'));
  $('btn-md2json-close').addEventListener('click', () => $('md2json-modal').classList.add('hidden'));
  $('btn-md2json-close-footer').addEventListener('click', () => $('md2json-modal').classList.add('hidden'));
  $('md2json-modal').addEventListener('click', (e) => { if (e.target === $('md2json-modal')) $('md2json-modal').classList.add('hidden'); });
  $('btn-md2json-convert').addEventListener('click', mdTableToJson);
  $('btn-md2json-copy').addEventListener('click', () => {
    const val = $('md2json-output').value;
    if (val) { input.value = val; $('md2json-modal').classList.add('hidden'); setStatus('\u5df2\u590d\u5236\u5230\u8f93\u5165\u6846', true); }
  });

  $('btn-pdf-close').addEventListener('click', hidePdfModal);
  $('btn-pdf-close-footer').addEventListener('click', hidePdfModal);
  $('pdf-modal').addEventListener('click', (e) => { if (e.target === $('pdf-modal')) hidePdfModal(); });
  document.querySelectorAll('.pdf-tab').forEach(tab => {
    tab.addEventListener('click', () => switchPdfTab(tab.dataset.tab));
  });
  $('btn-pdf-copy').addEventListener('click', copyPdfText);
  $('btn-pdf-to-input').addEventListener('click', pdfToInput);
  $('btn-pdf-download').addEventListener('click', downloadPdfText);
  $('btn-pdf-reset').addEventListener('click', resetPdfModal);
  $('btn-pdf-tojson').addEventListener('click', pdfToJson);
  $('btn-pdf-json-copy').addEventListener('click', copyPdfJson);
  $('btn-pdf-json-to-input').addEventListener('click', pdfJsonToInput);
  $('btn-pdf-tomd').addEventListener('click', pdfToMarkdown);
  $('btn-pdf-md-copy').addEventListener('click', copyPdfMd);
  $('btn-pdf-md-download').addEventListener('click', downloadPdfMd);

  const pdfDropZone = $('pdf-drop-zone');
  const pdfFileInput = $('pdf-file-input');
  if (pdfDropZone && pdfFileInput) {
    pdfDropZone.addEventListener('click', () => pdfFileInput.click());
    pdfDropZone.addEventListener('dragover', (e) => { e.preventDefault(); pdfDropZone.classList.add('dragover'); });
    pdfDropZone.addEventListener('dragleave', () => { pdfDropZone.classList.remove('dragover'); });
    pdfDropZone.addEventListener('drop', (e) => { e.preventDefault(); pdfDropZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handlePdfFile(e.dataTransfer.files[0]); });
    pdfFileInput.addEventListener('change', (e) => { if (e.target.files[0]) handlePdfFile(e.target.files[0]); });
  }

  $('btn-timestamp-close').addEventListener('click', hideTimestampModal);
  $('btn-timestamp-close-footer').addEventListener('click', hideTimestampModal);
  $('btn-ts-to-date').addEventListener('click', tsToDate);
  $('btn-ts-to-stamp').addEventListener('click', dateToTs);
  $('btn-ts-now').addEventListener('click', fillNowDateTime);
  $('btn-ts-copy-now').addEventListener('click', copyCurrentTimestamp);
  $('timestamp-modal').addEventListener('click', (e) => { if (e.target === $('timestamp-modal')) hideTimestampModal(); });
  $('btn-schema-validate').addEventListener('click', validateWithSchema);
  $('schema-modal').addEventListener('click', (e) => { if (e.target === $('schema-modal')) hideSchemaModal(); });

  $('btn-base64-img').addEventListener('click', showBase64Modal);
  $('btn-base64-close').addEventListener('click', hideBase64Modal);
  $('btn-base64-close-footer').addEventListener('click', hideBase64Modal);
  $('btn-base64-copy').addEventListener('click', copyBase64);
  $('btn-base64-json').addEventListener('click', base64ToJson);
  $('btn-base64-reset').addEventListener('click', resetBase64Modal);
  if ($('base64-datauri')) $('base64-datauri').addEventListener('change', updateBase64Output);
  $('base64-modal').addEventListener('click', (e) => { if (e.target === $('base64-modal')) hideBase64Modal(); });

  const base64DropZone = $('base64-drop-zone');
  const base64FileInput = $('base64-file-input');
  if (base64DropZone && base64FileInput) {
    base64DropZone.addEventListener('click', () => base64FileInput.click());
    base64DropZone.addEventListener('dragover', (e) => { e.preventDefault(); base64DropZone.classList.add('dragover'); });
    base64DropZone.addEventListener('dragleave', () => { base64DropZone.classList.remove('dragover'); });
    base64DropZone.addEventListener('drop', (e) => { e.preventDefault(); base64DropZone.classList.remove('dragover'); const file = e.dataTransfer.files[0]; if (file) handleBase64File(file); });
    base64FileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) handleBase64File(file); });
  }

  $('btn-img-base64').addEventListener('click', showImgDecodeModal);
  $('btn-img-decode-close').addEventListener('click', hideImgDecodeModal);
  $('btn-img-decode-close-footer').addEventListener('click', hideImgDecodeModal);
  $('btn-img-decode-preview').addEventListener('click', decodeBase64ToImage);
  $('btn-img-decode-from-input').addEventListener('click', getBase64FromInput);
  $('btn-img-decode-download').addEventListener('click', downloadDecodedImage);
  $('btn-img-decode-copy-img').addEventListener('click', copyDecodedImage);
  $('img-decode-modal').addEventListener('click', (e) => { if (e.target === $('img-decode-modal')) hideImgDecodeModal(); });

  $('search-toggle-replace').addEventListener('click', toggleReplaceBar);
  $('btn-replace').addEventListener('click', replaceCurrent);
  $('btn-replace-all').addEventListener('click', replaceAllMatches);

  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      applyTheme(opt.dataset.theme);
      $('theme-picker').classList.add('hidden');
    });
  });

  $('btn-theme').addEventListener('click', (e) => {
    e.stopPropagation();
    $('theme-picker').classList.toggle('hidden');
  });

  document.addEventListener('click', () => { $('theme-picker').classList.add('hidden'); });

  let autoFormatTimer = null;
  if ($('chk-auto')) {
    $('chk-auto').addEventListener('change', (e) => {
      if (e.target.checked) {
        input.addEventListener('input', autoFormatHandler);
      } else {
        input.removeEventListener('input', autoFormatHandler);
      }
    });
  }

  function autoFormatHandler() {
    clearTimeout(autoFormatTimer);
    autoFormatTimer = setTimeout(() => {
      if ($('chk-auto') && $('chk-auto').checked && input.value.trim()) {
        doFormat(false);
      }
    }, 500);
  }

  const searchRegex = $('search-regex');
  if (searchRegex) searchRegex.addEventListener('change', performSearch);
  const historySearch = $('history-search');
  if (historySearch) historySearch.addEventListener('input', filterHistory);

  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      showShortcuts();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (checkFileSize()) doFormat(false);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      toggleSearch();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault();
      minifyJson();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      beautifyJson();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      sortByKeys();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      sortByValues();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
    }
    if (e.key === 'Escape') {
      if (!searchBar.classList.contains('hidden')) {
        toggleSearch();
      } else if (!$('history-modal').classList.contains('hidden')) {
        hideHistory();
      } else if (!$('share-modal').classList.contains('hidden')) {
        hideShareModal();
      } else if (!$('shortcuts-modal').classList.contains('hidden')) {
        hideShortcuts();
      } else if (!$('schema-modal').classList.contains('hidden')) {
        hideSchemaModal();
      } else if (!$('base64-modal').classList.contains('hidden')) {
        hideBase64Modal();
      } else if (!$('img-decode-modal').classList.contains('hidden')) {
        hideImgDecodeModal();
      } else if (!$('timestamp-modal').classList.contains('hidden')) {
        hideTimestampModal();
      } else if (!$('pdf-modal').classList.contains('hidden')) {
        hidePdfModal();
      } else if (!$('hash-modal').classList.contains('hidden')) {
        hideHashModal();
      } else if (!$('http-modal').classList.contains('hidden')) {
        hideHttpModal();
      } else if (!$('java-modal').classList.contains('hidden')) {
        hideJavaModal();
      } else if (!$('table-modal').classList.contains('hidden')) {
        $('table-modal').classList.add('hidden');
      } else if (!$('html-modal').classList.contains('hidden')) {
        $('html-modal').classList.add('hidden');
      } else if (!$('analyzer-modal').classList.contains('hidden')) {
        $('analyzer-modal').classList.add('hidden');
      } else if (!$('filter-modal').classList.contains('hidden')) {
        $('filter-modal').classList.add('hidden');
      } else if (!$('regex-modal').classList.contains('hidden')) {
        $('regex-modal').classList.add('hidden');
      } else if (!$('md2json-modal').classList.contains('hidden')) {
        $('md2json-modal').classList.add('hidden');
      } else if (!$('qr-modal').classList.contains('hidden')) {
        $('qr-modal').classList.add('hidden');
      } else if (!$('compress-modal').classList.contains('hidden')) {
        $('compress-modal').classList.add('hidden');
      } else if (!$('encrypt-modal').classList.contains('hidden')) {
        $('encrypt-modal').classList.add('hidden');
      } else if (!$('chart-modal').classList.contains('hidden')) {
        $('chart-modal').classList.add('hidden');
      } else if (!$('svg-modal').classList.contains('hidden')) {
        $('svg-modal').classList.add('hidden');
      }
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.substring(0, start) + '  ' + input.value.substring(end);
      input.selectionStart = input.selectionEnd = start + 2;
    }
  });

  input.addEventListener('input', () => {
    undoStack.push(lastResultText);
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  });

  if ($('search-prev')) $('search-prev').addEventListener('click', () => jumpSearch(-1));
  if ($('search-next')) $('search-next').addEventListener('click', () => jumpSearch(1));
  if ($('search-close')) $('search-close').addEventListener('click', () => { toggleSearch(); clearSearch(); });
  if (searchInput) searchInput.addEventListener('input', performSearch);
  if (searchInput) searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jumpSearch(e.shiftKey ? -1 : 1);
  });

  tree.addEventListener('click', (e) => {
    const toggle = e.target.closest('.tree-toggle');
    if (toggle) {
      const id = toggle.dataset.id;
      const ul = document.getElementById(id);
      if (ul) {
        ul.classList.toggle('collapsed');
        toggle.textContent = ul.classList.contains('collapsed') ? '\u25b6' : '\u25bc';
      }
    }
    const path = e.target.closest('.tree-path');
    if (path) {
      const pathText = path.getAttribute('title') || path.textContent;
      navigator.clipboard.writeText(pathText).then(() => setStatus('\u8def\u5f84\u5df2\u590d\u5236: ' + pathText, true));
    }
  });

  $('btn-copy-path').addEventListener('click', () => {
    const path = $('current-path').textContent;
    navigator.clipboard.writeText(path).then(() => setStatus('\u8def\u5f84\u5df2\u590d\u5236', true));
  });

  $('tree-expand-all').addEventListener('click', () => {
    tree.querySelectorAll('ul').forEach(ul => ul.classList.remove('collapsed'));
    tree.querySelectorAll('.tree-toggle').forEach(t => t.textContent = '\u25bc');
  });

  $('tree-collapse-all').addEventListener('click', () => {
    tree.querySelectorAll('ul').forEach(ul => ul.classList.add('collapsed'));
    tree.querySelectorAll('.tree-toggle').forEach(t => t.textContent = '\u25b6');
  });

  if (treeSearch) {
    treeSearch.addEventListener('input', () => {
      const query = treeSearch.value.trim().toLowerCase();
      treeSearchMatches = [];
      if (!query) {
        tree.querySelectorAll('.tree-search-highlight').forEach(el => el.classList.remove('tree-search-highlight'));
        treeSearchCount.textContent = '';
        return;
      }
      const nodes = tree.querySelectorAll('.json-key, .json-string, .json-number, .json-boolean, .json-null');
      nodes.forEach(node => {
        if (node.textContent.toLowerCase().includes(query)) {
          node.classList.add('tree-search-highlight');
          treeSearchMatches.push(node);
        } else {
          node.classList.remove('tree-search-highlight');
        }
      });
      treeSearchIndex = treeSearchMatches.length > 0 ? 0 : -1;
      treeSearchCount.textContent = treeSearchMatches.length > 0 ? (treeSearchIndex + 1) + ' / ' + treeSearchMatches.length : (query ? '\u65e0\u7ed3\u679c' : '');
      if (treeSearchMatches[0]) treeSearchMatches[0].scrollIntoView({ block: 'center' });
    });
  }

  let historyScrollTop = 0;
  let lastPath = '$';

  output.addEventListener('mouseover', (e) => {
    const rect = output.getBoundingClientRect();
    const y = e.clientY - rect.top + output.scrollTop;
    const lineHeight = parseFloat(getComputedStyle(output).lineHeight);
    const lineIndex = Math.floor(y / lineHeight);
    const lines = lastResultText.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const lineText = lines[lineIndex].trim();
      const keyMatch = lineText.match(/^"([^"]+)"\s*:/);
      if (keyMatch) {
        currentPath.textContent = lastPath + '.' + keyMatch[1];
      }
    }
  });

  output.addEventListener('scroll', () => {
    lineNumbers.scrollTop = output.scrollTop;
  });

  // Drag and drop
  input.addEventListener('dragover', (e) => { e.preventDefault(); input.style.borderColor = 'var(--accent)'; });
  input.addEventListener('dragleave', () => { input.style.borderColor = ''; });
  input.addEventListener('drop', (e) => {
    e.preventDefault();
    input.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        input.value = ev.target.result;
        doFormat(false);
        setStatus('\u5df2\u52a0\u8f7d\u6587\u4ef6: ' + file.name, true);
      };
      reader.readAsText(file);
    }
  });

  const outputPanel = document.querySelector('.panel-output');
  outputPanel.addEventListener('dragover', (e) => { e.preventDefault(); outputPanel.style.borderColor = 'var(--accent)'; });
  outputPanel.addEventListener('dragleave', () => { outputPanel.style.borderColor = ''; });
  outputPanel.addEventListener('drop', (e) => {
    e.preventDefault();
    outputPanel.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        inputRight.value = ev.target.result;
        if (!compareMode) toggleCompareMode();
        doCompare();
        setStatus('\u5df2\u52a0\u8f7d\u6bd4\u5bf9\u6587\u4ef6: ' + file.name, true);
      };
      reader.readAsText(file);
    }
  });

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      const viewId = 'view-' + tab.id.replace('tab-', '');
      const viewEl = document.getElementById(viewId);
      if (viewEl) viewEl.classList.add('active');
    });
  });

  // --- Init ---
  files = [{ id: Date.now(), name: '\u672a\u547d\u540d 1', content: '' }];
  renderFileTabs();
  applyFontSize();
  loadTheme();
  loadFromUrl();
  setStatus('\u5c31\u7eea \xb7 \u7c98\u8d34 JSON \u540e\u70b9\u51fb\u201c\u683c\u5f0f\u5316\u201d\u6216\u6309 Ctrl+Enter');
})();
