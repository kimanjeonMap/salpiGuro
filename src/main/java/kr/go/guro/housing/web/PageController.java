package kr.go.guro.housing.web;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @GetMapping("/login")
    public String login(Authentication auth) {
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            return "redirect:/map";
        }
        return "login";
    }

    @GetMapping("/")
    public String root() {
        return "redirect:/map";
    }

    /** 지도 검색 (메인) */
    @GetMapping("/map")
    public String map() {
        return "map";
    }

    /** 보관함 (업무처리 리스트) */
    @GetMapping("/works")
    public String works() {
        return "works";
    }
}
