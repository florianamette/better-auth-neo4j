import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler({
	handler: (request: Request) => getAuth().handler(request),
});

export { GET, POST, PUT, PATCH, DELETE };
