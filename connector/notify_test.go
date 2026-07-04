package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNotifyHandler(t *testing.T) {
	t.Run("503 while the relay connection is down", func(t *testing.T) {
		n := &notifier{}
		rec := httptest.NewRecorder()
		n.handleNotify(rec, httptest.NewRequest("POST", "/notify", strings.NewReader(`{"title":"x"}`)))
		if rec.Code != 503 {
			t.Errorf("got %d, want 503", rec.Code)
		}
	})

	t.Run("forwards title and body as a notify frame", func(t *testing.T) {
		n := &notifier{}
		var got Frame
		n.setSender(func(f Frame) error { got = f; return nil })

		rec := httptest.NewRecorder()
		n.handleNotify(rec, httptest.NewRequest("POST", "/notify",
			strings.NewReader(`{"title":"Approval needed","body":"Deploy to prod?"}`)))

		if rec.Code != 200 {
			t.Fatalf("got %d, want 200 (body: %s)", rec.Code, rec.Body.String())
		}
		if got.T != "notify" || got.Title != "Approval needed" || got.Body != "Deploy to prod?" {
			t.Errorf("frame = %+v", got)
		}
	})

	t.Run("empty title and body are allowed (relay applies defaults)", func(t *testing.T) {
		n := &notifier{}
		var got Frame
		n.setSender(func(f Frame) error { got = f; return nil })

		rec := httptest.NewRecorder()
		n.handleNotify(rec, httptest.NewRequest("POST", "/notify", strings.NewReader(`{}`)))
		if rec.Code != 200 {
			t.Fatalf("got %d, want 200", rec.Code)
		}
		if got.T != "notify" {
			t.Errorf("frame = %+v", got)
		}
	})

	t.Run("rejects non-POST", func(t *testing.T) {
		n := &notifier{}
		rec := httptest.NewRecorder()
		n.handleNotify(rec, httptest.NewRequest("GET", "/notify", nil))
		if rec.Code != 405 {
			t.Errorf("got %d, want 405", rec.Code)
		}
	})

	t.Run("rejects malformed JSON", func(t *testing.T) {
		n := &notifier{}
		n.setSender(func(Frame) error { return nil })
		rec := httptest.NewRecorder()
		n.handleNotify(rec, httptest.NewRequest("POST", "/notify", strings.NewReader(`{nope`)))
		if rec.Code != 400 {
			t.Errorf("got %d, want 400", rec.Code)
		}
	})

	t.Run("truncates oversized title and body", func(t *testing.T) {
		n := &notifier{}
		var got Frame
		n.setSender(func(f Frame) error { got = f; return nil })
		long := strings.Repeat("a", 1000)
		rec := httptest.NewRecorder()
		n.handleNotify(rec, httptest.NewRequest("POST", "/notify",
			strings.NewReader(`{"title":"`+long+`","body":"`+long+`"}`)))
		if rec.Code != 200 {
			t.Fatalf("got %d, want 200", rec.Code)
		}
		if len(got.Title) > 256 || len(got.Body) > 256 {
			t.Errorf("title/body not truncated: %d/%d", len(got.Title), len(got.Body))
		}
	})
}
