package kr.go.guro.housing.building.dto;

/** 우측 패널 지표 행. judge: hit(해당) | ok(기준 내) | na(미적용) | info(참고) */
public record Indicator(String key, String label, String value, String judge) {
}
