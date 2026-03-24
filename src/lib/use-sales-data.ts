"use client";

import { useState, useEffect } from "react";
import { useDashboard } from "./dashboard-context";
import { SalesDashboardData } from "./types";

export function useSalesData() {
	const { period, timeFilter, setAvailableTimeFilters } = useDashboard();
	const [data, setData] = useState<SalesDashboardData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		const params = new URLSearchParams({ period });
		if (timeFilter && timeFilter !== "all") {
			params.set("timeFilter", timeFilter);
		}
		fetch(`/api/sales-data?${params}`)
			.then((res) => res.json())
			.then((data) => {
				setData(data);
				if (data.availableTimeFilters) {
					setAvailableTimeFilters(data.availableTimeFilters);
				}
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, [period, timeFilter, setAvailableTimeFilters]);

	return { data, loading };
}
