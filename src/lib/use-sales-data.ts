"use client";

import { useState, useEffect } from "react";
import { useDashboard } from "./dashboard-context";
import { SalesDashboardData } from "./types";

export function useSalesData() {
	const { period } = useDashboard();
	const [data, setData] = useState<SalesDashboardData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		fetch(`/api/sales-data?period=${period}`)
			.then((res) => res.json())
			.then((data) => {
				setData(data);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, [period]);

	return { data, loading };
}
