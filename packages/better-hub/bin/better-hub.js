#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const VERSION = "0.1.0";

function printHelp() {
	process.stdout.write(
		`better-hub ${VERSION}\n\nUsage:\n  better-hub init [options]\n  better-hub --help\n  better-hub --version\n\nOptions for init:\n  --host <domain>     Vanity domain to rewrite (default: better-hub.com)\n  --target <url>      Git base URL target (default: https://github.com/)\n  --local             Write config to current repository instead of --global\n  --dry-run           Print actions without changing git config\n  --no-www            Do not add www.<domain> rewrite\n`,
	);
}

function normalizeDomain(input) {
	const value = input.trim();
	if (!value) return "";

	if (value.startsWith("http://") || value.startsWith("https://")) {
		try {
			return new URL(value).hostname.toLowerCase();
		} catch {
			return "";
		}
	}

	return value.replace(/\/$/, "").toLowerCase();
}

function normalizeTarget(input) {
	const value = input.trim();
	if (!value) return "";

	try {
		const url = new URL(value);
		if (!url.pathname || url.pathname === "/") {
			url.pathname = "/";
		} else if (!url.pathname.endsWith("/")) {
			url.pathname = `${url.pathname}/`;
		}

		url.search = "";
		url.hash = "";

		return url.toString();
	} catch {
		return "";
	}
}

function runGit(args) {
	const result = spawnSync("git", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	return {
		status: result.status ?? 1,
		stdout: result.stdout?.trim() ?? "",
		stderr: result.stderr?.trim() ?? "",
	};
}

function getExistingInsteadOfValues(scopeArgs, key) {
	const result = runGit(["config", ...scopeArgs, "--get-all", key]);

	if (result.status !== 0) {
		return [];
	}

	return result.stdout
		.split(/\r?\n/)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function addRewrite(scopeArgs, key, value, dryRun) {
	if (dryRun) {
		process.stdout.write(
			`DRY RUN: git config ${scopeArgs.join(" ")} --add ${key} ${value}\n`,
		);
		return true;
	}

	const result = runGit(["config", ...scopeArgs, "--add", key, value]);
	if (result.status !== 0) {
		process.stderr.write(
			`Failed to add rewrite '${value}': ${result.stderr || "unknown git error"}\n`,
		);
		return false;
	}

	process.stdout.write(
		`Added rewrite: ${value} -> ${key.replace(/^url\./, "").replace(/\.insteadOf$/, "")}\n`,
	);
	return true;
}

function parseInitOptions(args) {
	const options = {
		host: "better-hub.com",
		target: "https://github.com/",
		scope: "global",
		dryRun: false,
		includeWww: true,
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (arg === "--host") {
			options.host = args[index + 1] ?? "";
			index += 1;
			continue;
		}

		if (arg === "--target") {
			options.target = args[index + 1] ?? "";
			index += 1;
			continue;
		}

		if (arg === "--local") {
			options.scope = "local";
			continue;
		}

		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}

		if (arg === "--no-www") {
			options.includeWww = false;
			continue;
		}

		if (arg === "--help" || arg === "-h") {
			printHelp();
			process.exit(0);
		}

		process.stderr.write(`Unknown option: ${arg}\n\n`);
		printHelp();
		process.exit(1);
	}

	return options;
}

function ensureInsideRepoForLocal(scope) {
	if (scope !== "local") return true;

	const check = runGit(["rev-parse", "--is-inside-work-tree"]);
	if (check.status !== 0 || check.stdout !== "true") {
		process.stderr.write(
			"--local was provided, but the current directory is not a git repository.\n",
		);
		return false;
	}

	return true;
}

function initCommand(rawArgs) {
	const options = parseInitOptions(rawArgs);
	const domain = normalizeDomain(options.host);
	const target = normalizeTarget(options.target);

	if (!domain) {
		process.stderr.write("Invalid --host value. Use a domain like better-hub.com.\n");
		process.exit(1);
	}

	if (!target) {
		process.stderr.write(
			"Invalid --target value. Use a URL like https://github.com/.\n",
		);
		process.exit(1);
	}

	if (!ensureInsideRepoForLocal(options.scope)) {
		process.exit(1);
	}

	const scopeArgs = options.scope === "local" ? ["--local"] : ["--global"];
	const key = `url.${target}.insteadOf`;

	const hostnames = new Set([domain]);
	if (options.includeWww && !domain.startsWith("www.")) {
		hostnames.add(`www.${domain}`);
	}

	const valuesToAdd = [];
	for (const host of hostnames) {
		valuesToAdd.push(`https://${host}/`);
		valuesToAdd.push(`http://${host}/`);
	}

	const existingValues = new Set(getExistingInsteadOfValues(scopeArgs, key));

	let added = 0;
	let skipped = 0;

	for (const value of valuesToAdd) {
		if (existingValues.has(value)) {
			skipped += 1;
			process.stdout.write(`Already exists: ${value}\n`);
			continue;
		}

		const success = addRewrite(scopeArgs, key, value, options.dryRun);
		if (!success) {
			process.exit(1);
		}

		added += 1;
	}

	process.stdout.write(`\nDone. Added ${added}, skipped ${skipped}.\n`);
	process.stdout.write(`You can now run: git clone https://${domain}/OWNER/REPO\n`);
}

const [, , command, ...args] = process.argv;

if (!command || command === "--help" || command === "-h") {
	printHelp();
	process.exit(0);
}

if (command === "--version" || command === "-v") {
	process.stdout.write(`${VERSION}\n`);
	process.exit(0);
}

if (command === "init") {
	initCommand(args);
	process.exit(0);
}

process.stderr.write(`Unknown command: ${command}\n\n`);
printHelp();
process.exit(1);
