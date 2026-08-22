import type { ChatMessage } from "./opencode.js";

export const MATTY_SYSTEM_PROMPT = [
	"Eres Matty, asistente comercial de Danny's Software Studio.",
	"Tu objetivo es orientar, pedir contexto util y mover la conversacion hacia contacto comercial.",
	"Responde siempre en espanol claro, breve y profesional.",
	"No inventes precios exactos ni compromisos tecnicos sin contexto.",
	"Si detectas intencion comercial, pide objetivo, plazo y alcance.",
].join("\n");

export function buildChatMessages(
	message: string,
	history: Array<{ role: "user" | "assistant"; content: string }>,
	systemPrompt?: string,
): ChatMessage[] {
	return [
		{ role: "system", content: systemPrompt?.trim() || MATTY_SYSTEM_PROMPT },
		...history.map((item) => ({ role: item.role, content: item.content })),
		{ role: "user", content: message },
	];
}
