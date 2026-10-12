/*
 * 업무처리(보관함) 리스트
 * 검색·필터·정렬·페이지 나눔은 서버(GET /api/works)가 처리합니다.
 */
(function () {
  const $ = s => document.querySelector(s);
  const esc = Common.esc;
  const PAGE_SIZE = 8;
  const STATUS = Common.STATUS;
  const ST_COLOR = ['#2458A6', '#5B3E96', '#2B7442', '#B22B2B'];
  const st = { q: '', status: '전체', welfare: '전체', from: '', to: '', sort: 'recent', page: 1 };
  let rows = [];
  let openMenuId = null;
  let loadSeq = 0;

  $('#f-status').innerHTML = ['전체', ...STATUS].map(s => `<option value="${s}">${s === '전체' ? '업무현황 전체' : s}</option>`).join('');
  $('#f-welfare').innerHTML = ['전체', ...Common.WELFARE].map(s => `<option value="${s}">${s === '전체' ? '복지 전체' : s}</option>`).join('');

  function renderStats(summary) {
    const cards = [{ key: '전체', n: summary.total, color: '#1E3A5F' }]
      .concat(STATUS.map((s, i) => ({ key: s, n: summary.byStatus[s] || 0, color: ST_COLOR[i] })));
    $('#stats').innerHTML = cards.map(c => `
      <button type="button" class="stat ${st.status === c.key ? 'active' : ''}" data-status="${c.key}">
        <span><i class="dot" style="background:${c.color}"></i>${c.key}</span>
        <strong>${c.n}<small>건</small></strong>
      </button>`).join('');
    const cnt = document.getElementById('gnb-count');
    if (cnt) cnt.textContent = summary.total;
  }

  function renderRows() {
    $('#rows').innerHTML = rows.length ? rows.map(w => `
      <tr>
        <td class="name">${esc(w.name)}</td>
        <td class="addr">${esc(w.address)}</td>
        <td><span class="st-chip st-${STATUS.indexOf(w.status)}">${esc(w.status)}</span></td>
        <td class="time">${Common.fmtDate(w.updatedAt)}</td>
        <td class="col-more">
          <button class="more-btn" data-more="${esc(w.id)}" aria-haspopup="menu" aria-expanded="${openMenuId === w.id}" aria-label="${esc(w.name)} 메뉴">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg>
          </button>
          ${openMenuId === w.id ? `
          <div class="menu" role="menu">
            <button role="menuitem" data-copy="${esc(w.id)}">내용 복사</button>
            <button role="menuitem" class="danger" data-del="${esc(w.id)}">항목 삭제</button>
          </div>` : ''}
        </td>
      </tr>`).join('')
      : '<tr class="empty-row"><td colspan="5">조건에 맞는 업무가 없습니다. 검색어나 조회 조건을 바꾸거나, 지도에서 새 분석을 시작하세요.</td></tr>';
  }

  function renderPager(page) {
    const nums = Array.from({ length: page.totalPages }, (_, i) => i + 1)
      .map(p => `<button data-page="${p}" class="${p === page.page ? 'cur' : ''}" aria-current="${p === page.page ? 'page' : 'false'}">${p}</button>`).join('');
    $('#pager').innerHTML = `
      <button data-page="${page.page - 1}" ${page.page <= 1 ? 'disabled' : ''} aria-label="이전 페이지">&lt;</button>
      ${nums}
      <button data-page="${page.page + 1}" ${page.page >= page.totalPages ? 'disabled' : ''} aria-label="다음 페이지">&gt;</button>`;
    $('#pager-total').textContent = `총 ${page.totalElements}건 · ${page.page}/${page.totalPages} 페이지`;
  }

  async function load() {
    const seq = ++loadSeq;
    openMenuId = null;
    try {
      const [page, summary] = await Promise.all([
        Common.Works.search({
          q: st.q,
          status: st.status === '전체' ? '' : st.status,
          welfare: st.welfare === '전체' ? '' : st.welfare,
          from: st.from, to: st.to, sort: st.sort,
          page: st.page, size: PAGE_SIZE
        }),
        Common.Works.summary()
      ]);
      if (seq !== loadSeq) return;
      st.page = page.page;
      rows = page.content;
      renderStats(summary);
      renderRows();
      renderPager(page);
    } catch (err) {
      Common.toast(err.message);
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  }
  function workText(w) {
    return [
      `[주거환경 취약요인 업무] ${w.name}`,
      `주소: ${w.address}`,
      w.jibunAddress ? `지번: ${w.jibunAddress}` : '',
      `업무 현황: ${w.status}`,
      `복지 분류: ${w.welfare}`,
      `취약요인(${w.factorCount}개): ${(w.factors || []).join(', ') || '-'}`,
      `메모: ${w.memo || '-'}`,
      `마지막 수정: ${Common.fmtDate(w.updatedAt)}`
    ].filter(Boolean).join('\n');
  }

  /* ---------- 이벤트 ---------- */
  $('#stats').addEventListener('click', e => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    st.status = b.dataset.status; st.page = 1;
    $('#f-status').value = st.status;
    load();
  });
  const doSearch = () => { st.q = $('#f-q').value.trim(); st.page = 1; load(); };
  $('#f-search').addEventListener('click', doSearch);
  $('#f-q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) doSearch(); });
  $('#f-status').addEventListener('change', e => { st.status = e.target.value; st.page = 1; load(); });
  $('#f-welfare').addEventListener('change', e => { st.welfare = e.target.value; st.page = 1; load(); });
  $('#f-from').addEventListener('change', e => { st.from = e.target.value; st.page = 1; load(); });
  $('#f-to').addEventListener('change', e => { st.to = e.target.value; st.page = 1; load(); });
  $('#f-sort').addEventListener('change', e => { st.sort = e.target.value; st.page = 1; load(); });

  $('#pager').addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    st.page = Number(b.dataset.page);
    load();
  });

  $('#rows').addEventListener('click', async e => {
    const more = e.target.closest('[data-more]');
    const copy = e.target.closest('[data-copy]');
    const del = e.target.closest('[data-del]');
    if (more) {
      openMenuId = openMenuId === more.dataset.more ? null : more.dataset.more;
      renderRows();
    } else if (copy) {
      const w = rows.find(x => x.id === copy.dataset.copy);
      openMenuId = null; renderRows();
      if (w) copyText(workText(w)).then(() => Common.toast('업무 내용을 복사했습니다.'), () => Common.toast('복사하지 못했습니다. 브라우저 권한을 확인하세요.'));
    } else if (del) {
      const w = rows.find(x => x.id === del.dataset.del);
      openMenuId = null; renderRows();
      if (!w || !confirm(`‘${w.name}’ 항목을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`)) return;
      try {
        await Common.Works.remove(w.id);
        Common.toast('항목을 삭제했습니다.');
        load();
      } catch (err) {
        Common.toast(err.message);
      }
    }
  });
  document.addEventListener('click', e => {
    if (openMenuId && !e.target.closest('.col-more')) { openMenuId = null; renderRows(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openMenuId) { openMenuId = null; renderRows(); }
  });

  load();
})();
