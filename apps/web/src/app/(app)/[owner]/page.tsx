import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
	getOrg,
	getOrgRepos,
	getUser,
	getUserPublicRepos,
	getUserPinnedRepos,
	getUserPublicOrgs,
	getUserOrgTopRepos,
	getContributionData,
} from "@/lib/github";
import { getProfilePinnedRepoFullNames } from "@/lib/pinned-items-store";
import { ogImageUrl, ogImages } from "@/lib/og/og-utils";
import { OrgDetailContent } from "@/components/orgs/org-detail-content";
import { UserProfileContent } from "@/components/users/user-profile-content";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ owner: string }>;
}): Promise<Metadata> {
	const { owner } = await params;
	const ogUrl = ogImageUrl({ type: "owner", owner });
	const userData = await getUser(owner).catch(() => null);
	if (!userData) {
		return { title: owner };
	}

	const actorType = (userData as { type?: string }).type;
	if (actorType === "Organization") {
		const orgData = await getOrg(owner).catch(() => null);
		const title = orgData?.name || orgData?.login || userData.name || userData.login;
		const description =
			orgData?.description || userData.bio || `${title} on Better Hub`;
		return {
			title,
			description,
			openGraph: { title, ...ogImages(ogUrl) },
			twitter: { card: "summary_large_image", ...ogImages(ogUrl) },
		};
	}

	const displayName = userData.name ? `${userData.name} (${userData.login})` : userData.login;
	return {
		title: displayName,
		description: userData.bio || `${displayName} on Better Hub`,
		openGraph: { title: displayName, ...ogImages(ogUrl) },
		twitter: { card: "summary_large_image", ...ogImages(ogUrl) },
	};
}

export default async function OwnerPage({ params }: { params: Promise<{ owner: string }> }) {
	const { owner } = await params;

	// Resolve actor first to avoid noisy /orgs/:user 404 calls for user handles.
	const actorData = await getUser(owner).catch(() => null);
	if (!actorData) {
		notFound();
	}

	const actorType = (actorData as { type?: string }).type;
	if (actorType === "Organization") {
		const orgData = await getOrg(owner).catch(() => null);
		if (!orgData) {
			notFound();
		}
		const reposData = await getOrgRepos(owner, {
			perPage: 100,
			sort: "updated",
			type: "all",
		}).catch(() => []);

		return (
			<OrgDetailContent
				org={{
					login: orgData.login,
					name: orgData.name ?? null,
					avatar_url: orgData.avatar_url,
					html_url:
						orgData.html_url ??
						`https://github.com/${orgData.login}`,
					description: orgData.description ?? null,
					blog: orgData.blog || null,
					location: orgData.location || null,
					public_repos: orgData.public_repos,
					followers: orgData.followers,
					following: orgData.following,
					created_at: orgData.created_at,
				}}
				repos={reposData.map((repo) => ({
					id: repo.id,
					name: repo.name,
					full_name: repo.full_name,
					description: repo.description,
					private: repo.private,
					fork: repo.fork,
					archived: repo.archived ?? false,
					language: repo.language ?? null,
					stargazers_count: repo.stargazers_count ?? 0,
					forks_count: repo.forks_count ?? 0,
					open_issues_count: repo.open_issues_count ?? 0,
					updated_at: repo.updated_at ?? null,
					pushed_at: repo.pushed_at ?? null,
				}))}
			/>
		);
	}

	// Fall back to user profile
	const userData = actorData;

	const isBot = (userData as { type?: string }).type === "Bot";

	let reposData: Awaited<ReturnType<typeof getUserPublicRepos>> = [];
	let pinnedReposData: Awaited<ReturnType<typeof getUserPinnedRepos>> = [];
	let customPinnedRepoFullNames: string[] = [];
	let orgsData: Awaited<ReturnType<typeof getUserPublicOrgs>> = [];
	let contributionData: Awaited<ReturnType<typeof getContributionData>> = null;
	let orgTopRepos: Awaited<ReturnType<typeof getUserOrgTopRepos>> = [];

	if (!isBot) {
		try {
			[
				reposData,
				pinnedReposData,
				customPinnedRepoFullNames,
				orgsData,
				contributionData,
			] = await Promise.all([
				getUserPublicRepos(userData.login, 100),
				getUserPinnedRepos(userData.login, 6),
				getProfilePinnedRepoFullNames(userData.login),
				getUserPublicOrgs(userData.login),
				getContributionData(userData.login),
			]);
			if (orgsData.length > 0) {
				orgTopRepos = await getUserOrgTopRepos(
					orgsData.map((o) => o.login),
				);
			}
		} catch {
			// Show profile with whatever we have
		}
	}

	const repoMapByFullName = new Map(reposData.map((repo) => [repo.full_name, repo] as const));
	const customPinnedRepos = customPinnedRepoFullNames
		.map((fullName) => repoMapByFullName.get(fullName))
		.filter((repo): repo is (typeof reposData)[number] => Boolean(repo));
	const effectivePinnedRepos =
		customPinnedRepos.length > 0 ? customPinnedRepos : pinnedReposData;

	return (
		<UserProfileContent
			user={{
				login: userData.login,
				name: userData.name ?? null,
				avatar_url: userData.avatar_url,
				html_url: userData.html_url,
				bio: userData.bio ?? null,
				blog: userData.blog || null,
				location: userData.location || null,
				company: userData.company || null,
				twitter_username:
					(userData as { twitter_username?: string | null })
						.twitter_username || null,
				public_repos: userData.public_repos,
				followers: userData.followers,
				following: userData.following,
				created_at: userData.created_at,
			}}
			repos={reposData.map((repo) => ({
				id: repo.id,
				name: repo.name,
				full_name: repo.full_name,
				description: repo.description,
				private: repo.private,
				fork: repo.fork,
				archived: repo.archived ?? false,
				language: repo.language ?? null,
				stargazers_count: repo.stargazers_count ?? 0,
				forks_count: repo.forks_count ?? 0,
				open_issues_count: repo.open_issues_count ?? 0,
				updated_at: repo.updated_at ?? null,
				pushed_at: repo.pushed_at ?? null,
			}))}
			orgs={orgsData.map((org) => ({
				login: org.login,
				avatar_url: org.avatar_url,
			}))}
			pinnedRepos={effectivePinnedRepos.map((repo) => ({
				id: String(repo.id),
				name: repo.name,
				full_name: repo.full_name,
				description: repo.description,
				private: repo.private,
				fork: repo.fork,
				archived: repo.archived ?? false,
				language: repo.language ?? null,
				stargazers_count: repo.stargazers_count ?? 0,
				forks_count: repo.forks_count ?? 0,
				updated_at: repo.updated_at ?? null,
				html_url: repo.html_url,
			}))}
			contributions={contributionData}
			orgTopRepos={orgTopRepos.map((r) => ({
				name: r.name,
				full_name: r.full_name,
				stargazers_count: r.stargazers_count,
				forks_count: r.forks_count,
				language: r.language,
			}))}
		/>
	);
}
