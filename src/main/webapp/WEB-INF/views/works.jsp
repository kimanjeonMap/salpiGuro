<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<c:set var="pageTitle" value="업무처리"/>
<c:set var="activeMenu" value="works"/>
<!DOCTYPE html>
<html lang="ko">
<%@ include file="/WEB-INF/views/include/head.jspf" %>
<body>
<%@ include file="/WEB-INF/views/include/header.jspf" %>

<main class="wl">
  <div class="wl-title">
    <h1>업무처리</h1>
    <a class="btn btn-primary" href="<c:url value='/map'/>">+ 지도에서 새 분석</a>
  </div>

  <div class="stats" id="stats"></div>

  <div class="filters">
    <div class="search">
      <input class="field" id="f-q" placeholder="장소명 또는 주소 검색" aria-label="장소명 또는 주소 검색">
      <button class="btn btn-primary" id="f-search">검색</button>
    </div>
    <select class="field" id="f-status" aria-label="업무현황"></select>
    <select class="field" id="f-welfare" aria-label="복지 분류"></select>
    <div class="period">
      <input class="field" type="date" id="f-from" aria-label="조회 시작일">
      <span>~</span>
      <input class="field" type="date" id="f-to" aria-label="조회 종료일">
    </div>
    <select class="field sort" id="f-sort" aria-label="정렬">
      <option value="recent">최근 수정순</option>
      <option value="riskHigh">위험도 높은 순</option>
      <option value="riskLow">위험도 낮은 순</option>
    </select>
  </div>

  <div class="tbl-wrap">
    <table class="wl-table">
      <thead>
        <tr>
          <th style="width:22%">장소명</th>
          <th>주소</th>
          <th style="width:14%">업무 현황</th>
          <th style="width:16%">마지막 수정</th>
          <th class="col-more"><span class="visually-hidden">메뉴</span></th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
  </div>

  <div class="pager" id="pager"></div>
  <p class="pager-total" id="pager-total"></p>
</main>

<script src="<c:url value='/js/common.js'/>"></script>
<script src="<c:url value='/js/works.js'/>"></script>
</body>
</html>
