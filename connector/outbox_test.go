package main

import (
	"path/filepath"
	"testing"
)

func TestReplyOutboxPersistsAndAcknowledges(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reply_outbox.json")
	outbox, err := newReplyOutbox(path)
	if err != nil {
		t.Fatal(err)
	}
	reply := SettledReply{ID: "event-1", ReqID: "req-1", SessionID: "session-1", Status: "done", Content: "hello", CreatedAt: 10}
	if err := outbox.add(reply); err != nil {
		t.Fatal(err)
	}

	reloaded, err := newReplyOutbox(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := reloaded.list(); len(got) != 1 || got[0] != reply {
		t.Fatalf("reloaded replies = %#v", got)
	}
	if err := reloaded.ack([]string{"event-1"}); err != nil {
		t.Fatal(err)
	}
	if got := reloaded.list(); len(got) != 0 {
		t.Fatalf("replies after ack = %#v", got)
	}
}

func TestReplyOutboxIsBounded(t *testing.T) {
	outbox, err := newReplyOutbox(filepath.Join(t.TempDir(), "reply_outbox.json"))
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < maxPendingReplies+1; i++ {
		if err := outbox.add(SettledReply{ID: newEventID(), Status: "done"}); err != nil {
			t.Fatal(err)
		}
	}
	if got := len(outbox.list()); got != maxPendingReplies {
		t.Fatalf("outbox length = %d, want %d", got, maxPendingReplies)
	}
}
