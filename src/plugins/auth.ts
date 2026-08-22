import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

const PUBLIC_PATHS = new Set(["/healthz", "/readyz"]);

export async function internalAuth(
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> {
	if (PUBLIC_PATHS.has(request.url.split("?")[0] ?? "")) return;

	const header = request.headers.authorization ?? "";
	const expected = `Bearer ${env.BOT_INTERNAL_KEY}`;

	if (header.length !== expected.length || header !== expected) {
		await reply.code(401).send({ ok: false, message: "Unauthorized." });
	}
}
