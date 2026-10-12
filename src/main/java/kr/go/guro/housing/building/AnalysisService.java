package kr.go.guro.housing.building;

import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import kr.go.guro.housing.building.dto.BuildingDetail;
import kr.go.guro.housing.building.dto.BuildingPoint;
import kr.go.guro.housing.building.dto.Cluster;
import kr.go.guro.housing.building.dto.DongInfo;
import kr.go.guro.housing.building.dto.Factor;
import kr.go.guro.housing.building.dto.Indicator;
import kr.go.guro.housing.building.dto.Summary;

/**
 * 취약요인 판정·집계. 기준값은 요청마다 달라질 수 있으므로 저장된 판정 결과가 아니라 원시 지표로 매번 계산한다.
 */
@Service
public class AnalysisService {

    private final BuildingRepository repo;
    private final int riskMin;   // 구 단위 집계에서 '위험시설'로 보는 최소 취약요인 수
    private final double refLat; // 묶음 격자의 기준위도 (전체 건물 평균 위도로 고정)

    public AnalysisService(BuildingRepository repo, @Value("${app.analysis.risk-min:3}") int riskMin) {
        this.repo = repo;
        this.riskMin = riskMin;
        this.refLat = repo.findAll().stream().mapToDouble(Building::lat).average().orElse(37.5);
    }

    public List<Factor> evaluate(Building b, Criteria c) {
        int year = Year.now().getValue();
        List<Factor> out = new ArrayList<>();
        Integer age = b.ageYears(year);
        if (c.ageOn() && age != null && age >= c.age()) {
            out.add(new Factor("age", "노후", b.useDate().getYear() + "년 사용승인, " + age + "년 경과 (기준 " + c.age() + "년)"));
        }
        if (c.slopeOn() && b.slopeDeg() != null && b.slopeDeg() >= c.slope()) {
            out.add(new Factor("slope", "급경사", fmt(b.slopeDeg(), 1) + "° (기준 " + fmt(c.slope(), 0) + "° 이상)"));
        }
        if (c.hospitalOn() && b.hospDist() > c.hospital()) {
            out.add(new Factor("hospital", "병원 접근성", "가장 가까운 병원 " + nz(b.hospNm()) + " " + fmt(b.hospDist(), 0) + " m (기준 " + c.hospital() + " m)"));
        }
        if (c.welfareOn() && b.welfDist() > c.welfare()) {
            out.add(new Factor("welfare", "복지시설 접근성", "가장 가까운 복지시설 " + nz(b.welfNm()) + " " + fmt(b.welfDist(), 0) + " m (기준 " + c.welfare() + " m)"));
        }
        if (c.busOn() && b.busDist() > c.bus()) {
            out.add(new Factor("bus", "정류장 접근성", "가장 가까운 정류장 " + nz(b.busNm()) + " " + fmt(b.busDist(), 0) + " m (기준 " + c.bus() + " m)"));
        }
        if (c.lowlandOn() && b.elevM() != null && b.elevM() <= c.lowland()) {
            out.add(new Factor("lowland", "저지대", "해발 " + fmt(b.elevM(), 1) + " m (기준 " + fmt(c.lowland(), 0) + " m 이하)"));
        }
        if (c.basement() && b.hasBasement()) {
            out.add(new Factor("basement", "지하층", "지하 " + b.ugrndFlr() + "층 보유 건물 (지하층 주거 등록 자료 없음 → 지하층 유무로 판정)"));
        }
        return out;
    }

    public BuildingPoint toPoint(Building b, Criteria c) {
        int cnt = evaluate(b, c).size();
        return new BuildingPoint(b.bldId(), b.lng(), b.lat(), cnt, b.useGroup(), b.useLabel(),
                b.strctNm() == null || b.strctNm().isBlank() ? "구조 미상" : b.strctNm(),
                b.useDate() == null ? null : b.useDate().getYear(), b.grndFlr(), b.ugrndFlr(), b.shortAddr(), b.dongName());
    }

