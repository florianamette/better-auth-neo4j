"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthDemo() {
	const { data: session, isPending } = authClient.useSession();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("Demo user");
	const [message, setMessage] = useState<string | null>(null);

	async function handleSignUp(e: React.FormEvent) {
		e.preventDefault();
		setMessage(null);
		const { error } = await authClient.signUp.email({
			email,
			password,
			name,
		});
		setMessage(error ? error.message ?? String(error) : "Signed up. You are logged in.");
	}

	async function handleSignIn(e: React.FormEvent) {
		e.preventDefault();
		setMessage(null);
		const { error } = await authClient.signIn.email({
			email,
			password,
		});
		setMessage(error ? error.message ?? String(error) : "Signed in.");
	}

	async function handleSignOut() {
		setMessage(null);
		await authClient.signOut();
		setMessage("Signed out.");
	}

	if (isPending) {
		return (
			<p className="text-zinc-600 dark:text-zinc-400">Loading session…</p>
		);
	}

	if (session?.user) {
		return (
			<div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
				<p className="text-zinc-800 dark:text-zinc-100">
					Signed in as{" "}
					<strong>{session.user.email}</strong>
				</p>
				<button
					type="button"
					onClick={handleSignOut}
					className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
				>
					Sign out
				</button>
				{message ? (
					<p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
				) : null}
			</div>
		);
	}

	return (
		<div className="flex w-full max-w-md flex-col gap-6">
			<form
				onSubmit={handleSignUp}
				className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
			>
				<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
					Sign up
				</h2>
				<input
					className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
					placeholder="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
				<input
					className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
				<input
					className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					minLength={8}
				/>
				<button
					type="submit"
					className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
				>
					Create account
				</button>
			</form>

			<form
				onSubmit={handleSignIn}
				className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
			>
				<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
					Sign in
				</h2>
				<input
					className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
				<input
					className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
				<button
					type="submit"
					className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
				>
					Sign in
				</button>
			</form>

			{message ? (
				<p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
			) : null}
		</div>
	);
}
