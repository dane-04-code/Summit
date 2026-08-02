package main

import "testing"

// The alphabet is duplicated across three files (protocol/pairingCode.ts,
// src/agents/relay/pairingCode.ts, and here). Pin it so a drift shows up as a
// test failure rather than as codes the relay mints and the connector rejects.
func TestPairingAlphabetMatchesTheOtherMirrors(t *testing.T) {
	const want = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
	if pairingAlphabet != want {
		t.Fatalf("alphabet drifted: got %q want %q", pairingAlphabet, want)
	}
	if pairingCodeLength != 8 {
		t.Fatalf("code length drifted: got %d want 8", pairingCodeLength)
	}
	for _, ambiguous := range []rune{'I', 'L', 'O', 'U'} {
		for _, ch := range pairingAlphabet {
			if ch == ambiguous {
				t.Fatalf("alphabet contains misread character %q", ambiguous)
			}
		}
	}
}

func TestFormatPairingCode(t *testing.T) {
	if got := formatPairingCode("K7M29XQP"); got != "K7M2-9XQP" {
		t.Fatalf("got %q want K7M2-9XQP", got)
	}
	// Legacy codes and anything unexpected print as-is rather than mis-grouped.
	if got := formatPairingCode("481920"); got != "481920" {
		t.Fatalf("got %q want 481920", got)
	}
}

func TestIsChannelLocator(t *testing.T) {
	valid := []string{"K7M29XQP", "00000000", "481920"}
	for _, code := range valid {
		if !isChannelLocator(code) {
			t.Errorf("expected %q to be a valid locator", code)
		}
	}

	invalid := []string{
		"",
		"K7M29XQ",   // too short
		"K7M29XQPZ", // too long
		"K7M29XQU",  // U is not in the alphabet
		"k7m29xqp",  // the wire form is always uppercase
		"48192",     // not a legacy code either
		"../../etc/passwd",
	}
	for _, code := range invalid {
		if isChannelLocator(code) {
			t.Errorf("expected %q to be rejected", code)
		}
	}
}

// A saved file that no longer parses must be discarded rather than dialled
// with: reclaiming a garbage locator just fails the relay's format gate, and
// the user would see a connector that never produces a code.
func TestSavedRelayIdentityDiscardsAMalformedCode(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("USERPROFILE", t.TempDir())

	if err := saveRelayIdentity("not-a-code", "tok"); err != nil {
		t.Fatalf("save: %v", err)
	}
	if code, token := savedRelayIdentity(); code != "" || token != "" {
		t.Fatalf("expected malformed identity to be ignored, got %q/%q", code, token)
	}

	if err := saveRelayIdentity("K7M29XQP", "tok"); err != nil {
		t.Fatalf("save: %v", err)
	}
	if code, _ := savedRelayIdentity(); code != "K7M29XQP" {
		t.Fatalf("expected saved code back, got %q", code)
	}

	clearRelayIdentity()
	if code, _ := savedRelayIdentity(); code != "" {
		t.Fatalf("expected cleared identity, got %q", code)
	}
}
