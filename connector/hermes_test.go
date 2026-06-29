package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStreamChat_parsesDeltas(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		fmt.Fprintln(w, `data: {"choices":[{"delta":{"content":"He"}}]}`)
		fmt.Fprintln(w, `data: {"choices":[{"delta":{"content":"llo"}}]}`)
		fmt.Fprintln(w, "data: [DONE]")
		w.(http.Flusher).Flush()
	}))
	defer srv.Close()

	msgs := []ChatMessage{{Role: "user", Content: "hi"}}
	frames := streamChat(msgs, srv.URL, "test-key")

	var got []Frame
	for f := range frames {
		got = append(got, f)
	}

	if len(got) != 3 {
		t.Fatalf("expected 3 frames, got %d: %+v", len(got), got)
	}
	if got[0].T != "chunk" || got[0].Delta != "He" {
		t.Errorf("frame 0: %+v", got[0])
	}
	if got[1].T != "chunk" || got[1].Delta != "llo" {
		t.Errorf("frame 1: %+v", got[1])
	}
	if got[2].T != "done" {
		t.Errorf("frame 2: %+v", got[2])
	}
}

func TestStreamChat_propagatesHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintln(w, `{"error":"invalid key"}`)
	}))
	defer srv.Close()

	frames := streamChat([]ChatMessage{{Role: "user", Content: "hi"}}, srv.URL, "bad")
	var got []Frame
	for f := range frames {
		got = append(got, f)
	}

	if len(got) != 1 || got[0].T != "error" {
		t.Fatalf("expected one error frame, got %+v", got)
	}
}
