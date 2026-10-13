/*
 * 지도 검색(메인) 화면 — 서버 API 연동판, 배경지도는 카카오맵 JavaScript SDK
 *  - 건물 묶음       : GET /api/buildings/clusters?bbox=&cell=&기준값...  (지도 범위·기준 변경 시 재조회)
 *  - 화면 안 건물    : GET /api/buildings?bbox=&limit=&기준값...          (건물 단위 레벨, 묶음 구역 목록)
 *  - 구 단위 집계    : GET /api/buildings/summary?기준값...
 *  - 동 목록         : GET /api/regions/dongs
 *  - 주소 검색       : GET /api/buildings/search?dong=&q=
 *  - 건물 상세       : GET /api/buildings/{id}?기준값...
 *  - 보관함          : /api/works
 * 지도 위 표시(도넛 묶음·건물 핀·구 라벨)는 카카오 CustomOverlay(HTML)로, 구 경계는 Polygon 으로 그린다.
 */
(function () {
  const C = window.APP_CONFIG;
  const $ = s => document.querySelector(s);
  const esc = Common.esc;
  const mapEl = $('#map');

  /* 카카오 SDK 가 없으면(키 없음 · 도메인 미등록 · 카카오맵 사용 설정 꺼짐 · 네트워크) 안내만 띄운다 */
  if (!window.kakao || !window.kakao.maps || !window.kakao.maps.load) {
    mapEl.innerHTML = `<div class="map-error"><b>카카오맵을 불러오지 못했습니다</b><p>${mapEl.dataset.key === 'none'
      ? '서버가 읽은 카카오 키가 비어 있습니다. app.properties 의 <code>app.kakao.js-key</code> 에 JavaScript 키를 넣고 저장한 뒤, Tomcat 을 재시작해야 반영됩니다.'
      : `카카오 개발자 콘솔에서 이 주소(<code>${esc(location.origin)}</code>)가 [플랫폼 &gt; Web 사이트 도메인]에 등록돼 있는지, [제품 설정 &gt; 카카오맵] 사용 설정이 켜져 있는지 확인하세요.`}</p></div>`;
    return;
  }
  window.kakao.maps.load(main);

  function main() {
    const state = {
      criteria: C.CRITERIA.map(c => Object.assign({}, c, { enabled: true, open: true })),
      includeBasement: false,
      includeViol: true,
      useAll: [],          // 건축물용도 전체 목록 [{ name, count }]
      uses: null,          // 선택한 용도 Set (null = 전체)
      selectedId: null,
      detail: null,   // 선택 건물 상세 (서버)
      work: null,     // 선택 건물의 보관함 항목
      cluster: null,  // 선택한 격자·묶음 { c: 집계, extent, list: 구역 건물 목록, label }
      mode: 'gu',     // 지금 그려진 표시 방식 : gu(구 단위) | cluster(도넛 묶음) | building(건물 핀)
      summary: { total: 0, riskCount: 0, riskMin: 3 },
      riskOnly: true, // 취약요인 riskMin 개 이상 건물이 있는 곳만 지도에 표시 (지도 위 칩으로 끄고 켬)
      points: new Map()
    };
    const levelOf = n => C.LEVELS.find(l => n >= l.min);
    const guLevelOf = n => C.GU_LEVELS.find(l => n >= l.min);
    /* 기준값 → 쿼리 파라미터 */
    function criteriaQuery() {
      const q = new URLSearchParams();
      state.criteria.forEach(c => { q.set(c.key, c.value); q.set(c.key + 'On', c.enabled); });
      q.set('basement', state.includeBasement);
      q.set('viol', state.includeViol);
      /* 전체 선택이면 보내지 않음(=전체), 하나도 없으면 아무 건물과도 맞지 않는 값 */
      if (state.uses && state.uses.size < state.useAll.length) {
        if (state.uses.size === 0) q.append('uses', '__none__');
        else state.uses.forEach(u => q.append('uses', u));
      }
      return q;
    }

    /* ---------- 아이콘 ---------- */
    const GLYPH = {
      '단독주택': () => '<path d="M6.8 12.6 12 8l5.2 4.6V17.4H6.8z" fill="#fff"/>',
      '공동주택': c => `<rect x="8" y="6.6" width="8" height="11" rx=".6" fill="#fff"/><rect x="9.5" y="8.4" width="1.8" height="1.8" fill="${c}"/><rect x="12.7" y="8.4" width="1.8" height="1.8" fill="${c}"/><rect x="9.5" y="11.6" width="1.8" height="1.8" fill="${c}"/><rect x="12.7" y="11.6" width="1.8" height="1.8" fill="${c}"/>`,
      '업무시설': () => '<rect x="6.8" y="10" width="10.4" height="7" rx="1.2" fill="#fff"/><rect x="9.8" y="7.6" width="4.4" height="3" rx=".8" fill="none" stroke="#fff" stroke-width="1.3"/>',
      '기타': () => '<circle cx="12" cy="12" r="3.2" fill="#fff"/>'
    };
    /* 건물 아이콘 : 지도 핀 모양 (끝이 건물 위치). 머리 부분에 용도 그림 */
    function pointSvg(color, use, selected, size) {
      const s = size || (selected ? 34 : 26);
      const h = Math.round(s * 32 / 24);
      const edge = selected ? 'stroke="#1E3A5F" stroke-width="2.2"' : 'stroke="#fff" stroke-width="1.8"';
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${h}" viewBox="0 0 24 32"><path d="M12 30.5C12 30.5 2.5 19.6 2.5 12a9.5 9.5 0 0 1 19 0c0 7.6-9.5 18.5-9.5 18.5z" fill="${color}" ${edge}/>${(GLYPH[use] || GLYPH['기타'])(color)}</svg>`;
    }
    const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

    /* ---------- 건물 묶음 ----------
       동 단위 줌 : 화면 CLUSTER_PX 칸마다 건물을 도넛 묶음 하나로 (혼자 있는 건물은 핀)
       건물 단위 줌 : 건물마다 핀. 같은 좌표에 겹친 건물은 핀을 누르면 그 위치의 건물 목록 */
    /* 취약요인 수별 건물 수(hist) → C.LEVELS 단계별 건물 수 */
    const levelCounts = hist => C.LEVELS.map(l => hist.reduce((s, n, i) => s + (levelOf(i) === l ? n : 0), 0));
    const compact = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + '천' : String(n);
    const FONT = 'Pretendard, "Malgun Gothic", sans-serif';
    /* 현재 레벨의 표시 방식 (카카오 레벨은 숫자가 클수록 넓게 보임) */
    const modeOf = lv => (lv >= C.LEVEL.GU_MIN ? 'gu' : lv >= C.LEVEL.CLUSTER_MIN ? 'cluster' : 'building');
    /* 도넛 테두리 = 취약요인 단계 비율 (12시 방향부터 4개 이상 → 0~1개) */
    const clusterRadius = size => Math.round(Math.min(28, 15 + 4.5 * Math.log10(Math.max(size, 1))));
    function clusterSvg(c) {
      const r = clusterRadius(c.size), ring = 6, S = (r + 2) * 2, m = S / 2;
      const rr = r - ring / 2, L = 2 * Math.PI * rr;
      const counts = levelCounts(c.hist);
      const parts = counts.filter(Boolean).length;
      let off = 0, segs = '';
      counts.forEach((n, i) => {
        if (!n) return;
        const len = L * n / c.size;
        const gap = parts > 1 ? Math.min(2, len / 2) : 0;   // 단계 사이 2px 흰 틈
        segs += `<circle cx="${m}" cy="${m}" r="${rr}" fill="none" stroke="${C.COLORS[C.LEVELS[i].key]}" stroke-width="${ring}"`
          + ` stroke-dasharray="${(len - gap).toFixed(2)} ${L.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${m} ${m})"/>`;
        off += len;
      });
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><circle cx="${m}" cy="${m}" r="${r + 1.5}" fill="#fff"/>${segs}</svg>`;
    }
    /* 겹친 건물 목록 → 구역 패널용 집계 (서버 Cluster 와 같은 모양) */
    function samePlaceAgg(list) {
      const hist = new Array(10).fill(0);                // 서버 MAX_FACTORS(9) + 1
      list.forEach(b => { hist[Math.min(b.count, hist.length - 1)]++; });
      return {
        size: list.length,
        riskCount: list.filter(b => b.count >= state.summary.riskMin).length,
        maxCount: Math.max(...list.map(b => b.count)),
        hist,
        extent: [Math.min(...list.map(b => b.lng)), Math.min(...list.map(b => b.lat)), Math.max(...list.map(b => b.lng)), Math.max(...list.map(b => b.lat))]
      };
    }

    /* ---------- 지도 (카카오맵) ---------- */
    const LL = ([lng, lat]) => new kakao.maps.LatLng(lat, lng);
    const wrapEl = $('.map-wrap');
    const map = new kakao.maps.Map(mapEl, { center: LL(C.MAP_CENTER), level: C.LEVEL_INIT });
    map.setMinLevel(C.LEVEL.MIN);
    map.setMaxLevel(C.LEVEL.MAX);
    map.setCopyrightPosition(kakao.maps.CopyrightPosition.BOTTOMRIGHT, true);   // 왼쪽 아래는 범례 자리
    const lvNow = () => map.getLevel();
    /* 이동·확대 애니메이션 중에는 패널 고정 보정을 하지 않는다 */
    let animUntil = 0;
    const animating = () => performance.now() < animUntil;
    function flyTo(lonlat, level) {
      const target = LL(lonlat);
      animUntil = performance.now() + 450;
      if (level == null || level === lvNow()) { map.panTo(target); return; }
      map.setCenter(target);
      map.setLevel(level, { animate: true });          // 카카오는 레벨 차이가 2 이하일 때만 부드럽게 바뀐다
    }
    function zoomBy(d) {
      animUntil = performance.now() + 400;
      map.setLevel(Math.min(C.LEVEL.MAX, Math.max(C.LEVEL.MIN, lvNow() + d)), { animate: true });
    }
    function fitTo(ext, pad) {
      animUntil = performance.now() + 450;
      map.setBounds(new kakao.maps.LatLngBounds(LL([ext[0], ext[1]]), LL([ext[2], ext[3]])), pad, pad, pad, pad);
    }

    /* 구 경계 : 반투명 색칠 + 가운데 원형 라벨 (구 단위 레벨에서만) */
    const guPolygon = new kakao.maps.Polygon({ path: C.GU_RING.map(LL), strokeWeight: 2.5, strokeOpacity: 1, fillOpacity: 0.26, zIndex: 1 });
    const guLabelEl = document.createElement('div');
    guLabelEl.className = 'kgu';
    const guLabel = new kakao.maps.CustomOverlay({ position: LL(C.MAP_CENTER), content: guLabelEl, zIndex: 5 });
    const zoomIntoGu = () => flyTo(C.MAP_CENTER, C.LEVEL.GU_MIN - 1);
    kakao.maps.event.addListener(guPolygon, 'click', zoomIntoGu);
    guLabelEl.addEventListener('click', zoomIntoGu);
    let guShown = false;
    function renderGu() {
      const n = state.summary.riskCount;
      const col = C.COLORS[guLevelOf(n).key];
      guPolygon.setOptions({ strokeColor: col, fillColor: col });
      guLabelEl.style.borderColor = col;
      guLabelEl.innerHTML = `<b>${esc(C.GU_NAME)}</b>위험 ${n.toLocaleString()}곳`;
      const show = modeOf(lvNow()) === 'gu';
      if (show === guShown) return;
      guShown = show;
      guPolygon.setMap(show ? map : null);
      guLabel.setMap(show ? map : null);
    }

    /* ---------- 지도 위 건물 표시 (카카오 CustomOverlay, HTML) ----------
       다시 불러와도 그대로인 것은 두고, 바뀐 것만 넣고 뺀다 */
    const marks = new Map();      // key → { key, kind: 'cluster' | 'building', data, same, el, ov }
    const pinById = new Map();    // 건물 id → 핀
    let dragging = false, dragEndAt = 0;
    function drawPin(m) {
      const b = m.data, lv = levelOf(b.count), sel = b.id === state.selectedId;
      /* 취약요인 0~1개 건물은 작게, 나머지는 크게 → 취약한 건물이 먼저 눈에 들어오도록 */
      const s = sel ? 36 : lv.rank === 1 ? 20 : 28, h = Math.round(s * 32 / 24);
      m.el.className = 'kpin' + (sel ? ' sel' : '');
      m.el.style.width = s + 'px';
      m.el.style.height = h + 'px';
      m.el.innerHTML = `<img src="${svgUri(pointSvg(C.COLORS[lv.key], b.useGroup, sel, s))}" width="${s}" height="${h}" alt="" draggable="false"><span class="kpin-label">${esc(b.shortAddr)}</span>`;
      if (m.ov) m.ov.setMap(null);   // 크기가 바뀌면 기준점(핀 끝)을 다시 잡도록 새로 얹는다
      m.ov = new kakao.maps.CustomOverlay({ map, position: LL([b.lng, b.lat]), content: m.el, xAnchor: 0.5, yAnchor: 1, zIndex: sel ? 99 : lv.rank });
    }
    /* 도넛 묶음 : 가운데 숫자 = 건물 수, 오른쪽 위 빨간 숫자 = 취약요인 riskMin 개 이상 건물 수 */
    function drawCluster(m) {
      const c = m.data, r = clusterRadius(c.size), S = (r + 2) * 2, k = Math.round(r * 0.8);
      m.el.className = 'kcl';
      m.el.style.width = m.el.style.height = S + 'px';
      m.el.innerHTML = `<img src="${svgUri(clusterSvg(c))}" width="${S}" height="${S}" alt="" draggable="false">`
        + `<b style="font-size:${r >= 22 ? 15 : 14}px">${compact(c.size)}</b>`
        + (c.riskCount > 0 ? `<i style="left:${S / 2 + k}px;top:${S / 2 - k}px">${compact(c.riskCount)}</i>` : '');
      m.ov = new kakao.maps.CustomOverlay({ map, position: LL([c.lng, c.lat]), content: m.el, xAnchor: 0.5, yAnchor: 0.5, zIndex: 10 + Math.min(c.riskCount, 80) });
    }
    function addMark(it) {
      const m = Object.assign({ el: document.createElement('div'), ov: null }, it);
      m.el.addEventListener('click', () => { if (performance.now() - dragEndAt > 150) onMarkClick(m); });
      m.el.addEventListener('mouseenter', () => showTip(m));
      m.el.addEventListener('mouseleave', hideTip);
      if (m.kind === 'cluster') drawCluster(m);
      else { drawPin(m); pinById.set(m.data.id, m); }
      marks.set(m.key, m);
    }
    function removeMark(m) {
      m.ov.setMap(null);
      marks.delete(m.key);
      if (m.kind === 'building' && pinById.get(m.data.id) === m) pinById.delete(m.data.id);
    }
    /* items : [{ key, kind, data, same }] 를 지도에 반영 */
    function setMarks(items) {
      const next = new Map(items.map(it => [it.key, it]));
      [...marks.values()].forEach(m => { if (!next.has(m.key)) removeMark(m); });
      items.forEach(it => {
        const m = marks.get(it.key);
        if (m) { m.data = it.data; m.same = it.same; } else addMark(it);
      });
    }
    /* 선택이 바뀐 핀만 다시 그린다 */
    function redrawPins(...ids) {
      ids.forEach(id => { const m = id && pinById.get(id); if (m) drawPin(m); });
    }
    const pinItem = (b, same) => ({ key: `b|${b.id}|${b.count}|${b.useGroup}|${same ? same.length : 0}`, kind: 'building', data: b, same });
    const clusterItem = c => ({ key: `c|${c.lng.toFixed(6)}|${c.lat.toFixed(6)}|${c.size}|${c.riskCount}|${c.hist.join('.')}`, kind: 'cluster', data: c });
    /* 같은 좌표(소수 6자리 ≈ 10cm)에 겹친 건물끼리 묶는다 : 건물 id → 그 위치 건물 목록 (2동 이상일 때만) */
    function samePlaceGroups(list) {
      const k = b => b.lng.toFixed(6) + ',' + b.lat.toFixed(6);
      const groups = new Map(), out = new Map();
      list.forEach(b => { if (!groups.has(k(b))) groups.set(k(b), []); groups.get(k(b)).push(b); });
      list.forEach(b => { const g = groups.get(k(b)); if (g.length > 1) out.set(b.id, g); });
      return out;
    }

    /* ---------- 좌우 패널 접기·펴기 ----------
       화살표 손잡이로 접으면 지도가 그만큼 넓어진다. 접고 펴는 동안 매 프레임 지도 크기를 다시 잡고(relayout),
       지도 내용이 화면에 붙어 있도록 중심을 옮겨서 보던 건물이 미끄러지지 않게 한다. 접힘 상태는 이 브라우저에 기억한다 */
    const layout = $('.main-layout');
    const PANEL_KEY = 'guro.panels';
    const PANEL_MS = 260;                          // app.css 의 .main-layout transition 시간과 같게
    const PANEL_NAME = { left: '왼쪽 패널', right: '오른쪽 패널' };
    const panelOpen = { left: true, right: true };
    let anchor = null;    // 패널이 움직이는 동안 지도 내용을 화면에 붙여 둘 기준 (beginAnchor)
    let mapBox = mapEl.getBoundingClientRect();

    function applyPanel(side) {
      layout.classList.toggle(side + '-closed', !panelOpen[side]);
      const btn = $('#toggle-' + side);
      const label = PANEL_NAME[side] + (panelOpen[side] ? ' 접기' : ' 펼치기');
      btn.setAttribute('aria-expanded', String(panelOpen[side]));
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }
    /* 패널을 움직이기 전 상태를 기준으로 잡는다 : 그때의 지도 중심, 지도 칸의 화면상 가운데 x,
       화면 1px 당 좌표 변화(가로 방향). 정수 픽셀로 반올림되는 화면 좌표 대신 좌표 두 개의 차이로 구해서 오차가 없다 */
    function beginAnchor() {
      if (animating()) return null;
      const proj = map.getProjection();
      const a = proj.coordsFromContainerPoint(new kakao.maps.Point(0, 0));
      const b = proj.coordsFromContainerPoint(new kakao.maps.Point(1000, 0));
      const r = mapEl.getBoundingClientRect();
      return { c: map.getCenter(), x: r.left + r.width / 2,
               dLat: (b.getLat() - a.getLat()) / 1000, dLng: (b.getLng() - a.getLng()) / 1000 };
    }
    /* 지도 칸 크기가 바뀌었으면 카카오맵에 알리고, 패널 움직임 중이면 내용을 화면에 고정.
       매 프레임 '움직이기 전 기준'에서 바로 계산하므로(조금씩 옮기며 더하지 않음) 오차가 쌓이지 않는다 */
    function relayout() {
      const r = mapEl.getBoundingClientRect();
      if (r.width === mapBox.width && r.height === mapBox.height && r.left === mapBox.left) return;
      mapBox = r;
      if (animating()) { map.relayout(); return; }
      if (!anchor) { const c = map.getCenter(); map.relayout(); map.setCenter(c); return; }
      map.relayout();
      const d = (r.left + r.width / 2) - anchor.x;     // 지도 칸 가운데가 화면에서 옮겨 간 거리(px)
      map.setCenter(new kakao.maps.LatLng(anchor.c.getLat() + d * anchor.dLat, anchor.c.getLng() + d * anchor.dLng));
    }
    /* 패널을 열거나 닫는다. 움직임이 끝나면 resolve */
    function setPanel(side, open) {
      if (panelOpen[side] === open) return Promise.resolve();
      panelOpen[side] = open;
      mapBox = mapEl.getBoundingClientRect();
      const mine = anchor = beginAnchor();
      applyPanel(side);
      try { localStorage.setItem(PANEL_KEY, JSON.stringify(panelOpen)); } catch (e) { /* 저장할 수 없는 환경 */ }
      return new Promise(resolve => {
        const t0 = performance.now();
        (function tick() {
          relayout();
          if (performance.now() - t0 < PANEL_MS + 60) requestAnimationFrame(tick);
          else { relayout(); if (anchor === mine) anchor = null; scheduleLoad(); resolve(); }
        })();
      });
    }
    const showRight = () => setPanel('right', true);
    /* 선택한 건물이 패널에 가려지거나 화면 끝에 붙어 있으면 보이는 곳으로 */
    function ensureVisible(lonlat) {
      const p = map.getProjection().containerPointFromCoords(LL(lonlat));
      const w = mapEl.clientWidth, h = mapEl.clientHeight, m = 56;
      if (p.x >= m && p.x <= w - m && p.y >= m && p.y <= h - m) return;
      animUntil = performance.now() + 450;
      map.panTo(LL(lonlat));
    }
    $('#toggle-left').addEventListener('click', () => setPanel('left', !panelOpen.left));
    $('#toggle-right').addEventListener('click', () => setPanel('right', !panelOpen.right));
    (function restorePanels() {
      try {
        const saved = JSON.parse(localStorage.getItem(PANEL_KEY) || 'null');
        if (saved) { panelOpen.left = saved.left !== false; panelOpen.right = saved.right !== false; }
      } catch (e) { /* 기본값 : 둘 다 열림 */ }
      layout.classList.add('no-anim');               // 처음 그릴 때는 애니메이션 없이
      applyPanel('left'); applyPanel('right');
      map.relayout();
      map.setCenter(LL(C.MAP_CENTER));
      mapBox = mapEl.getBoundingClientRect();
      requestAnimationFrame(() => requestAnimationFrame(() => layout.classList.remove('no-anim')));
    })();

    /* ---------- 서버 조회 ---------- */
    let pointSeq = 0;
    const cellByLevel = {};   // 레벨별 묶음 칸 크기 (같은 레벨에서는 같은 값 → 지도를 옮겨도 묶음이 흔들리지 않음)
    async function loadPoints() {
      const lv = lvNow();
      const mode = modeOf(lv);
      const seq = ++pointSeq;
      if (mode === 'gu') { lastRaw = null; setMarks([]); state.points.clear(); return; }   // 구 단위에서는 건물 표시 없음
      const bounds = map.getBounds(), sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
      const pad = mode === 'cluster' ? 0.002 : 0.0005;   // 화면 바깥 조금 (건물 단위는 약 50m)
      const q = criteriaQuery();
      q.set('bbox', [sw.getLng() - pad, sw.getLat() - pad, ne.getLng() + pad, ne.getLat() + pad].map(v => v.toFixed(5)).join(','));
      try {
        let list;
        if (mode === 'cluster') {
          /* 동 단위 : 칸 크기(경도, 도) = 화면 CLUSTER_PX 픽셀 */
          if (!cellByLevel[lv]) cellByLevel[lv] = C.CLUSTER_PX * (ne.getLng() - sw.getLng()) / mapEl.clientWidth;
          q.set('cell', cellByLevel[lv].toFixed(8));
          list = await Common.api('GET', '/api/buildings/clusters?' + q.toString());
        } else {
          /* 건물 단위 : 화면 안 건물을 하나씩 (취약요인 많은 순, 최대 BUILDING_LIMIT 동) */
          q.set('limit', C.BUILDING_LIMIT);
          list = await Common.api('GET', '/api/buildings?' + q.toString());
        }
        if (seq !== pointSeq) return;
        lastRaw = { mode, list };
        state.mode = mode;
        state.points.clear();
        list.forEach(x => { const b = mode === 'cluster' ? x.point : x; if (b) state.points.set(b.id, b); });
        renderMarks();
        renderLegend();
      } catch (err) { Common.toast(err.message); }
    }
    /* 마지막으로 받은 자료(lastRaw)를 지도에 그린다.
       riskOnly 이면 취약요인 riskMin 개 이상 건물이 있는 묶음(빨간 숫자가 붙는 묶음)과 그런 건물 핀만.
       선택한 건물은 기준 미만이어도 항상 보인다 */
    let lastRaw = null;
    const passRisk = b => !state.riskOnly || b.count >= state.summary.riskMin || b.id === state.selectedId;
    function renderMarks() {
      if (!lastRaw) { setMarks([]); return; }
      let items;
      if (lastRaw.mode === 'cluster') {
        items = lastRaw.list
          .filter(c => (c.point ? passRisk(c.point) : !state.riskOnly || c.riskCount > 0))
          .map(c => (c.point ? pinItem(c.point) : clusterItem(c)));
      } else {
        const same = samePlaceGroups(lastRaw.list);   // 겹친 위치 목록은 거르기 전 전체 기준
        items = lastRaw.list.filter(passRisk).map(b => pinItem(b, same.get(b.id)));
      }
      setMarks(items);
    }
    let moveTimer = null;
    function scheduleLoad() {
      clearTimeout(moveTimer);
      moveTimer = setTimeout(loadPoints, 200);
    }
    /* 여러 묶음 집계를 하나로 합친다 (구역 패널의 분포용) */
    function mergeClusters(list) {
      if (!list || !list.length) return null;
      const out = { size: 0, riskCount: 0, maxCount: 0, hist: new Array(list[0].hist.length).fill(0), extent: list[0].extent.slice() };
      list.forEach(c => {
        out.size += c.size; out.riskCount += c.riskCount; out.maxCount = Math.max(out.maxCount, c.maxCount);
        c.hist.forEach((n, i) => { out.hist[i] += n; });
        out.extent = [Math.min(out.extent[0], c.extent[0]), Math.min(out.extent[1], c.extent[1]), Math.max(out.extent[2], c.extent[2]), Math.max(out.extent[3], c.extent[3])];
      });
      return out;
    }
    /* 선택한 묶음의 분포(현재 기준값)와 취약요인 많은 건물 목록 */
    let clusterSeq = 0;
    async function loadClusterList() {
      const cl = state.cluster;
      if (!cl) return;
      const seq = ++clusterSeq;
      const e = 1e-6;
      const bbox = [cl.extent[0] - e, cl.extent[1] - e, cl.extent[2] + e, cl.extent[3] + e].map(v => v.toFixed(7)).join(',');
      const ql = criteriaQuery(); ql.set('bbox', bbox); ql.set('limit', C.CLUSTER_LIST);
      const qa = criteriaQuery(); qa.set('bbox', bbox); qa.set('cell', 5); qa.set('snap', false);
      try {
        const [list, agg] = await Promise.all([
          Common.api('GET', '/api/buildings?' + ql.toString()),
          Common.api('GET', '/api/buildings/clusters?' + qa.toString())
        ]);
        if (seq !== clusterSeq || state.cluster !== cl) return;
        cl.list = list;
        cl.c = mergeClusters(agg) || cl.c;
        if (!state.selectedId) renderPanel();
      } catch (err) { if (seq === clusterSeq) Common.toast(err.message); }
    }
    /* 도넛 묶음(cluster)을 눌렀을 때 : 오른쪽에 구역 목록, 지도는 그 구역으로 확대
       겹친 핀(stack)을 눌렀을 때 : 그 위치의 건물 목록 (이미 건물 단위라 확대하지 않음) */
    function openCluster(c, kind) {
      const area = kind === 'cluster';
      state.cluster = { c, extent: c.extent, list: null, label: area ? '묶음 구역' : '같은 위치에 겹친 건물' };
      const prev = state.selectedId;
      state.selectedId = null; state.detail = null; state.work = null;
      detailSeq++;
      renderMarks();
      redrawPins(prev);
      renderPanel();
      loadClusterList();
      /* 오른쪽 패널이 접혀 있으면 먼저 펴고, 줄어든 지도 크기에 맞춰
         묶음 칸으로 확대 */
      const cl = state.cluster;
      showRight().then(() => {
        if (state.cluster !== cl) return;
        if (!area) { ensureVisible([(c.extent[0] + c.extent[2]) / 2, (c.extent[1] + c.extent[3]) / 2]); return; }
        fitTo(c.cell, 60);
      });
    }
    function closeCluster() {
      state.cluster = null;
      clusterSeq++;
    }
    async function loadSummary() {
      try {
        state.summary = await Common.api('GET', '/api/buildings/summary?' + criteriaQuery().toString());
        renderGu();
        applyRiskOnly();
        renderMarks();
        renderLegend();
        $('#summary-chip').innerHTML = `${C.GU_NAME} 건물 ${state.summary.total.toLocaleString()}동 중 취약요인 ${state.summary.riskMin}개 이상 <b>${state.summary.riskCount.toLocaleString()}건</b>`;
      } catch (err) { Common.toast(err.message); }
    }
    let detailSeq = 0;
    async function loadDetail(id) {
      const seq = ++detailSeq;
      try {
        const [detail, work] = await Promise.all([
          Common.api('GET', `/api/buildings/${encodeURIComponent(id)}?` + criteriaQuery().toString()),
          Common.Works.findByBuilding(id)
        ]);
        if (seq !== detailSeq) return;
        state.detail = detail; state.work = work;
        renderPanel();
      } catch (err) { if (seq === detailSeq) Common.toast(err.message); }
    }
    let recomputeTimer = null;
    function recompute() {
      clearTimeout(recomputeTimer);
      recomputeTimer = setTimeout(() => {
        loadSummary(); loadPoints();
        if (state.selectedId) loadDetail(state.selectedId);
        if (state.cluster) loadClusterList();
      }, 150);
    }
    /* 지도 이벤트 : 레벨이 바뀌면 표시 방식·범례, 움직임이 끝나면(idle) 건물 다시 조회 */
    function onLevelChanged() {
      const lv = lvNow();
      wrapEl.classList.toggle('show-labels', lv <= C.LEVEL.LABEL_MAX);
      if (modeOf(lv) === 'gu') { pointSeq++; lastRaw = null; setMarks([]); state.points.clear(); }
      renderGu();
      updateScaleChip();
      renderLegend();
    }
    kakao.maps.event.addListener(map, 'zoom_start', hideTip);
    kakao.maps.event.addListener(map, 'zoom_changed', onLevelChanged);
    kakao.maps.event.addListener(map, 'idle', scheduleLoad);
    kakao.maps.event.addListener(map, 'dragstart', () => { dragging = true; hideTip(); });
    kakao.maps.event.addListener(map, 'dragend', () => { dragging = false; dragEndAt = performance.now(); });
    function updateScaleChip() {
      const mode = modeOf(lvNow());
      const label = mode === 'gu' ? '구 단위 보기' : mode === 'cluster' ? '동 단위 · 건물 묶음' : '건물 단위 · 건물 위치';
      $('#scale-chip').innerHTML = `현재 <b>${label}</b>`;
    }

    /* ---------- 호버 요약 / 클릭 ---------- */
    const tipEl = $('#map-tip');
    const YEAR = new Date().getFullYear();
    function showTip(m) {
      if (dragging) return;
      if (m.kind === 'cluster') {
        const c = m.data;
        tipEl.innerHTML = `
          <strong>이 묶음 건물 ${c.size.toLocaleString()}동</strong>
          <dl>
            <dt>취약요인 ${state.summary.riskMin}개 이상</dt><dd>${c.riskCount.toLocaleString()}동</dd>
            <dt>가장 많은 요인</dt><dd>${c.maxCount}개</dd>
          </dl>
          <div class="tip-cnt" style="color:#1E3A5F">누르면 확대하고 건물 목록을 보여줍니다</div>`;
      } else {
        const b = m.data;
        const lv = levelOf(b.count);
        tipEl.innerHTML = `
          <strong>${esc(b.shortAddr)}</strong>
          <dl>
            <dt>건물번호</dt><dd>${esc(b.id)}</dd>
            <dt>노후도</dt><dd>${b.year ? `${YEAR - b.year}년 경과 (${b.year}년 승인)` : '자료 없음'}</dd>
            <dt>정보</dt><dd>${esc(b.useNm)} · ${esc(b.strctNm)} · ${floors(b)}</dd>
          </dl>
          <div class="tip-cnt" style="color:${C.COLORS[lv.key]}">위험요소 ${b.count}개</div>${m.same
            ? `<div class="tip-cnt" style="color:#1E3A5F">이 위치에 건물 ${m.same.length}동이 겹쳐 있습니다 · 누르면 목록</div>` : ''}`;
      }
      /* 표시 위에 띄우고, 지도 위쪽 끝이라 넘치면 아래로 */
      const r = (m.el.querySelector('img') || m.el).getBoundingClientRect(), w = wrapEl.getBoundingClientRect();
      tipEl.classList.add('show');
      const below = r.top - w.top - 8 < tipEl.offsetHeight + 4;
      tipEl.classList.toggle('below', below);
      tipEl.style.left = (r.left + r.width / 2 - w.left) + 'px';
      tipEl.style.top = (below ? r.bottom - w.top + 8 : r.top - w.top - 8) + 'px';
    }
    function hideTip() { tipEl.classList.remove('show'); }
    wrapEl.addEventListener('mouseleave', hideTip);
    function onMarkClick(m) {
      hideTip();
      if (m.kind === 'cluster') openCluster(m.data, 'cluster');
      else if (m.same) openCluster(samePlaceAgg(m.same), 'stack');
      else { closeCluster(); select(m.data.id); }
    }

    /* lonlat : 지도 위 핀이 아직 없을 때(검색 결과 등) 보이게 맞출 위치 */
    function select(id, lonlat) {
      const prev = state.selectedId;
      state.selectedId = id;
      state.detail = null; state.work = null;
      renderMarks();
      redrawPins(prev, id);
      if (!id) { detailSeq++; renderPanel(); return; }
      renderPanel();
      loadDetail(id);
      /* 오른쪽 패널이 접혀 있으면 펴서 상세를 보여주고, 건물이 가려졌으면 보이게 옮긴다 */
      const b = state.points.get(id);
      const at = lonlat || (b && [b.lng, b.lat]);
      showRight().then(() => { if (at && state.selectedId === id) ensureVisible(at); });
    }
    /* ---------- 우측 상세 패널 ---------- */
    const TAG = { hit: '<span class="tag hit">해당</span>', ok: '<span class="tag ok">기준 내</span>', na: '<span class="tag na">미적용</span>', warn: '<span class="tag hit">이력 있음</span>', info: '' };
    const floors = b => `지상 ${b.grndFlr == null ? '?' : b.grndFlr} / 지하 ${b.ugrndFlr == null ? '?' : b.ugrndFlr}`;
    function stepper(status) {
      const finalStep = status === '반려' ? '반려' : '신청 승인 완료';
      const order = ['현장조사 중', '승인 처리 중', finalStep];
      const idx = order.indexOf(status);
      const html = order.map((s, i) => `<div class="step ${i < idx ? 'done' : i === idx ? 'current' + (s === '반려' ? ' reject' : '') : ''}"><i></i>${s}</div>`).join('');
      const note = idx < 0 ? '<p class="steps-note">아직 등록되지 않은 건물입니다. 보관함에 저장하면 ‘현장조사 중’ 단계로 등록됩니다.</p>' : '';
      return `<div class="steps">${html}</div>${note}`;
    }
    /* 묶음을 눌렀을 때 : 구역 분포 + 취약요인 많은 건물 목록 */
    const ROW_CHEVRON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 3 4 4-4 4"/></svg>';
    function renderClusterPanel() {
      const panel = $('#panel');
      const cl = state.cluster, c = cl.c;
      const counts = levelCounts(c.hist);
      const bar = C.LEVELS.map((l, i) => counts[i] ? `<span style="flex:${counts[i]} 1 0;background:${C.COLORS[l.key]}"></span>` : '').join('');
      const legend = C.LEVELS.map((l, i) => `<span class="lg-item"><span class="sw" style="background:${C.COLORS[l.key]}"></span>${l.label} <b>${counts[i].toLocaleString()}</b></span>`).join('');
      const barLabel = C.LEVELS.map((l, i) => `${l.label} ${counts[i]}동`).join(', ');
      const dongs = cl.list ? [...new Set(cl.list.map(b => b.dongName).filter(Boolean))] : [];
      const rows = !cl.list
        ? '<div class="factor-none">건물 목록을 불러오는 중…</div>'
        : cl.list.length
          ? cl.list.map(b => `
            <button type="button" class="cl-row" data-bid="${esc(b.id)}">
              <span class="lv-chip lv-${levelOf(b.count).key}">${b.count}개</span>
              <span class="cl-main"><b>${esc(b.shortAddr)}</b><small>${esc(b.useNm)} · ${b.year ? b.year + '년 승인' : '승인연도 없음'} · ${floors(b)}</small></span>
              ${ROW_CHEVRON}
            </button>`).join('')
          : '<div class="factor-none">이 구역에 표시할 건물이 없습니다.</div>';
      const samePlace = (c.extent[2] - c.extent[0]) < 1e-5 && (c.extent[3] - c.extent[1]) < 1e-5;
      const more = cl.list && c.size > cl.list.length
        ? `<p class="rp-note">취약요인이 많은 순으로 ${cl.list.length}동만 보여줍니다. ${samePlace
            ? '모두 같은 위치 좌표라 지도에서는 핀이 하나로 겹쳐 보입니다.'
            : '지도를 확대하면 나머지 건물도 볼 수 있습니다.'}</p>` : '';
      const riskChip = c.riskCount > 0 ? 'lv-red' : 'st-none';

      panel.innerHTML = `
        <div class="rp-head">
          <button class="rp-close" id="rp-close" aria-label="닫기"><svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.8"><path d="M2 2l10 10M12 2 2 12"/></svg></button>
          <div class="rp-badges">
            <span class="lv-chip ${riskChip}">취약요인 ${state.summary.riskMin}개 이상 ${c.riskCount.toLocaleString()}동</span>
          </div>
          <h2>선택한 구역 · 건물 ${c.size.toLocaleString()}동</h2>
          <p class="rp-sub">${esc(cl.label)}${dongs.length ? ' · ' + esc(dongs.join(', ')) : ''}</p>
        </div>
        <section class="rp-sec">
          <h3>취약요인 수 분포</h3>
          <div class="cl-bar" role="img" aria-label="${esc(barLabel)}">${bar}</div>
          <div class="cl-legend">${legend}</div>
        </section>
        <section class="rp-sec">
          <h3>취약요인 많은 건물 <small>${cl.list ? cl.list.length + '동' : ''}</small></h3>
          <div class="cl-list" id="cl-list">${rows}</div>
          ${more}
        </section>`;

      $('#rp-close').addEventListener('click', () => { closeCluster(); renderPanel(); });
      $('#cl-list').addEventListener('click', e => {
        const row = e.target.closest('[data-bid]');
        if (!row || !cl.list) return;
        const b = cl.list.find(x => x.id === row.dataset.bid);
        if (!b) return;
        flyTo([b.lng, b.lat], Math.min(lvNow(), C.LEVEL.BUILDING));
        select(b.id, [b.lng, b.lat]);
      });
    }

    function renderPanel() {
      const panel = $('#panel');
      if (!state.selectedId && state.cluster) { renderClusterPanel(); return; }
      if (!state.selectedId) {
        panel.innerHTML = `
          <div class="rp-empty">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#8691A1" stroke-width="1.5"><path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>
            <h2>건물을 선택하세요</h2>
            <p>지도에서 포인트를 누르면 건물 정보와 취약요인이 이곳에 표시됩니다.</p>
          </div>`;
        return;
      }
      const d = state.detail;
      if (!d) {
        panel.innerHTML = '<div class="rp-empty"><p>건물 정보를 불러오는 중…</p></div>';
        return;
      }
      const b = d.point;
      const lv = levelOf(b.count);
      const work = state.work;
      const status = work ? work.status : '미등록';
      const stCls = work ? 'st-' + Common.STATUS.indexOf(status) : 'st-none';
      const factors = d.factors.length
        ? d.factors.map(f => `<div class="factor"><b>${esc(f.label)}</b>${esc(f.text)}</div>`).join('')
        : '<div class="factor-none">현재 기준에서 확인된 취약요인이 없습니다.</div>';
      const indicators = d.indicators.map(i => `
        <div class="ind"><span class="ind-name">${esc(i.label)}</span><span class="ind-val">${esc(i.value)}</span>${TAG[i.judge] || ''}</div>`).join('');

      panel.innerHTML = `
        <div class="rp-head">
          <button class="rp-close" id="rp-close" aria-label="닫기"><svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.8"><path d="M2 2l10 10M12 2 2 12"/></svg></button>
          ${state.cluster ? '<button type="button" class="rp-back" id="rp-back">← 구역 목록으로</button>' : ''}
          <div class="rp-badges">
            <span class="lv-chip lv-${lv.key}">취약요인 ${b.count}개</span>
            <span class="st-chip ${stCls}">${esc(status)}</span>
          </div>
          <h2>${esc(b.shortAddr)}</h2>
          <p class="rp-sub">${esc(d.addr)}</p>
          <div class="rp-meta">
            <div><em>시설 구분</em>${esc(b.useNm)}</div>
            <div><em>건축</em>${esc(b.strctNm)}</div>
            <div><em>층고</em>${floors(b)}</div>
          </div>
        </div>
        <section class="rp-sec"><h3>업무 진행 단계</h3>${stepper(status)}</section>
        <section class="rp-sec"><h3>확인된 취약요인 <small>${b.count}개</small></h3>${factors}</section>
        <section class="rp-sec"><h3>지표 <small>거리는 QGIS 산출 직선거리</small></h3>${indicators}</section>
        <section class="rp-sec">
          <h3>건물 정보 <small>GIS 건물통합정보</small></h3>
          <dl class="info-grid">
            <dt>건물식별번호</dt><dd>${esc(b.id)}</dd>
            <dt>필지고유번호</dt><dd>${esc(d.pnu)}</dd>
            <dt>주소</dt><dd>${esc(d.addr)}</dd>
            <dt>건축물용도</dt><dd>${esc(b.useNm)} <small>(${esc(b.useGroup)})</small></dd>
            <dt>구조</dt><dd>${esc(b.strctNm)}</dd>
            <dt>층수</dt><dd>${floors(b)}</dd>
            <dt>사용승인일</dt><dd>${d.useDate ? esc(d.useDate) : '자료 없음 (건축물대장 미연계)'}</dd>
            <dt>위반건축물</dt><dd>${d.violYn == null ? '자료 없음' : d.violYn ? '해당' : '해당 없음'}</dd>
            <dt>침수횟수</dt><dd>${d.floodCnt}회</dd>
          </dl>
        </section>
        <section class="rp-sec">
          <h3><label for="memo">메모 (선택)</label></h3>
          <textarea class="memo" id="memo" placeholder="예: 반지하 거주 여부 현장 확인 필요">${esc(work ? work.memo : '')}</textarea>
          <button class="btn btn-primary btn-block rp-save" id="btn-save">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>
            ${work ? '보관함 내용 갱신' : '보관함에 저장'}
          </button>
          <p class="rp-note">현재 기준값과 함께 저장되므로, 기준을 바꾼 뒤에도 저장 당시 결과를 볼 수 있습니다. 취약요인은 공간데이터 중첩과 기준 충족 여부이며 거주자의 위험도를 뜻하지 않습니다.</p>
        </section>`;

      $('#rp-close').addEventListener('click', () => { closeCluster(); select(null); });
      if (state.cluster) $('#rp-back').addEventListener('click', () => select(null));
      $('#btn-save').addEventListener('click', async e => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const res = await Common.Works.save({
            buildingId: b.id,
            name: `${b.shortAddr} ${b.useNm}`,
            address: d.addr,
            jibunAddress: d.addr,
            factorCount: b.count,
            factors: d.factors.map(f => f.label),
            criteria: state.criteria.filter(c => c.enabled).map(c => ({ key: c.key, value: c.value })),
            includeBasement: state.includeBasement,
            memo: $('#memo').value.trim()
          });
          if (state.selectedId === b.id) state.work = res.work;
          Common.refreshCount();
          Common.toast(res.created ? '보관함에 저장했습니다.' : '보관함 내용을 갱신했습니다.');
          renderPanel();
        } catch (err) {
          Common.toast(err.message);
          btn.disabled = false;
        }
      });
    }

    /* ---------- 좌측 : 취약요인 기준 ---------- */
    const CHEVRON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
    const fmtVal = c => `${c.value.toLocaleString()}${c.unit}${c.suffix}`;
    const pct = c => ((c.value - c.min) / (c.max - c.min) * 100).toFixed(1) + '%';
    function renderCriteria() {
      $('#criteria').innerHTML = state.criteria.map((c, i) => `
        <div class="crit ${c.enabled ? '' : 'off'} ${c.open ? 'open' : ''}" data-i="${i}">
          <div class="crit-head">
            <label class="chk"><input type="checkbox" data-act="enable" ${c.enabled ? 'checked' : ''}><span>${esc(c.label)}</span></label>
            <span class="crit-val">${fmtVal(c)}</span>
            <button type="button" class="crit-fold" data-act="fold" aria-expanded="${c.open}" aria-label="${esc(c.label)} 기준값 조정">${CHEVRON}</button>
          </div>
          <div class="crit-body">
            <input type="range" data-act="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}" style="--p:${pct(c)}" ${c.enabled ? '' : 'disabled'} aria-label="${esc(c.label)} 기준값">
            <div class="crit-scale"><span>${c.min.toLocaleString()}${c.unit}</span><span>${c.max.toLocaleString()}${c.unit}</span></div>
            <p class="crit-desc">${esc(c.desc)}</p>
          </div>
        </div>`).join('');
    }
    const critWrap = $('#criteria');
    critWrap.addEventListener('change', e => {
      if (e.target.dataset.act !== 'enable') return;
      const box = e.target.closest('.crit');
      const c = state.criteria[box.dataset.i];
      c.enabled = e.target.checked;
      box.classList.toggle('off', !c.enabled);
      box.querySelector('input[type=range]').disabled = !c.enabled;
      recompute();
    });
    critWrap.addEventListener('input', e => {
      if (e.target.dataset.act !== 'range') return;
      const box = e.target.closest('.crit');
      const c = state.criteria[box.dataset.i];
      c.value = Number(e.target.value);
      e.target.style.setProperty('--p', pct(c));
      box.querySelector('.crit-val').textContent = fmtVal(c);
      recompute();
    });
    critWrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-act="fold"]');
      if (!btn) return;
      const box = btn.closest('.crit');
      const c = state.criteria[box.dataset.i];
      c.open = !c.open;
      box.classList.toggle('open', c.open);
      btn.setAttribute('aria-expanded', c.open);
    });
    $('#chk-basement').addEventListener('change', e => { state.includeBasement = e.target.checked; recompute(); });
    $('#chk-viol').addEventListener('change', e => { state.includeViol = e.target.checked; recompute(); });

    /* ---------- 좌측 : 건축물 용도 (여러 개 선택) ---------- */
    function renderUses() {
      $('#use-list').innerHTML = state.useAll.map(u => `
        <label class="chk use-item"><input type="checkbox" data-use="${esc(u.name)}" ${state.uses.has(u.name) ? 'checked' : ''}>
          <span class="use-name">${esc(u.name)}</span><span class="use-cnt">${u.count.toLocaleString()}</span></label>`).join('');
    }
    async function loadUses() {
      try {
        const m = await Common.api('GET', '/api/buildings/uses');
        state.useAll = Object.keys(m).map(name => ({ name, count: m[name] }));
        state.uses = new Set(state.useAll.map(u => u.name));
        renderUses();
      } catch (err) {
        $('#use-list').innerHTML = '<p class="crit-desc">용도 목록을 불러오지 못했습니다.</p>';
      }
    }
    $('#use-list').addEventListener('change', e => {
      const u = e.target.dataset.use;
      if (u == null) return;
      if (e.target.checked) state.uses.add(u); else state.uses.delete(u);
      recompute();
    });
    document.querySelectorAll('.use-tool').forEach(btn => btn.addEventListener('click', () => {
      const p = btn.dataset.preset;
      const names = state.useAll.map(u => u.name);
      state.uses = new Set(p === 'all' ? names : p === 'none' ? [] : names.filter(n => (C.USE_PRESETS[p] || []).includes(n)));
      renderUses();
      recompute();
    }));
    loadUses();

    /* ---------- 좌측 : 지도 레이어 ----------
       병원·복지시설·정류장은 좌표 없이 이름·거리만 제공되어 지도 레이어로 그릴 수 없음 → 건물 레이어만 제공 */
    $('#layer-list').innerHTML = `
      <label class="chk"><input type="checkbox" data-layer="building" checked><span class="layer-ico">${pointSvg(C.COLORS.orange, '공동주택', false, 18)}</span><span>건물 (취약요인 수)</span></label>
      <p class="crit-desc">병원·복지시설·정류장은 좌표 자료가 없어 지도에 표시하지 않고, 건물 선택 시 이름과 거리로 보여줍니다.</p>`;
    $('#layer-list').addEventListener('change', e => {
      if (e.target.dataset.layer === 'building') wrapEl.classList.toggle('hide-points', !e.target.checked);
    });

    /* ---------- 범례 ---------- */
    const lvItems = C.LEVELS.slice().reverse().map(l => `<span class="lg-item"><span class="sw" style="background:${C.COLORS[l.key]}"></span>${l.label}</span>`).join('');
    const useItems = Object.keys(GLYPH).map(u => `<span class="lg-item">${pointSvg('#5B6676', u, false, 16)}${u}</span>`).join('');
    /* 범례 : 동 단위에서는 도넛 묶음 읽는 법, 건물 단위에서는 건물 핀 단계·용도 */
    const sampleCluster = svgUri(clusterSvg({ size: 12, hist: [3, 3, 2, 2, 1, 1, 0, 0] }));
    let legendKey = '';
    function renderLegend() {
      const mode = modeOf(lvNow());
      const key = mode + '|' + state.summary.riskMin + '|' + state.riskOnly;
      if (key === legendKey) return;
      legendKey = key;
      if (mode === 'cluster') {
        $('#legend').innerHTML = `<div class="lg-row"><span class="lg-title">취약요인 수</span>${lvItems}</div>`
          + `<div class="lg-row"><span class="lg-title">묶음</span><span class="lg-item"><img src="${sampleCluster}" width="26" height="26" alt="">숫자 = 건물 수 · 테두리 = 단계 비율</span>`
          + `<span class="lg-item"><span class="lg-badge">N</span>취약요인 ${state.summary.riskMin}개 이상</span></div>`
          + `<div class="lg-row lg-note">${state.riskOnly ? `취약요인 ${state.summary.riskMin}개 이상 건물이 있는 묶음만 표시 중 · ` : ''}묶음을 누르면 확대하고, 그 구역의 건물 목록을 보여줍니다</div>`;
        return;
      }
      /* 건물 단위에서 riskOnly 이면 기준 이상 단계(3개 · 4개 이상)만 범례에 */
      const lvShown = state.riskOnly ? C.LEVELS.filter(l => l.min >= state.summary.riskMin) : C.LEVELS;
      $('#legend').innerHTML = `<div class="lg-row"><span class="lg-title">취약요인 수</span>${lvShown.slice().reverse().map(l => `<span class="lg-item"><span class="sw" style="background:${C.COLORS[l.key]}"></span>${l.label}</span>`).join('')}</div>`
        + `<div class="lg-row"><span class="lg-title">용도</span>${useItems}</div>`
        + `<div class="lg-row lg-note">${state.riskOnly ? `취약요인 ${state.summary.riskMin}개 이상 건물만 표시 중 · ` : ''}핀이 겹친 곳을 누르면 그 위치의 건물 목록을 보여줍니다</div>`;
    }
    /* 지도 위 칩 : 취약 건물만 보기 켜고 끄기 */
    const riskBtn = $('#risk-only');
    function applyRiskOnly() {
      riskBtn.classList.toggle('on', state.riskOnly);
      riskBtn.setAttribute('aria-pressed', String(state.riskOnly));
      riskBtn.querySelector('b').textContent = state.summary.riskMin;
      riskBtn.title = state.riskOnly ? '누르면 모든 건물을 표시합니다' : `누르면 취약요인 ${state.summary.riskMin}개 이상 있는 곳만 표시합니다`;
    }
    riskBtn.addEventListener('click', () => {
      state.riskOnly = !state.riskOnly;
      applyRiskOnly();
      renderMarks();
      renderLegend();
    });
    applyRiskOnly();
    renderLegend();

    /* ---------- 좌측 : 분석 지역 / 주소 검색 ---------- */
    let dongs = [];
    async function loadDongs() {
      try {
        dongs = await Common.api('GET', '/api/regions/dongs');
        $('#sel-dong').insertAdjacentHTML('beforeend', dongs.map(d => `<option value="${esc(d.code)}">${esc(d.name)} (${d.buildingCount})</option>`).join(''));
      } catch (err) { Common.toast(err.message); }
    }
    $('#sel-dong').addEventListener('change', e => {
      const d = dongs.find(x => x.code === e.target.value);
      if (d) flyTo([d.lng, d.lat], C.LEVEL.DONG); else flyTo(C.MAP_CENTER, C.LEVEL_INIT);
    });
    async function search() {
      const q = $('#addr-input').value.trim();
      const dong = $('#sel-dong').value;
      if (!q) {
        const d = dongs.find(x => x.code === dong);
        if (!d) { Common.toast('동을 선택하거나 세부 주소를 입력하세요.'); return; }
        flyTo([d.lng, d.lat], C.LEVEL.DONG);
        return;
      }
      try {
        const qs = criteriaQuery(); qs.set('dong', dong); qs.set('q', q);
        const hits = await Common.api('GET', '/api/buildings/search?' + qs.toString());
        if (!hits.length) { Common.toast('검색 결과가 없습니다. 주소를 다시 확인하세요.'); return; }
        const b = hits[0];
        flyTo([b.lng, b.lat], C.LEVEL.BUILDING);
        select(b.id, [b.lng, b.lat]);
        if (hits.length > 1) Common.toast(`${hits.length}건 이상 검색되어 첫 번째 건물을 표시합니다.`);
      } catch (err) { Common.toast(err.message); }
    }
    $('#btn-search').addEventListener('click', search);
    $('#addr-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) search(); });
    $('#zoom-in').addEventListener('click', () => zoomBy(-1));
    $('#zoom-out').addEventListener('click', () => zoomBy(1));
    $('#zoom-home').addEventListener('click', () => flyTo(C.MAP_CENTER, C.LEVEL_INIT));

    /* ---------- AI 업무 도우미 : 대화 하나 ----------
       질문과 함께 직전 대화(최대 AI_HISTORY 개)를 보내서, LLM 연동 시 앞의 대화를 이어서 답할 수 있게 한다 */
    const AI_HISTORY = 10;
    const ai = {
      busy: false,
      logs: [{
        from: 'ai', intro: true,
        text: '복지 정책·지침, 시스템 사용법, 업무 처리 절차를 무엇이든 물어보세요.\n예) 주거급여 수선유지 지원 기준이 어떻게 되나요?\n예) 현장조사 결과는 어디에 기록하나요?'
      }]
    };
    function renderAi() {
      $('#ai-log').innerHTML = ai.logs.map(m => `<div class="msg ${m.from === 'me' ? 'me' : 'ai'}${m.pending ? ' pending' : ''}">${esc(m.text)}</div>`).join('');
      $('#ai-log').scrollTop = $('#ai-log').scrollHeight;
      $('#ai-send').disabled = ai.busy;
    }
    /* 대화창 올리기·내리기 : 입력창을 누르거나 입력하면 올라오고, ▾ 버튼·Esc·왼쪽 조건 영역을 누르면 내려간다 */
    const aiBox = $('#ai');
    function setAiOpen(open) {
      if (aiBox.classList.contains('open') === open) return;
      aiBox.classList.toggle('open', open);
      $('#ai-q').setAttribute('aria-expanded', String(open));
      if (open) { aiBox.classList.remove('has-new'); renderAi(); }
    }
    ['pointerdown', 'focus', 'input'].forEach(t => $('#ai-q').addEventListener(t, () => setAiOpen(true)));
    $('#ai-fold').addEventListener('click', () => { setAiOpen(false); $('#ai-fold').blur(); });
    aiBox.addEventListener('keydown', e => { if (e.key === 'Escape') setAiOpen(false); });
    $('.left-scroll').addEventListener('pointerdown', () => setAiOpen(false));

    async function askAi() {
      const q = $('#ai-q').value.trim();
      if (!q || ai.busy) return;
      setAiOpen(true);
      const history = ai.logs.filter(m => !m.intro && !m.pending && !m.failed).slice(-AI_HISTORY)
        .map(m => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text.slice(0, 2000) }));
      const pending = { from: 'ai', text: '답변을 준비하고 있습니다…', pending: true };
      ai.logs.push({ from: 'me', text: q }, pending);
      ai.busy = true;
      $('#ai-q').value = '';
      renderAi();
      try {
        const res = await Common.api('POST', '/api/assistant', { question: q, history });
        pending.text = res.answer;
      } catch (err) {
        pending.text = '답변을 받지 못했습니다. 잠시 후 다시 시도하세요.';
        pending.failed = true;
      }
      pending.pending = false;
      ai.busy = false;
      if (!aiBox.classList.contains('open')) aiBox.classList.add('has-new');
      renderAi();
    }
    $('#ai-send').addEventListener('click', askAi);
    $('#ai-q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) askAi(); });

    /* ---------- 시작 ---------- */
    renderCriteria();
    renderPanel();
    renderAi();
    onLevelChanged();
    loadDongs();
    loadSummary();
    loadPoints();
  }
})();