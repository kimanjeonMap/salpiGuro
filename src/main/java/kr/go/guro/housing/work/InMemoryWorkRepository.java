package kr.go.guro.housing.work;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Repository;

/**
 * 메모리 저장소 (서버를 재시작하면 초기화됨).
 * 업무 리스트 화면 확인을 위해 샘플 13건을 넣어 둔다.
 */
@Repository
public class InMemoryWorkRepository implements WorkRepository {

    private final Map<String, Work> store = new ConcurrentHashMap<>();

    public InMemoryWorkRepository() {
        seed();
    }

    @Override
    public List<Work> findAll() {
        return new ArrayList<>(store.values());
    }

    @Override
    public Optional<Work> findById(String id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<Work> findByBuildingId(String buildingId) {
        return store.values().stream().filter(w -> w.getBuildingId().equals(buildingId)).findFirst();
    }

    @Override
    public Work save(Work work) {
        store.put(work.getId(), work);
        return work;
    }

    @Override
    public boolean deleteById(String id) {
        return store.remove(id) != null;
    }

    @Override
    public long count() {
        return store.size();
    }

    private void seed() {
        String[][] rows = {
            // 장소명, 도로명주소, 지번주소, 건물ID
            {"한울빌라", "개봉로3길 12", "개봉동 152-3", "B1153010700005"},
            {"미래하이츠", "고척로21길 8", "고척동 211-7", "B1153010600012"},
            {"오류동 285-12 다세대주택", "오리로11길 30", "오류동 285-12", "B1153010800009"},
            {"청솔빌라", "가마산로9길 41", "구로동 140-21", "B1153010200017"},
            {"삼익연립", "남부순환로5길 17", "가리봉동 190-4", "B1153010300003"},
            {"궁동 330-4 다가구주택", "궁동로14길 6", "궁동 330-4", "B1153010900021"},
            {"대림맨션", "신도림로7길 25", "신도림동 108-2", "B1153010100014"},
            {"새봄빌", "온수로3길 19", "온수동 351-8", "B1153011000006"},
            {"현대빌라", "천왕로2길 44", "천왕동 380-15", "B1153011100011"},
            {"개봉동 226-9 단독주택", "개봉로17길 3", "개봉동 226-9", "B1153010700028"},
            {"은하빌라", "고척로8길 52", "고척동 239-1", "B1153010600030"},
            {"해오름빌", "항동로4길 9", "항동 420-6", "B1153011200008"},
            {"우성하이빌", "가마산로22길 15", "구로동 161-27", "B1153010200033"}
        };
        String[] statuses = {"현장조사 중", "승인 처리 중", "신청 승인 완료", "반려"};
        String[] welfare = {"주거급여", "긴급복지(주거지원)", "주거취약계층 이주지원", "주택 개보수 지원", "미지정"};
        String[] memos = {"반지하 세대 거주 여부 현장 확인 필요", "고령 1인 가구 다수, 장마철 침수 이력 문의", "",
                "집주인 연락처 확보 필요", "이주지원 대상 여부 검토 중"};
        String[] labels = {"노후", "급경사", "병원 접근성", "복지시설 접근성", "정류장 접근성", "저지대"};

        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES);
        for (int i = 0; i < rows.length; i++) {
            int cnt = (i * 7) % 5 + 2;
            LocalDateTime t = now.minusHours(i * 37L).minusMinutes((i % 4) * 41L);
            Work w = new Work();
            w.setId(String.format("W%05d", i + 1));
            w.setName(rows[i][0]);
            w.setAddress("서울특별시 구로구 " + rows[i][1]);
            w.setJibunAddress("서울특별시 구로구 " + rows[i][2]);
            w.setBuildingId(rows[i][3]);
            w.setStatus(i > 8 && i % 4 == 3 ? statuses[3] : statuses[i % 3]);
            w.setWelfare(welfare[i % welfare.length]);
            w.setFactorCount(cnt);
            w.setFactors(List.of(labels).subList(0, cnt));
            w.setMemo(memos[i % memos.length]);
            w.setCreatedBy("system");
            w.setUpdatedBy("system");
            w.setCreatedAt(t);
            w.setUpdatedAt(t);
            store.put(w.getId(), w);
        }
    }
}
