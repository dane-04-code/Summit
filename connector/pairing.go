package main

import (
	"os"
	"path/filepath"
	"strings"
)

// Pairing-code format. Mirror of /protocol/pairingCode.ts — keep in sync.
// The connector never mints a code (the relay does); it only prints one and
// checks that what it saved still looks like a code before reclaiming it.
const pairingAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const pairingCodeLength = 8

// formatPairingCode renders K7M29XQP as K7M2-9XQP. Display only — the wire and
// the saved identity file always hold the unhyphenated form.
func formatPairingCode(code string) string {
	if len(code) != pairingCodeLength {
		return code
	}
	return code[:4] + "-" + code[4:]
}

// isChannelLocator reports whether a string can legitimately name a pairing
// channel: the current 8-character format, or a legacy 6-digit code still held
// by an install that paired before the format changed. Guards the saved
// identity file so a truncated or hand-edited one is discarded rather than
// dialled with.
func isChannelLocator(code string) bool {
	if len(code) == 6 {
		for _, ch := range code {
			if ch < '0' || ch > '9' {
				return false
			}
		}
		return true
	}
	if len(code) != pairingCodeLength {
		return false
	}
	for _, ch := range code {
		if !strings.ContainsRune(pairingAlphabet, ch) {
			return false
		}
	}
	return true
}

func summitDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".summit"), nil
}

// saveRelayIdentity persists the channel locator and the connector's durable
// token so a restart rejoins the same channel instead of stranding the phone.
func saveRelayIdentity(code, token string) error {
	dir, err := summitDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "pairing_code"), []byte(code+"\n"), 0600); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "connector_token"), []byte(token+"\n"), 0600)
}

// clearRelayIdentity drops the saved channel so the next dial mints a fresh
// code. Only ever called for a code that lapsed before anyone paired with it —
// clearing a paired channel would orphan the phone.
func clearRelayIdentity() {
	dir, err := summitDir()
	if err != nil {
		return
	}
	os.Remove(filepath.Join(dir, "pairing_code"))
	os.Remove(filepath.Join(dir, "connector_token"))
}
