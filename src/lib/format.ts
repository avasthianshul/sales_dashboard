// Always format in Lakhs with 2 decimal places
export function formatINR(amount: number): string {
	const sign = amount < 0 ? "-" : "";
	const inLakhs = Math.abs(amount) / 100000;
	return sign + "\u20B9" + inLakhs.toFixed(2) + "L";
}

// Compact format for chart axes (use Cr if >= 1Cr, else L)
export function formatINRCompact(amount: number): string {
	const abs = Math.abs(amount);
	const sign = amount < 0 ? "-" : "";
	if (abs >= 10000000) return sign + (abs / 10000000).toFixed(1) + "Cr";
	return sign + (abs / 100000).toFixed(1) + "L";
}

// Full Indian comma format for tooltips
export function formatINRFull(amount: number): string {
	return (amount < 0 ? "-\u20B9" : "\u20B9") + Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function formatPercent(value: number): string {
	return value.toFixed(1) + "%";
}

export function formatMultiplier(value: number): string {
	return value.toFixed(1) + "x";
}

export function formatMonth(dateStr: string): string {
	const [year, month] = dateStr.split("-");
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return months[parseInt(month) - 1] + " " + year;
}
