import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "./lib/auth";

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	const shouldProtectHome = pathname.startsWith("/home");
	const isAuthPage = pathname === "/login" || pathname === "/signup";
	if (!shouldProtectHome && !isAuthPage) {
		return NextResponse.next();
	}

	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (shouldProtectHome && !session) {
			return NextResponse.redirect(new URL("/login", request.url));
		}

		if (isAuthPage && session) {
			return NextResponse.redirect(new URL("/home", request.url));
		}

		return NextResponse.next();
	} catch {
		if (shouldProtectHome) {
			return NextResponse.redirect(new URL("/login", request.url));
		}
		return NextResponse.next();
	}
}

export const config = {
	matcher: ["/home/:path*", "/login", "/signup"],
};
