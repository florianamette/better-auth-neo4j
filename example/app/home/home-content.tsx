"use client";

import { authClient } from "@/lib/auth-client";

export function HomeContent() {
	const { data, isPending } = authClient.useSession();

	if (isPending) {
		return <p className="text-sm text-muted-foreground">Loading session...</p>;
	}

	if (!data?.user || !data?.session) {
		return (
			<p className="text-sm text-muted-foreground">
				No active session detected.
			</p>
		);
	}

	const { user, session } = data;

	return (
		<div className="space-y-4">
			<div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
				<h2 className="text-lg font-semibold">User</h2>
				<div className="mt-3 grid gap-1 text-sm">
					<p>
						<span className="font-medium">ID:</span> {user.id}
					</p>
					<p>
						<span className="font-medium">Name:</span> {user.name}
					</p>
					<p>
						<span className="font-medium">Email:</span> {user.email}
					</p>
					<p>
						<span className="font-medium">Email verified:</span>{" "}
						{user.emailVerified ? "yes" : "no"}
					</p>
				</div>
			</div>

			<div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
				<h2 className="text-lg font-semibold">Session</h2>
				<div className="mt-3 grid gap-1 text-sm">
					<p>
						<span className="font-medium">Session ID:</span> {session.id}
					</p>
					<p>
						<span className="font-medium">User ID:</span> {session.userId}
					</p>
					<p>
						<span className="font-medium">Expires at:</span>{" "}
						{new Date(session.expiresAt).toLocaleString()}
					</p>
					<p>
						<span className="font-medium">IP:</span> {session.ipAddress ?? "n/a"}
					</p>
					<p>
						<span className="font-medium">User agent:</span>{" "}
						{session.userAgent ?? "n/a"}
					</p>
				</div>
			</div>

			<div className="flex gap-2">
				<button
					type="button"
					onClick={async () => {
						await authClient.signOut();
						window.location.href = "/login";
					}}
					className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
				>
					Sign out
				</button>
				<a
					href="http://localhost:7475"
					target="_blank"
					rel="noreferrer"
					className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
				>
					Open Neo4j web panel
				</a>
			</div>
		</div>
	);
}
