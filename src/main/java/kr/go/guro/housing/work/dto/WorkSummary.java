package kr.go.guro.housing.work.dto;

import java.util.Map;

public record WorkSummary(long total, Map<String, Long> byStatus) {
}
