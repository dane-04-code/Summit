package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// streamChat calls Hermes /v1/chat/completions with stream:true and returns a
// channel of frames (chunk per token, then done; error on any failure).
func streamChat(messages []ChatMessage, sessionID, sessionKey, baseURL, apiKey string) <-chan Frame {
	ch := make(chan Frame, 64)
	go func() {
		defer close(ch)

		payload, err := json.Marshal(map[string]interface{}{
			"model":    "hermes",
			"messages": messages,
			"stream":   true,
		})
		if err != nil {
			ch <- Frame{T: "error", Message: fmt.Sprintf("marshal: %v", err)}
			return
		}

		req, err := http.NewRequest("POST", baseURL+"/v1/chat/completions", bytes.NewReader(payload))
		if err != nil {
			ch <- Frame{T: "error", Message: fmt.Sprintf("build request: %v", err)}
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+apiKey)
		if sessionID != "" {
			req.Header.Set("X-Hermes-Session-Id", sessionID)
		}
		if sessionKey != "" {
			req.Header.Set("X-Hermes-Session-Key", sessionKey)
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			ch <- Frame{T: "error", Message: fmt.Sprintf("http: %v", err)}
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			ch <- Frame{T: "error", Message: fmt.Sprintf("hermes %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))}
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				break
			}
			var ev struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}
			if err := json.Unmarshal([]byte(data), &ev); err != nil {
				continue
			}
			if len(ev.Choices) > 0 && ev.Choices[0].Delta.Content != "" {
				ch <- Frame{T: "chunk", Delta: ev.Choices[0].Delta.Content}
			}
		}
		ch <- Frame{T: "done"}
	}()
	return ch
}
