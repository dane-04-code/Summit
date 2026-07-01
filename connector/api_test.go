package main

import "testing"

func TestApiAllowed(t *testing.T) {
	allowed := []struct{ method, path string }{
		{"GET", "/api/jobs"},
		{"GET", "/api/jobs/abc123"},
		{"POST", "/api/jobs/abc/run"},
		{"POST", "/api/jobs/abc/pause"},
		{"POST", "/api/jobs/abc/resume"},
		{"POST", "/v1/runs/r1/approval"},
		{"POST", "/v1/runs/r1/stop"},
		{"GET", "/v1/capabilities"},
		{"GET", "/health"},
	}
	for _, c := range allowed {
		if !apiAllowed(c.method, c.path) {
			t.Errorf("expected allowed: %s %s", c.method, c.path)
		}
	}

	denied := []struct{ method, path string }{
		{"GET", "/api/jobs/abc/run"},       // read-only method on an action route
		{"POST", "/api/jobs"},              // can't create jobs from the app
		{"DELETE", "/api/jobs/abc"},        // can't delete jobs from the app
		{"GET", "/api/sessions"},           // not on the list
		{"GET", "/api/jobs/abc/../secret"}, // path traversal attempt
		{"GET", "/api/jobs/abc/runs"},      // not permitted
		{"POST", "/v1/runs/r1/events"},     // not permitted
		{"GET", "/"},                       // root
		{"GET", "/api/jobs/a/b"},           // extra segment
	}
	for _, c := range denied {
		if apiAllowed(c.method, c.path) {
			t.Errorf("expected denied: %s %s", c.method, c.path)
		}
	}
}
