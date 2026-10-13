package kr.go.guro.housing.building;

import java.util.List;

/**
 * 취약요인 기준값 (쿼리 파라미터). 값이 없으면 기본값을 쓴다.
 * 예) /api/buildings?age=30&ageOn=true&slope=15&slopeOn=true&hospital=500&...&basement=true&viol=true&uses=공장&uses=창고시설
 */
public record Criteria(
        Integer age,      Boolean ageOn,       // 노후: 사용승인 후 N년 이상
        Double  slope,    Boolean slopeOn,     // 급경사: N° 이상
        Integer hospital, Boolean hospitalOn,  // 병원까지 N m 초과
        Integer welfare,  Boolean welfareOn,   // 복지시설까지 N m 초과
        Integer bus,      Boolean busOn,       // 정류장까지 N m 초과
        Double  lowland,  Boolean lowlandOn,   // 저지대: 고도 N m 이하
        Integer flood,    Boolean floodOn,     // 침수: 침수흔적 N회 이상
        Boolean basement,                      // 지하층 있는 건물 +1
        Boolean viol,                          // 위반건축물 +1
        List<String> uses) {                   // 표시할 건축물용도 (없으면 전체)

    /** 아무 용도도 고르지 않았을 때 화면이 보내는 값 (어떤 건물과도 맞지 않음) */
    public static final String NO_USE = "__none__";

    public Criteria normalized() {
        return new Criteria(
                age == null ? 30 : age,         ageOn == null || ageOn,
                slope == null ? 15 : slope,     slopeOn == null || slopeOn,
                hospital == null ? 500 : hospital, hospitalOn == null || hospitalOn,
                welfare == null ? 500 : welfare,   welfareOn == null || welfareOn,
                bus == null ? 300 : bus,        busOn == null || busOn,
                lowland == null ? 30 : lowland, lowlandOn == null || lowlandOn,
                flood == null ? 1 : flood,      floodOn == null || floodOn,
                basement != null && basement,
                viol == null || viol,
                uses == null || uses.isEmpty() ? null : List.copyOf(uses));
    }

    /** 이 용도(건물의 useLabel)를 지도·집계에 포함하는지 */
    public boolean acceptsUse(String useLabel) {
        return uses == null || uses.contains(useLabel);
    }
}
