package main

import "testing"

func TestAgentIdentity(t *testing.T) {
	cases := []struct {
		name          string
		frameworkEnv  string
		nameEnv       string
		wantFramework string
		wantName      string
	}{
		{"defaults to hermes", "", "", "hermes", "Hermes"},
		{"explicit hermes", "hermes", "", "hermes", "Hermes"},
		{"generic framework defaults name to Agent", "openai", "", "openai", "Agent"},
		{"explicit name wins", "openai", "Ollama box", "openai", "Ollama box"},
		{"framework is normalized", " Hermes ", "", "hermes", "Hermes"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			framework, name := agentIdentity(c.frameworkEnv, c.nameEnv)
			if framework != c.wantFramework || name != c.wantName {
				t.Errorf("agentIdentity(%q, %q) = (%q, %q), want (%q, %q)",
					c.frameworkEnv, c.nameEnv, framework, name, c.wantFramework, c.wantName)
			}
		})
	}
}
