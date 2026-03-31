import { HomeContent } from "./home-content";

export default function HomePage() {
	return (
		<div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6 md:p-10">
			<header className="space-y-2">
				<h1 className="text-2xl font-semibold tracking-tight">
					neo4j-better-auth demo
				</h1>
				<p className="text-sm text-muted-foreground">
					Protected home page with your current Better Auth user and session.
				</p>
			</header>
			<HomeContent />
		</div>
	);
}
