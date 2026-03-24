import type {
	TimePeriod,
	ZohoDeal,
	ZohoPipelineKpis,
	StageDistribution,
	StageCategory,
	ForecastCategory,
	SalesForecastKpis,
	LostDealBreakdown,
	RepPerformance,
	LeadSourceMetrics,
	QuarterlyForecast,
	FunnelStage,
	SalesTimeSeriesPoint,
	PipelineTimeSeriesPoint,
	PipelineData,
	SalesDashboardData,
	AvailableTimeFilters,
	TimeFilterOption,
	DealMovement,
	RepDailyMovement,
	DailyDealMovement,
} from "./types";
import { readZohoDeals } from "./zoho-parser";

// --- Period key helpers ---

export function getMonthKey(dateStr: string): string {
	return dateStr.substring(0, 7); // "YYYY-MM"
}

export function getQuarterKey(dateStr: string): string {
	const month = parseInt(dateStr.substring(5, 7));
	const year = parseInt(dateStr.substring(0, 4));

	let fyStartYear: number;
	let quarter: number;

	if (month >= 4 && month <= 6) {
		fyStartYear = year;
		quarter = 1;
	} else if (month >= 7 && month <= 9) {
		fyStartYear = year;
		quarter = 2;
	} else if (month >= 10 && month <= 12) {
		fyStartYear = year;
		quarter = 3;
	} else {
		fyStartYear = year - 1;
		quarter = 4;
	}

	return `${fyStartYear}-Q${quarter}`;
}

export function getFYKey(dateStr: string): string {
	const month = parseInt(dateStr.substring(5, 7));
	const year = parseInt(dateStr.substring(0, 4));

	if (month >= 4) {
		return String(year);
	}
	return String(year - 1);
}

function getPeriodKey(dateStr: string, period: TimePeriod): string {
	switch (period) {
		case "monthly":
			return getMonthKey(dateStr);
		case "quarterly":
			return getQuarterKey(dateStr);
		case "annual":
			return getFYKey(dateStr);
	}
}

export function getPeriodLabel(key: string, period: TimePeriod): string {
	switch (period) {
		case "monthly": {
			const [year, month] = key.split("-");
			const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			return months[parseInt(month) - 1] + " " + year;
		}
		case "quarterly": {
			const [fyStart, q] = key.split("-");
			const fyEndShort = String((parseInt(fyStart) + 1) % 100).padStart(2, "0");
			return `${q} FY${fyEndShort}`;
		}
		case "annual": {
			const startYear = parseInt(key);
			return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
		}
	}
}

// --- Stage classification ---

const WON_STAGES = ["Closed Won", "Closed (Won)"];
const LOST_STAGES = ["Closed Lost", "Closed (Lost)", "Lost", "Lost to product competitor", "Lost to Big 4", "Disqualified"];
const COMMIT_STAGES = ["Commit", "Commit - Upsell", "Negotiation/Review"];
const ACTIVE_STAGES = ["Proposal Shared", "Solution Fit/Demo Done", "Qualified Lead"];
const EARLY_STAGES = ["Prospecting", "Partner- Prospecting", "Partner-Prospecting"];
const NURTURE_LOST_STAGES = ["Nurture/Parked"];

function isWon(stage: string): boolean {
	return WON_STAGES.some((s) => stage.toLowerCase() === s.toLowerCase());
}

function isLost(stage: string): boolean {
	return LOST_STAGES.some((s) => stage.toLowerCase() === s.toLowerCase());
}

export function getStageCategory(stage: string): StageCategory {
	const s = stage.toLowerCase();
	if (WON_STAGES.some((w) => s === w.toLowerCase())) return "won";
	if (LOST_STAGES.some((l) => s === l.toLowerCase()) || NURTURE_LOST_STAGES.some((n) => s === n.toLowerCase())) return "lost";
	if (COMMIT_STAGES.some((c) => s === c.toLowerCase())) return "commit";
	if (ACTIVE_STAGES.some((a) => s === a.toLowerCase())) return "active";
	if (EARLY_STAGES.some((e) => s === e.toLowerCase())) return "early";
	return "active";
}

