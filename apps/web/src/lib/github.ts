import { Octokit } from "@octokit/rest";
import { headers } from "next/headers";
import { cache } from "react";
import { $Session, getServerSession } from "./auth";
import {
	claimDueGithubSyncJobs,
	deleteGithubCacheByPrefix,
	deleteSharedCacheByPrefix,
	enqueueGithubSyncJob,
	getGithubCacheEntry,
	getSharedCacheEntry,
	markGithubSyncJobFailed,
	markGithubSyncJobSucceeded,
	touchGithubCacheEntrySyncedAt,
	touchSharedCacheEntrySyncedAt,
	upsertGithubCacheEntry,
	upsertSharedCacheEntry,
} from "./github-sync-store";
import { redis } from "./redis";
import { computeContributorScore } from "./contributor-score";
import { getCachedAuthorDossier, setCachedAuthorDossier } from "./repo-data-cache";
import type { UserBadge } from "@/components/users/user-badges";

export type RepoPermissions = {
	admin: boolean;
	push: boolean;
	pull: boolean;
	maintain: boolean;
	triage: boolean;
};

export interface FetchedUserProfile {
	login: string;
	name: string | null;
	avatar_url: string;
	html_url: string;
	bio: string | null;
	blog: string | null;
	location: string | null;
	company: string | null;
	twitter_username?: string | null;
	public_repos: number;
	followers: number;
	following: number;
	created_at: string;
	badges?: UserBadge[];
	type?: string;
}

export function extractRepoPermissions(repoData: {
	permissions?: Partial<RepoPermissions>;
}): RepoPermissions {
	const p = repoData?.permissions;
	return {
		admin: !!p?.admin,
		push: !!p?.push,
		pull: !!p?.pull,
		maintain: !!p?.maintain,
		triage: !!p?.triage,
	};
}

type RepoSort = "updated" | "pushed" | "full_name";
type OrgRepoSort = "created" | "updated" | "pushed" | "full_name";
type OrgRepoType = "all" | "public" | "private" | "forks" | "sources" | "member";

interface GitHubAuthContext {
	userId: string;
	token: string;
	octokit: Octokit;
	forceRefresh: boolean;
	githubUser: $Session["githubUser"];
}

// Rest of the file continues...
