"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { TimePeriod, AvailableTimeFilters } from "./types";

type DashboardContextType = {
	period: TimePeriod;
	setPeriod: (p: TimePeriod) => void;
	timeFilter: string;
	setTimeFilter: (f: string) => void;
	availableTimeFilters: AvailableTimeFilters | null;
	setAvailableTimeFilters: (f: AvailableTimeFilters) => void;
};

const DashboardContext = createContext<DashboardContextType>({
	period: "monthly",
	setPeriod: () => {},
	timeFilter: "all",
	setTimeFilter: () => {},
	availableTimeFilters: null,
	setAvailableTimeFilters: () => {},
});

export function DashboardProvider({ children }: { children: ReactNode }) {
	const [period, setPeriod] = useState<TimePeriod>("monthly");
	const [timeFilter, setTimeFilter] = useState("all");
	const [availableTimeFilters, setAvailableTimeFilters] = useState<AvailableTimeFilters | null>(null);
	return (
		<DashboardContext.Provider value={{ period, setPeriod, timeFilter, setTimeFilter, availableTimeFilters, setAvailableTimeFilters }}>
			{children}
		</DashboardContext.Provider>
	);
}

export function useDashboard() {
	return useContext(DashboardContext);
}
