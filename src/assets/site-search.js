(function () {
  'use strict';
  var form = document.getElementById('site-search-form');
  var input = document.getElementById('site-search-input');
  var results = document.getElementById('site-search-results');
  var status = document.getElementById('site-search-status');
  if (!form || !input || !results || !status) return;
  var index = [];
  var stop = /^(about|after|also|and|are|can|does|for|from|how|into|its|not|of|on|or|that|the|this|to|what|when|where|which|with|your)$/i;
  function esc(value) { return String(value || '').replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function terms(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(function (x) { return x.length > 1 && !stop.test(x); }); }
  function score(row, query) {
    var hay = (row.title + ' ' + row.description + ' ' + row.text).toLowerCase();
    var title = row.title.toLowerCase(); var score = 0;
    terms(query).forEach(function (term) {
      if (title.indexOf(term) >= 0) score += 12;
      if (row.description.toLowerCase().indexOf(term) >= 0) score += 6;
      if (hay.indexOf(term) >= 0) score += 2;
      if (term === 'dst' && /delaware statutory trust/.test(hay)) score += 5;
      if (term === '1031' && /like kind|replacement property/.test(hay)) score += 5;
    });
    return score;
  }
  function render(query) {
    var q = String(query || '').trim();
    if (!q) { results.innerHTML = ''; status.textContent = index.length + ' pages available to search.'; return; }
    var ranked = index.map(function (row) { return { row: row, score: score(row, q) }; }).filter(function (item) { return item.score > 0; }).sort(function (a, b) { return b.score - a.score || a.row.title.localeCompare(b.row.title); }).slice(0, 30);
    status.textContent = ranked.length + ' result' + (ranked.length === 1 ? '' : 's') + ' for “' + q + '”.';
    results.innerHTML = ranked.length ? ranked.map(function (item) { return '<article class="search-result"><h2><a href="' + esc(item.row.url) + '">' + esc(item.row.title) + '</a></h2><p>' + esc(item.row.description || item.row.text.slice(0, 260)) + '</p></article>'; }).join('') : '<p>No matching pages found. Try “1031,” “DST,” “calculator,” or a sponsor or property type.</p>';
  }
  fetch('/search-index.json', { credentials: 'same-origin' }).then(function (response) { if (!response.ok) throw new Error('search index unavailable'); return response.json(); }).then(function (data) {
    index = Array.isArray(data) ? data : [];
    var query = new URLSearchParams(location.search).get('q') || '';
    input.value = query; render(query);
  }).catch(function () { status.textContent = 'Search is temporarily unavailable. Browse the Resources and Insights sections instead.'; });
  form.addEventListener('submit', function (event) { event.preventDefault(); var q = input.value.trim(); history.replaceState(null, '', q ? '?q=' + encodeURIComponent(q) : location.pathname); render(q); if (window.b1031Analytics) window.b1031Analytics.track('site_search', { search_term: q, results_count: index.filter(function (row) { return score(row, q) > 0; }).length }); });
}());
