package kr.go.guro.housing.work.dto;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;

/** 업무 리스트 조회 조건 (쿼리 파라미터) */
public record WorkSearchCondition(
        String q,
        String status,
        String welfare,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        String sort,
        Integer page,
        Integer size) {
}
