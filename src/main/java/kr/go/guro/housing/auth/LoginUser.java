package kr.go.guro.housing.auth;

import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * 로그인한 공무원 정보. 헤더의 "기관명.담당" 표시에 사용한다.
 */
public class LoginUser implements UserDetails {

    private static final long serialVersionUID = 1L;

    private final String empNo;
    private final String password;
    private final String name;
    private final String org;
    private final String dept;
    private final String role;

    public LoginUser(String empNo, String password, String name, String org, String dept, String role) {
        this.empNo = empNo;
        this.password = password;
        this.name = name;
        this.org = org;
        this.dept = dept;
        this.role = role;
    }

    public String getEmpNo() { return empNo; }
    public String getName() { return name; }
    public String getOrg() { return org; }
    public String getDept() { return dept; }
    public String getRole() { return role; }

    /** 헤더 표시용 : 구로구청.주거복지담당자 */
    public String getOrgLabel() { return org + "." + role; }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_STAFF"));
    }

    @Override public String getPassword() { return password; }
    @Override public String getUsername() { return empNo; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
