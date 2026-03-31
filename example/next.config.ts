import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Monorepo: `file:..` symlink — relative alias for Turbopack (from `example/`)
	turbopack: {
		resolveAlias: {
			"neo4j-better-auth": "../",
		},
	},
};

export default nextConfig;
