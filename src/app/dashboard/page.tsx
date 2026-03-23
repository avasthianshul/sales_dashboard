"use client";

import { useMemo, useState, useCallback } from "react";
import { useSalesData } from "@/lib/use-sales-data";
import { formatINR, formatINRCompact, formatINRFull, formatPercent, formatMultiplier } from "@/lib/format";
import { KpiCard } from "@/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, X, AlertTriangle } from "lucide-react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	Legend,
	PieChart,
	Pie,
	Cell,
	ReferenceLine,
} from "recharts";
import { LastUpdated } from "@/components/last-updated";
import type { ZohoDeal, SalesTimeSeriesPoint, TimePeriod, ForecastCategory } from "@/lib/types";
import { useDashboard } from "@/lib/dashboard-context";

// --- Forecast category helpers ---

const FORECAST_LABELS: Record<ForecastCategory, string> = {
	pipeline: "Pipeline",
	bestCase: "Best Case",
	commit: "Commit",
	won: "Won",
	lost: "Lost",
};

function getForecastCategoryClient(stage: string): ForecastCategory {
	const s = stage.toLowerCase();
	if (s === "closed won" || s === "closed (won)") return "won";
	if (s.includes("lost") || s === "disqualified" || s === "nurture/parked") return "lost";
	if (s === "commit" || s === "commit - upsell" || s === "negotiation/review") return "commit";
	if (s === "solution fit/demo done" || s === "proposal shared") return "bestCase";
	return "pipeline";
}

function getDealPeriodKey(closingDate: string | null, period: TimePeriod): string | null {
	if (!closingDate) return null;
	const month = parseInt(closingDate.substring(5, 7));
	const year = parseInt(closingDate.substring(0, 4));
	switch (period) {
		case "monthly":
			return closingDate.substring(0, 7);
		case "quarterly": {
			let fyStart: number, q: number;
			if (month >= 4 && month <= 6) { fyStart = year; q = 1; }
			else if (month >= 7 && month <= 9) { fyStart = year; q = 2; }
			else if (month >= 10 && month <= 12) { fyStart = year; q = 3; }
			else { fyStart = year - 1; q = 4; }
			return `${fyStart}-Q${q}`;
		}
		case "annual":
			return month >= 4 ? String(year) : String(year - 1);
	}
}

function LoadingSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{Array.from({ length: 8 }).map((_, i) => (
					<Skeleton key={i} className="h-32 rounded-lg" />
				))}
			</div>
			<Skeleton className="h-[400px] rounded-lg" />
		</div>
	);
}

function getStageBadgeStyle(stage: string): string {
	const s = stage.toLowerCase();
	if (s === "closed won") return "bg-green-100 text-green-700 border-green-200";
	if (s === "lost" || s.startsWith("lost to") || s === "disqualified") return "bg-red-100 text-red-700 border-red-200";
	if (s.includes("commit") || s.includes("negotiation") || s.includes("proposal")) return "bg-amber-100 text-amber-700 border-amber-200";
	if (s.includes("prospect")) return "bg-gray-100 text-gray-700 border-gray-200";
	if (s.includes("nurture") || s.includes("parked") || s.includes("partner")) return "bg-violet-100 text-violet-700 border-violet-200";
	return "bg-blue-100 text-blue-700 border-blue-200";
}

function getForecastBadgeStyle(cat: ForecastCategory): string {
	switch (cat) {
		case "pipeline": return "bg-slate-100 text-slate-700 border-slate-200";
		case "bestCase": return "bg-blue-100 text-blue-700 border-blue-200";
		case "commit": return "bg-amber-100 text-amber-700 border-amber-200";
		case "won": return "bg-green-100 text-green-700 border-green-200";
		case "lost": return "bg-red-100 text-red-700 border-red-200";
	}
}

function rateColor(value: number, greenThreshold: number, amberThreshold: number): string {
	if (value >= greenThreshold) return "text-green-600";
	if (value >= amberThreshold) return "text-amber-600";
	return "text-red-600";
}

function rateBg(value: number, greenThreshold: number, amberThreshold: number): string {
	if (value >= greenThreshold) return "bg-green-50";
	if (value >= amberThreshold) return "bg-amber-50";
	return "bg-red-50";
}

type SortField = "dealName" | "accountName" | "amount" | "stage" | "closingDate" | "owner" | "forecastCategory";
type SortDir = "asc" | "desc";

