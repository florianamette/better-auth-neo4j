import { createAuthClient } from "better-auth/react";

/**
 * Use the browser’s current origin so session/auth requests hit this dev server even when
 * Next.js picks another port (e.g. 3001). A fixed localhost:3000 breaks with "Load failed".
 */
export const authClient = createAuthClient({
	...(typeof window !== "undefined"
		? { baseURL: window.location.origin }
		: process.env.NEXT_PUBLIC_BETTER_AUTH_URL
			? { baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL }
			: {}),
});