// --- Sales forecast stage mapping (Brett Queener framework) ---

const PIPELINE_FORECAST_STAGES = ["Prospecting", "Partner- Prospecting", "Partner-Prospecting", "Qualified Lead"];
const BEST_CASE_STAGES = ["Solution Fit/Demo Done", "Proposal Shared"];

export function getForecastCategory(stage: string): ForecastCategory {
	const s = stage.toLowerCase();
	if (WON_STAGES.some((w) => s === w.toLowerCase())) return "won";
	if (LOST_STAGES.some((l) => s === l.toLowerCase()) || NURTURE_LOST_STAGES.some((n) => s === n.toLowerCase())) return "lost";
	if (COMMIT_STAGES.some((c) => s === c.toLowerCase())) return "commit";
	if (BEST_CASE_STAGES.some((b) => s === b.toLowerCase())) return "bestCase";
	if (PIPELINE_FORECAST_STAGES.some((p) => s === p.toLowerCase())) return "pipeline";
	return "pipeline";
}

const QUARTERLY_TARGET = 20000000; // ₹2 Cr per quarter

// --- Computation functions ---

export function computeSalesForecastKpis(deals: ZohoDeal[]): SalesForecastKpis {
	let forecastValue = 0;
	let bestCaseValue = 0;
	let pipelineStageValue = 0;
	let openPipelineValue = 0;
	let wonCount = 0;
	let wonValue = 0;
	let lostToNoDecisionCount = 0;
	let lostToCompetitionCount = 0;
	let slippedDealsCount = 0;
	let slippedDealsValue = 0;
	const salesCycleDays: number[] = [];
	const today = new Date().toISOString().substring(0, 10);

	for (const deal of deals) {
		const cat = getForecastCategory(deal.stage);
		switch (cat) {
			case "commit":
				forecastValue += deal.amount;
				openPipelineValue += deal.amount;
				break;
			case "bestCase":
				bestCaseValue += deal.amount;
				openPipelineValue += deal.amount;
				break;
			case "pipeline":
				pipelineStageValue += deal.amount;
				openPipelineValue += deal.amount;
				break;
			case "won":
				wonCount += 1;
				wonValue += deal.amount;
				if (deal.createdTime && deal.closingDate) {
					const created = new Date(deal.createdTime);
					const closed = new Date(deal.closingDate);
					const days = Math.round((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
					if (days >= 0) salesCycleDays.push(days);
				}
				break;
			case "lost": {
				const sl = deal.stage.toLowerCase();
				if (sl === "lost to product competitor" || sl === "lost to big 4") {
					lostToCompetitionCount += 1;
				} else if (sl !== "disqualified") {
					lostToNoDecisionCount += 1;
				}
				break;
			}
		}

		// Slipped deals: open deals with closing date in the past
		if (cat !== "won" && cat !== "lost" && deal.closingDate && deal.closingDate < today) {
			slippedDealsCount += 1;
			slippedDealsValue += deal.amount;
		}
	}

	const decidedCount = wonCount + lostToCompetitionCount + lostToNoDecisionCount;
	const closeRate = decidedCount > 0 ? (wonCount / decidedCount) * 100 : 0;
	const competitiveTotal = wonCount + lostToCompetitionCount;
	const winRate = competitiveTotal > 0 ? (wonCount / competitiveTotal) * 100 : 0;
	const pipelineCoverage = QUARTERLY_TARGET > 0 ? (bestCaseValue + forecastValue) / QUARTERLY_TARGET : 0;
	const avgSalesCycleDays = salesCycleDays.length > 0 ? Math.round(salesCycleDays.reduce((a, b) => a + b, 0) / salesCycleDays.length) : 0;
	const avgDealSize = wonCount > 0 ? wonValue / wonCount : 0;

	return {
		forecastValue,
		bestCaseValue,
		pipelineStageValue,
		closeRate,
		winRate,
		pipelineCoverage,
		avgSalesCycleDays,
		slippedDealsCount,
		slippedDealsValue,
		quarterlyTarget: QUARTERLY_TARGET,
		avgDealSize,
		openPipelineValue,
	};
}

export function computeLostDealBreakdown(deals: ZohoDeal[]): LostDealBreakdown {
	const result: LostDealBreakdown = {
		lostToNoDecision: { count: 0, value: 0 },
		lostToCompetition: { count: 0, value: 0 },
		disqualified: { count: 0, value: 0 },
		nurtureParked: { count: 0, value: 0 },
	};

	for (const deal of deals) {
		const s = deal.stage.toLowerCase();
		if (s === "lost" || s === "lost (no decision)") {
			result.lostToNoDecision.count += 1;
			result.lostToNoDecision.value += deal.amount;
		} else if (s === "lost to product competitor" || s === "lost to big 4") {
			result.lostToCompetition.count += 1;
			result.lostToCompetition.value += deal.amount;
		} else if (s === "disqualified") {
			result.disqualified.count += 1;
			result.disqualified.value += deal.amount;
		} else if (s === "nurture/parked") {
			result.nurtureParked.count += 1;
			result.nurtureParked.value += deal.amount;
		}
	}

	return result;
}

export function computeRepPerformance(deals: ZohoDeal[]): RepPerformance[] {
	const ownerMap: Record<string, {
		pipelineValue: number; dealCount: number; wonCount: number; wonValue: number;
		lostCount: number; competitionLostCount: number; noDecisionLostCount: number;
		forecastValue: number; bestCaseValue: number;
	}> = {};

	for (const deal of deals) {
		const owner = deal.owner || "Unknown";
		if (!ownerMap[owner]) {
			ownerMap[owner] = { pipelineValue: 0, dealCount: 0, wonCount: 0, wonValue: 0, lostCount: 0, competitionLostCount: 0, noDecisionLostCount: 0, forecastValue: 0, bestCaseValue: 0 };
		}
		const o = ownerMap[owner];
		o.dealCount += 1;
		const cat = getForecastCategory(deal.stage);
		switch (cat) {
			case "won":
				o.wonCount += 1;
				o.wonValue += deal.amount;
				break;
			case "lost": {
				o.lostCount += 1;
				const sl = deal.stage.toLowerCase();
				if (sl === "lost to product competitor" || sl === "lost to big 4") {
					o.competitionLostCount += 1;
				} else if (sl !== "disqualified") {
					o.noDecisionLostCount += 1;
				}
				break;
			}
			case "commit":
				o.forecastValue += deal.amount;
				o.pipelineValue += deal.amount;
				break;
			case "bestCase":
				o.bestCaseValue += deal.amount;
				o.pipelineValue += deal.amount;
				break;
			case "pipeline":
				o.pipelineValue += deal.amount;
				break;
		}
	}

	return Object.entries(ownerMap)
		.map(([owner, o]) => {
			const decidedCount = o.wonCount + o.competitionLostCount + o.noDecisionLostCount;
			const competitiveTotal = o.wonCount + o.competitionLostCount;
			return {
				owner,
				pipelineValue: o.pipelineValue,
				dealCount: o.dealCount,
				wonCount: o.wonCount,
				wonValue: o.wonValue,
				lostCount: o.lostCount,
				closeRate: decidedCount > 0 ? (o.wonCount / decidedCount) * 100 : 0,
				winRate: competitiveTotal > 0 ? (o.wonCount / competitiveTotal) * 100 : 0,
				avgDealSize: o.wonCount > 0 ? o.wonValue / o.wonCount : 0,
				forecastValue: o.forecastValue,
				bestCaseValue: o.bestCaseValue,
			};
		})
		.sort((a, b) => b.pipelineValue - a.pipelineValue);
}

export function computeLeadSourceMetrics(deals: ZohoDeal[]): LeadSourceMetrics[] {
	const sourceMap: Record<string, {
		totalDeals: number; totalValue: number; wonDeals: number; wonValue: number;
		lostDeals: number; competitionLostDeals: number; noDecisionLostDeals: number;
		openPipelineValue: number;
	}> = {};

	for (const deal of deals) {
		const source = deal.leadSource || "Unknown";
		if (!sourceMap[source]) {
			sourceMap[source] = { totalDeals: 0, totalValue: 0, wonDeals: 0, wonValue: 0, lostDeals: 0, competitionLostDeals: 0, noDecisionLostDeals: 0, openPipelineValue: 0 };
		}
		const s = sourceMap[source];
		s.totalDeals += 1;
		s.totalValue += deal.amount;
		const cat = getForecastCategory(deal.stage);
		if (cat === "won") {
			s.wonDeals += 1;
			s.wonValue += deal.amount;
		} else if (cat === "lost") {
			s.lostDeals += 1;
			const sl = deal.stage.toLowerCase();
			if (sl === "lost to product competitor" || sl === "lost to big 4") {
				s.competitionLostDeals += 1;
			} else if (sl !== "disqualified") {
				s.noDecisionLostDeals += 1;
			}
		} else {
			s.openPipelineValue += deal.amount;
		}
	}

	return Object.entries(sourceMap)
		.filter(([, s]) => s.totalDeals >= 3)
		.map(([leadSource, s]) => {
			const decidedCount = s.wonDeals + s.competitionLostDeals + s.noDecisionLostDeals;
			const competitiveTotal = s.wonDeals + s.competitionLostDeals;
			return {
				leadSource,
				totalDeals: s.totalDeals,
				totalValue: s.totalValue,
				wonDeals: s.wonDeals,
				wonValue: s.wonValue,
				lostDeals: s.lostDeals,
				closeRate: decidedCount > 0 ? (s.wonDeals / decidedCount) * 100 : 0,
				winRate: competitiveTotal > 0 ? (s.wonDeals / competitiveTotal) * 100 : 0,
				avgDealValue: s.totalDeals > 0 ? s.totalValue / s.totalDeals : 0,
				openPipelineValue: s.openPipelineValue,
			};
		})
		.sort((a, b) => b.totalValue - a.totalValue);
}

export function computeQuarterlyForecast(deals: ZohoDeal[]): QuarterlyForecast[] {
	const now = new Date();
	const currentMonth = now.getMonth() + 1;
	const currentYear = now.getFullYear();

	function getQuarterInfo(year: number, month: number): { key: string; label: string } {
		let fyStart: number, q: number;
		if (month >= 4 && month <= 6) { fyStart = year; q = 1; }
		else if (month >= 7 && month <= 9) { fyStart = year; q = 2; }
		else if (month >= 10 && month <= 12) { fyStart = year; q = 3; }
		else { fyStart = year - 1; q = 4; }
		const fyEndShort = String((fyStart + 1) % 100).padStart(2, "0");
		return { key: `${fyStart}-Q${q}`, label: `Q${q} FY${fyEndShort}` };
	}

	function advanceQuarter(year: number, month: number, advance: number): { year: number; month: number } {
		let qFirstMonth: number;
		if (month >= 4 && month <= 6) qFirstMonth = 4;
		else if (month >= 7 && month <= 9) qFirstMonth = 7;
		else if (month >= 10 && month <= 12) qFirstMonth = 10;
		else qFirstMonth = 1;

		let m = qFirstMonth + advance * 3;
		let y = year;
		while (m > 12) { m -= 12; y += 1; }
		return { year: y, month: m };
	}

	const quarters: { key: string; label: string }[] = [];
	for (let i = 0; i < 3; i++) {
		const { year: qy, month: qm } = advanceQuarter(currentYear, currentMonth, i);
		quarters.push(getQuarterInfo(qy, qm));
	}

	const quarterBuckets: Record<string, { pipeline: number; bestCase: number; commit: number; won: number; count: number }> = {};
	for (const q of quarters) {
		quarterBuckets[q.key] = { pipeline: 0, bestCase: 0, commit: 0, won: 0, count: 0 };
	}

	for (const deal of deals) {
		if (!deal.closingDate) continue;
		const qKey = getQuarterKey(deal.closingDate);
		if (!quarterBuckets[qKey]) continue;
		const cat = getForecastCategory(deal.stage);
		quarterBuckets[qKey].count += 1;
		switch (cat) {
			case "pipeline": quarterBuckets[qKey].pipeline += deal.amount; break;
			case "bestCase": quarterBuckets[qKey].bestCase += deal.amount; break;
			case "commit": quarterBuckets[qKey].commit += deal.amount; break;
			case "won": quarterBuckets[qKey].won += deal.amount; break;
		}
	}

	return quarters.map((q) => {
		const b = quarterBuckets[q.key];
		const coverageRatio = QUARTERLY_TARGET > 0 ? (b.bestCase + b.commit) / QUARTERLY_TARGET : 0;
		return {
			quarter: q.label,
			quarterKey: q.key,
			pipelineValue: b.pipeline,
			bestCaseValue: b.bestCase,
			commitValue: b.commit,
			wonValue: b.won,
			target: QUARTERLY_TARGET,
			coverageRatio,
			dealCount: b.count,
		};
	});
}

export function computeSalesFunnel(deals: ZohoDeal[]): FunnelStage[] {
	let pipelineValue = 0, pipelineCount = 0;
	let bestCaseValue = 0, bestCaseCount = 0;
	let commitValue = 0, commitCount = 0;
	let wonValue = 0, wonCount = 0;

	for (const deal of deals) {
		const cat = getForecastCategory(deal.stage);
		switch (cat) {
			case "pipeline":
				pipelineValue += deal.amount;
				pipelineCount += 1;
				break;
			case "bestCase":
				bestCaseValue += deal.amount;
				bestCaseCount += 1;
				break;
			case "commit":
				commitValue += deal.amount;
				commitCount += 1;
				break;
			case "won":
				wonValue += deal.amount;
				wonCount += 1;
				break;
		}
	}

	return [
		{ name: "Pipeline", value: pipelineValue, count: pipelineCount, color: "#64748b" },
		{ name: "Best Case", value: bestCaseValue, count: bestCaseCount, color: "#3b82f6" },
		{ name: "Commit", value: commitValue, count: commitCount, color: "#f59e0b" },
		{ name: "Won", value: wonValue, count: wonCount, color: "#22c55e" },
	];
}

export function computeSalesTimeSeries(deals: ZohoDeal[], period: TimePeriod): SalesTimeSeriesPoint[] {
	const buckets: Record<string, { pipeline: number; bestCase: number; commit: number; won: number; lost: number; count: number }> = {};

	for (const deal of deals) {
		if (!deal.closingDate) continue;
		const key = getPeriodKey(deal.closingDate, period);
		if (!buckets[key]) buckets[key] = { pipeline: 0, bestCase: 0, commit: 0, won: 0, lost: 0, count: 0 };
		const cat = getForecastCategory(deal.stage);
		buckets[key].count += 1;
		switch (cat) {
			case "pipeline": buckets[key].pipeline += deal.amount; break;
			case "bestCase": buckets[key].bestCase += deal.amount; break;
			case "commit": buckets[key].commit += deal.amount; break;
			case "won": buckets[key].won += deal.amount; break;
			case "lost": buckets[key].lost += deal.amount; break;
		}
	}

	return Object.keys(buckets).sort().map((key) => ({
		period: getPeriodLabel(key, period),
		periodKey: key,
		pipelineValue: buckets[key].pipeline,
		bestCaseValue: buckets[key].bestCase,
		commitValue: buckets[key].commit,
		wonValue: buckets[key].won,
		lostValue: buckets[key].lost,
		dealCount: buckets[key].count,
	}));
}

export function computePipelineTimeSeries(deals: ZohoDeal[], period: TimePeriod): PipelineTimeSeriesPoint[] {
	const buckets: Record<string, { commit: number; active: number; early: number; won: number; lost: number; count: number }> = {};

	for (const deal of deals) {
		if (!deal.closingDate) continue;
		const key = getPeriodKey(deal.closingDate, period);
		if (!buckets[key]) buckets[key] = { commit: 0, active: 0, early: 0, won: 0, lost: 0, count: 0 };
		const cat = getStageCategory(deal.stage);
		buckets[key].count += 1;
		switch (cat) {
			case "won": buckets[key].won += deal.amount; break;
			case "commit": buckets[key].commit += deal.amount; break;
			case "active": buckets[key].active += deal.amount; break;
			case "early": buckets[key].early += deal.amount; break;
			case "lost": buckets[key].lost += deal.amount; break;
		}
	}

	return Object.keys(buckets).sort().map((key) => ({
		period: getPeriodLabel(key, period),
		periodKey: key,
		commitValue: buckets[key].commit,
		activeValue: buckets[key].active,
		earlyValue: buckets[key].early,
		wonValue: buckets[key].won,
		lostValue: buckets[key].lost,
		dealCount: buckets[key].count,
	}));
}

export function computeDailyDealMovement(deals: ZohoDeal[], days: number = 7): DailyDealMovement[] {
	const now = new Date();
	const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
	const cutoffISO = cutoff.toISOString();

	const movements: DealMovement[] = [];

	for (const deal of deals) {
		const createdInWindow = deal.createdTime && deal.createdTime >= cutoffISO;
		const modifiedInWindow = deal.modifiedTime && deal.modifiedTime >= cutoffISO;

		if (!createdInWindow && !modifiedInWindow) continue;

		// If created in window, classify as "created"; otherwise "modified"
		const movementType: "created" | "modified" = createdInWindow ? "created" : "modified";
		const relevantTime = createdInWindow ? deal.createdTime : deal.modifiedTime;
		const date = relevantTime.substring(0, 10); // YYYY-MM-DD

		movements.push({
			date,
			dealName: deal.dealName,
			accountName: deal.accountName,
			amount: deal.amount,
			stage: deal.stage,
			forecastCategory: getForecastCategory(deal.stage),
			owner: deal.owner || "Unknown",
			movementType,
		});
	}

	// Group by date, then by owner
	const dateMap = new Map<string, Map<string, DealMovement[]>>();
	for (const m of movements) {
		if (!dateMap.has(m.date)) dateMap.set(m.date, new Map());
		const ownerMap = dateMap.get(m.date)!;
		if (!ownerMap.has(m.owner)) ownerMap.set(m.owner, []);
		ownerMap.get(m.owner)!.push(m);
	}

	// Build result sorted by date descending
	const result: DailyDealMovement[] = Array.from(dateMap.entries())
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([date, ownerMap]) => {
			const reps: RepDailyMovement[] = Array.from(ownerMap.entries())
				.map(([owner, deals]) => {
					const created = deals.filter((d) => d.movementType === "created");
					const modified = deals.filter((d) => d.movementType === "modified");
					return {
						owner,
						created: { count: created.length, value: created.reduce((s, d) => s + d.amount, 0) },
						modified: { count: modified.length, value: modified.reduce((s, d) => s + d.amount, 0) },
						deals: deals.sort((a, b) => b.amount - a.amount),
					};
				})
				.sort((a, b) => (b.created.value + b.modified.value) - (a.created.value + a.modified.value));
			return { date, reps };
		});

	return result;
}

export function computePipelineData(deals: ZohoDeal[], period: TimePeriod): PipelineData {
	const wonDeals = deals.filter((d) => isWon(d.stage));
	const lostDeals = deals.filter((d) => isLost(d.stage));
	const openDeals = deals.filter((d) => !isWon(d.stage) && !isLost(d.stage));
	const closedDeals = [...wonDeals, ...lostDeals];

	const wonDealsValue = wonDeals.reduce((sum, d) => sum + d.amount, 0);
	const lostDealsValue = lostDeals.reduce((sum, d) => sum + d.amount, 0);
	const totalPipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);
	const winRate = closedDeals.length > 0 ? (wonDeals.length / closedDeals.length) * 100 : 0;
	const avgDealSize = deals.length > 0 ? deals.reduce((sum, d) => sum + d.amount, 0) / deals.length : 0;

	const kpis: ZohoPipelineKpis = {
		totalPipelineValue,
		wonDealsCount: wonDeals.length,
		wonDealsValue,
		lostDealsCount: lostDeals.length,
		lostDealsValue,
		winRate,
		avgDealSize,
		openDealsCount: openDeals.length,
	};

	// Stage distribution
	const stageMap: Record<string, { count: number; value: number }> = {};
	for (const d of deals) {
		const stage = d.stage || "Unknown";
		if (!stageMap[stage]) stageMap[stage] = { count: 0, value: 0 };
		stageMap[stage].count += 1;
		stageMap[stage].value += d.amount;
	}
	const stageDistribution: StageDistribution[] = Object.entries(stageMap)
		.map(([stage, data]) => ({ stage, ...data }))
		.sort((a, b) => b.value - a.value);

	const timeSeries = computePipelineTimeSeries(deals, period);

	const salesKpis = computeSalesForecastKpis(deals);
	const lostDealBreakdown = computeLostDealBreakdown(deals);
	const repPerformance = computeRepPerformance(deals);
	const leadSourceMetrics = computeLeadSourceMetrics(deals);
	const quarterlyForecast = computeQuarterlyForecast(deals);
	const funnel = computeSalesFunnel(deals);
	const salesTimeSeries = computeSalesTimeSeries(deals, period);
	const dailyDealMovement = computeDailyDealMovement(deals);

	return { deals, kpis, stageDistribution, timeSeries, salesKpis, lostDealBreakdown, repPerformance, leadSourceMetrics, quarterlyForecast, funnel, salesTimeSeries, dailyDealMovement };
}

