import { NextRequest, NextResponse } from "next/server";
import { getSalesDashboardData } from "@/lib/sales-engine";
import { getRefreshTimestamps } from "@/lib/refresh-timestamps";
import type { TimePeriod } from "@/lib/types";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const period = (searchParams.get("period") || "monthly") as TimePeriod;

	try {
		const data = getSalesDashboardData(period);
		const ts = getRefreshTimestamps();
		return NextResponse.json({
			...data,
			refreshedAt: { zoho: ts.zoho },
		});
	} catch (error) {
		console.error("Sales data error:", error);
		return NextResponse.json(
			{ error: "Failed to load sales data" },
			{ status: 500 }
		);
	}
}
