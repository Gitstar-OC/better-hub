"use server";

import { getAuthenticatedUser, getOctokit, invalidateRepoIssuesCache } from "@/lib/github";
import { getErrorMessage } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { invalidateRepoCache } from "@/lib/repo-data-cache-vc";

export async function fetchIssuesByAuthor(owner: string, repo: string, author: string) {
	const octokit = await getOctokit();
	if (!octokit) return { open: [], closed: [] };

	const [openRes, closedRes] = await Promise.all([
		octokit.search.issuesAndPullRequests({
			q: `is:issue is:open repo:${owner}/${repo} author:${author}`,
			per_page: 100,
			sort: "updated",
			order: "desc",
		}),
		octokit.search.issuesAndPullRequests({
			q: `is:issue is:closed repo:${owner}/${repo} author:${author}`,
			per_page: 100,
			sort: "updated",
			order: "desc",
		}),
	]);

	return {
		open: openRes.data.items,
		closed: closedRes.data.items,
	};
}

export interface IssueTemplate {
	name: string;
	about: string;
	title: string;
	labels: string[];
	body: string;
}

export async function getIssueTemplates(owner: string, repo: string): Promise<IssueTemplate[]> {
	const octokit = await getOctokit();
	if (!octokit) return [];

	try {
		const { data: contents } = await octokit.repos.getContent({
			owner,
			repo,
			path: ".github/ISSUE_TEMPLATE",
		});

		if (!Array.isArray(contents)) return [];

		const mdFiles = contents.filter(
			(f) =>
				f.type === "file" &&
				(f.name.endsWith(".md") ||
					f.name.endsWith(".yml") ||
					f.name.endsWith(".yaml")),
		);

		const templates: IssueTemplate[] = [];

		for (const file of mdFiles) {
			try {
				const { data } = await octokit.repos.getContent({
					owner,
					repo,
					path: file.path,
				});

				if ("content" in data && typeof data.content === "string") {
					const decoded = Buffer.from(
						data.content,
						"base64",
					).toString("utf-8");
					const template = parseTemplateFrontmatter(
						decoded,
						file.name,
					);
					if (template) templates.push(template);
				}
			} catch {
				// skip unreadable files
			}
		}

		return templates;
	} catch {
		return [];
	}
}

