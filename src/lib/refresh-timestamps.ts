import fs from "fs";
import path from "path";
import type { RefreshTimestamps } from "./types";

const TIMESTAMPS_PATH = path.join(process.cwd(), "src", "data", "refresh-timestamps.json");

export function getRefreshTimestamps(): RefreshTimestamps {
	const result: RefreshTimestamps = {};

	try {
		if (fs.existsSync(TIMESTAMPS_PATH)) {
			const raw = JSON.parse(fs.readFileSync(TIMESTAMPS_PATH, "utf-8"));
			if (raw.zoho) result.zoho = raw.zoho;
		}
	} catch {
		// Cold start — no timestamps file yet
	}

	return result;
}
