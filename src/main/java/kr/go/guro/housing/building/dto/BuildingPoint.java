package kr.go.guro.housing.building.dto;

public record BuildingPoint(
        String id, double lng, double lat, int count,
        String useGroup, String useNm, String strctNm, Integer year,
        Integer grndFlr, Integer ugrndFlr, String shortAddr, String dongName) {
}
