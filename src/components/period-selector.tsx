"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimePeriod } from "@/lib/types";

type PeriodSelectorProps = {
	value: TimePeriod;
	onChange: (period: TimePeriod) => void;
};

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
	return (
		<Tabs value={value} onValueChange={(v) => onChange(v as TimePeriod)}>
			<TabsList>
				<TabsTrigger value="monthly">Monthly</TabsTrigger>
				<TabsTrigger value="quarterly">Quarterly</TabsTrigger>
				<TabsTrigger value="annual">Annual</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
