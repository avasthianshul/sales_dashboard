"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

type KpiCardProps = {
	title: string;
	value: string;
	subtitle?: React.ReactNode;
	trend?: number | null;
	trendLabel?: string;
	accentColor?: string;
};

export function KpiCard({ title, value, subtitle, trend, trendLabel, accentColor = "#3b82f6" }: KpiCardProps) {
	return (
		<Card className="shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
			<div
				className="absolute top-0 left-0 right-0 h-1"
				style={{ backgroundColor: accentColor }}
			/>
			<CardContent className="p-6 pt-5">
				<p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">{title}</p>
				<p className="text-3xl font-bold mt-2 tracking-tight">{value}</p>
				{subtitle && (
					<p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
				)}
				{trend !== undefined && trend !== null && (
					<div className="mt-3 flex items-center gap-2">
						<Badge
							variant={trend >= 0 ? "default" : "destructive"}
							className={
								trend >= 0
									? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
									: "bg-red-100 text-red-700 hover:bg-red-100 border-red-200"
							}
						>
							{trend >= 0 ? (
								<TrendingUp className="h-3 w-3 mr-1" />
							) : (
								<TrendingDown className="h-3 w-3 mr-1" />
							)}
							{Math.abs(trend).toFixed(1)}%
						</Badge>
						{trendLabel && (
							<span className="text-xs text-muted-foreground">{trendLabel}</span>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
