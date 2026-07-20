package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// SettledReply is one completed agent turn waiting for the phone to persist it.
// It lives on the user's connector host, never in the hosted relay.
type SettledReply struct {
	ID        string `json:"id"`
	ReqID     string `json:"reqId"`
	SessionID string `json:"sessionId"`
	Status    string `json:"status"`
	Content   string `json:"content"`
	Error     string `json:"error,omitempty"`
	CreatedAt int64  `json:"createdAt"`
}

const maxPendingReplies = 100

// replyOutbox is a small acknowledged queue. A disk-backed queue matters here:
// the connector may restart while the phone is still off. Writes are atomic
// and the file is owner-only because settled replies contain transcript text.
type replyOutbox struct {
	mu    sync.Mutex
	path  string
	items []SettledReply
}

func newReplyOutbox(path string) (*replyOutbox, error) {
	o := &replyOutbox{path: path}
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return o, nil
		}
		return nil, err
	}
	if len(b) > 0 {
		if err := json.Unmarshal(b, &o.items); err != nil {
			return nil, fmt.Errorf("read reply outbox: %w", err)
		}
	}
	return o, nil
}

func defaultReplyOutbox() (*replyOutbox, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	return newReplyOutbox(filepath.Join(home, ".summit", "reply_outbox.json"))
}

func newEventID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err == nil {
		return hex.EncodeToString(b)
	}
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func (o *replyOutbox) add(reply SettledReply) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	if reply.ID == "" {
		reply.ID = newEventID()
	}
	if reply.CreatedAt == 0 {
		reply.CreatedAt = time.Now().UnixMilli()
	}
	o.items = append(o.items, reply)
	if len(o.items) > maxPendingReplies {
		o.items = append([]SettledReply(nil), o.items[len(o.items)-maxPendingReplies:]...)
	}
	return o.saveLocked()
}

func (o *replyOutbox) list() []SettledReply {
	o.mu.Lock()
	defer o.mu.Unlock()
	return append([]SettledReply(nil), o.items...)
}

func (o *replyOutbox) ack(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	wanted := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		wanted[id] = struct{}{}
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	kept := o.items[:0]
	for _, item := range o.items {
		if _, ok := wanted[item.ID]; !ok {
			kept = append(kept, item)
		}
	}
	o.items = kept
	return o.saveLocked()
}

func (o *replyOutbox) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(o.path), 0700); err != nil {
		return err
	}
	b, err := json.Marshal(o.items)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(o.path), "reply_outbox-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(b); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, o.path)
}
