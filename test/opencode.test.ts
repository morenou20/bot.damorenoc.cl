import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.HOST = "127.0.0.1";
process.env.PORT = "18010";
process.env.BOT_INTERNAL_KEY = "unit-test-internal-key-0123456789";
process.env.OPENCODE_API_KEY = "unit-test-provider-key";
process.env.OPENCODE_BASE_URL = "https://opencode.example.test/v1";
process.env.OPENCODE_MODEL = "big-pickle";
process.env.OPENCODE_FALLBACK_MODELS = "x-preview-f-free,nemotron-3-ultra-free";

const { generateContent } = await import("../src/services/opencode.js");

function mockFetchOnce(payload: unknown, status = 200): void {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(payload), {
					status,
					headers: { "Content-Type": "application/json" },
				}),
		),
	);
}

describe("generateContent (OpenCode Zen client)", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("returns trimmed text and model on success", async () => {
		mockFetchOnce({
			choices: [{ message: { content: "  Hola, soy Matty.  " } }],
		});

		const result = await generateContent(
			[{ role: "user", content: "hola" }],
			100,
		);

		expect(result).toEqual({
			ok: true,
			text: "Hola, soy Matty.",
			model: "big-pickle",
		});
	});

	it("maps provider 401 to status 502", async () => {
		mockFetchOnce({ error: { message: "bad key" } }, 401);

		const result = await generateContent([{ role: "user", content: "x" }]);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(502);
			expect(result.message).toBe("bad key");
		}
	});

	it("passes through provider 429 quota errors", async () => {
		mockFetchOnce({ error: { message: "quota" } }, 429);

		const result = await generateContent([{ role: "user", content: "x" }]);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(429);
		}
	});

	it("maps empty completion content to 502", async () => {
		mockFetchOnce({ choices: [{ message: { content: "   " } }] });

		const result = await generateContent([{ role: "user", content: "x" }]);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(502);
		}
	});

	it("maps network failure to 502", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("ECONNREFUSED");
			}),
		);

		const result = await generateContent([{ role: "user", content: "x" }]);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(502);
			expect(result.message).toContain("ECONNREFUSED");
		}
	});

	it("falls back to next model when primary is rate limited", async () => {
		const triedModels: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init?: RequestInit) => {
				const body = JSON.parse(String(init?.body)) as { model: string };
				triedModels.push(body.model);
				if (body.model === "big-pickle") {
					return new Response(
						JSON.stringify({
							error: { message: "FreeUsageLimitError" },
						}),
						{ status: 429 },
					);
				}
				return new Response(
					JSON.stringify({
						choices: [{ message: { content: "hola desde fallback" } }],
					}),
					{ status: 200 },
				);
			}),
		);

		const result = await generateContent([{ role: "user", content: "x" }]);

		expect(triedModels[0]).toBe("big-pickle");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.model).toBe("x-preview-f-free");
			expect(result.text).toBe("hola desde fallback");
		}
	});
});
