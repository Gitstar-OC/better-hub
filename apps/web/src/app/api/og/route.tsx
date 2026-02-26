import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const size = {
	width: 1200,
	height: 630,
};

const contentType = "image/png";

type RepoSummary = {
	full_name: string;
	description: string | null;
	stargazers_count: number;
	forks_count: number;
	open_issues_count: number;
	language: string | null;
};

type PullRequestSummary = {
	title: string;
	state: string;
	comments: number;
	commits: number;
	additions: number;
	deletions: number;
	user?: { login?: string };
};

type IssueSummary = {
	title: string;
	state: string;
	comments: number;
	user?: { login?: string };
};

type UserSummary = {
	login: string;
	name: string | null;
	bio: string | null;
	followers: number;
	following: number;
	public_repos: number;
	location: string | null;
	company: string | null;
};

async function fetchGitHubJson<T>(path: string): Promise<T | null> {
	const response = await fetch(`https://api.github.com${path}`, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "better-hub-og-preview",
		},
	});

	if (!response.ok) return null;
	return (await response.json()) as T;
}

function formatNumber(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

function Card({
	eyebrow,
	title,
	subtitle,
	stats,
	footer,
}: {
	eyebrow: string;
	title: string;
	subtitle?: string;
	stats?: Array<{ label: string; value: string }>;
	footer: string;
}) {
	return (
		<div
			style={{
				display: "flex",
				width: "100%",
				height: "100%",
				padding: 44,
				background: "radial-gradient(circle at top right, #1a2a44 0%, #0b1220 45%, #05070d 100%)",
				color: "#f8fafc",
				fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					width: "100%",
					height: "100%",
					border: "1px solid rgba(148, 163, 184, 0.22)",
					borderRadius: 24,
					padding: 36,
					background: "rgba(15, 23, 42, 0.72)",
					justifyContent: "space-between",
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
					<div
						style={{
							display: "flex",
							fontSize: 26,
							fontWeight: 700,
							color: "#a5b4fc",
						}}
					>
						Better Hub
					</div>
					<div
						style={{
							display: "flex",
							fontSize: 22,
							fontWeight: 600,
							color: "#94a3b8",
							textTransform: "uppercase",
							letterSpacing: 1.2,
						}}
					>
						{eyebrow}
					</div>
					<div
						style={{
							display: "flex",
							fontSize: 52,
							fontWeight: 800,
							lineHeight: 1.15,
							maxWidth: 1080,
						}}
					>
						{title}
					</div>
					{subtitle ? (
						<div
							style={{
								display: "flex",
								fontSize: 28,
								lineHeight: 1.35,
								color: "#cbd5e1",
								maxWidth: 1080,
							}}
						>
							{subtitle}
						</div>
					) : null}
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					{stats && stats.length > 0 ? (
						<div
							style={{
								display: "flex",
								gap: 12,
								flexWrap: "wrap",
							}}
						>
							{stats.map((stat) => (
								<div
									key={stat.label}
									style={{
										display: "flex",
										gap: 8,
										padding: "8px 14px",
										borderRadius: 999,
										border: "1px solid rgba(148, 163, 184, 0.35)",
										fontSize: 24,
										color: "#e2e8f0",
									}}
								>
									<span
										style={{
											opacity: 0.78,
										}}
									>
										{stat.label}
									</span>
									<span
										style={{
											fontWeight: 700,
										}}
									>
										{stat.value}
									</span>
								</div>
							))}
						</div>
					) : null}
					<div
						style={{
							display: "flex",
							fontSize: 24,
							color: "#93c5fd",
						}}
					>
						{footer}
					</div>
				</div>
			</div>
		</div>
	);
}

function stateLabel(value: string | undefined): string {
	if (!value) return "Unknown";
	if (value.toLowerCase() === "open") return "Open";
	if (value.toLowerCase() === "closed") return "Closed";
	if (value.toLowerCase() === "merged") return "Merged";
	return value;
}

export async function GET(request: NextRequest) {
	const params = request.nextUrl.searchParams;
	const type = params.get("type");
	const owner = params.get("owner") ?? "";
	const repo = params.get("repo") ?? "";
	const number = params.get("number") ?? "";
	const username = params.get("username") ?? owner;

	if (type === "repo" && owner && repo) {
		const repoData = await fetchGitHubJson<RepoSummary>(`/repos/${owner}/${repo}`);
		const title = repoData?.full_name ?? `${owner}/${repo}`;
		const subtitle =
			repoData?.description ??
			"Explore repository activity, code, pull requests, and issues.";

		return new ImageResponse(
			<Card
				eyebrow="Repository"
				title={title}
				subtitle={subtitle}
				stats={[
					{
						label: "Stars",
						value: formatNumber(
							repoData?.stargazers_count ?? 0,
						),
					},
					{
						label: "Forks",
						value: formatNumber(repoData?.forks_count ?? 0),
					},
					{
						label: "Open Issues",
						value: formatNumber(
							repoData?.open_issues_count ?? 0,
						),
					},
					{ label: "Language", value: repoData?.language ?? "N/A" },
				]}
				footer={`better-hub.com/${owner}/${repo}`}
			/>,
			size,
		);
	}

	if (type === "pr" && owner && repo && number) {
		const pr = await fetchGitHubJson<PullRequestSummary>(
			`/repos/${owner}/${repo}/pulls/${number}`,
		);
		const prTitle = pr?.title ?? `Pull Request #${number}`;
		const prState = stateLabel(pr?.state);
		const author = pr?.user?.login ?? "unknown";

		return new ImageResponse(
			<Card
				eyebrow="Pull Request"
				title={prTitle}
				subtitle={`#${number} in ${owner}/${repo} by @${author}`}
				stats={[
					{ label: "State", value: prState },
					{
						label: "Comments",
						value: formatNumber(pr?.comments ?? 0),
					},
					{ label: "Commits", value: formatNumber(pr?.commits ?? 0) },
					{
						label: "Changes",
						value: `+${formatNumber(pr?.additions ?? 0)} / -${formatNumber(pr?.deletions ?? 0)}`,
					},
				]}
				footer={`better-hub.com/${owner}/${repo}/pulls/${number}`}
			/>,
			size,
		);
	}

	if (type === "issue" && owner && repo && number) {
		const issue = await fetchGitHubJson<IssueSummary>(
			`/repos/${owner}/${repo}/issues/${number}`,
		);
		const issueTitle = issue?.title ?? `Issue #${number}`;
		const issueState = stateLabel(issue?.state);
		const author = issue?.user?.login ?? "unknown";

		return new ImageResponse(
			<Card
				eyebrow="Issue"
				title={issueTitle}
				subtitle={`#${number} in ${owner}/${repo} by @${author}`}
				stats={[
					{ label: "State", value: issueState },
					{
						label: "Comments",
						value: formatNumber(issue?.comments ?? 0),
					},
				]}
				footer={`better-hub.com/${owner}/${repo}/issues/${number}`}
			/>,
			size,
		);
	}

	if (type === "profile" && username) {
		const user = await fetchGitHubJson<UserSummary>(`/users/${username}`);
		const displayName = user?.name?.trim()
			? `${user.name} (@${user.login})`
			: `@${user?.login ?? username}`;
		const bio =
			user?.bio ?? "View profile highlights, repositories, and recent activity.";
		const location = user?.location ?? "N/A";
		const company = user?.company ?? "N/A";

		return new ImageResponse(
			<Card
				eyebrow="Profile"
				title={displayName}
				subtitle={bio}
				stats={[
					{
						label: "Followers",
						value: formatNumber(user?.followers ?? 0),
					},
					{
						label: "Following",
						value: formatNumber(user?.following ?? 0),
					},
					{
						label: "Repos",
						value: formatNumber(user?.public_repos ?? 0),
					},
					{ label: "Location", value: location },
					{ label: "Company", value: company },
				]}
				footer={`better-hub.com/users/${username}`}
			/>,
			size,
		);
	}

	return new ImageResponse(
		<Card
			eyebrow="Better Hub"
			title="Code collaboration for humans and agents"
			subtitle="Share richer previews for repositories, pull requests, issues, and profiles."
			footer="better-hub.com"
		/>,
		size,
	);
}

export { contentType };
