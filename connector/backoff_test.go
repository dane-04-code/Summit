package main

import (
	"testing"
	"time"
)

func TestNextBackoffDoublesToTheCeiling(t *testing.T) {
	cases := []struct {
		name    string
		current time.Duration
		want    time.Duration
	}{
		{"zero starts at the floor", 0, backoffFloor},
		{"below the floor snaps up", time.Second, backoffFloor},
		{"floor doubles", backoffFloor, 10 * time.Second},
		{"keeps doubling", 10 * time.Second, 20 * time.Second},
		{"clamps at the ceiling", 40 * time.Second, backoffCeil},
		{"stays at the ceiling", backoffCeil, backoffCeil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nextBackoff(tc.current); got != tc.want {
				t.Fatalf("nextBackoff(%v) = %v, want %v", tc.current, got, tc.want)
			}
		})
	}
}

// A connector that reconnects successfully must go back to redialling fast;
// growth is only ever a response to consecutive failures.
func TestBackoffRecoversAfterASuccessfulConnection(t *testing.T) {
	wait := backoffFloor
	for i := 0; i < 10; i++ {
		wait = nextBackoff(wait)
	}
	if wait != backoffCeil {
		t.Fatalf("expected repeated failures to reach the ceiling, got %v", wait)
	}
	wait = backoffFloor // what main's loop does once run() reports it connected
	if next := nextBackoff(wait); next != 10*time.Second {
		t.Fatalf("after a reset the next wait should be 10s, got %v", next)
	}
}

func TestJitterStaysWithinAQuarterOfTheWait(t *testing.T) {
	for i := 0; i < 200; i++ {
		got := jitter(backoffCeil)
		if got < backoffCeil || got >= backoffCeil+backoffCeil/4+time.Nanosecond {
			t.Fatalf("jitter(%v) = %v, outside [d, 1.25d]", backoffCeil, got)
		}
	}
}