function parseTemplateFrontmatter(content: string, filename: string): IssueTemplate | null {
	// Handle YAML-based templates (.yml/.yaml)
	if (filename.endsWith(".yml") || filename.endsWith(".yaml")) {
		return parseYamlTemplate(content, filename);
	}

	// Markdown templates with YAML front matter
	const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)/);
	if (!fmMatch) {
		return {
			name: filename.replace(/\.md$/, "").replace(/[-_]/g, " "),
			about: "",
			title: "",
			labels: [],
			body: content,
		};
	}

	const frontmatter = fmMatch[1];
	const body = fmMatch[2].trim();

	const name =
		extractYamlValue(frontmatter, "name") ||
		filename.replace(/\.md$/, "").replace(/[-_]/g, " ");
	const about = extractYamlValue(frontmatter, "about") || "";
	const title = extractYamlValue(frontmatter, "title") || "";
	const labelsRaw = extractYamlValue(frontmatter, "labels") || "";
	const labels = labelsRaw
		? labelsRaw
				.replace(/^\[|\]$/g, "")
				.split(",")
				.map((l) => l.trim().replace(/^['"]|['"]$/g, ""))
				.filter(Boolean)
		: [];

	return { name, about, title, labels, body };
}

function parseYamlTemplate(content: string, filename: string): IssueTemplate | null {
	const name =
		extractYamlValue(content, "name") ||
		filename.replace(/\.(yml|yaml)$/, "").replace(/[-_]/g, " ");
	const description = extractYamlValue(content, "description") || "";
	const title = extractYamlValue(content, "title") || "";
	const labelsRaw = extractYamlValue(content, "labels") || "";
	const labels = labelsRaw
		? labelsRaw
				.replace(/^\[|\]$/g, "")
				.split(",")
				.map((l) => l.trim().replace(/^['"]|['"]$/g, ""))
				.filter(Boolean)
		: [];

	// Build body from form fields
	const bodyParts: string[] = [];
	const bodyMatch = content.match(/body:\s*\n([\s\S]*)/);
	if (bodyMatch) {
		const fieldMatches = bodyMatch[1].matchAll(
			/- type:\s*(\w+)[\s\S]*?(?:label:\s*["']?(.+?)["']?\s*\n)[\s\S]*?(?:description:\s*["']?(.+?)["']?\s*\n)?/g,
		);
		for (const m of fieldMatches) {
			const type = m[1];
			const label = m[2]?.trim() || "";
			if (type === "markdown") continue;
			if (label) {
				bodyParts.push(`### ${label}\n\n`);
			}
		}
	}

	return {
		name,
		about: description,
		title,
		labels,
		body: bodyParts.join("\n") || "",
	};
}

function extractYamlValue(yaml: string, key: string): string | null {
	const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
	const match = yaml.match(re);
	if (!match) return null;
	return match[1].trim().replace(/^['"]|['"]$/g, "");
}

export async function createIssue(
	owner: string,
	repo: string,
	title: string,
	body: string,
	labels: string[],
	assignees: string[],
): Promise<{ success: boolean; number?: number; error?: string }> {
	const octokit = await getOctokit();
	if (!octokit) return { success: false, error: "Not authenticated" };

	try {
		const { data } = await octokit.issues.create({
			owner,
			repo,
			title,
			body: body || undefined,
			labels: labels.length > 0 ? labels : undefined,
			assignees: assignees.length > 0 ? assignees : undefined,
		});

		await invalidateRepoIssuesCache(owner, repo);
		invalidateRepoCache(owner, repo);
		revalidatePath(`/repos/${owner}/${repo}/issues`);
		revalidatePath(`/repos/${owner}/${repo}`, "layout");
		return { success: true, number: data.number };
	} catch (err: unknown) {
		return {
			success: false,
			error: getErrorMessage(err),
		};
	}
}

export async function getRepoLabels(
	owner: string,
	repo: string,
): Promise<Array<{ name: string; color: string; description: string | null }>> {
	const octokit = await getOctokit();
	if (!octokit) return [];

	try {
		const { data } = await octokit.issues.listLabelsForRepo({
			owner,
			repo,
			per_page: 100,
		});
		return data.map((l) => ({
			name: l.name,
			color: l.color ?? "888888",
			description: l.description ?? null,
		}));
	} catch {
		return [];
	}
}

interface UploadImageResult {
	success: boolean;
	url?: string;
	error?: string;
}

export type IssueImageUploadMode = "repo" | "fork" | "needs_fork";

export interface IssueImageUploadContext {
	success: boolean;
	mode?: IssueImageUploadMode;
	viewerLogin?: string;
	uploadOwner?: string;
	uploadRepo?: string;
	error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isForkOfRepo(
	forkData: {
		fork?: boolean;
		parent?: { full_name?: string | null } | null;
		source?: { full_name?: string | null } | null;
	},
	fullName: string,
) {
	if (!forkData.fork) return false;
	return forkData.parent?.full_name === fullName || forkData.source?.full_name === fullName;
}

export async function getIssueImageUploadContext(
	owner: string,
	repo: string,
): Promise<IssueImageUploadContext> {
	const octokit = await getOctokit();
	if (!octokit) return { success: false, error: "Not authenticated" };

	const viewer = await getAuthenticatedUser();
	if (!viewer?.login) return { success: false, error: "Not authenticated" };

	try {
		const { data: repoData } = await octokit.repos.get({ owner, repo });
		const isOwner = repoData.owner?.login === viewer.login;
		const canWrite =
			repoData.permissions?.push ||
			repoData.permissions?.maintain ||
			repoData.permissions?.admin;

		// Prefer direct upstream uploads for owners and users with write-level permissions.
		if (isOwner || canWrite) {
			return {
				success: true,
				mode: "repo",
				viewerLogin: viewer.login,
				uploadOwner: owner,
				uploadRepo: repo,
			};
		}

		const upstreamFullName = `${owner}/${repo}`;
		try {
			// For non-writers, try using their own fork as the upload target.
			const { data: forkRepoData } = await octokit.repos.get({
				owner: viewer.login,
				repo,
			});

			if (isForkOfRepo(forkRepoData, upstreamFullName)) {
				return {
					success: true,
					mode: "fork",
					viewerLogin: viewer.login,
					uploadOwner: viewer.login,
					uploadRepo: repo,
				};
			}
		} catch {
			// user fork doesn't exist yet
		}

		return {
			success: true,
			mode: "needs_fork",
			viewerLogin: viewer.login,
		};
	} catch (err: unknown) {
		return { success: false, error: getErrorMessage(err) };
	}
}

export async function ensureForkForIssueImageUpload(
	owner: string,
	repo: string,
): Promise<IssueImageUploadContext> {
	const octokit = await getOctokit();
	if (!octokit) return { success: false, error: "Not authenticated" };

	const viewer = await getAuthenticatedUser();
	if (!viewer?.login) return { success: false, error: "Not authenticated" };

	try {
		await octokit.repos.createFork({ owner, repo });

		const upstreamFullName = `${owner}/${repo}`;
		// GitHub fork creation is async; poll until the fork is queryable and linked.
		for (let attempt = 0; attempt < 12; attempt++) {
			try {
				const { data: forkRepoData } = await octokit.repos.get({
					owner: viewer.login,
					repo,
				});
				if (isForkOfRepo(forkRepoData, upstreamFullName)) {
					return {
						success: true,
						mode: "fork",
						viewerLogin: viewer.login,
						uploadOwner: viewer.login,
						uploadRepo: repo,
					};
				}
			} catch {
				// fork may still be provisioning
			}

			await sleep(1000);
		}

		return {
			success: false,
			error: "Fork created, but it is still provisioning. Try again in a few seconds.",
		};
	} catch (err: unknown) {
		return { success: false, error: getErrorMessage(err) };
	}
}

/**
 * Upload an image to a temporary location in the repository for use in issue bodies.
 * GitHub doesn't have a dedicated API for uploading images to issues directly,
 * so we upload to a special branch or use the GitHub asset upload pattern.
 */
export async function uploadImage(
	owner: string,
	repo: string,
	file: File,
): Promise<UploadImageResult> {
	const octokit = await getOctokit();
	if (!octokit) return { success: false, error: "Not authenticated" };

	try {
		// Read file as base64
		const bytes = await file.arrayBuffer();
		const base64Content = Buffer.from(bytes).toString("base64");

		// Generate a unique filename with timestamp
		const timestamp = Date.now();
		const randomId = Math.random().toString(36).substring(2, 10);
		const ext = file.name.split(".").pop()?.toLowerCase() || "png";
		const filename = `issue-upload-${timestamp}-${randomId}.${ext}`;

		// Get the default branch first
		const { data: repoData } = await octokit.repos.get({ owner, repo });
		const defaultBranch = repoData.default_branch;

		// Try to create/update the file in a hidden .github-images directory
		// This follows GitHub's pattern for issue assets
		const path = `.github-images/${filename}`;

		try {
			// Create or update file on the default branch
			await octokit.repos.createOrUpdateFileContents({
				owner,
				repo,
				path,
				message: `Upload image for issue: ${filename}`,
				content: base64Content,
				branch: defaultBranch,
			});

			// Construct the raw GitHub URL for the uploaded image
			const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${path}`;

			return { success: true, url: imageUrl };
		} catch (error) {
			// If the file already exists (rare but possible), try to get it
			if (
				typeof error === "object" &&
				error !== null &&
				"status" in error &&
				error.status === 422
			) {
				// File might already exist, construct URL anyway
				const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${path}`;
				return { success: true, url: imageUrl };
			}
			throw error;
		}
	} catch (err: unknown) {
		const message = getErrorMessage(err);
		// Check if it's a permission error - users without write access can't upload this way
		if (typeof err === "object" && err !== null && "status" in err) {
			if (err.status === 403 || err.status === 404) {
				return {
					success: false,
					error: "You don't have permission to upload images to this repository. Please drag and drop images directly into the GitHub text editor instead.",
				};
			}
		}
		return { success: false, error: `Upload failed: ${message}` };
	}
}
