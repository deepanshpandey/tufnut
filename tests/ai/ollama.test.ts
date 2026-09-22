// ─────────────────────────────────────────────────────────────────────────────
// Tests: Ollama provider
// ─────────────────────────────────────────────────────────────────────────────

import { callOllama, listOllamaModels } from "../../src/ai/providers/ollama";
import type { AICompletionRequest } from "../../src/types";

// ── Fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok:   status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

const baseRequest: AICompletionRequest = {
  config: {
    provider:  "ollama",
    apiKey:    "",
    model:     "llama3.2",
    ollamaUrl: "http://localhost:11434",
  },
  systemPrompt: "You are a tutor.",
  messages: [
    { role: "user", content: "Help me understand binary search.", timestamp: 0 },
  ],
};

// ── callOllama ────────────────────────────────────────────────────────────────

describe("callOllama", () => {
  beforeEach(() => mockFetch.mockReset());

  it("calls the correct endpoint with the correct body", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ message: { content: "What do you think the midpoint represents?" } })
    );

    await callOllama(baseRequest);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({
        method:  "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("llama3.2");
    expect(body.stream).toBe(false);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
  });

  it("returns the response content from message.content", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ message: { content: "What is the invariant of the loop?" } })
    );

    const result = await callOllama(baseRequest);
    expect(result.content).toBe("What is the invariant of the loop?");
    expect(result.error).toBeUndefined();
  });

  it("returns a helpful error when Ollama is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await callOllama(baseRequest);
    expect(result.content).toBe("");
    expect(result.error).toContain("ollama serve");
  });

  it("returns an error for non-ok HTTP responses", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ error: "model not found" }, 404)
    );

    const result = await callOllama(baseRequest);
    expect(result.content).toBe("");
    expect(result.error).toContain("404");
  });

  it("uses the ollamaUrl from config, stripping trailing slash", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ message: { content: "Hint" } })
    );

    await callOllama({
      ...baseRequest,
      config: { ...baseRequest.config, ollamaUrl: "http://myserver:11434/" },
    });

    const calledUrl = (mockFetch.mock.calls[0][0] as string);
    expect(calledUrl).toBe("http://myserver:11434/api/chat");
  });

  it("defaults to localhost:11434 when ollamaUrl is not set", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ message: { content: "Hint" } })
    );

    const reqWithoutUrl: AICompletionRequest = {
      ...baseRequest,
      config: { provider: "ollama", apiKey: "", model: "llama3.2" },
    };
    await callOllama(reqWithoutUrl);

    const calledUrl = (mockFetch.mock.calls[0][0] as string);
    expect(calledUrl).toBe("http://localhost:11434/api/chat");
  });
});

// ── listOllamaModels ──────────────────────────────────────────────────────────

describe("listOllamaModels", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns model names from /api/tags", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({
        models: [
          { name: "llama3.2" },
          { name: "codellama" },
          { name: "mistral" },
        ],
      })
    );

    const models = await listOllamaModels("http://localhost:11434");
    expect(models).toEqual(["llama3.2", "codellama", "mistral"]);
  });

  it("returns empty array when server is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const models = await listOllamaModels("http://localhost:11434");
    expect(models).toEqual([]);
  });

  it("returns empty array on non-ok response", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}, 503));
    const models = await listOllamaModels("http://localhost:11434");
    expect(models).toEqual([]);
  });
});
