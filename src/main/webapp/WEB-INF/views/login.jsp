<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<c:set var="pageTitle" value="로그인"/>
<!DOCTYPE html>
<html lang="ko">
<%@ include file="/WEB-INF/views/include/head.jspf" %>
<body>
<div class="login-page">
  <section class="login-visual">
    <div style="position:relative">
      <h1>주거환경 취약요인 공간분석</h1>
      <p>노후도, 경사, 고도, 생활시설 거리를 겹쳐 보고 취약 건물을 찾아 업무로 바로 등록합니다. 서비스 지역은 구로구입니다.</p>
    </div>
    <svg class="grid-art" viewBox="0 0 520 420" aria-hidden="true">
      <g fill="none" stroke="#3A5A85" stroke-width="1">
        <path d="M0 80h520M0 170h520M0 260h520M0 350h520M90 0v420M200 0v420M310 0v420M420 0v420"/>
      </g>
      <g opacity=".95">
        <rect x="104" y="92" width="40" height="54" rx="3" fill="#3E9E5A"/>
        <rect x="152" y="96" width="34" height="46" rx="3" fill="#E2B52A"/>
        <rect x="214" y="184" width="44" height="60" rx="3" fill="#D93A3A"/>
        <rect x="266" y="190" width="30" height="40" rx="3" fill="#EC8B2F"/>
        <rect x="324" y="96" width="38" height="50" rx="3" fill="#E2B52A"/>
        <rect x="104" y="276" width="46" height="56" rx="3" fill="#EC8B2F"/>
        <rect x="324" y="276" width="40" height="52" rx="3" fill="#3E9E5A"/>
        <rect x="434" y="186" width="36" height="58" rx="3" fill="#D93A3A"/>
      </g>
      <path d="M236 214 L340 112" stroke="#9FC3E8" stroke-width="2" stroke-dasharray="6 6"/>
      <circle cx="340" cy="112" r="9" fill="#1F7A8C" stroke="#fff" stroke-width="2"/>
    </svg>
    <p class="foot">구로구청 · 행정 내부망 전용</p>
  </section>

  <section class="login-form-wrap">
    <%-- Spring Security 폼 로그인 : POST /login (Thymeleaf 와 달리 CSRF 토큰을 직접 넣는다) --%>
    <form class="login-form" action="<c:url value='/login'/>" method="post" autocomplete="off">
      <c:if test="${not empty _csrf}"><input type="hidden" name="${_csrf.parameterName}" value="${_csrf.token}"></c:if>
      <h2>로그인</h2>
      <p class="desc">행정 업무에 쓰는 사원번호와 비밀번호를 입력하세요.</p>
      <label for="emp-no">사원번호</label>
      <input class="field" id="emp-no" name="empNo" inputmode="numeric" placeholder="사원번호" required autofocus>
      <label for="pw">비밀번호</label>
      <input class="field" id="pw" name="password" type="password" placeholder="비밀번호" required>
      <button class="btn btn-primary btn-block" type="submit">로그인</button>
      <div class="login-hint">프로토타입 확인용 계정 : 2026001 / guro1234</div>
    </form>
  </section>
</div>

<%-- 로그인 실패 시 (/login?error) 알림 후 로그인 화면 유지 --%>
<c:if test="${param.error != null}">
<script>
  alert('잘못된 접근입니다');
  history.replaceState(null, '', location.pathname);
</script>
</c:if>
</body>
</html>
