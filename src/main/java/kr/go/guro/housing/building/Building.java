package kr.go.guro.housing.building;

import java.time.LocalDate;

/**
 * 건물 1동 (QGIS 산출 테이블 1행). 컬럼명은 제공된 데이터 테이블을 그대로 따른다.
 *  fid, bld_id, pnu, use_nm, strct_nm, use_date, viol_yn, grnd_flr, ugrnd_flr, elev_m, slope_deg,
 *  flood_cnt, hosp_nm, Hosp_Dist, bus_nm, bus_dist, welf_nm, welf_dist, lng, lat, addr
 */
public record Building(
        long fid,
        String bldId,       // GIS 건물통합식별번호 (28자리)
        String pnu,         // 필지고유번호 (19자리) – 앞 10자리 = 법정동코드
        String useNm,       // 건축물용도명
        String strctNm,     // 건축물구조
        LocalDate useDate,  // 사용승인일 (없으면 null)
        Boolean violYn,     // 위반건축물 여부 (자료 없으면 null)
        Integer grndFlr,    // 지상층수 (자료 없으면 null)
        Integer ugrndFlr,   // 지하층수 (자료 없으면 null)
        Double elevM,       // 고도 (DEM 범위 밖이면 null)
        Double slopeDeg,    // 경사도 (null 가능)
        int floodCnt,       // 침수횟수
        String hospNm, double hospDist,   // 최근접 병원명·거리(m)
        String busNm,  double busDist,    // 최근접 정류장명·거리(m)
        String welfNm, double welfDist,   // 최근접 복지시설명·거리(m)
        double lng, double lat,
        String addr) {

    /** 법정동코드 = PNU 앞 10자리 */
    public String dongCode() {
        return pnu != null && pnu.length() >= 10 ? pnu.substring(0, 10) : "";
    }

    /** 주소 "서울특별시 구로구 구로동 147-4" → "구로동" */
    public String dongName() {
        if (addr == null) return "";
        for (String t : addr.trim().split("\\s+")) {
            if (t.endsWith("동") && !t.endsWith("구")) return t;
        }
        return "";
    }

    /** 주소에서 '구로동 147-4' 부분 */
    public String shortAddr() {
        if (addr == null) return "";
        return addr.replace("서울특별시", "").replace("구로구", "").trim();
    }

    /** 건축물용도명 (건축물대장 미연계 건물은 빈값 → '용도 미상') */
    public String useLabel() {
        return useNm == null || useNm.isBlank() ? "용도 미상" : useNm;
    }

    /** 지하층 보유 여부 (지하층 주거 등록 자료가 없어 대용) */
    public boolean hasBasement() {
        return ugrndFlr != null && ugrndFlr > 0;
    }

    /** 픽토그램 구분 : 단독주택 / 공동주택 / 업무시설 / 기타 (건축물용도명으로 분류) */
    public String useGroup() {
        String u = useNm == null ? "" : useNm;
        if (u.contains("단독") || u.contains("다가구")) return "단독주택";
        if (u.contains("공동") || u.contains("아파트") || u.contains("다세대") || u.contains("연립")) return "공동주택";
        if (u.contains("업무") || u.contains("오피스텔")) return "업무시설";
        return "기타";
    }

    /** 사용승인 후 경과 연수 (사용승인일 없으면 null) */
    public Integer ageYears(int currentYear) {
        return useDate == null ? null : currentYear - useDate.getYear();
    }
}
