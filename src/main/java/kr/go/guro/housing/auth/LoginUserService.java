package kr.go.guro.housing.auth;

import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import kr.go.guro.housing.config.AppProperties;
import kr.go.guro.housing.config.AppProperties.UserAccount;

/**
 * 사원번호로 사용자를 찾는다.
 * 프로토타입은 root-context.xml 의 계정 목록을 쓰고, 실서비스에서는 이 클래스만 인사 DB 조회로 바꾸면 된다.
 */
@Service
public class LoginUserService implements UserDetailsService {

    private final Map<String, UserAccount> accounts;

    public LoginUserService(AppProperties props) {
        this.accounts = props.users().stream()
                .collect(Collectors.toUnmodifiableMap(UserAccount::empNo, Function.identity()));
    }

    @Override
    public UserDetails loadUserByUsername(String empNo) throws UsernameNotFoundException {
        UserAccount a = accounts.get(empNo == null ? "" : empNo.trim());
        if (a == null) {
            throw new UsernameNotFoundException("등록되지 않은 사원번호");
        }
        return new LoginUser(a.empNo(), a.password(), a.name(), a.org(), a.dept(), a.role());
    }
}
