package kr.go.guro.housing.building.dto;

/**
 * 지도 묶음 1개 (격자 한 칸에 들어간 건물들).
 *
 * @param lng       묶음 표시 위치 (구성 건물 좌표 평균)
 * @param lat       묶음 표시 위치 (구성 건물 좌표 평균)
 * @param size      건물 수
 * @param riskCount 취약요인 riskMin 개 이상 건물 수 (상단 '위험 N건'과 같은 기준)
 * @param maxCount  묶음 안에서 가장 많은 취약요인 수
 * @param hist      취약요인 수별 건물 수. hist[0] = 0개, hist[1] = 1개 … hist[7] = 7개
 * @param extent    구성 건물 범위 [minLng, minLat, maxLng, maxLat] (목록 조회용)
 * @param cell      격자 칸 범위 [minLng, minLat, maxLng, maxLat] (지도에 타일로 그릴 때)
 * @param point     건물이 1동이면 그 건물 정보, 2동 이상이면 null
 */
public record Cluster(double lng, double lat, int size, int riskCount, int maxCount,
                      int[] hist, double[] extent, double[] cell, BuildingPoint point) {
}