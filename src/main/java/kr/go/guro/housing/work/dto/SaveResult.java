package kr.go.guro.housing.work.dto;

import kr.go.guro.housing.work.Work;

/** created=true 이면 새로 등록, false 이면 기존 항목 갱신 */
public record SaveResult(Work work, boolean created) {
}
