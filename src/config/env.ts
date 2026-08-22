import { z } from "zod";

const envSchema = z.object({
	HOST: z.string().default("127.0.0.1"),
	PORT: z.coerce.number().int().positive().default(8080),

	BOT_INTERNAL_KEY: z.string().min(16),

	OPENCODE_API_KEY: z.string().min(8),
	OPENCODE_BASE_URL: z.string().url().default("https://opencode.ai/zen/v1"),
	OPENCODE_MODEL: z.string().default("big-pickle"),
	OPENCODE_FALLBACK_MODELS: z
		.string()
		.default("x-preview-f-free,nemotron-3-ultra-free"),

	REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
	MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(700),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error(
		"[bot] Invalid environment configuration:",
		parsed.error.flatten().fieldErrors,
	);
	process.exit(1);
}

export const env = parsed.data;
