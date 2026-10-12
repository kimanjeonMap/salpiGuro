package kr.go.guro.housing.work;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import kr.go.guro.housing.work.dto.CriterionValue;

/**
 * 보관함에 저장된 업무 1건 (건물 1동 = 업무 1건).
 * DB 전환 시 테이블 work 로 매핑한다.
 */
public class Work {

    private String id;
    private String buildingId;
    private String name;
    private String address;
    private String jibunAddress;
    private String status;
    private String welfare;
    private int factorCount;
    private List<String> factors = new ArrayList<>();
    private List<CriterionValue> criteria = new ArrayList<>();
    private boolean includeBasement;
    private String memo;
    private String createdBy;
    private String updatedBy;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getBuildingId() { return buildingId; }
    public void setBuildingId(String buildingId) { this.buildingId = buildingId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getJibunAddress() { return jibunAddress; }
    public void setJibunAddress(String jibunAddress) { this.jibunAddress = jibunAddress; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getWelfare() { return welfare; }
    public void setWelfare(String welfare) { this.welfare = welfare; }
    public int getFactorCount() { return factorCount; }
    public void setFactorCount(int factorCount) { this.factorCount = factorCount; }
    public List<String> getFactors() { return factors; }
    public void setFactors(List<String> factors) { this.factors = factors == null ? new ArrayList<>() : new ArrayList<>(factors); }
    public List<CriterionValue> getCriteria() { return criteria; }
    public void setCriteria(List<CriterionValue> criteria) { this.criteria = criteria == null ? new ArrayList<>() : new ArrayList<>(criteria); }
    public boolean isIncludeBasement() { return includeBasement; }
    public void setIncludeBasement(boolean includeBasement) { this.includeBasement = includeBasement; }
    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
