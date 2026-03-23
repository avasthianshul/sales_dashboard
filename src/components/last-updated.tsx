"use client";

import type { RefreshTimestamps } from "@/lib/types";

type SourceConfig = {
	key: keyof RefreshTimestamps;
	label: string;
	live?: boolean;
};

function formatRelativeTime(isoString: string): string {
	const now = Date.now();
	const then = new Date(isoString).getTime();
	const diffMs = now - then;
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	return `${diffDay}d ago`;
}

function getStaleness(isoString: string): "fresh" | "stale" | "very-stale" {
	const diffMs = Date.now() - new Date(isoString).getTime();
	const hours = diffMs / 3600000;
	if (hours > 48) return "very-stale";
	if (hours > 24) return "stale";
	return "fresh";
}

const STALENESS_STYLES = {
	fresh: "bg-green-500",
	stale: "bg-amber-500",
	"very-stale": "bg-red-500",
};

function SourceIndicator({ config, timestamps }: { config: SourceConfig; timestamps?: RefreshTimestamps }) {
	if (config.live) {
		return (
			<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
				<span className="relative flex h-2 w-2">
					<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
					<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
				</span>
				<span className="font-medium text-green-600">{config.label}</span>
				<span className="text-green-600">Live</span>
			</span>
		);
	}

	const ts = timestamps?.[config.key];
	if (!ts) {
		return (
			<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
				<span className="inline-flex rounded-full h-2 w-2 bg-gray-300" />
				<span>{config.label}</span>
				<span className="text-gray-400">no data</span>
			</span>
		);
	}

	const staleness = getStaleness(ts);
	return (
		<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
			<span className={`inline-flex rounded-full h-2 w-2 ${STALENESS_STYLES[staleness]}`} />
			<span>{config.label}</span>
			<span className={staleness === "very-stale" ? "text-red-500" : staleness === "stale" ? "text-amber-500" : ""}>
				{formatRelativeTime(ts)}
			</span>
		</span>
	);
}

export function LastUpdated({
	sources,
	timestamps,
}: {
	sources: SourceConfig[];
	timestamps?: RefreshTimestamps;
}) {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
			{sources.map((s) => (
				<SourceIndicator key={s.key + (s.live ? "-live" : "")} config={s} timestamps={timestamps} />
			))}
		</div>
	);
}
