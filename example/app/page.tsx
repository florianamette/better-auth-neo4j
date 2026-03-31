import { AuthDemo } from "./auth-demo";

export default function Home() {
	return (
		<div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
			<main className="flex w-full max-w-lg flex-col items-center gap-8">
				<div className="text-center">
					<h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
						neo4j-better-auth example
					</h1>
					<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
						Better Auth with Neo4j (email + password). Start Neo4j with{" "}
						<code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
							docker compose up -d
						</code>
						, run{" "}
						<code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
							npm run db:schema
						</code>
						, then sign up below.
					</p>
				</div>
				<AuthDemo />
			</main>
		</div>
	);
}
