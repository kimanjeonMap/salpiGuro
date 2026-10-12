package kr.go.guro.housing.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

import kr.go.guro.housing.auth.LoginUser;
import kr.go.guro.housing.config.AppProperties;
import kr.go.guro.housing.work.WorkService;

/**
 * 화면(JSP) 공통 모델 : 로그인 사용자, 보관함 건수, 지도 설정.
 */
@ControllerAdvice(assignableTypes = PageController.class)
public class PageModelAdvice {

    private final AppProperties props;
    private final WorkService workService;

    public PageModelAdvice(AppProperties props, WorkService workService) {
        this.props = props;
        this.workService = workService;
    }

    @ModelAttribute("loginUser")
    public LoginUser loginUser(@AuthenticationPrincipal LoginUser user) {
        return user;
    }

    @ModelAttribute("workCount")
    public long workCount(@AuthenticationPrincipal LoginUser user) {
        return user == null ? 0 : workService.count();
    }

    /** 카카오맵 JavaScript 키 (map.jsp 가 SDK 주소에 넣는다) */
    @ModelAttribute("kakaoKey")
    public String kakaoKey() {
        return props.kakao().jsKey();
    }
}