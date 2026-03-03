"use server";

import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updatePinnedRepos(username: string, repoFullNames: string[]) {
	const session = await getServerSession();

	if (!session?.user?.id) {
		return { error: "Not authenticated" };
	}

	// Security check: only the owner can update pins
	const sessionLogin = session.githubUser?.login ?? session.user.name ?? "";
	const isOwner = sessionLogin.toLowerCase() === username.toLowerCase();
	if (!isOwner) {
		return { error: "Not authorized to pin on this profile" };
	}

	// Limit to 6
	const limitedNames = repoFullNames.slice(0, 6);
	try {
		await prisma.$transaction(async (tx) => {
			// Remove existing pinned items for this user with profile_repo type
			await tx.pinnedItem.deleteMany({
				where: {
					userId: session.user.id,
					owner: username,
					repo: "__profile__",
					itemType: "profile_repo",
				},
			});

			// Create new pinned items
			if (limitedNames.length > 0) {
				const base = Date.now();
				await tx.pinnedItem.createMany({
					data: limitedNames.map((fullName, index) => ({
						id: crypto.randomUUID(),
						userId: session.user.id,
						owner: username,
						repo: "__profile__",
						url: fullName,
						title: fullName,
						itemType: "profile_repo",
						pinnedAt: new Date(base + index).toISOString(),
					})),
				});
			}
		});

		revalidatePath(`/${username}`);
		return { success: true };
	} catch (error) {
		console.error("Failed to update pinned repos:", error);
		return { error: "Failed to save pinned repositories" };
	}
}
