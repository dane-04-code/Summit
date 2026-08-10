package main

import (
	"math/rand"
	"time"
)

// Redial pacing. A fixed retry interval is what turns a transient relay refusal
// into a standing one: the relay throttles pairing attempts per IP, so a
// connector that redials at a constant rate can hold its own IP over the limit
// indefinitely and lock out the phone trying to pair from the same network.
const (
	backoffFloor = 5 * time.Second
	backoffCeil  = 60 * time.Second
)

// nextBackoff doubles a wait up to the ceiling. Callers reset to backoffFloor
// once a connection actually establishes, so a healthy connector that drops now
// and then always reconnects promptly — the delay only grows while failures do.
func nextBackoff(current time.Duration) time.Duration {
	if current < backoffFloor {
		return backoffFloor
	}
	doubled := current * 2
	if doubled > backoffCeil {
		return backoffCeil
	}
	return doubled
}

// jitter spreads the wait over [d, 1.25d). Connectors that were disconnected by
// the same event — a relay deploy drops every WebSocket at once — would
// otherwise all come back in the same instant and recreate the pile-up.
func jitter(d time.Duration) time.Duration {
	return d + time.Duration(rand.Int63n(int64(d/4)+1))
}
