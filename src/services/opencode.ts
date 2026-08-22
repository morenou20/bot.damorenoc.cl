import { env } from "../config/env.js";

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type CompletionResult =
	| { ok: true; text: string; model: string }
	| { ok: false; status: number; message: string };

type ChatCompletionsPayload = {
	choices?: Array<{ message?: { content?: string } }>;
	error?: { message?: string };
};

function modelChain(): string[] {
	const fallbacks = env.OPENCODE_FALLBACK_MODELS.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	return [env.OPENCODE_MODEL, ...fallbacks];
}

async function requestModel(
	model: string,
	messages: ChatMessage[],
	maxOutputTokens: number,
): Promise<CompletionResult> {
	const endpoint = `${env.OPENCODE_BASE_URL.replace(/\/+$/, "")}/chat/completions`;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.OPENCODE_API_KEY}`,
			},
			body: JSON.stringify({
				model,
				messages,
				max_tokens: maxOutputTokens,
			}),
			signal: controller.signal,
		});
	} catch (error) {
		clearTimeout(timer);
		if (error instanceof Error && error.name === "AbortError") {
			return {
				ok: false,
				status: 504,
				message: `Provider timed out after ${env.REQUEST_TIMEOUT_MS}ms.`,
			};
		}
		return {
			ok: false,
			status: 502,
			message:
				error instanceof Error
					? error.message
					: "Provider network request failed.",
		};
	}
	clearTimeout(timer);

	let payload: ChatCompletionsPayload;
	try {
		payload = (await response.json()) as ChatCompletionsPayload;
	} catch {
		payload = {};
	}

	if (!response.ok) {
		return {
			ok: false,
			status:
				response.status === 401 || response.status === 403
					? 502
					: response.status,
			message:
				payload?.error?.message ??
				`Provider request failed with status ${response.status}.`,
		};
	}

	const reply = payload?.choices?.[0]?.message?.content;

	if (typeof reply !== "string" || !reply.trim()) {
		return {
			ok: false,
			status: 502,
			message: "Provider returned an empty response.",
		};
	}

	return { ok: true, text: reply.trim(), model };
}

export async function generateContent(
	messages: ChatMessage[],
	maxOutputTokens = env.MAX_OUTPUT_TOKENS,
): Promise<CompletionResult> {
	let lastError: CompletionResult = {
		ok: false,
		status: 502,
		message: "No provider models configured.",
	};

	for (const model of modelChain()) {
		lastError = await requestModel(model, messages, maxOutputTokens);
		if (lastError.ok) return lastError;
		if (lastError.status === 401 || lastError.status === 403) break;
	}

	return lastError;
}
