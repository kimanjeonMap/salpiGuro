package kr.go.guro.housing.work;

import java.util.List;
import java.util.Optional;

/**
 * 업무 저장소. 현재는 메모리 구현(InMemoryWorkRepository)이며,
 * DB 연동 시 MyBatis Mapper 또는 JPA Repository 구현체로 교체한다.
 */
public interface WorkRepository {

    List<Work> findAll();

    Optional<Work> findById(String id);

    Optional<Work> findByBuildingId(String buildingId);

    Work save(Work work);

    boolean deleteById(String id);

    long count();
}
