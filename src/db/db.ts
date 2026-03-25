import Dexie from "dexie";
import type { Person, Relationship, Event } from "../models/types";

export class RelationshipMapDB extends Dexie {
	people!: Dexie.Table<Person, string>;
	relationships!: Dexie.Table<Relationship, string>;
	events!: Dexie.Table<Event, string>;
	tags!: Dexie.Table<any, string>;

	constructor() {
		super("relationship-map-db");

		// Bump this version when you change the schema.
		// Normalize older records on upgrade to avoid runtime crashes.
		// Add `tags` table and migrate legacy tag strings into tag records.
		this.version(5)
			.stores({
				people: "id, year, name, inrete",
				relationships: "id, from, to, type",
				events: "id, title, kind, date, startDate, endDate",
				tags: "id, name, normalized",
			})
			.upgrade(async (tx) => {
				const peopleTable = tx.table("people");
				const tagsTable = tx.table("tags");

				const normalize = (s: string) =>
					String(s ?? "")
						.trim()
						.toLowerCase()
						.replace(/\s+/g, "_");

				// Ensure existing tags are normalized
				await tagsTable.toCollection().modify((t: any) => {
					t.normalized =
						typeof t.normalized === "string" ? t.normalized : normalize(t.name);
				});

				// Migrate each person's legacy tag strings into tag records
				await peopleTable.toCollection().modify(async (p: any) => {
					try {
						const raw = Array.isArray(p.inrete)
							? p.inrete
							: p.tags && Array.isArray(p.tags)
								? p.tags
								: [];
						const nextTagIds: string[] = [];
						for (const tName of raw) {
							const name = String(tName ?? "").trim();
							if (!name) continue;
							const normalized = normalize(name);
							const existing = await tagsTable
								.where("normalized")
								.equals(normalized)
								.first();
							if (existing) {
								nextTagIds.push(existing.id);
								continue;
							}
							const id = crypto.randomUUID
								? crypto.randomUUID()
								: Math.random().toString(36).slice(2, 9);
							await tagsTable.add({ id, name, normalized });
							nextTagIds.push(id);
						}

						// Also convert legacy `location` string into hierarchical tags (country and country:state)
						try {
							const loc = String(p.location ?? "").trim();
							if (loc) {
								const parts = loc
									.split(",")
									.map((s) => String(s).trim())
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
								} else if (parts.length === 1) {
									country = parts[0];
								}
								const locNames: string[] = [];
								if (country) locNames.push(country);
								if (country && state) locNames.push(`${country}:${state}`);
								for (const name of locNames) {
									const normalized = normalize(name);
									const existing = await tagsTable
										.where("normalized")
										.equals(normalized)
										.first();
									if (existing) {
										nextTagIds.push(existing.id);
										continue;
									}
									const id = crypto.randomUUID
										? crypto.randomUUID()
										: Math.random().toString(36).slice(2, 9);
									await tagsTable.add({ id, name, normalized });
									nextTagIds.push(id);
								}
							}
						} catch (e) {
							console.warn("Location -> tag migration failed", e);
						}
						p.inrete = nextTagIds;
						p.events = Array.isArray(p.events) ? p.events : [];
						p.socials = p.socials ?? {
							instagram: [],
							linkedin: [],
							twitter: [],
						};
					} catch (e) {
						// best-effort migration; skip on error to avoid blocking upgrade
						console.error("Tag migration failed for person", p?.id, e);
						p.inrete = Array.isArray(p.inrete) ? p.inrete : [];
					}
				});
			});
	}
}

export const db = new RelationshipMapDB();
