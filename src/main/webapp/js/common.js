/*
 * 공통 모듈 : 서버 API 호출(CSRF 포함), 보관함 API, 알림, 헤더 동작
 * 로그인 확인과 헤더 렌더링은 서버(Spring Security + JSP)가 처리합니다.
 * ctx, _csrf, _csrf_header 값은 WEB-INF/views/include/head.jspf 의 meta 태그에서 읽습니다.
 */
(function () {
  const STATUS = ['현장조사 중', '승인 처리 중', '신청 승인 완료', '반려'];
  const WELFARE = ['주거급여', '긴급복지(주거지원)', '주거취약계층 이주지원', '주택 개보수 지원', '미지정'];

  const meta = name => {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute('content') : null;
  };
  const CTX = (meta('ctx') || '/').replace(/\/$/, '');
  const url = path => CTX + path;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  /* 서버 형식 "2026-10-12T14:05:00" 또는 타임스탬프 */
  function fmtDate(v) {
    const d = new Date(v);
    if (isNaN(d)) return '-';
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function api(method, path, body) {
    const opt = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    if (method !== 'GET') {
      const token = meta('_csrf'), header = meta('_csrf_header');
      if (token && header) opt.headers[header] = token;
    }
    const res = await fetch(url(path), opt);
    if (res.status === 401) {
      location.href = url('/login');
      throw new Error('로그인이 만료되었습니다. 다시 로그인하세요.');
    }
    if (res.status === 403) throw new Error('요청이 거부되었습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    if (!res.ok) throw new Error(`서버 요청에 실패했습니다. (${res.status})`);
    if (res.status === 204) return null;
    return res.json();
  }

  const Works = {
    search(params) {
      const qs = new URLSearchParams();
      Object.keys(params).forEach(k => { if (params[k] !== '' && params[k] != null) qs.append(k, params[k]); });
      return api('GET', '/api/works?' + qs.toString());
    },
    summary() { return api('GET', '/api/works/summary'); },
    findByBuilding(bid) { return api('GET', '/api/works/by-building/' + encodeURIComponent(bid)); },
    save(item) { return api('POST', '/api/works', item); },
    remove(id) { return api('DELETE', '/api/works/' + encodeURIComponent(id)); }
  };

  /* 헤더 '보관함' 건수 갱신 */
  async function refreshCount() {
    try {
      const s = await Works.summary();
      const el = document.getElementById('gnb-count');
      if (el) el.textContent = s.total;
      return s;
    } catch (e) { return null; }
  }

  function toast(msg) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  window.Common = { STATUS, WELFARE, url, esc, fmtDate, api, Works, refreshCount, toast };
})();