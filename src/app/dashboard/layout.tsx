"use client";

import { PeriodSelector } from "@/components/period-selector";
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context";
import { ChevronDown } from "lucide-react";

function TimeFilterDropdown() {
	const { timeFilter, setTimeFilter, availableTimeFilters } = useDashboard();

	return (
		<div className="relative">
			<select
				value={timeFilter}
				onChange={(e) => setTimeFilter(e.target.value)}
				className="appearance-none text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 pr-8 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
			>
				<option value="all">All Time</option>
				{availableTimeFilters && availableTimeFilters.fiscalYears.length > 0 && (
					<optgroup label="Fiscal Year">
						{availableTimeFilters.fiscalYears.map((fy) => (
							<option key={fy.key} value={fy.key}>{fy.label}</option>
						))}
					</optgroup>
				)}
				{availableTimeFilters && availableTimeFilters.quarters.length > 0 && (
					<optgroup label="Quarter">
						{availableTimeFilters.quarters.map((q) => (
							<option key={q.key} value={q.key}>{q.label}</option>
						))}
					</optgroup>
				)}
			</select>
			<ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
		</div>
	);
}

function DashboardHeader() {
	const { period, setPeriod } = useDashboard();
	return (
		<header className="sticky top-0 z-30 bg-white border-b px-8 py-4 flex items-center justify-between">
			<div>
				<h1 className="text-xl font-bold text-slate-900">Sales Dashboard</h1>
				<p className="text-sm text-muted-foreground">
					Oren India — Pipeline & Forecast
				</p>
			</div>
			<div className="flex items-center gap-3">
				<TimeFilterDropdown />
				<PeriodSelector value={period} onChange={setPeriod} />
			</div>
		</header>
	);
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<DashboardProvider>
			<div className="min-h-screen bg-gray-50">
				<DashboardHeader />
				<main className="p-8">{children}</main>
			</div>
		</DashboardProvider>
	);
}
