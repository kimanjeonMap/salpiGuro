<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<c:set var="pageTitle" value="지도 검색"/>
<c:set var="activeMenu" value="map"/>
<!DOCTYPE html>
<html lang="ko">
<%@ include file="/WEB-INF/views/include/head.jspf" %>
<body>
<%@ include file="/WEB-INF/views/include/header.jspf" %>

<div class="main-layout">
  <!-- 좌측 : 분석 조건 + AI 업무 도우미 (아래에 입력창만 붙어 있다가 누르면 대화창이 올라온다) -->
  <aside class="left" id="panel-left">
    <div class="left-scroll">
      <section class="sec">
        <h2 class="sec-title">분석 지역</h2>
        <div class="row">
          <select class="field" id="sel-gu" aria-label="구 선택"><option value="11530">구로구</option></select>
          <select class="field" id="sel-dong" aria-label="동 선택"><option value="">동 전체</option></select>
        </div>
        <div class="row">
          <input class="field" id="addr-input" placeholder="세부 주소 (예: 개봉로3길 12, 152-3)" aria-label="세부 주소">
          <button class="btn btn-primary btn-icon" id="btn-search" aria-label="검색">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          </button>
        </div>
      </section>

      <section class="sec">
        <h2 class="sec-title">취약요인 기준 <small>체크한 요인만 집계</small></h2>
        <div id="criteria"></div>
        <div class="basement-opt">
          <label class="chk"><input type="checkbox" id="chk-basement"><span>지하층 주거 등록 건물을 요인에 포함</span></label>
          <p>현재 자료에 지하층 주거 등록 여부가 없어 지하층(ugrnd_flr)이 있는 건물에 취약요인 1개를 더합니다.</p>
        </div>
      </section>

      <section class="sec">
        <h2 class="sec-title">지도 레이어</h2>
        <div class="layer-list" id="layer-list"></div>
      </section>
    </div>

    <section class="ai" id="ai" aria-label="AI 업무 도우미">
      <div class="ai-head">
        <h2>AI 업무 도우미</h2><span>답변 기능 연동 예정</span>
        <button type="button" class="ai-fold" id="ai-fold" aria-label="대화창 내리기" title="대화창 내리기">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 6 5 5 5-5"/></svg>
        </button>
      </div>
      <div class="ai-log" id="ai-log" aria-live="polite"></div>
      <div class="ai-input">
        <label class="ai-field">
          <span class="ai-ico" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 10h.01M12 10h.01M15.5 10h.01" stroke-width="2.6" stroke-linecap="round"/></svg></span>
          <input class="field" id="ai-q" placeholder="AI에게 질문하세요" aria-label="AI 업무 도우미에게 질문" aria-controls="ai-log" aria-expanded="false" autocomplete="off">
        </label>
        <button class="btn btn-primary btn-sm" id="ai-send">보내기</button>
      </div>
    </section>
  </aside>

  <!-- 중앙 : 지도 -->
  <main class="map-wrap">
    <div id="map" data-key="${empty kakaoKey ? 'none' : 'set'}"></div>
    <div class="map-top">
      <div class="map-chip" id="summary-chip"></div>
      <div class="map-chip scale" id="scale-chip"></div>
      <%-- 켜져 있으면 취약요인 3개 이상 건물이 있는 묶음(빨간 숫자)과 그런 건물 핀만 지도에 표시 --%>
      <button type="button" class="map-chip chip-toggle on" id="risk-only" aria-pressed="true">
        <span class="ck" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 6.2 2.4 2.4 4.6-5"/></svg></span>
        <span>취약요인 <b>3</b>개 이상 있는 곳만</span>
      </button>
    </div>
    <div class="map-ctrl">
      <button id="zoom-in" aria-label="확대">+</button>
      <button id="zoom-out" aria-label="축소">−</button>
      <button id="zoom-home" aria-label="구로구 전체 보기">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>
      </button>
    </div>
    <div class="map-legend" id="legend"></div>
    <div class="map-tip" id="map-tip"></div>
    <%-- 좌우 패널 접기·펴기 (화살표는 접혔을 때 반대로 돈다) --%>
    <button type="button" class="side-toggle side-toggle-left" id="toggle-left" aria-controls="panel-left" aria-expanded="true" aria-label="왼쪽 패널 접기" title="왼쪽 패널 접기">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>
    </button>
    <button type="button" class="side-toggle side-toggle-right" id="toggle-right" aria-controls="panel" aria-expanded="true" aria-label="오른쪽 패널 접기" title="오른쪽 패널 접기">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>
    </button>
  </main>

  <!-- 우측 : 건물 상세 -->
  <aside class="right" id="panel"></aside>
</div>

<%-- 카카오맵 SDK (키 : app.properties 의 app.kakao.js-key).
     autoload=false 로 불러온 뒤 main.js 가 kakao.maps.load() 로 지도를 시작한다 --%>
<c:if test="${not empty kakaoKey}">
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=<c:out value='${kakaoKey}'/>&amp;autoload=false"></script>
</c:if>
<script src="<c:url value='/js/config.js'/>"></script>
<script src="<c:url value='/js/common.js'/>"></script>
<script src="<c:url value='/js/main.js'/>"></script>
</body>
</html>
