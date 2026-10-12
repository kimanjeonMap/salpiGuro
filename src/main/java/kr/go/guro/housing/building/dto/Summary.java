package kr.go.guro.housing.building.dto;

import java.util.Map;

public record Summary(long total, long riskCount, int riskMin, Map<String, Long> riskByDong) {
}
