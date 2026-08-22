import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateContent } from "../services/opencode.js";

const jsonSchema = z.object({
	system: z.string().trim().min(1).max(16000),
	messages: z
		.array(
			z.object({
				role: z.enum(["user", "assistant"]),
				content: z.string().min(1).max(30000),
			}),
		)
		.min(1)
		.max(20),
	maxTokens: z.number().int().positive().max(8000).optional(),
});

export async function jsonRoutes(app: FastifyInstance): Promise<void> {
	app.post("/v1/json", async (request, reply) => {
		const parsed = jsonSchema.safeParse(request.body);

		if (!parsed.success) {
			return reply.code(400).send({
				ok: false,
				message: "Invalid request body.",
				details: parsed.error.flatten().fieldErrors,
			});
		}

		const { system, messages, maxTokens } = parsed.data;
		const result = await generateContent(
			[
				{ role: "system", content: system },
				...messages.map((item) => ({ role: item.role, content: item.content })),
			],
			maxTokens,
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
