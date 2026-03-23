export type TimePeriod = "monthly" | "quarterly" | "annual";

export type RefreshTimestamps = {
	zoho?: string;
};

export type StageCategory = "won" | "commit" | "active" | "early" | "lost";

export type ZohoDeal = {
	dealName: string;
	accountName: string;
	amount: number;
	stage: string;
	pipeline: string;
	closingDate: string | null;
	leadSource: string;
	region: string;
	type: string;
	owner: string;
	description: string;
	nextStep: string;
	createdTime: string;
	modifiedTime: string;
	revenueClientName: string | null;
};

export type StageDistribution = {
	stage: string;
	count: number;
	value: number;
};

export type ZohoPipelineKpis = {
	totalPipelineValue: number;
	wonDealsCount: number;
	wonDealsValue: number;
	lostDealsCount: number;
	lostDealsValue: number;
	winRate: number;
	avgDealSize: number;
	openDealsCount: number;
};

export type PipelineTimeSeriesPoint = {
	period: string;
	periodKey: string;
	commitValue: number;
	activeValue: number;
	earlyValue: number;
	wonValue: number;
	lostValue: number;
	dealCount: number;
};

export type ForecastCategory = "pipeline" | "bestCase" | "commit" | "won" | "lost";

export type SalesForecastKpis = {
	forecastValue: number;
	bestCaseValue: number;
	pipelineStageValue: number;
	closeRate: number;
	winRate: number;
	pipelineCoverage: number;
	avgSalesCycleDays: number;
	slippedDealsCount: number;
	slippedDealsValue: number;
	quarterlyTarget: number;
	avgDealSize: number;
	openPipelineValue: number;
};

export type LostDealBreakdown = {
	lostToNoDecision: { count: number; value: number };
	lostToCompetition: { count: number; value: number };
	disqualified: { count: number; value: number };
	nurtureParked: { count: number; value: number };
};

export type RepPerformance = {
	owner: string;
	pipelineValue: number;
	dealCount: number;
	wonCount: number;
	wonValue: number;
	lostCount: number;
	closeRate: number;
	winRate: number;
	avgDealSize: number;
	forecastValue: number;
	bestCaseValue: number;
};

export type LeadSourceMetrics = {
	leadSource: string;
	totalDeals: number;
	totalValue: number;
	wonDeals: number;
	wonValue: number;
	lostDeals: number;
	closeRate: number;
	winRate: number;
	avgDealValue: number;
	openPipelineValue: number;
};

export type QuarterlyForecast = {
	quarter: string;
	quarterKey: string;
	pipelineValue: number;
	bestCaseValue: number;
	commitValue: number;
	wonValue: number;
	target: number;
	coverageRatio: number;
	dealCount: number;
};

export type FunnelStage = {
	name: string;
	value: number;
	count: number;
	color: string;
};

export type SalesTimeSeriesPoint = {
	period: string;
	periodKey: string;
	pipelineValue: number;
	bestCaseValue: number;
	commitValue: number;
	wonValue: number;
	lostValue: number;
	dealCount: number;
};

export type PipelineData = {
	deals: ZohoDeal[];
	kpis: ZohoPipelineKpis;
	stageDistribution: StageDistribution[];
	timeSeries: PipelineTimeSeriesPoint[];
	salesKpis: SalesForecastKpis;
	lostDealBreakdown: LostDealBreakdown;
	repPerformance: RepPerformance[];
	leadSourceMetrics: LeadSourceMetrics[];
	quarterlyForecast: QuarterlyForecast[];
	funnel: FunnelStage[];
	salesTimeSeries: SalesTimeSeriesPoint[];
};

export type SalesDashboardData = {
	pipeline: PipelineData | null;
	refreshedAt?: RefreshTimestamps;
};
