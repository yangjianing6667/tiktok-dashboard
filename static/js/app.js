(function () {
  /* ---------- CONFIG ---------- */
  const API_BASE = '';
  const DONUT_COLORS = ['#4FACFE', '#00F2FE', '#38BDF8', '#0EA5E9', '#0284C7'];
  const GENRE_HUES = {
    'Werewolf Alpha': 'rgba(79,172,254,0.15)',
    'Vampire': 'rgba(220,38,38,0.15)',
    'Billionaire': 'rgba(96,165,250,0.15)',
    'Mafia': 'rgba(168,85,247,0.15)',
    'Contract Marriage': 'rgba(34,211,238,0.15)',
    'Revenge': 'rgba(245,87,108,0.15)',
    'Secret Baby': 'rgba(250,204,21,0.15)',
    'Forbidden Love': 'rgba(240,147,251,0.15)',
    'Rebirth': 'rgba(45,212,191,0.15)',
    'Amnesia': 'rgba(148,163,184,0.15)',
    'Fake Heiress': 'rgba(251,146,60,0.15)',
    'Divorce': 'rgba(244,114,182,0.15)',
    'Witch': 'rgba(139,92,246,0.15)',
    'Mermaid': 'rgba(52,211,153,0.15)',
    'AI Lover': 'rgba(236,72,153,0.15)',
    'Royal Romance': 'rgba(251,191,36,0.15)',
    'Supernatural': 'rgba(99,102,241,0.15)'
  };

  /* ---------- STATE ---------- */
  let currentRegion = 'us';
  let currentRange = 'today';
  let activeGenres = new Set();
  let sortKey = null;
  let sortDir = 'desc';
  let searchTerm = '';
  let currentPage = 1;
  const PAGE_SIZE = 10;
  let allData = null;
  let heatmapData = null;
  let donutChartInst = null;
  let barChartInst = null;

  /* ---------- UTILS ---------- */
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  function formatNumber(n, decimals) {
    if (decimals > 0) return n.toFixed(decimals);
    return Math.round(n).toLocaleString('en-US');
  }

  /* ---------- API ---------- */
  async function fetchData() {
    try {
      const res = await fetch(`${API_BASE}/api/data?region=${currentRegion}&range=${currentRange}`);
      if (!res.ok) throw new Error('Network error');
      allData = await res.json();
      const genres = Array.from(new Set(allData.table.flatMap(r => r.genres)));
      if (activeGenres.size === 0) genres.forEach(g => activeGenres.add(g));
      return allData;
    } catch (e) {
      showToast('数据加载失败，请刷新重试');
      console.error(e);
      return null;
    }
  }

  async function fetchHeatmap() {
    try {
      const res = await fetch(`${API_BASE}/api/heatmap?region=${currentRegion}`);
      if (!res.ok) throw new Error('Network error');
      heatmapData = await res.json();
      return heatmapData;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async function fetchAnalysis() {
    try {
      const btn = document.getElementById('refreshAnalysis');
      if (btn) btn.disabled = true;
      const res = await fetch(`${API_BASE}/api/analyze?region=${currentRegion}`);
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      if (btn) btn.disabled = false;
      return data;
    } catch (e) {
      showToast('分析加载失败');
      console.error(e);
      return null;
    }
  }

  /* ---------- KPI COUNTER ANIMATION ---------- */
  function animateKpis() {
    if (!allData) return;
    const kpis = allData.kpis;
    document.querySelectorAll('[data-kpi]').forEach(el => {
      const key = el.getAttribute('data-kpi');
      const target = kpis[key];
      if (target === undefined) return;
      const suffix = el.getAttribute('data-suffix') || '';
      const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      const duration = 900;
      const start = performance.now();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { el.textContent = formatNumber(target, decimals) + suffix; return; }
      function step(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = formatNumber(target * eased, decimals) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* ---------- GENRE FILTER UI ---------- */
  function renderGenreFilter() {
    const wrap = document.getElementById('genreFilter');
    if (!wrap || !allData) return;
    const genres = Array.from(new Set(allData.table.flatMap(r => r.genres)));
    wrap.innerHTML = '';
    genres.forEach(g => {
      const lbl = document.createElement('label');
      lbl.className = 'capsule' + (activeGenres.has(g) ? ' checked' : '');
      lbl.innerHTML = '<input type="checkbox" ' + (activeGenres.has(g) ? 'checked' : '') + '><span>' + g + '</span>';
      lbl.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) activeGenres.add(g); else activeGenres.delete(g);
        lbl.classList.toggle('checked', e.target.checked);
        currentPage = 1;
        renderTable();
      });
      wrap.appendChild(lbl);
    });
  }

  /* ---------- CHARTS (Chart.js) ---------- */
  function renderDonutChart() {
    const ctx = document.getElementById('donutChartCanvas');
    if (!ctx || !allData) return;
    if (donutChartInst) { donutChartInst.destroy(); }
    const data = allData.mature;
    donutChartInst = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: DONUT_COLORS,
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(8,12,20,0.95)',
            borderColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            titleColor: '#E8ECF4',
            bodyColor: '#E8ECF4',
            callbacks: {
              label: (item) => ' ' + item.label + ': ' + item.raw + '%'
            }
          }
        }
      },
      plugins: [{
        id: 'centerText',
        afterDraw: (chart) => {
          const { width, ctx } = chart;
          const area = chart.chartArea;
          if (!area) return;
          const cx = (area.left + area.right) / 2;
          const cy = (area.top + area.bottom) / 2;
          ctx.save();
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#E8ECF4';
          ctx.fillText('68%', cx, cy - 10);
          ctx.font = '11px sans-serif';
          ctx.fillStyle = 'rgba(232,236,244,0.55)';
          ctx.fillText('稳态占比', cx, cy + 12);
          ctx.restore();
        }
      }]
    });
  }

  function renderDonutLegend() {
    if (!allData) return;
    const data = allData.mature;
    const wrap = document.getElementById('donutLegend');
    if (!wrap) return;
    wrap.innerHTML = data.map((d, i) =>
      '<div class="legend-row"><span class="legend-dot" style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + ';"></span>' + d.name + '<span style="margin-left:auto;color:var(--c-ink);font-weight:600;">' + d.value + '%</span></div>'
    ).join('');
  }

  function renderBarChart() {
    const ctx = document.getElementById('barChartCanvas');
    if (!ctx || !allData) return;
    if (barChartInst) { barChartInst.destroy(); }
    const data = allData.emerging.map(d => ({ ...d })).sort((a, b) => b.growth - a.growth);
    barChartInst = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          data: data.map(d => d.growth),
          backgroundColor: data.map((_, i) => {
            const t = i / Math.max(data.length - 1, 1);
            const r = Math.round(240 + (245 - 240) * t);
            const g = Math.round(147 + (87 - 147) * t);
            const b = Math.round(251 + (108 - 251) * t);
            return 'rgba(' + r + ',' + g + ',' + b + ',0.9)';
          }),
          borderRadius: 6,
          barThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { display: false, grid: { display: false } },
          y: {
            grid: { display: false },
            ticks: { color: 'rgba(232,236,244,0.75)', font: { size: 12 } },
            border: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(8,12,20,0.95)',
            borderColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            titleColor: '#E8ECF4',
            bodyColor: '#E8ECF4',
            callbacks: {
              label: (item) => ' 增速: +' + item.raw + '%'
            }
          }
        }
      }
    });
  }

  function renderCharts() {
    renderDonutChart();
    renderDonutLegend();
    renderBarChart();
  }

  /* ---------- HEATMAP ---------- */
  function renderHeatmap() {
    const wrap = document.getElementById('heatmap');
    if (!wrap || !heatmapData) return;
    const { buckets, matrix } = heatmapData;
    const maxVal = Math.max(...matrix.flatMap(r => r.values));
    const minVal = Math.min(...matrix.flatMap(r => r.values));
    const range = maxVal - minVal || 1;

    function colorFor(v) {
      const t = (v - minVal) / range;
      const r = Math.round(79 + (245 - 79) * t);
      const g = Math.round(172 + (87 - 172) * t);
      const b = Math.round(254 + (108 - 254) * t);
      return `rgba(${r},${g},${b},${0.2 + t * 0.7})`;
    }

    let html = '<div class="heatmap-grid" style="grid-template-columns: auto repeat(' + buckets.length + ', 1fr); min-width: 480px;">';
    html += '<div style="padding: 6px 8px; font-size: 11px; color: var(--c-ink-3); font-weight: 600;">题材 / 时段</div>';
    buckets.forEach(b => {
      html += '<div style="padding: 6px 4px; font-size: 11px; color: var(--c-ink-3); text-align: center; font-weight: 500;">' + b + '</div>';
    });
    matrix.forEach(row => {
      html += '<div style="padding: 6px 8px; font-size: 11px; color: var(--c-ink-2); font-weight: 500; white-space: nowrap;">' + row.genre + '</div>';
      row.values.forEach(v => {
        html += '<div class="heatmap-cell" style="background: ' + colorFor(v) + '; height: 32px;" title="' + row.genre + ' ' + v + '">' + v + '</div>';
      });
    });
    html += '</div>';
    wrap.innerHTML = html;
  }

  /* ---------- INSIGHTS ---------- */
  function renderInsights(data) {
    const box = document.getElementById('insightsBox');
    const list = document.getElementById('insightsList');
    if (!box || !list || !data || !data.insights) return;
    list.innerHTML = data.insights.map(i => '<li>' + i + '</li>').join('');
    box.style.display = 'block';
  }

  /* ---------- TABLE ---------- */
  function completionColor(r) {
    if (r >= 0.7) return 'linear-gradient(90deg,#34D399,#10B981)';
    if (r >= 0.5) return 'linear-gradient(90deg,#FBBF24,#F59E0B)';
    return 'linear-gradient(90deg,#F87171,#EF4444)';
  }

  function getFilteredSorted() {
    if (!allData) return [];
    let rows = allData.table.slice();
    if (activeGenres.size > 0) {
      rows = rows.filter(r => r.genres.some(g => activeGenres.has(g)));
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(r => r.title.toLowerCase().includes(q));
    }
    if (sortKey) {
      rows.sort((a, b) => {
        return (a[sortKey] - b[sortKey]) * (sortDir === 'asc' ? 1 : -1);
      });
    } else {
      rows.sort((a, b) => a.rank - b.rank);
    }
    return rows;
  }

  function renderTable() {
    const rows = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageRows = rows.slice(startIdx, startIdx + PAGE_SIZE);

    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    if (pageRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--c-ink-3);padding:40px;">无匹配剧集</td></tr>';
    } else {
      tbody.innerHTML = pageRows.map((r, i) => {
        const displayRank = sortKey ? (startIdx + i + 1) : r.rank;
        const tags = r.genres.map(g => '<span class="tag-pill" style="background:' + (GENRE_HUES[g] || 'rgba(255,255,255,0.08)') + ';color:var(--c-ink);">' + g + '</span>').join(' ');
        const pct = Math.round(r.completion * 100);
        return '<tr>' +
          '<td style="color:var(--c-ink-2);font-variant-numeric:tabular-nums;">#' + displayRank + '</td>' +
          '<td><div style="display:flex;align-items:center;gap:12px;"><span class="thumb"><i data-lucide="film"></i></span><span style="font-weight:500;">' + r.title + '</span></div></td>' +
          '<td><div style="display:flex;gap:6px;flex-wrap:wrap;">' + tags + '</div></td>' +
          '<td style="font-variant-numeric:tabular-nums;font-weight:600;">' + r.vv.toFixed(1) + 'W</td>' +
          '<td><div style="display:flex;align-items:center;gap:10px;"><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;background:' + completionColor(r.completion) + ';"></div></div><span style="font-size:12px;color:var(--c-ink-2);min-width:34px;">' + pct + '%</span></div></td>' +
          '<td style="color:var(--c-ink-2);font-size:12px;">' + r.updated + '</td>' +
          '</tr>';
      }).join('');
    }

    const pag = document.getElementById('pagination');
    if (!pag) return;
    let btns = '';
    btns += '<button class="page-btn" ' + (currentPage === 1 ? 'disabled' : '') + ' data-page="prev"><i data-lucide="chevron-left" class="lucide-wrp"></i></button>';
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)) {
        btns += '<button class="page-btn ' + (p === currentPage ? 'active' : '') + '" data-page="' + p + '">' + p + '</button>';
      } else if (p === currentPage - 3 || p === currentPage + 3) {
        btns += '<span style="color:var(--c-ink-3);font-size:12px;padding:0 4px;">...</span>';
      }
    }
    btns += '<button class="page-btn" ' + (currentPage === totalPages ? 'disabled' : '') + ' data-page="next"><i data-lucide="chevron-right" class="lucide-wrp"></i></button>';
    pag.innerHTML = '<div style="font-size:12px;color:var(--c-ink-3);">共 ' + rows.length + ' 条 · 第 ' + currentPage + '/' + totalPages + ' 页</div><div style="display:flex;gap:6px;align-items:center;">' + btns + '</div>';

    pag.querySelectorAll('.page-btn').forEach(b => {
      b.addEventListener('click', () => {
        const p = b.getAttribute('data-page');
        if (p === 'prev') currentPage = Math.max(1, currentPage - 1);
        else if (p === 'next') currentPage = Math.min(totalPages, currentPage + 1);
        else currentPage = parseInt(p, 10);
        renderTable();
        lucide.createIcons();
      });
    });

    document.querySelectorAll('.th-sort').forEach(th => {
      th.classList.toggle('active', th.getAttribute('data-sort') === sortKey);
      const ic = th.querySelector('i');
      if (ic) {
        if (th.getAttribute('data-sort') === sortKey) {
          ic.setAttribute('data-lucide', sortDir === 'asc' ? 'chevron-up' : 'chevron-down');
        } else {
          ic.setAttribute('data-lucide', 'chevrons-up-down');
        }
      }
    });

    lucide.createIcons();
  }

  /* ---------- EVENT WIRING ---------- */
  function bindEvents() {
    document.getElementById('regionSeg').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      document.querySelectorAll('#regionSeg button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRegion = btn.getAttribute('data-region');
      currentPage = 1;
      activeGenres.clear();
      loadAll();
    });

    document.getElementById('timeSeg').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      document.querySelectorAll('#timeSeg button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.getAttribute('data-range');
      currentPage = 1;
      loadAll();
    });

    document.getElementById('tableSearch').addEventListener('input', (e) => {
      searchTerm = e.target.value;
      currentPage = 1;
      renderTable();
    });

    document.querySelectorAll('.th-sort').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (sortKey === key) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortKey = key;
          sortDir = 'desc';
        }
        currentPage = 1;
        renderTable();
      });
    });

    document.getElementById('refreshAnalysis').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const ic = btn.querySelector('i');
      if (ic) {
        ic.style.transition = 'transform 0.8s';
        ic.style.transform = 'rotate(360deg)';
        setTimeout(() => { ic.style.transition = 'none'; ic.style.transform = 'rotate(0deg)'; }, 800);
      }
      const data = await fetchAnalysis();
      if (data) {
        renderInsights(data);
        showToast('DeepSeek 分析已更新');
      }
    });

    document.getElementById('exportCsv').addEventListener('click', () => {
      window.open(`${API_BASE}/api/export?region=${currentRegion}&range=${currentRange}`, '_blank');
    });
  }

  /* ---------- MASTER LOAD ---------- */
  async function loadAll() {
    showToast('正在加载数据...');
    await fetchData();
    if (allData) {
      document.getElementById('lastUpdated').textContent = '最后更新: ' + allData.lastUpdated;
      renderGenreFilter();
      animateKpis();
      renderCharts();
      renderTable();
    }
    await fetchHeatmap();
    renderHeatmap();
    const analysis = await fetchAnalysis();
    if (analysis) renderInsights(analysis);
    showToast('数据加载完成');
  }

  /* ---------- INIT ---------- */
  bindEvents();
  loadAll();
})();
