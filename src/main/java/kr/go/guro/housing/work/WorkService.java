package kr.go.guro.housing.work;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import kr.go.guro.housing.work.dto.PageResponse;
import kr.go.guro.housing.work.dto.SaveResult;
import kr.go.guro.housing.work.dto.WorkSaveRequest;
import kr.go.guro.housing.work.dto.WorkSearchCondition;
import kr.go.guro.housing.work.dto.WorkSummary;

@Service
public class WorkService {

    public static final List<String> STATUSES = List.of("현장조사 중", "승인 처리 중", "신청 승인 완료", "반려");
    private static final String ALL = "전체";
    private static final int DEFAULT_PAGE_SIZE = 8;

    private final WorkRepository repository;

    public WorkService(WorkRepository repository) {
        this.repository = repository;
    }

    public long count() {
        return repository.count();
    }

    public PageResponse<Work> search(WorkSearchCondition c) {
        Stream<Work> s = repository.findAll().stream();

        if (StringUtils.hasText(c.q())) {
            String q = stripSpaces(c.q());
            s = s.filter(w -> stripSpaces(nz(w.getName()) + nz(w.getAddress()) + nz(w.getJibunAddress())).contains(q));
        }
        if (StringUtils.hasText(c.status()) && !ALL.equals(c.status())) {
            s = s.filter(w -> c.status().equals(w.getStatus()));
        }
        if (StringUtils.hasText(c.welfare()) && !ALL.equals(c.welfare())) {
            s = s.filter(w -> c.welfare().equals(w.getWelfare()));
        }
        if (c.from() != null) {
            LocalDateTime start = c.from().atStartOfDay();
            s = s.filter(w -> !w.getUpdatedAt().isBefore(start));
        }
        if (c.to() != null) {
            LocalDateTime end = c.to().plusDays(1).atStartOfDay();
            s = s.filter(w -> w.getUpdatedAt().isBefore(end));
        }

        Comparator<Work> recent = Comparator.comparing(Work::getUpdatedAt).reversed();
        Comparator<Work> order = switch (c.sort() == null ? "recent" : c.sort()) {
            case "riskHigh" -> Comparator.comparingInt(Work::getFactorCount).reversed().thenComparing(recent);
            case "riskLow" -> Comparator.comparingInt(Work::getFactorCount).thenComparing(recent);
            default -> recent;
        };
        List<Work> all = s.sorted(order).toList();

        int size = c.size() == null ? DEFAULT_PAGE_SIZE : Math.max(1, Math.min(c.size(), 50));
        int total = all.size();
        int totalPages = Math.max(1, (int) Math.ceil(total / (double) size));
        int page = c.page() == null ? 1 : Math.max(1, Math.min(c.page(), totalPages));
        int from = (page - 1) * size;
        List<Work> content = all.subList(Math.min(from, total), Math.min(from + size, total));
        return new PageResponse<>(content, page, size, total, totalPages);
    }

    public WorkSummary summary() {
        List<Work> all = repository.findAll();
        Map<String, Long> byStatus = new LinkedHashMap<>();
        STATUSES.forEach(st -> byStatus.put(st, all.stream().filter(w -> st.equals(w.getStatus())).count()));
        return new WorkSummary(all.size(), byStatus);
    }

    public Optional<Work> findByBuilding(String buildingId) {
        return repository.findByBuildingId(buildingId);
    }

    /** 같은 건물이 이미 보관함에 있으면 내용을 갱신하고(업무 단계 유지), 없으면 '현장조사 중'으로 새로 등록한다. */
    public synchronized SaveResult save(WorkSaveRequest req, String empNo) {
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        Work w = repository.findByBuildingId(req.buildingId()).orElse(null);
        boolean created = w == null;
        if (created) {
            w = new Work();
            w.setId("W" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            w.setBuildingId(req.buildingId());
            w.setStatus(STATUSES.get(0));
            w.setWelfare("미지정");
            w.setCreatedAt(now);
            w.setCreatedBy(empNo);
        }
        w.setName(req.name());
        w.setAddress(req.address());
        w.setJibunAddress(req.jibunAddress());
        w.setFactorCount(req.factorCount());
        w.setFactors(req.factors());
        w.setCriteria(req.criteria());
        w.setIncludeBasement(req.includeBasement());
        w.setMemo(req.memo() == null ? "" : req.memo().trim());
        w.setUpdatedAt(now);
        w.setUpdatedBy(empNo);
        repository.save(w);
        return new SaveResult(w, created);
    }

    public boolean delete(String id) {
        return repository.deleteById(id);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String stripSpaces(String s) {
        return s.replaceAll("\\s", "");
    }
}