function getUniqueValues(deals: ZohoDeal[], field: keyof ZohoDeal): string[] {
	const vals = new Set<string>();
	for (const d of deals) {
		const v = d[field];
		if (v && typeof v === "string") vals.add(v);
	}
	return Array.from(vals).sort();
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
	return (
		<div className="flex flex-col gap-1">
			<label className="text-xs text-muted-foreground font-medium">{label}</label>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="">All</option>
				{options.map((o) => (
					<option key={o} value={o}>{o}</option>
				))}
			</select>
		</div>
	);
}

const LOST_PIE_COLORS = ["#94a3b8", "#ef4444", "#6b7280", "#8b5cf6"];

export default function SalesDashboardPage() {
	const { data, loading } = useSalesData();
	const { period } = useDashboard();
	const [sortField, setSortField] = useState<SortField>("amount");
	const [sortDir, setSortDir] = useState<SortDir>("desc");
	const [filterStage, setFilterStage] = useState("");
	const [filterPipeline, setFilterPipeline] = useState("");
	const [filterRegion, setFilterRegion] = useState("");
	const [filterType, setFilterType] = useState("");
	const [filterOwner, setFilterOwner] = useState("");
	const [filterLeadSource, setFilterLeadSource] = useState("");
	const [filterForecastCategory, setFilterForecastCategory] = useState("");
	const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
	const [repSortField, setRepSortField] = useState<string>("pipelineValue");
	const [repSortDir, setRepSortDir] = useState<SortDir>("desc");
	const [sourceSortField, setSourceSortField] = useState<string>("totalValue");
	const [sourceSortDir, setSourceSortDir] = useState<SortDir>("desc");

	const pipeline = data?.pipeline;
	const deals = useMemo(() => pipeline?.deals || [], [pipeline]);

	const filterOptions = useMemo(() => ({
		stage: getUniqueValues(deals, "stage"),
		pipeline: getUniqueValues(deals, "pipeline"),
		region: getUniqueValues(deals, "region"),
		type: getUniqueValues(deals, "type"),
		owner: getUniqueValues(deals, "owner"),
		leadSource: getUniqueValues(deals, "leadSource"),
		forecastCategory: ["pipeline", "bestCase", "commit", "won", "lost"],
	}), [deals]);

	const filteredDeals = useMemo(() => {
		return deals.filter((d) => {
			if (filterStage && d.stage !== filterStage) return false;
			if (filterPipeline && d.pipeline !== filterPipeline) return false;
			if (filterRegion && d.region !== filterRegion) return false;
			if (filterType && d.type !== filterType) return false;
			if (filterOwner && d.owner !== filterOwner) return false;
			if (filterLeadSource && d.leadSource !== filterLeadSource) return false;
			if (filterForecastCategory && getForecastCategoryClient(d.stage) !== filterForecastCategory) return false;
			if (selectedPeriodKey && getDealPeriodKey(d.closingDate, period) !== selectedPeriodKey) return false;
			return true;
		});
	}, [deals, filterStage, filterPipeline, filterRegion, filterType, filterOwner, filterLeadSource, filterForecastCategory, selectedPeriodKey, period]);

	const sortedDeals = useMemo(() => {
		return [...filteredDeals].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case "amount":
					cmp = a.amount - b.amount;
					break;
				case "closingDate":
					cmp = (a.closingDate || "").localeCompare(b.closingDate || "");
					break;
				case "forecastCategory":
					cmp = getForecastCategoryClient(a.stage).localeCompare(getForecastCategoryClient(b.stage));
					break;
				default:
					cmp = (a[sortField as keyof ZohoDeal] as string || "").localeCompare(b[sortField as keyof ZohoDeal] as string || "");
			}
			return sortDir === "desc" ? -cmp : cmp;
		});
	}, [filteredDeals, sortField, sortDir]);

	const salesTimeSeries = useMemo(() => pipeline?.salesTimeSeries || [], [pipeline]);

	const selectedPeriodInfo = useMemo(() => {
		if (!selectedPeriodKey) return null;
		const point = salesTimeSeries.find((p) => p.periodKey === selectedPeriodKey);
		return point ? { label: point.period, count: point.dealCount, value: point.pipelineValue + point.bestCaseValue + point.commitValue + point.wonValue } : null;
	}, [selectedPeriodKey, salesTimeSeries]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const handleBarClick = useCallback((clickData: any) => {
		if (clickData?.activePayload?.[0]) {
			const key = (clickData.activePayload[0].payload as SalesTimeSeriesPoint).periodKey;
			setSelectedPeriodKey((prev) => (prev === key ? null : key));
		}
	}, []);

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortField(field);
			setSortDir(field === "amount" ? "desc" : "asc");
		}
	};

	const sortedReps = useMemo(() => {
		if (!pipeline?.repPerformance) return [];
		return [...pipeline.repPerformance].sort((a, b) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const av = (a as any)[repSortField] ?? 0;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const bv = (b as any)[repSortField] ?? 0;
			return repSortDir === "desc" ? bv - av : av - bv;
		});
	}, [pipeline?.repPerformance, repSortField, repSortDir]);

	const sortedSources = useMemo(() => {
		if (!pipeline?.leadSourceMetrics) return [];
		return [...pipeline.leadSourceMetrics].sort((a, b) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const av = (a as any)[sourceSortField] ?? 0;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const bv = (b as any)[sourceSortField] ?? 0;
			return sourceSortDir === "desc" ? bv - av : av - bv;
		});
	}, [pipeline?.leadSourceMetrics, sourceSortField, sourceSortDir]);

	const toggleRepSort = (field: string) => {
		if (repSortField === field) {
			setRepSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setRepSortField(field);
			setRepSortDir("desc");
		}
	};

	const toggleSourceSort = (field: string) => {
		if (sourceSortField === field) {
			setSourceSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSourceSortField(field);
			setSourceSortDir("desc");
		}
	};

	if (loading || !data) return <LoadingSkeleton />;

	if (!pipeline) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-center">
					<p className="text-lg font-medium text-muted-foreground">No CRM data available</p>
					<p className="text-sm text-muted-foreground mt-1">Run the Zoho Bigin ETL script to load deal data</p>
				</div>
			</div>
		);
	}

	const { salesKpis, lostDealBreakdown, quarterlyForecast, funnel } = pipeline;
	const today = new Date().toISOString().substring(0, 10);

	const sortIndicator = (field: SortField) => {
		if (sortField !== field) return <ArrowUpDown className="inline h-3 w-3 ml-1 text-muted-foreground/50" />;
		return <span className="ml-1 text-foreground">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
	};

	const repSortIndicator = (field: string) => {
		if (repSortField !== field) return <ArrowUpDown className="inline h-3 w-3 ml-1 text-muted-foreground/50" />;
		return <span className="ml-1 text-foreground">{repSortDir === "asc" ? "\u2191" : "\u2193"}</span>;
	};

	const sourceSortIndicator = (field: string) => {
		if (sourceSortField !== field) return <ArrowUpDown className="inline h-3 w-3 ml-1 text-muted-foreground/50" />;
		return <span className="ml-1 text-foreground">{sourceSortDir === "asc" ? "\u2191" : "\u2193"}</span>;
	};

	// Lost deal pie data
	const lostPieData = [
		{ name: "No Decision", value: lostDealBreakdown.lostToNoDecision.count + lostDealBreakdown.nurtureParked.count },
		{ name: "Competition", value: lostDealBreakdown.lostToCompetition.count },
		{ name: "Disqualified", value: lostDealBreakdown.disqualified.count },
	].filter((d) => d.value > 0);

	const totalLost = lostDealBreakdown.lostToNoDecision.count + lostDealBreakdown.lostToCompetition.count + lostDealBreakdown.disqualified.count + lostDealBreakdown.nurtureParked.count;
	const noDecisionPct = totalLost > 0 ? ((lostDealBreakdown.lostToNoDecision.count + lostDealBreakdown.nurtureParked.count) / totalLost * 100) : 0;
	const competitionPct = totalLost > 0 ? (lostDealBreakdown.lostToCompetition.count / totalLost * 100) : 0;

	// Quarterly forecast chart data
	const forecastChartData = quarterlyForecast.map((q) => ({
		quarter: q.quarter,
		Commit: q.commitValue,
		"Best Case": q.bestCaseValue,
		Pipeline: q.pipelineValue,
		Won: q.wonValue,
		Target: q.target,
	}));

	return (
		<div className="space-y-6">
			<LastUpdated
				sources={[{ key: "zoho", label: "CRM" }]}
				timestamps={data.refreshedAt}
			/>
			{/* Section 1: Diagnostic KPI Cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<KpiCard
					title="Forecast (Commit)"
					value={formatINR(salesKpis.forecastValue)}
					subtitle="Commit-stage deals"
					accentColor="#f59e0b"
				/>
				<KpiCard
					title="Pipeline Coverage"
					value={formatMultiplier(salesKpis.pipelineCoverage)}
					subtitle={
						<span className={rateColor(salesKpis.pipelineCoverage, 3, 2)}>
							{salesKpis.pipelineCoverage >= 3 ? "Healthy" : salesKpis.pipelineCoverage >= 2 ? "At risk" : "Critical"} (target: 3.0x)
						</span>
					}
					accentColor={salesKpis.pipelineCoverage >= 3 ? "#22c55e" : salesKpis.pipelineCoverage >= 2 ? "#f59e0b" : "#ef4444"}
				/>
				<KpiCard
					title="Close Rate"
					value={formatPercent(salesKpis.closeRate)}
					subtitle={
						<span className={rateColor(salesKpis.closeRate, 33, 20)}>
							won / decided (target: {"\u2265"}33%)
						</span>
					}
					accentColor={salesKpis.closeRate >= 33 ? "#22c55e" : salesKpis.closeRate >= 20 ? "#f59e0b" : "#ef4444"}
				/>
				<KpiCard
					title="Win Rate"
					value={formatPercent(salesKpis.winRate)}
					subtitle={
						<span className={rateColor(salesKpis.winRate, 50, 33)}>
							won / competitive (target: {"\u2265"}50%)
						</span>
					}
					accentColor={salesKpis.winRate >= 50 ? "#22c55e" : salesKpis.winRate >= 33 ? "#f59e0b" : "#ef4444"}
				/>
				<KpiCard
					title="Avg Deal Size"
					value={formatINR(salesKpis.avgDealSize)}
					subtitle="won deals average"
					accentColor="#8b5cf6"
				/>
				<KpiCard
					title="Sales Cycle"
					value={`${salesKpis.avgSalesCycleDays}d`}
					subtitle="avg days to close (won)"
					accentColor="#3b82f6"
				/>
				<KpiCard
					title="Open Pipeline"
					value={formatINR(salesKpis.openPipelineValue)}
					subtitle={`${deals.filter((d) => { const c = getForecastCategoryClient(d.stage); return c !== "won" && c !== "lost"; }).length} open deals`}
					accentColor="#06b6d4"
				/>
				<KpiCard
					title="Slipped Deals"
					value={salesKpis.slippedDealsCount.toString()}
					subtitle={
						salesKpis.slippedDealsCount > 0 ? (
							<span className="text-orange-600">{formatINR(salesKpis.slippedDealsValue)} overdue</span>
						) : "None overdue"
					}
					accentColor={salesKpis.slippedDealsCount > 0 ? "#f97316" : "#22c55e"}
				/>
			</div>

			{/* Section 2: Forecast & Funnel */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Funnel */}
				<Card className="shadow-sm hover:shadow-md transition-shadow">
					<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
						<CardTitle className="text-base font-semibold text-slate-800">Sales Funnel</CardTitle>
					</CardHeader>
					<CardContent className="pt-6 space-y-3">
						{funnel.map((stage, i) => {
							const maxVal = funnel[0]?.value || 1;
							const widthPct = Math.max(10, (stage.value / maxVal) * 100);
							return (
								<div key={stage.name} className="space-y-1">
									<div className="flex justify-between text-sm">
										<span className="font-medium text-slate-700">{stage.name}</span>
										<span className="text-muted-foreground">
											{stage.count} deals &middot; {formatINR(stage.value)}
										</span>
									</div>
									<div className="w-full bg-slate-100 rounded-full h-8 overflow-hidden">
										<div
											className="h-full rounded-full flex items-center px-3 transition-all duration-500"
											style={{
												width: `${widthPct}%`,
												backgroundColor: stage.color,
												opacity: 0.85 + i * 0.05,
											}}
										>
											<span className="text-white text-xs font-medium truncate">
												{formatINRCompact(stage.value)}
											</span>
										</div>
									</div>
								</div>
							);
						})}
					</CardContent>
				</Card>

				{/* Quarterly Forecast Table */}
				<Card className="shadow-sm hover:shadow-md transition-shadow">
					<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
						<CardTitle className="text-base font-semibold text-slate-800">Quarterly Forecast</CardTitle>
						<p className="text-xs text-muted-foreground">Target: {formatINR(salesKpis.quarterlyTarget)}/quarter</p>
					</CardHeader>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<table className="w-full text-sm border-collapse">
								<thead>
									<tr className="bg-slate-50 border-b">
										<th className="text-left px-4 py-2 font-medium text-muted-foreground">Quarter</th>
										<th className="text-right px-3 py-2 font-medium text-muted-foreground">Pipeline</th>
										<th className="text-right px-3 py-2 font-medium text-muted-foreground">Best Case</th>
										<th className="text-right px-3 py-2 font-medium text-muted-foreground">Commit</th>
										<th className="text-right px-3 py-2 font-medium text-muted-foreground">Won</th>
										<th className="text-right px-3 py-2 font-medium text-muted-foreground">Coverage</th>
									</tr>
								</thead>
								<tbody>
									{quarterlyForecast.map((q) => (
										<tr key={q.quarterKey} className="border-b hover:bg-slate-50/50">
											<td className="px-4 py-2 font-medium">{q.quarter}</td>
											<td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500">{formatINR(q.pipelineValue)}</td>
											<td className="px-3 py-2 text-right font-mono tabular-nums text-blue-600">{formatINR(q.bestCaseValue)}</td>
											<td className="px-3 py-2 text-right font-mono tabular-nums text-amber-600">{formatINR(q.commitValue)}</td>
											<td className="px-3 py-2 text-right font-mono tabular-nums text-green-600">{formatINR(q.wonValue)}</td>
											<td className={`px-3 py-2 text-right font-mono tabular-nums font-semibold ${rateColor(q.coverageRatio, 3, 2)}`}>
												{formatMultiplier(q.coverageRatio)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Forecast vs Target Chart */}
			{forecastChartData.length > 0 && (
				<Card className="shadow-sm hover:shadow-md transition-shadow">
					<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
						<CardTitle className="text-base font-semibold text-slate-800">Forecast vs Target by Quarter</CardTitle>
					</CardHeader>
					<CardContent className="pt-4">
						<ResponsiveContainer width="100%" height={300}>
							<BarChart data={forecastChartData}>
								<XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
								<YAxis tickFormatter={(v: number) => formatINRCompact(v)} tick={{ fontSize: 11 }} />
								<Tooltip formatter={(value) => [formatINRFull(Number(value))]} labelFormatter={(label) => String(label)} />
								<Legend />
								<ReferenceLine y={salesKpis.quarterlyTarget} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Target", position: "right", fontSize: 11, fill: "#ef4444" }} />
								<Bar dataKey="Won" stackId="forecast" fill="#22c55e" />
								<Bar dataKey="Commit" stackId="forecast" fill="#f59e0b" />
								<Bar dataKey="Best Case" stackId="forecast" fill="#3b82f6" />
								<Bar dataKey="Pipeline" stackId="forecast" fill="#64748b" radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			{/* Section 3: Lost Deal Analysis */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card className="shadow-sm hover:shadow-md transition-shadow">
					<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
						<CardTitle className="text-base font-semibold text-slate-800">Lost Deal Breakdown</CardTitle>
						<p className="text-xs text-muted-foreground">{totalLost} total lost deals</p>
					</CardHeader>
					<CardContent className="pt-4">
						{lostPieData.length > 0 ? (
							<ResponsiveContainer width="100%" height={260}>
								<PieChart>
									<Pie
										data={lostPieData}
										cx="50%"
										cy="50%"
										innerRadius={60}
										outerRadius={100}
										paddingAngle={3}
										dataKey="value"
										label={({ name, value }) => `${name}: ${value}`}
									>
										{lostPieData.map((_, i) => (
											<Cell key={i} fill={LOST_PIE_COLORS[i % LOST_PIE_COLORS.length]} />
										))}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						) : (
							<p className="text-center text-muted-foreground py-8">No lost deals</p>
						)}
					</CardContent>
				</Card>

				<Card className="shadow-sm hover:shadow-md transition-shadow">
					<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
						<CardTitle className="text-base font-semibold text-slate-800">Loss Diagnosis</CardTitle>
					</CardHeader>
					<CardContent className="pt-4 space-y-4">
						<div className="space-y-3 text-sm">
							<div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
								<div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: "#94a3b8" }} />
								<div>
									<p className="font-medium">Lost to No Decision: {lostDealBreakdown.lostToNoDecision.count + lostDealBreakdown.nurtureParked.count} deals ({formatPercent(noDecisionPct)})</p>
									<p className="text-muted-foreground mt-0.5">
										Value: {formatINR(lostDealBreakdown.lostToNoDecision.value + lostDealBreakdown.nurtureParked.value)}
										{lostDealBreakdown.nurtureParked.count > 0 && ` (incl. ${lostDealBreakdown.nurtureParked.count} nurture/parked)`}
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
								<div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: "#ef4444" }} />
								<div>
									<p className="font-medium">Lost to Competition: {lostDealBreakdown.lostToCompetition.count} deals ({formatPercent(competitionPct)})</p>
									<p className="text-muted-foreground mt-0.5">Value: {formatINR(lostDealBreakdown.lostToCompetition.value)}</p>
								</div>
							</div>
							<div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
								<div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: "#6b7280" }} />
								<div>
									<p className="font-medium">Disqualified: {lostDealBreakdown.disqualified.count} deals</p>
									<p className="text-muted-foreground mt-0.5">Value: {formatINR(lostDealBreakdown.disqualified.value)}</p>
								</div>
							</div>
						</div>

						{/* Diagnostic insight */}
						<div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
							<p className="text-sm font-medium text-amber-800">
								{noDecisionPct > 60
									? "Qualification gap: Most losses are to no-decision, suggesting weak discovery or deals entering the pipeline too early."
									: competitionPct > 40
									? "Competitive pressure: A significant share of losses are to competitors. Review differentiation and demo effectiveness."
									: "Loss pattern is balanced. Continue monitoring for emerging trends."}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Section 4: Rep Performance */}
			<Card className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
				<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
					<CardTitle className="text-base font-semibold text-slate-800">Rep Performance</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<table className="w-full text-sm border-collapse">
							<thead className="sticky top-0 z-10">
								<tr className="bg-slate-50 border-b">
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">Rep</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleRepSort("pipelineValue")}>
										Pipeline {repSortIndicator("pipelineValue")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleRepSort("dealCount")}>
										Deals {repSortIndicator("dealCount")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleRepSort("wonCount")}>
										Won {repSortIndicator("wonCount")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleRepSort("closeRate")}>
										Close Rate {repSortIndicator("closeRate")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleRepSort("winRate")}>
										Win Rate {repSortIndicator("winRate")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleRepSort("avgDealSize")}>
										Avg Deal {repSortIndicator("avgDealSize")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleRepSort("forecastValue")}>
										Forecast {repSortIndicator("forecastValue")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleRepSort("bestCaseValue")}>
										Best Case {repSortIndicator("bestCaseValue")}
									</th>
								</tr>
							</thead>
							<tbody>
								{sortedReps.map((rep, i) => (
									<tr key={rep.owner} className={`border-b hover:bg-slate-50/50 ${i % 2 === 0 ? "bg-gray-50/30" : "bg-white"}`}>
										<td className="px-4 py-2 font-medium">{rep.owner}</td>
										<td className="px-3 py-2 text-right font-mono tabular-nums">{formatINR(rep.pipelineValue)}</td>
										<td className="px-3 py-2 text-right">{rep.dealCount}</td>
										<td className="px-3 py-2 text-right text-green-600 font-medium">{rep.wonCount}</td>
										<td className={`px-3 py-2 text-right font-medium ${rateColor(rep.closeRate, 33, 20)} ${rateBg(rep.closeRate, 33, 20)} rounded`}>
											{formatPercent(rep.closeRate)}
										</td>
										<td className={`px-3 py-2 text-right font-medium ${rateColor(rep.winRate, 50, 33)} ${rateBg(rep.winRate, 50, 33)} rounded`}>
											{formatPercent(rep.winRate)}
										</td>
										<td className="px-3 py-2 text-right font-mono tabular-nums">{formatINR(rep.avgDealSize)}</td>
										<td className="px-3 py-2 text-right font-mono tabular-nums text-amber-600">{formatINR(rep.forecastValue)}</td>
										<td className="px-3 py-2 text-right font-mono tabular-nums text-blue-600">{formatINR(rep.bestCaseValue)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			{/* Section 5: Lead Source Effectiveness */}
			<Card className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
				<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
					<CardTitle className="text-base font-semibold text-slate-800">Lead Source Effectiveness</CardTitle>
					<p className="text-xs text-muted-foreground">Sources with 3+ deals</p>
				</CardHeader>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<table className="w-full text-sm border-collapse">
							<thead className="sticky top-0 z-10">
								<tr className="bg-slate-50 border-b">
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">Source</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleSourceSort("totalDeals")}>
										Deals {sourceSortIndicator("totalDeals")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleSourceSort("totalValue")}>
										Pipeline Created {sourceSortIndicator("totalValue")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleSourceSort("wonDeals")}>
										Won {sourceSortIndicator("wonDeals")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleSourceSort("wonValue")}>
										Won Value {sourceSortIndicator("wonValue")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleSourceSort("closeRate")}>
										Close Rate {sourceSortIndicator("closeRate")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleSourceSort("winRate")}>
										Win Rate {sourceSortIndicator("winRate")}
									</th>
									<th className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground" onClick={() => toggleSourceSort("avgDealValue")}>
										Avg Deal {sourceSortIndicator("avgDealValue")}
									</th>
								</tr>
							</thead>
							<tbody>
								{sortedSources.map((src, i) => (
									<tr key={src.leadSource} className={`border-b hover:bg-slate-50/50 ${i % 2 === 0 ? "bg-gray-50/30" : "bg-white"}`}>
										<td className="px-4 py-2 font-medium max-w-[200px] truncate">{src.leadSource}</td>
										<td className="px-3 py-2 text-right">{src.totalDeals}</td>
										<td className="px-3 py-2 text-right font-mono tabular-nums">{formatINR(src.totalValue)}</td>
										<td className="px-3 py-2 text-right text-green-600 font-medium">{src.wonDeals}</td>
										<td className="px-3 py-2 text-right font-mono tabular-nums text-green-600">{formatINR(src.wonValue)}</td>
										<td className={`px-3 py-2 text-right font-medium ${rateColor(src.closeRate, 33, 20)} ${rateBg(src.closeRate, 33, 20)} rounded`}>
											{formatPercent(src.closeRate)}
										</td>
										<td className={`px-3 py-2 text-right font-medium ${rateColor(src.winRate, 50, 33)} ${rateBg(src.winRate, 50, 33)} rounded`}>
											{formatPercent(src.winRate)}
										</td>
										<td className="px-3 py-2 text-right font-mono tabular-nums">{formatINR(src.avgDealValue)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			{/* Section 6: Pipeline by Close Date */}
			{salesTimeSeries.length > 0 && (
				<Card className="shadow-sm hover:shadow-md transition-shadow">
					<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
						<CardTitle className="text-base font-semibold text-slate-800">Pipeline by Expected Close Date</CardTitle>
						<p className="text-xs text-muted-foreground mt-0.5">Click a bar to filter the deals table below</p>
					</CardHeader>
					<CardContent className="pt-4">
						<ResponsiveContainer width="100%" height={320}>
							<BarChart data={salesTimeSeries} onClick={handleBarClick} className="cursor-pointer">
								<XAxis dataKey="period" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
								<YAxis tickFormatter={(v: number) => formatINRCompact(v)} tick={{ fontSize: 11 }} />
								<Tooltip
									formatter={(value, name) => [formatINRFull(Number(value)), String(name)]}
									labelFormatter={(label) => String(label)}
								/>
								<Legend />
								<Bar dataKey="wonValue" name="Won" stackId="pipeline" fill="#22c55e" />
								<Bar dataKey="commitValue" name="Commit" stackId="pipeline" fill="#f59e0b" />
								<Bar dataKey="bestCaseValue" name="Best Case" stackId="pipeline" fill="#3b82f6" />
								<Bar dataKey="pipelineValue" name="Pipeline" stackId="pipeline" fill="#64748b" radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			{/* Period filter badge */}
			{selectedPeriodInfo && (
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1.5 text-sm">
						Showing: {selectedPeriodInfo.label} ({selectedPeriodInfo.count} deals, {formatINR(selectedPeriodInfo.value)})
						<button onClick={() => setSelectedPeriodKey(null)} className="ml-2 hover:text-blue-900">
							<X className="h-3 w-3 inline" />
						</button>
					</Badge>
				</div>
			)}

			{/* Section 7: Deals Table */}
			<Card className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
				<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
					<CardTitle className="text-base font-semibold text-slate-800">
						Deals ({filteredDeals.length}{filteredDeals.length !== deals.length ? ` of ${deals.length}` : ""})
					</CardTitle>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mt-3">
						<FilterSelect label="Stage" value={filterStage} options={filterOptions.stage} onChange={setFilterStage} />
						<FilterSelect label="Forecast" value={filterForecastCategory} options={filterOptions.forecastCategory} onChange={setFilterForecastCategory} />
						<FilterSelect label="Pipeline" value={filterPipeline} options={filterOptions.pipeline} onChange={setFilterPipeline} />
						<FilterSelect label="Region" value={filterRegion} options={filterOptions.region} onChange={setFilterRegion} />
						<FilterSelect label="Type" value={filterType} options={filterOptions.type} onChange={setFilterType} />
						<FilterSelect label="Owner" value={filterOwner} options={filterOptions.owner} onChange={setFilterOwner} />
						<FilterSelect label="Lead Source" value={filterLeadSource} options={filterOptions.leadSource} onChange={setFilterLeadSource} />
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<div className="overflow-x-auto overflow-y-auto max-h-[600px]">
						<table className="w-full text-sm border-collapse">
							<thead className="sticky top-0 z-10">
								<tr className="bg-slate-50 border-b">
									<th
										className="cursor-pointer hover:text-foreground select-none text-left px-4 py-2 font-medium text-muted-foreground min-w-[200px]"
										onClick={() => toggleSort("dealName")}
									>
										Deal Name {sortIndicator("dealName")}
									</th>
									<th
										className="cursor-pointer hover:text-foreground select-none text-left px-3 py-2 font-medium text-muted-foreground min-w-[140px]"
										onClick={() => toggleSort("accountName")}
									>
										Account {sortIndicator("accountName")}
									</th>
									<th
										className="cursor-pointer hover:text-foreground select-none text-right px-3 py-2 font-medium text-muted-foreground min-w-[100px]"
										onClick={() => toggleSort("amount")}
									>
										Amount {sortIndicator("amount")}
									</th>
									<th
										className="cursor-pointer hover:text-foreground select-none text-left px-3 py-2 font-medium text-muted-foreground min-w-[130px]"
										onClick={() => toggleSort("stage")}
									>
										Stage {sortIndicator("stage")}
									</th>
									<th
										className="cursor-pointer hover:text-foreground select-none text-left px-3 py-2 font-medium text-muted-foreground min-w-[100px]"
										onClick={() => toggleSort("forecastCategory")}
									>
										Forecast {sortIndicator("forecastCategory")}
									</th>
									<th
										className="cursor-pointer hover:text-foreground select-none text-left px-3 py-2 font-medium text-muted-foreground min-w-[100px]"
										onClick={() => toggleSort("owner")}
									>
										Owner {sortIndicator("owner")}
									</th>
									<th className="text-left px-3 py-2 font-medium text-muted-foreground min-w-[100px]">Region</th>
									<th className="text-left px-3 py-2 font-medium text-muted-foreground min-w-[100px]">Lead Source</th>
									<th
										className="cursor-pointer hover:text-foreground select-none text-left px-3 py-2 font-medium text-muted-foreground min-w-[100px]"
										onClick={() => toggleSort("closingDate")}
									>
										Closing Date {sortIndicator("closingDate")}
									</th>
								</tr>
							</thead>
							<tbody>
								{sortedDeals.map((deal, i) => {
									const rowBg = i % 2 === 0 ? "bg-gray-50/30" : "bg-white";
									const cat = getForecastCategoryClient(deal.stage);
									const isSlipped = cat !== "won" && cat !== "lost" && deal.closingDate !== null && deal.closingDate < today;
									return (
										<tr key={`${deal.dealName}-${i}`} className={`hover:bg-slate-100/50 ${rowBg}`}>
											<td className="px-4 py-1.5 font-medium text-sm max-w-[200px] truncate">{deal.dealName}</td>
											<td className="px-3 py-1.5 text-sm max-w-[140px] truncate">{deal.accountName}</td>
											<td className="px-3 py-1.5 text-right font-mono tabular-nums text-sm">
												{deal.amount > 0 ? formatINR(deal.amount) : "-"}
											</td>
											<td className="px-3 py-1.5">
												<Badge variant="outline" className={getStageBadgeStyle(deal.stage)}>
													{deal.stage}
												</Badge>
											</td>
											<td className="px-3 py-1.5">
												<Badge variant="outline" className={getForecastBadgeStyle(cat)}>
													{FORECAST_LABELS[cat]}
												</Badge>
											</td>
											<td className="px-3 py-1.5 text-sm">{deal.owner}</td>
											<td className="px-3 py-1.5 text-sm">{deal.region}</td>
											<td className="px-3 py-1.5 text-sm">{deal.leadSource}</td>
											<td className="px-3 py-1.5 text-sm whitespace-nowrap">
												<span className="flex items-center gap-1">
													{deal.closingDate || "-"}
													{isSlipped && (
														<span className="inline-flex items-center gap-0.5 text-orange-500" title="Slipped: past closing date">
															<AlertTriangle className="h-3.5 w-3.5" />
														</span>
													)}
												</span>
											</td>
										</tr>
									);
								})}
								{sortedDeals.length === 0 && (
									<tr>
										<td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
											No deals match the current filters
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
