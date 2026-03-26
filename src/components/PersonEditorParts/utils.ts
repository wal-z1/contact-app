import { nanoid } from "nanoid";
import type { TimelineEvent } from "../../models/types";

export const normalizeTag = (value: string) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

export const deriveLocationNames = (location: string) => {
  const output: string[] = [];
  const raw = String(location ?? "").trim();

  if (!raw) return output;

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let country: string | undefined;
  let state: string | undefined;

  if (parts.length >= 3) {
    country = parts[parts.length - 1];
    state = parts[parts.length - 2];
  } else if (parts.length === 2) {
    const a = parts[0];
    const b = parts[1];

    if (/^[A-Za-z]{2,3}$/.test(b)) {
      state = b;
      country = "USA";
    } else {
      country = b;
      state = a;
    }
  } else {
    country = parts[0];
  }

  if (country) output.push(country);
  if (country && state) output.push(`${country}:${state}`);

  return output;
};

export const normalizeHandle = (value: string) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  const withoutAt = trimmed.replace(/^@/, "");
  const withoutProtocol = withoutAt.replace(/^https?:\/\//i, "");
  const withoutDomain = withoutProtocol.replace(
    /^(?:[a-z0-9-]+\.)+[a-z]{2,}\//i,
    "",
  );

  return withoutDomain.split(/[?#]/)[0].trim();
};

export const coerceSocialArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value ? [value] : [];
  }

  return [];
};

export const coerceEvents = (value: unknown): TimelineEvent[] => {
  if (!value || !Array.isArray(value)) return [];

  return value
    .map((event: any) => {
      if (!event || typeof event !== "object") return null;

      const kind = event.kind === "range" ? "range" : "date";

      return {
        id: typeof event.id === "string" ? event.id : nanoid(),
        kind,
        note: typeof event.note === "string" ? event.note : "",
        date: typeof event.date === "string" ? event.date : undefined,
        startDate:
          typeof event.startDate === "string" ? event.startDate : undefined,
        endDate:
          typeof event.endDate === "string" ? event.endDate : undefined,
        sourceId:
          typeof event.sourceId === "string" ? event.sourceId : undefined,
      };
    })
    .filter(Boolean) as TimelineEvent[];
};