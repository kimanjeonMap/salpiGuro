package kr.go.guro.housing.building.dto;

import java.time.LocalDate;
import java.util.List;

public record BuildingDetail(
        BuildingPoint point,
        long fid, String pnu, String addr, LocalDate useDate, Boolean violYn, int floodCnt,
        String hospNm, double hospDist, String welfNm, double welfDist, String busNm, double busDist,
        Double elevM, Double slopeDeg,
        List<Factor> factors, List<Indicator> indicators) {
}
