const assert = require("node:assert/strict");
const http = require("node:http");
const { after, afterEach, before, beforeEach, describe, it } = require("node:test");
const app = require("../app");

const originalFetch = global.fetch;
const originalApiKey = process.env.GROQ_API_KEY;
let server;
let baseUrl;

function request(path, { method = "GET", body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(`${baseUrl}${path}`, {
      method,
      headers: payload ? {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
      } : {},
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let data;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          return reject(new Error(`API returned invalid JSON: ${text}`));
        }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe("Med Alert medical assistant API", () => {
  before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-groq-secret";
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
  });

  after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("reports a healthy API", async () => {
    assert.deepEqual(await request("/api/health"), { status: 200, data: { status: "ok" } });
  });

  it("rejects empty, oversize, and malformed requests", async () => {
    assert.equal((await request("/api/medical-assistant", { method: "POST", body: { message: " " } })).status, 400);
    assert.equal((await request("/api/medical-assistant", { method: "POST", body: { message: "x".repeat(2001) } })).status, 400);
    assert.equal((await request("/api/medical-assistant", { method: "POST", body: { message: "hello", history: [{ role: "user", text: "unanswered" }] } })).status, 400);

    const malformed = await new Promise((resolve, reject) => {
      const req = http.request(`${baseUrl}/api/medical-assistant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
      });
      req.on("error", reject);
      req.end("{invalid");
    });
    assert.equal(malformed.status, 400);
    assert.match(malformed.data.error, /valid JSON/i);
  });

  it("fails explicitly when the server-side API key is not configured", async () => {
    delete process.env.GROQ_API_KEY;
    const result = await request("/api/medical-assistant", { method: "POST", body: { message: "What should I do?" } });
    assert.equal(result.status, 503);
    assert.match(result.data.error, /GROQ_API_KEY/);
  });

  it("sends the key only in Authorization header and maps Groq response to the reply", async () => {
    let capturedRequest;
    global.fetch = async (url, options) => {
      capturedRequest = { url: String(url), options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Call emergency services now." } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const result = await request("/api/medical-assistant", {
      method: "POST",
      body: {
        message: "I have sudden chest pain",
        history: [{ role: "user", text: "Earlier?" }, { role: "assistant", text: "General information only." }],
      },
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { reply: "Call emergency services now." });
    assert.equal(capturedRequest.url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(capturedRequest.options.headers.Authorization, "Bearer test-groq-secret");
    assert.equal(capturedRequest.url.includes("test-groq-secret"), false);
    const payload = JSON.parse(capturedRequest.options.body);
    assert.equal(payload.messages[0].role, "system");
    assert.equal(payload.messages[0].content.includes("not to wait for your response"), true);
    assert.equal(payload.messages[0].content.includes("Do not prescribe medication or dosage."), true);
    assert.equal(payload.messages[1].role, "user");
    assert.equal(payload.messages[1].content, "Earlier?");
    assert.equal(payload.messages[2].role, "assistant");
    assert.equal(payload.messages[2].content, "General information only.");
    assert.equal(payload.messages[3].role, "user");
    assert.equal(payload.messages[3].content, "I have sudden chest pain");
    assert.equal(capturedRequest.options.signal.aborted, false);
  });

  it("accepts the maximum conversation size through the JSON body parser", async () => {
    let receivedMessages = 0;
    global.fetch = async (_url, options) => {
      receivedMessages = JSON.parse(options.body).messages.length;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "General information only." } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const history = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      text: "🩺".repeat(1000),
    }));

    const result = await request("/api/medical-assistant", {
      method: "POST",
      body: { message: "What should I do?", history },
    });

    assert.equal(result.status, 200);
    assert.equal(receivedMessages, 10); // 1 system + 8 history + 1 user
  });

  it("reports an upstream timeout with a retryable 504 response", async () => {
    global.fetch = async () => {
      throw Object.assign(new Error("request timed out"), { name: "TimeoutError" });
    };
    const result = await request("/api/medical-assistant", { method: "POST", body: { message: "What should I do?" } });
    assert.equal(result.status, 504);
    assert.match(result.data.error, /too long to respond/i);
    assert.match(result.data.error, /emergency services now/i);
  });

  it("handles Groq errors and malformed upstream responses explicitly", async (t) => {
    await t.test("upstream error", async () => {
      global.fetch = async () => new Response(JSON.stringify({ error: { message: "provider details" } }), { status: 429 });
      const result = await request("/api/medical-assistant", { method: "POST", body: { message: "What should I do?" } });
      assert.equal(result.status, 502);
      assert.match(result.data.error, /could not complete/i);
    });

    await t.test("invalid JSON", async () => {
      global.fetch = async () => new Response("not json", { status: 200 });
      const result = await request("/api/medical-assistant", { method: "POST", body: { message: "What should I do?" } });
      assert.equal(result.status, 502);
      assert.match(result.data.error, /returned no guidance/i);
    });

    await t.test("no text candidate", async () => {
      global.fetch = async () => new Response(JSON.stringify({ choices: [] }), { status: 200 });
      const result = await request("/api/medical-assistant", { method: "POST", body: { message: "What should I do?" } });
      assert.equal(result.status, 502);
      assert.match(result.data.error, /returned no guidance/i);
    });
  });
});
