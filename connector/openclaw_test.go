package main

import (
	"encoding/json"
	"testing"
)

func TestTranslateEvent(t *testing.T) {
	const runID = "req-1"

	assistant := `{"type":"event","event":"session.message","payload":{
		"sessionKey":"agent:main:main",
		"message":{"role":"assistant","content":[{"type":"text","text":"PONG"}],"stopReason":"end_turn"},
		"messageId":"m2","messageSeq":2}}`
	userEcho := `{"type":"event","event":"session.message","payload":{
		"message":{"role":"user","content":[{"type":"text","text":"hi"}]}}}`
	agentLifecycle := `{"type":"event","event":"agent","payload":{"runId":"req-1","stream":"lifecycle","data":{"phase":"start"}}}`
	chatDone := `{"type":"event","event":"chat","payload":{"runId":"req-1","state":"done","errorMessage":null}}`
	chatErr := `{"type":"event","event":"chat","payload":{"runId":"req-1","state":"error","errorMessage":"boom"}}`
	otherRun := `{"type":"event","event":"chat","payload":{"runId":"other","state":"done"}}`

	if f, ok := translateEvent([]byte(assistant), runID); !ok || f.T != "chunk" || f.Delta != "PONG" {
		t.Errorf("assistant: got %+v ok=%v", f, ok)
	}
	if _, ok := translateEvent([]byte(userEcho), runID); ok {
		t.Errorf("user echo should be skipped")
	}
	if _, ok := translateEvent([]byte(agentLifecycle), runID); ok {
		t.Errorf("agent lifecycle should be skipped in phase 1")
	}
	if f, ok := translateEvent([]byte(chatDone), runID); !ok || f.T != "done" {
		t.Errorf("chat done: got %+v ok=%v", f, ok)
	}
	if f, ok := translateEvent([]byte(chatErr), runID); !ok || f.T != "error" || f.Message != "boom" {
		t.Errorf("chat error: got %+v ok=%v", f, ok)
	}
	if _, ok := translateEvent([]byte(otherRun), runID); ok {
		t.Errorf("chat for other runId should be skipped")
	}
}

func TestBuildFrames(t *testing.T) {
	connectRaw, id := buildConnect("tok-123")
	if id == "" {
		t.Fatal("connect id must be non-empty")
	}
	var connect map[string]any
	if err := json.Unmarshal(connectRaw, &connect); err != nil {
		t.Fatalf("connect not JSON: %v", err)
	}
	if connect["method"] != "connect" || connect["id"] != id {
		t.Errorf("connect envelope wrong: %v", connect)
	}
	params := connect["params"].(map[string]any)
	client := params["client"].(map[string]any)
	if client["id"] != "gateway-client" || client["mode"] != "backend" {
		t.Errorf("client identity wrong: %v", client)
	}
	if params["role"] != "operator" {
		t.Errorf("role wrong: %v", params["role"])
	}
	auth := params["auth"].(map[string]any)
	if auth["token"] != "tok-123" {
		t.Errorf("token wrong: %v", auth)
	}

	var sub map[string]any
	json.Unmarshal(buildSubscribe("main"), &sub)
	subParams := sub["params"].(map[string]any)
	if sub["method"] != "sessions.messages.subscribe" || subParams["key"] != "main" {
		t.Errorf("subscribe wrong: %v", sub)
	}
	if _, hasSessionKey := subParams["sessionKey"]; hasSessionKey {
		t.Errorf("subscribe must use key, not sessionKey")
	}

	var send map[string]any
	json.Unmarshal(buildChatSend("hello", "main", "idem-1"), &send)
	sendParams := send["params"].(map[string]any)
	if send["method"] != "chat.send" || sendParams["message"] != "hello" ||
		sendParams["idempotencyKey"] != "idem-1" || sendParams["sessionKey"] != "main" {
		t.Errorf("chat.send wrong: %v", send)
	}
}
