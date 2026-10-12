package kr.go.guro.housing.work;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import kr.go.guro.housing.auth.LoginUser;
import kr.go.guro.housing.work.dto.PageResponse;
import kr.go.guro.housing.work.dto.SaveResult;
import kr.go.guro.housing.work.dto.WorkSaveRequest;
import kr.go.guro.housing.work.dto.WorkSearchCondition;
import kr.go.guro.housing.work.dto.WorkSummary;

/**
 * 보관함(업무) REST API
 */
@RestController
@RequestMapping("/api/works")
public class WorkApiController {

    private final WorkService workService;

    public WorkApiController(WorkService workService) {
        this.workService = workService;
    }

    /** GET /api/works?q=&status=&welfare=&from=2026-10-01&to=2026-10-12&sort=recent&page=1&size=8 */
    @GetMapping
    public PageResponse<Work> search(@ModelAttribute WorkSearchCondition condition) {
        return workService.search(condition);
    }

    /** 업무 단계별 건수 */
    @GetMapping("/summary")
    public WorkSummary summary() {
        return workService.summary();
    }

    /** 건물 ID로 보관함 항목 조회. 없으면 204 */
    @GetMapping("/by-building/{buildingId}")
    public ResponseEntity<Work> byBuilding(@PathVariable("buildingId") String buildingId) {
        return workService.findByBuilding(buildingId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** 보관함에 저장 (같은 건물이면 갱신) */
    @PostMapping
    public SaveResult save(@Valid @RequestBody WorkSaveRequest request, @AuthenticationPrincipal LoginUser user) {
        return workService.save(request, user.getEmpNo());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") String id) {
        return workService.delete(id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
