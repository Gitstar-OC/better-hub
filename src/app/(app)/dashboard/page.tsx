import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getAuthenticatedUser,
  getUserRepos,
  searchIssues,
  getNotifications,
  getContributionData,
  getUserEvents,
  getTrendingRepos,
} from "@/lib/github";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) return null;

  const ghUser = await getAuthenticatedUser();
  if (!ghUser) return null;
  const username = ghUser.login;

  const [reviewRequests, myOpenPRs, myIssues, repos, notifications, contributions, activity, trending] =
    await Promise.all([
      searchIssues(`is:pr is:open review-requested:${username}`, 10),
      searchIssues(`is:pr is:open author:${username}`, 10),
      searchIssues(`is:issue is:open assignee:${username}`, 10),
      getUserRepos("updated", 30),
      getNotifications(20),
      getContributionData(username),
      getUserEvents(username, 20),
      getTrendingRepos(undefined, "weekly", 8),
    ]);

  const accounts = await auth.api.listUserAccounts({ headers: reqHeaders });
  const slackConnected = (accounts as Array<{ providerId: string }>).some(
    (a) => a.providerId === "slack"
  );

  return (
    <DashboardContent
      user={ghUser as { login: string; avatar_url: string; name: string | null; public_repos: number; followers: number; following: number }}
      reviewRequests={reviewRequests as { items: Array<{ id: number; title: string; html_url: string; number: number; state: string; created_at: string; updated_at: string; repository_url: string; user: { login: string; avatar_url: string } | null; labels: Array<{ name?: string; color?: string }>; draft?: boolean; pull_request?: { merged_at: string | null }; comments: number }>; total_count: number }}
      myOpenPRs={myOpenPRs as { items: Array<{ id: number; title: string; html_url: string; number: number; state: string; created_at: string; updated_at: string; repository_url: string; user: { login: string; avatar_url: string } | null; labels: Array<{ name?: string; color?: string }>; draft?: boolean; pull_request?: { merged_at: string | null }; comments: number }>; total_count: number }}
      myIssues={myIssues as { items: Array<{ id: number; title: string; html_url: string; number: number; state: string; created_at: string; updated_at: string; repository_url: string; user: { login: string; avatar_url: string } | null; labels: Array<{ name?: string; color?: string }>; draft?: boolean; pull_request?: { merged_at: string | null }; comments: number }>; total_count: number }}
      repos={repos as Array<{ id: number; name: string; full_name: string; description: string | null; html_url: string; stargazers_count: number; forks_count: number; language: string | null; updated_at: string | null; visibility?: string; private: boolean; open_issues_count: number; owner: { login: string; avatar_url: string } }>}
      notifications={notifications as Array<{ id: string; reason: string; subject: { title: string; type: string }; repository: { full_name: string }; updated_at: string; unread: boolean }>}
      contributions={contributions as { totalContributions: number; weeks: Array<{ contributionDays: Array<{ contributionCount: number; date: string; color: string }> }> } | null}
      activity={activity as Array<{ id: string; type: string | null; repo: { name: string }; created_at: string | null; payload: { action?: string; ref?: string | null; ref_type?: string; commits?: Array<{ message: string; sha: string }>; pull_request?: { title: string; number: number; merged?: boolean }; issue?: { title: string; number: number }; comment?: { body: string }; size?: number } }>}
      trending={trending as Array<{ id: number; name: string; full_name: string; description: string | null; html_url: string; stargazers_count: number; forks_count: number; language: string | null; created_at: string | null; owner: { login: string; avatar_url: string } }>}
      slackConnected={slackConnected}
    />
  );
}
