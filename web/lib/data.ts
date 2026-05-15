import { promises as fs } from "fs";
import path from "path";
import type { UnifiedData, Anomaly, SplitwiseData } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "..", "data");

async function readJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    return JSON.parse(buf) as T;
  } catch (err) {
    console.error(`[data] could not read ${file}, using fallback`, err);
    return fallback;
  }
}

export async function loadUnified(): Promise<UnifiedData> {
  return readJSON<UnifiedData>("unified.json", {
    generated_at: new Date().toISOString(),
    total_transactions: 0,
    sources: { chase_checking: 0, boa_credit: 0, splitwise: 0 },
    transactions: [],
  });
}

export async function loadAnomalies(): Promise<Anomaly[]> {
  return readJSON<Anomaly[]>("anomalies.json", []);
}

export async function loadSplitwise(): Promise<SplitwiseData> {
  return readJSON<SplitwiseData>("splitwise.json", {
    current_user: { id: 0, first_name: "" },
    friends: [],
    groups: [],
    expenses: [],
  });
}
