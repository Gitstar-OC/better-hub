export type OgImageType = "repo" | "pr" | "issue" | "profile";

const FALLBACK_APP_URL = "https://better-hub.com";

export function buildOgImageUrl(
	type: OgImageType,
	params: Record<string, string | number | undefined>,
): string {
	const base = process.env.NEXT_PUBLIC_APP_URL ?? FALLBACK_APP_URL;
	const url = new URL("/api/og", base);
	url.searchParams.set("type", type);

	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) continue;
		url.searchParams.set(key, String(value));
	}

	return url.toString();
}
