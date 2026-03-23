"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChartContainerProps = {
	title: string;
	children: React.ReactNode;
	className?: string;
	subtitle?: string;
};

export function ChartContainer({ title, children, className, subtitle }: ChartContainerProps) {
	return (
		<Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)}>
			<CardHeader className="pb-2 bg-slate-50/60 border-b border-slate-100">
				<CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
				{subtitle && (
					<p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
				)}
			</CardHeader>
			<CardContent className="p-5">
				<div className="h-[350px] w-full">{children}</div>
			</CardContent>
		</Card>
	);
}
