package kr.go.guro.housing.work.dto;

import java.util.List;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WorkSaveRequest(
        @NotBlank String buildingId,
        @NotBlank @Size(max = 200) String name,
        @NotBlank @Size(max = 300) String address,
        @Size(max = 300) String jibunAddress,
        @Min(0) int factorCount,
        List<String> factors,
        List<CriterionValue> criteria,
        boolean includeBasement,
        @Size(max = 2000) String memo) {
}