function computeAvailableTimeFilters(deals: ZohoDeal[]): AvailableTimeFilters {
	const quarterSet = new Map<string, string>();
	const fySet = new Map<string, string>();

	for (const deal of deals) {
		if (!deal.closingDate) continue;
		const qKey = getQuarterKey(deal.closingDate);
		if (!quarterSet.has(qKey)) {
			quarterSet.set(qKey, getPeriodLabel(qKey, "quarterly"));
		}
		const fyKey = getFYKey(deal.closingDate);
		if (!fySet.has(fyKey)) {
			fySet.set(fyKey, getPeriodLabel(fyKey, "annual"));
		}
	}

	const quarters: TimeFilterOption[] = Array.from(quarterSet.entries())
		.map(([key, label]) => ({ key, label }))
		.sort((a, b) => a.key.localeCompare(b.key));

	const fiscalYears: TimeFilterOption[] = Array.from(fySet.entries())
		.map(([key, label]) => ({ key, label }))
		.sort((a, b) => a.key.localeCompare(b.key));

	return { quarters, fiscalYears };
}

function filterDealsByTimeFilter(deals: ZohoDeal[], timeFilter: string): ZohoDeal[] {
	if (timeFilter === "all") return deals;

	return deals.filter((deal) => {
		if (!deal.closingDate) return false;
		// Quarter filter: key like "2025-Q1"
		if (timeFilter.includes("-Q")) {
			return getQuarterKey(deal.closingDate) === timeFilter;
		}
		// FY filter: key like "2025"
		return getFYKey(deal.closingDate) === timeFilter;
	});
}

export function getSalesDashboardData(period: TimePeriod, timeFilter: string = "all"): SalesDashboardData {
	let pipeline: PipelineData | null = null;
	let availableTimeFilters: AvailableTimeFilters | undefined;
	try {
		const allDeals = readZohoDeals();
		if (allDeals) {
			availableTimeFilters = computeAvailableTimeFilters(allDeals);
			const deals = filterDealsByTimeFilter(allDeals, timeFilter);
			pipeline = computePipelineData(deals, period);
		}
	} catch (e) {
		console.error("Failed to load Zoho data:", e);
	}

	return { pipeline, availableTimeFilters };
}
