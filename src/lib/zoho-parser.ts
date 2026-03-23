import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import type { ZohoDeal } from "./types";

const fileCache: Record<string, { mtime: number; data: unknown }> = {};

const DATA_DIR = path.join(process.cwd(), "src", "data");

function getDataPath(filename: string): string {
	return path.join(DATA_DIR, filename);
}

function tryReadJsonFile<T>(filename: string): T | null {
	const filePath = getDataPath(filename);
	if (!fs.existsSync(filePath)) return null;

	const stat = fs.statSync(filePath);
	const mtime = stat.mtimeMs;

	if (fileCache[filename] && fileCache[filename].mtime === mtime) {
		return fileCache[filename].data as T;
	}

	const raw = fs.readFileSync(filePath, "utf-8");
	const data = JSON.parse(raw) as T;
	fileCache[filename] = { mtime, data };
	return data;
}

function tryReadWorkbook(filename: string): XLSX.WorkBook | null {
	const filePath = getDataPath(filename);
	if (!fs.existsSync(filePath)) return null;

	const stat = fs.statSync(filePath);
	const mtime = stat.mtimeMs;

	if (fileCache[filename] && fileCache[filename].mtime === mtime) {
		return fileCache[filename].data as XLSX.WorkBook;
	}

	const buffer = fs.readFileSync(filePath);
	const workbook = XLSX.read(buffer, { cellDates: true, type: "buffer" });
	fileCache[filename] = { mtime, data: workbook };
	return workbook;
}

export function readZohoClientMapping(): Record<string, string | null> {
	return tryReadJsonFile<Record<string, string | null>>("zoho-client-mapping.json") || {};
}

function safeString(value: unknown): string {
	if (value === null || value === undefined) return "";
	return String(value).trim();
}

function safeNumber(value: unknown): number {
	if (value === null || value === undefined) return 0;
	const n = typeof value === "number" ? value : parseFloat(String(value));
	return isNaN(n) ? 0 : n;
}

function toISOString(value: unknown): string {
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === "string" && value) {
		return value;
	}
	return "";
}

function toISODateOrNull(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	if (value instanceof Date) {
		return value.toISOString().split("T")[0];
	}
	if (typeof value === "number") {
		const parsed = XLSX.SSF.parse_date_code(value);
		const y = String(parsed.y).padStart(4, "0");
		const m = String(parsed.m).padStart(2, "0");
		const d = String(parsed.d).padStart(2, "0");
		return `${y}-${m}-${d}`;
	}
	if (typeof value === "string") {
		const d = new Date(value);
		if (!isNaN(d.getTime())) {
			return d.toISOString().split("T")[0];
		}
		return value;
	}
	return null;
}

function parseDealsRows(
	rows: Record<string, unknown>[],
	mapping: Record<string, string | null>,
): ZohoDeal[] {
	return rows.map((row) => {
		const accountName = safeString(row["Account Name"]);
		const revenueClientName = accountName in mapping ? mapping[accountName] : null;

		return {
			dealName: safeString(row["Deal Name"]),
			accountName,
			amount: safeNumber(row["Amount"]),
			stage: safeString(row["Stage"]),
			pipeline: safeString(row["Pipeline"]),
			closingDate: toISODateOrNull(row["Closing Date"]),
			leadSource: safeString(row["Lead Source"]),
			region: safeString(row["Region"]),
			type: safeString(row["Type"]),
			owner: safeString(row["Owner"]),
			description: safeString(row["Description"]),
			nextStep: safeString(row["Next Step"]),
			createdTime: toISOString(row["Created Time"]),
			modifiedTime: toISOString(row["Modified Time"]),
			revenueClientName,
		};
	});
}

export function readZohoDeals(): ZohoDeal[] | null {
	const wb = tryReadWorkbook("deals.xlsx");
	if (!wb) return null;

	const sheetName = wb.SheetNames[0];
	const sheet = wb.Sheets[sheetName];
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

	const mapping = readZohoClientMapping();
	return parseDealsRows(rows, mapping);
}
