"use server";

import { getOctokit } from "@/lib/github";
import { getErrorMessage } from "@/lib/utils";

export type ReactionUser = {
  login: string;
  avatar_url: string;
  content: string;
};

export async function getReactionUsers(
  owner: string,
  repo: string,
  contentType: "issue" | "issueComment",
  contentId: number
): Promise<{ users: ReactionUser[]; error?: string }> {
  const octokit = await getOctokit();
  if (!octokit) return { users: [], error: "Not authenticated" };

  try {
    const res = contentType === "issue"
      ? await octokit.reactions.listForIssue({
          owner,
          repo,
          issue_number: contentId,
          per_page: 100,
        })
      : await octokit.reactions.listForIssueComment({
          owner,
          repo,
          comment_id: contentId,
          per_page: 100,
        });

    return {
      users: res.data.map((r) => ({
        login: r.user?.login ?? "unknown",
        avatar_url: r.user?.avatar_url ?? "",
        content: r.content,
      })),
    };
  } catch (e: unknown) {
    return { users: [], error: getErrorMessage(e) || "Failed to fetch reactions" };
  }
}
