"use client";

import { PeriodSelector } from "@/components/period-selector";
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context";

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
			<PeriodSelector value={period} onChange={setPeriod} />
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
