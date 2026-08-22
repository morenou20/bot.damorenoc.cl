import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { generateContent } from "../services/opencode.js";
import { buildChatMessages } from "../services/prompt.js";

const chatSchema = z.object({
	message: z.string().trim().min(1).max(4000),
	history: z
		.array(
			z.object({
				role: z.enum(["user", "assistant"]),
				content: z.string().max(6000),
			}),
		)
		.max(40)
		.optional(),
	systemPrompt: z.string().max(8000).optional(),
	maxTokens: z.number().int().positive().max(4000).optional(),
});

export async function chatRoutes(app: FastifyInstance): Promise<void> {
	app.post("/v1/chat", async (request, reply) => {
		const parsed = chatSchema.safeParse(request.body);

		if (!parsed.success) {
			return reply.code(400).send({
				ok: false,
				message: "Invalid request body.",
				details: parsed.error.flatten().fieldErrors,
			});
		}

		const { message, history, systemPrompt, maxTokens } = parsed.data;
		const result = await generateContent(
			buildChatMessages(message, history ?? [], systemPrompt),
			maxTokens ?? env.MAX_OUTPUT_TOKENS,
		);

		if (!result.ok) {
			return reply
				.code(result.status >= 400 && result.status < 600 ? result.status : 502)
				.send({
					ok: false,
					message: result.message,
				});
		}

		return reply.send({ ok: true, text: result.text, model: result.model });
	});
}
