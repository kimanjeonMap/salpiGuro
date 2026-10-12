package kr.go.guro.housing.config;

import java.util.List;

/**
 * app.* 설정. root-context.xml 의 appProperties 빈으로 만든다.
 * (카카오맵 키는 app.properties, 로그인 계정 목록은 root-context.xml 에 있다)
 */
public record AppProperties(Kakao kakao, List<UserAccount> users) {

    public AppProperties {
        if (kakao == null) {
            kakao = new Kakao("");
        }
        if (users == null) {
            users = List.of();
        }
    }

    /** 카카오맵 JavaScript 키 (REST API 키가 아님). 비어 있으면 지도 대신 안내 문구를 띄운다. */
    public record Kakao(String jsKey) {
        public Kakao {
            jsKey = jsKey == null ? "" : jsKey.trim();
        }
    }

    /** 프로토타입용 계정. 실서비스에서는 인사 DB 조회로 대체. */
    public record UserAccount(String empNo, String password, String name, String org, String dept, String role) {
    }
}