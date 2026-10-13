package kr.go.guro.housing.building;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import kr.go.guro.housing.building.dto.BuildingDetail;
import kr.go.guro.housing.building.dto.BuildingPoint;
import kr.go.guro.housing.building.dto.Cluster;
import kr.go.guro.housing.building.dto.DongInfo;
import kr.go.guro.housing.building.dto.Summary;

/**
 * 건물·분석 API (기준값은 Criteria 쿼리 파라미터로 받음)
 */
@RestController
@RequestMapping("/api")
public class BuildingApiController {

    private final AnalysisService analysis;

    public BuildingApiController(AnalysisService analysis) {
        this.analysis = analysis;
    }

    /** 동 목록 (PNU 앞 10자리 + 주소에서 산출) */
    @GetMapping("/regions/dongs")
    public List<DongInfo> dongs() {
        return analysis.dongs();
    }

    /** 건축물용도 목록과 건물 수 (좌측 용도 체크박스용) */
    @GetMapping("/buildings/uses")
    public Map<String, Long> uses() {
        return analysis.uses();
    }

    /** 구 단위 집계 : 전체 건물 수, 취약요인 N개 이상 건물 수, 동별 분포 */
    @GetMapping("/buildings/summary")
    public Summary summary(@ModelAttribute Criteria criteria) {
        return analysis.summary(criteria.normalized());
    }

    /**
     * 지도 범위 안의 건물 포인트. bbox=minLng,minLat,maxLng,maxLat (없으면 전체)
     * 한 화면에 최대 limit개(기본 20)만, 취약요인이 많은 건물부터 돌려준다. limit=0 이면 전부.
     */
    @GetMapping("/buildings")
    public List<BuildingPoint> points(@ModelAttribute Criteria criteria,
                                      @RequestParam(name = "bbox", required = false) String bbox,
                                      @RequestParam(name = "limit", defaultValue = "20") int limit) {
        return analysis.points(criteria.normalized(), parseBbox(bbox), limit);
    }

    /**
     * 지도 묶음. 화면 격자 한 칸(cell, 경도 기준 도 단위)에 들어간 건물을 하나로 묶어 돌려준다.
     * 예) /api/buildings/clusters?bbox=126.85,37.49,126.87,37.50&cell=0.0012&age=30&ageOn=true...
     * snap=false 로 주면 bbox 를 칸 경계로 넓히지 않고 bbox 안 건물만 집계한다.
     */
    @GetMapping("/buildings/clusters")
    public List<Cluster> clusters(@ModelAttribute Criteria criteria,
                                  @RequestParam(name = "bbox", required = false) String bbox,
                                  @RequestParam(name = "cell") double cell,
                                  @RequestParam(name = "snap", defaultValue = "true") boolean snap) {
        return analysis.clusters(criteria.normalized(), parseBbox(bbox), cell, snap);
    }

    /** bbox=minLng,minLat,maxLng,maxLat → double[4] (없거나 형식이 다르면 null = 전체) */
    private static double[] parseBbox(String bbox) {
        if (bbox == null || bbox.isBlank()) return null;
        String[] p = bbox.split(",");
        if (p.length != 4) return null;
        double[] box = new double[4];
        for (int i = 0; i < 4; i++) box[i] = Double.parseDouble(p[i].trim());
        return box;
    }

    /** 세부 주소 검색 (동 선택 + 지번/용도/건물번호) */
    @GetMapping("/buildings/search")
    public List<BuildingPoint> search(@ModelAttribute Criteria criteria,
                                      @RequestParam(name = "dong", required = false) String dongCode,
                                      @RequestParam(name = "q", required = false) String q) {
        return analysis.search(dongCode, q, criteria.normalized(), 20);
    }

    @GetMapping("/buildings/{bldId}")
    public ResponseEntity<BuildingDetail> detail(@PathVariable("bldId") String bldId, @ModelAttribute Criteria criteria) {
        return analysis.detail(bldId, criteria.normalized())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}