import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler({
	handler: (request: Request) => auth.handler(request),
});

export { GET, POST, PUT, PATCH, DELETE };
