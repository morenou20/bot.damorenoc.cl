import "dotenv/config";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { internalAuth } from "./plugins/auth.js";
import { chatRoutes } from "./routes/chat.js";
import { jsonRoutes } from "./routes/json.js";

const app = Fastify({
	logger: {
		level: process.env.NODE_ENV === "production" ? "info" : "debug",
		transport:
			process.env.NODE_ENV === "production"
				? undefined
				: { target: "pino-pretty" },
	},
});

app.addHook("onRequest", internalAuth);

app.get("/healthz", async () => ({ ok: true, service: "bot.damorenoc.cl" }));
app.get("/readyz", async () => ({ ok: true }));

await app.register(chatRoutes);
await app.register(jsonRoutes);

const start = async (): Promise<void> => {
	try {
		await app.listen({ host: env.HOST, port: env.PORT });
	} catch (error) {
		app.log.error(error);
		process.exit(1);
	}
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, async () => {
		await app.close();
		process.exit(0);
	});
}

start();
