package kr.go.guro.housing.building;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Repository;

import jakarta.annotation.PostConstruct;

/**
 * 건물 테이블을 CSV에서 읽어 메모리에 보관한다.
 * PostGIS 전환 시 이 클래스만 DB 조회(MyBatis/JPA)로 바꾸면 된다.
 *
 * - 헤더 이름으로 컬럼을 찾으므로 컬럼 순서가 달라도 되고, 대소문자(Hosp_Dist)도 무시한다.
 * - 빈 셀(건축물대장 미연계, DEM 범위 밖)은 null 로 두어 판정에서 제외한다. 0 으로 채우면 저지대·노후로 잘못 잡힌다.
 * - 거리 3종은 모두 m 단위. 병원 거리 0~1 m 는 병원이 같은 건물에 있는 경우.
 */
@Repository
public class BuildingRepository {

    private static final Logger log = LoggerFactory.getLogger(BuildingRepository.class);

    private final ResourceLoader loader;
    private final String csvLocation;
    private List<Building> buildings = List.of();
    private Map<String, Building> byId = Map.of();

    public BuildingRepository(ResourceLoader loader,
                              @Value("${app.data.buildings-csv:classpath:data/buildings.csv}") String csvLocation) {
        this.loader = loader;
        this.csvLocation = csvLocation;
    }

    @PostConstruct
    void load() {
        Resource res = loader.getResource(csvLocation);
        List<Building> list = new ArrayList<>();
        int noRegister = 0, noDem = 0;
        try (BufferedReader br = new BufferedReader(new InputStreamReader(res.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = br.readLine();
            if (headerLine == null) throw new IllegalStateException("빈 CSV: " + csvLocation);
            if (headerLine.startsWith("\uFEFF")) headerLine = headerLine.substring(1);
            Map<String, Integer> col = new HashMap<>();
            List<String> headers = parseLine(headerLine);
            for (int i = 0; i < headers.size(); i++) col.put(headers.get(i).trim().toLowerCase(Locale.ROOT), i);
            require(col, "bld_id", "pnu", "use_nm", "use_date", "grnd_flr", "ugrnd_flr", "elev_m", "slope_deg",
                    "hosp_nm", "hosp_dist", "bus_nm", "bus_dist", "welf_nm", "welf_dist", "lng", "lat", "addr");

            String line;
            long lineNo = 1;
            while ((line = br.readLine()) != null) {
                lineNo++;
                if (line.isBlank()) continue;
                List<String> v = parseLine(line);
                try {
                    String viol = get(v, col, "viol_yn");
                    Double elev = dblOrNull(get(v, col, "elev_m"));
                    Building b = new Building(
                            (long) dbl(get(v, col, "fid"), lineNo - 1),
                            get(v, col, "bld_id"),
                            get(v, col, "pnu"),
                            get(v, col, "use_nm"),
                            get(v, col, "strct_nm"),
                            date(get(v, col, "use_date")),
                            viol.isBlank() ? null : "Y".equalsIgnoreCase(viol),
                            intOrNull(get(v, col, "grnd_flr")),
                            intOrNull(get(v, col, "ugrnd_flr")),
                            elev,
                            dblOrNull(get(v, col, "slope_deg")),
                            (int) dbl(get(v, col, "flood_cnt")),
                            get(v, col, "hosp_nm"), dbl(get(v, col, "hosp_dist")),
                            get(v, col, "bus_nm"), dbl(get(v, col, "bus_dist")),
                            get(v, col, "welf_nm"), dbl(get(v, col, "welf_dist")),
                            dbl(get(v, col, "lng")), dbl(get(v, col, "lat")),
                            get(v, col, "addr"));
                    if (b.bldId().isBlank() || b.lng() == 0 || b.lat() == 0) continue;
                    if (b.useDate() == null) noRegister++;
                    if (elev == null) noDem++;
                    list.add(b);
                } catch (RuntimeException e) {
                    log.warn("건물 CSV {}행 건너뜀: {}", lineNo, e.getMessage());
                }
            }
        } catch (IOException e) {
            throw new IllegalStateException("건물 CSV를 읽을 수 없습니다: " + csvLocation, e);
        }
        Map<String, Building> map = new HashMap<>();
        list.forEach(b -> map.put(b.bldId(), b));
        this.buildings = Collections.unmodifiableList(list);
        this.byId = Collections.unmodifiableMap(map);
        log.info("건물 {}동 적재 ({})", list.size(), csvLocation);
        if (noRegister > 0) log.info("사용승인일 없는 건물 {}동 → 노후 요인 판정 제외", noRegister);
        if (noDem > 0) log.info("고도 값 없는 건물 {}동 → 저지대 요인 판정 제외", noDem);
    }

    public List<Building> findAll() { return buildings; }

    public Optional<Building> findById(String bldId) { return Optional.ofNullable(byId.get(bldId)); }

    /* ---------- CSV 파서 (따옴표·쉼표 처리) ---------- */
    static List<String> parseLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean q = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (q) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') { sb.append('"'); i++; }
                    else q = false;
                } else sb.append(c);
            } else if (c == '"') q = true;
            else if (c == ',') { out.add(sb.toString()); sb.setLength(0); }
            else sb.append(c);
        }
        out.add(sb.toString());
        return out;
    }

    private static void require(Map<String, Integer> col, String... names) {
        for (String n : names) if (!col.containsKey(n)) throw new IllegalStateException("건물 CSV에 컬럼이 없습니다: " + n);
    }

    private static String get(List<String> v, Map<String, Integer> col, String name) {
        Integer i = col.get(name);
        return i == null || i >= v.size() ? "" : v.get(i).trim();
    }

    private static double dbl(String s) { return dbl(s, 0); }

    private static Double dblOrNull(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return null; }
    }

    private static Integer intOrNull(String s) {
        Double d = dblOrNull(s);
        return d == null ? null : d.intValue();
    }

    private static double dbl(String s, double def) {
        if (s == null || s.isBlank()) return def;
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return def; }
    }

    private static LocalDate date(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim().replace('.', '-').replace('/', '-');
        try {
            if (t.length() == 8 && t.chars().allMatch(Character::isDigit)) {   // 19960115
                return LocalDate.of(Integer.parseInt(t.substring(0, 4)), Integer.parseInt(t.substring(4, 6)), Integer.parseInt(t.substring(6, 8)));
            }
            return LocalDate.parse(t.length() > 10 ? t.substring(0, 10) : t);
        } catch (DateTimeParseException | NumberFormatException e) {
            return null;
        }
    }
}