    /** 지도에 먼저 보여줄 순서 : 취약요인 많은 순 → 오래된 건물 순 → 건물 ID 순 */
    private static final Comparator<BuildingPoint> MAP_ORDER =
            Comparator.comparingInt(BuildingPoint::count).reversed()
                    .thenComparing(BuildingPoint::year, Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(BuildingPoint::id);

    /**
     * 지도 범위(bbox: minLng,minLat,maxLng,maxLat) 안의 건물 포인트.
     * 취약요인이 많은 건물부터 최대 limit개만 돌려준다 (limit ≤ 0 이면 전부).
     */
    public List<BuildingPoint> points(Criteria c, double[] bbox, int limit) {
        Stream<BuildingPoint> s = repo.findAll().stream()
                .filter(b -> bbox == null || (b.lng() >= bbox[0] && b.lng() <= bbox[2] && b.lat() >= bbox[1] && b.lat() <= bbox[3]))
                .map(b -> toPoint(b, c))
                .sorted(MAP_ORDER);
        return (limit > 0 ? s.limit(limit) : s).toList();
    }

    /** 취약요인 수 최댓값 (age, slope, hospital, welfare, bus, lowland, basement) */
    private static final int MAX_FACTORS = 7;

    /**
     * 지도 묶음 : bbox 안 건물을 격자로 묶는다.
     * - 격자는 경도 cellLng 도 × 위도 (cellLng × cos 기준위도) 도로, 땅 위에서(화면에서도) 정사각형이 되도록 맞춘다.
     *   예) 250 m 격자 = cellLng 250 / (111,319.49 × cos 37.5°)
     * - 격자 원점과 기준위도를 고정해서, 지도를 옮겨도 같은 건물은 같은 칸에 묶인다.
     * - snap=true 이면 bbox 를 칸 경계까지 넓혀서, 화면 가장자리 묶음도 칸 전체 건물 수를 보여준다.
     *   (snap=false 는 bbox 안 건물만 정확히 집계할 때 : 구역 목록 패널의 분포)
     */
    public List<Cluster> clusters(Criteria c, double[] bbox, double cellLng, boolean snap) {
        double cell = Math.max(1e-5, Math.min(cellLng, 5.0));
        double cellLat = cell * Math.cos(Math.toRadians(refLat));
        if (bbox != null && snap) {
            bbox = new double[] {
                    Math.floor(bbox[0] / cell) * cell, Math.floor(bbox[1] / cellLat) * cellLat,
                    (Math.floor(bbox[2] / cell) + 1) * cell, (Math.floor(bbox[3] / cellLat) + 1) * cellLat };
        }

        Map<Long, ClusterAcc> cells = new HashMap<>();
        for (Building b : repo.findAll()) {
            if (bbox != null && (b.lng() < bbox[0] || b.lng() > bbox[2] || b.lat() < bbox[1] || b.lat() > bbox[3])) continue;
            long ix = (long) Math.floor(b.lng() / cell);
            long iy = (long) Math.floor(b.lat() / cellLat);
            long key = (ix << 32) ^ (iy & 0xFFFFFFFFL);   // 칸 번호 (경도 칸, 위도 칸) → 하나의 키
            cells.computeIfAbsent(key, k -> new ClusterAcc(ix, iy)).add(b, evaluate(b, c).size());
        }
        List<Cluster> out = new ArrayList<>(cells.size());
        for (ClusterAcc a : cells.values()) {
            BuildingPoint single = a.size == 1 ? toPoint(a.first, c) : null;
            double[] cellExt = { a.ix * cell, a.iy * cellLat, (a.ix + 1) * cell, (a.iy + 1) * cellLat };
            out.add(new Cluster(a.sumLng / a.size, a.sumLat / a.size, a.size, a.risk, a.max, a.hist,
                    new double[] { a.minLng, a.minLat, a.maxLng, a.maxLat }, cellExt, single));
        }
        return out;
    }

    /** 묶음 한 칸의 누적값 */
    private final class ClusterAcc {
        final long ix, iy;
        ClusterAcc(long ix, long iy) { this.ix = ix; this.iy = iy; }
        int size, risk, max;
        final int[] hist = new int[MAX_FACTORS + 1];
        double sumLng, sumLat;
        double minLng = Double.MAX_VALUE, minLat = Double.MAX_VALUE, maxLng = -Double.MAX_VALUE, maxLat = -Double.MAX_VALUE;
        Building first;

        void add(Building b, int count) {
            if (first == null) first = b;
            size++;
            hist[Math.min(count, MAX_FACTORS)]++;
            if (count >= riskMin) risk++;
            max = Math.max(max, count);
            sumLng += b.lng(); sumLat += b.lat();
            minLng = Math.min(minLng, b.lng()); maxLng = Math.max(maxLng, b.lng());
            minLat = Math.min(minLat, b.lat()); maxLat = Math.max(maxLat, b.lat());
        }
    }

    public Summary summary(Criteria c) {
        List<Building> all = repo.findAll();
        long risk = 0;
        Map<String, Long> byDong = new LinkedHashMap<>();
        for (Building b : all) {
            if (evaluate(b, c).size() >= riskMin) {
                risk++;
                byDong.merge(b.dongName(), 1L, Long::sum);
            }
        }
        return new Summary(all.size(), risk, riskMin, byDong);
    }

    public List<DongInfo> dongs() {
        Map<String, List<Building>> grouped = new LinkedHashMap<>();
        for (Building b : repo.findAll()) grouped.computeIfAbsent(b.dongCode(), k -> new ArrayList<>()).add(b);
        List<DongInfo> out = new ArrayList<>();
        grouped.forEach((code, list) -> {
            double lng = list.stream().mapToDouble(Building::lng).average().orElse(0);
            double lat = list.stream().mapToDouble(Building::lat).average().orElse(0);
            out.add(new DongInfo(code, list.get(0).dongName(), lng, lat, list.size()));
        });
        out.sort(Comparator.comparing(DongInfo::name));
        return out;
    }

    /** 동 선택 + 세부 주소(지번, 용도, 건물번호) 검색 */
    public List<BuildingPoint> search(String dongCode, String q, Criteria c, int limit) {
        String nq = q == null ? "" : q.replaceAll("\\s", "").toLowerCase(Locale.ROOT);
        return repo.findAll().stream()
                .filter(b -> dongCode == null || dongCode.isBlank() || b.dongCode().equals(dongCode))
                .filter(b -> nq.isEmpty() || (nz(b.addr()) + nz(b.useNm()) + b.bldId() + nz(b.pnu()))
                        .replaceAll("\\s", "").toLowerCase(Locale.ROOT).contains(nq))
                .limit(limit)
                .map(b -> toPoint(b, c))
                .toList();
    }

    public Optional<BuildingDetail> detail(String bldId, Criteria c) {
        return repo.findById(bldId).map(b -> {
            List<Factor> factors = evaluate(b, c);
            Integer age = b.ageYears(Year.now().getValue());
            List<Indicator> ind = List.of(
                    new Indicator("age", "사용승인", b.useDate() == null ? "자료 없음" : b.useDate() + " (" + age + "년)", age == null ? "na" : judge(c.ageOn(), age >= c.age())),
                    new Indicator("slope", "경사", b.slopeDeg() == null ? "자료 없음" : fmt(b.slopeDeg(), 1) + "°", b.slopeDeg() == null ? "na" : judge(c.slopeOn(), b.slopeDeg() >= c.slope())),
                    new Indicator("lowland", "고도", b.elevM() == null ? "자료 없음" : fmt(b.elevM(), 1) + " m", b.elevM() == null ? "na" : judge(c.lowlandOn(), b.elevM() <= c.lowland())),
                    new Indicator("hospital", "병원 · " + nz(b.hospNm()), fmt(b.hospDist(), 0) + " m", judge(c.hospitalOn(), b.hospDist() > c.hospital())),
                    new Indicator("welfare", "복지시설 · " + nz(b.welfNm()), fmt(b.welfDist(), 0) + " m", judge(c.welfareOn(), b.welfDist() > c.welfare())),
                    new Indicator("bus", "정류장 · " + nz(b.busNm()), fmt(b.busDist(), 0) + " m", judge(c.busOn(), b.busDist() > c.bus())),
                    new Indicator("basement", "지하층", b.ugrndFlr() == null ? "자료 없음" : b.hasBasement() ? "지하 " + b.ugrndFlr() + "층" : "없음", b.hasBasement() ? (c.basement() ? "hit" : "na") : "ok"),
                    new Indicator("flood", "침수횟수", b.floodCnt() + "회", b.floodCnt() > 0 ? "warn" : "info"),
                    new Indicator("viol", "위반건축물", b.violYn() == null ? "자료 없음" : b.violYn() ? "해당" : "해당 없음", "info"));
            return new BuildingDetail(toPoint(b, c), b.fid(), b.pnu(), b.addr(), b.useDate(), b.violYn(), b.floodCnt(),
                    b.hospNm(), b.hospDist(), b.welfNm(), b.welfDist(), b.busNm(), b.busDist(), b.elevM(), b.slopeDeg(),
                    factors, ind);
        });
    }

    private static String judge(boolean on, boolean hit) { return !on ? "na" : hit ? "hit" : "ok"; }
    private static String nz(String s) { return s == null ? "" : s; }
    private static String fmt(double v, int d) { return String.format(Locale.ROOT, "%,." + d + "f", v); }
}