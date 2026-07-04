package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
)

// notifier gives agent-side callers (Hermes cron jobs, skills, any local
// script) a door to the phone:
//
//	curl -s localhost:8643/notify -d '{"title":"Approval needed","body":"Deploy to prod?"}'
//
// becomes a notify frame to the relay, which pushes to the paired device when
// the app is away. Bound to loopback only — anything that can reach it is
// already on the agent's machine. The Hermes server itself is inbound-only;
// this endpoint is how the agent reaches out.
type notifier struct {
	mu   sync.Mutex
	send func(Frame) error // nil while the relay connection is down
}

func (n *notifier) setSender(send func(Frame) error) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.send = send
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max]
	}
	return s
}

func (n *notifier) handleNotify(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		w.Write([]byte(`{"error":"POST only"}`))
		return
	}
	var body struct {
		Title string `json:"title"`
		Body  string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error":"body must be JSON: {\"title\":..., \"body\":...}"}`))
		return
	}

	n.mu.Lock()
	send := n.send
	n.mu.Unlock()
	if send == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"error":"relay not connected"}`))
		return
	}
	if err := send(Frame{T: "notify", Title: truncate(body.Title, 256), Body: truncate(body.Body, 256)}); err != nil {
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(`{"error":"send failed"}`))
		return
	}
	w.Write([]byte(`{"ok":true}`))
}

// startNotifyServer serves the loopback notify endpoint for the process's
// lifetime; run() swaps the sender in and out as the relay connection cycles.
func startNotifyServer(n *notifier, port string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/notify", n.handleNotify)
	go func() {
		if err := http.ListenAndServe("127.0.0.1:"+port, mux); err != nil {
			log.Printf("notify server: %v", err)
		}
	}()
}
