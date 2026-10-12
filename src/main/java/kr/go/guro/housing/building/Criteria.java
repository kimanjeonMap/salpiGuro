package kr.go.guro.housing.building;

/**
 * 취약요인 기준값 (쿼리 파라미터). 값이 없으면 기본값을 쓴다.
 * 예) /api/buildings?age=30&ageOn=true&slope=15&slopeOn=true&hospital=500&...&basement=true
 */
public record Criteria(
        Integer age,      Boolean ageOn,       // 노후: 사용승인 후 N년 이상
        Double  slope,    Boolean slopeOn,     // 급경사: N° 이상
        Integer hospital, Boolean hospitalOn,  // 병원까지 N m 초과
        Integer welfare,  Boolean welfareOn,   // 복지시설까지 N m 초과
        Integer bus,      Boolean busOn,       // 정류장까지 N m 초과
        Double  lowland,  Boolean lowlandOn,   // 저지대: 고도 N m 이하
        Boolean basement) {                    // 지하층 있는 건물 +1

    public Criteria normalized() {
        return new Criteria(
                age == null ? 30 : age,         ageOn == null || ageOn,
                slope == null ? 15 : slope,     slopeOn == null || slopeOn,
                hospital == null ? 500 : hospital, hospitalOn == null || hospitalOn,
                welfare == null ? 500 : welfare,   welfareOn == null || welfareOn,
                bus == null ? 300 : bus,        busOn == null || busOn,
                lowland == null ? 30 : lowland, lowlandOn == null || lowlandOn,
                basement != null && basement);
    }
}
