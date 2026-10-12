package kr.go.guro.housing.assistant;

import java.util.List;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * AI 업무 도우미 (대화 하나). 실제 답변 생성은 추후 LLM 과 연동 (현재는 고정 응답).
 * 연동할 때는 history(앞의 대화) + question 을 순서대로 LLM 메시지로 넘기면 대화가 이어진다.
 */
@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

    /** 앞의 대화 한 줄. role : user(담당자) | assistant(도우미) */
    public record Turn(@NotBlank @Pattern(regexp = "user|assistant") String role,
                       @NotBlank @Size(max = 2000) String content) {
    }

    public record AssistantRequest(@NotBlank @Size(max = 1000) String question,
                                   @Valid @Size(max = 20) List<Turn> history) {
    }

    public record AssistantResponse(String answer) {
    }

    @PostMapping
    public AssistantResponse ask(@Valid @RequestBody AssistantRequest req) {
        return new AssistantResponse("답변 생성 기능은 추후 연결됩니다.");
    }
}