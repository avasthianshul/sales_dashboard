"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { TimePeriod } from "./types";

type DashboardContextType = {
	period: TimePeriod;
	setPeriod: (p: TimePeriod) => void;
};

const DashboardContext = createContext<DashboardContextType>({
	period: "monthly",
	setPeriod: () => {},
});

export function DashboardProvider({ children }: { children: ReactNode }) {
	const [period, setPeriod] = useState<TimePeriod>("monthly");
	return (
		<DashboardContext.Provider value={{ period, setPeriod }}>
			{children}
		</DashboardContext.Provider>
	);
}

export function useDashboard() {
	return useContext(DashboardContext);
}
