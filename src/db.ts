import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type {
  Cadence,
  ConversationEvent,
  ConversationMessage,
  EventType,
  ExperimentGroup,
  FakePaymentEvent,
  FakePaymentPlanId,
  UserProfile
} from "./domain/types.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");

export class CompanionStore {
  private readonly db: InstanceType<typeof DatabaseSync>;

  constructor(databasePath = ":memory:") {
    if (databasePath !== ":memory:") {
      const directory = dirname(databasePath);
      if (directory !== "." && !existsSync(directory)) {
        mkdirSync(directory, { recursive: true });
      }
    }

    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  getUser(userId: string): UserProfile | undefined {
    const row = this.db
      .prepare(
        "SELECT id, cadence, experiment_group, ai_disclosure_shown, created_at, updated_at FROM users WHERE id = ?"
      )
      .get(userId) as UserRow | undefined;

    return row ? mapUser(row) : undefined;
  }

  listUsers(): UserProfile[] {
    const rows = this.db
      .prepare("SELECT id, cadence, experiment_group, ai_disclosure_shown, created_at, updated_at FROM users ORDER BY id")
      .all() as unknown as UserRow[];

    return rows.map(mapUser);
  }

  createUser(
    userId: string,
    experimentGroup: ExperimentGroup = assignExperimentGroup(userId),
    createdAt: string = new Date().toISOString()
  ): UserProfile {
    const cadence = cadenceForExperimentGroup(experimentGroup);
    this.db
      .prepare(
        "INSERT INTO users (id, cadence, experiment_group, ai_disclosure_shown, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)"
      )
      .run(userId, cadence, experimentGroup, createdAt, createdAt);

    return {
      id: userId,
      cadence,
      experimentGroup,
      aiDisclosureShown: true,
      createdAt,
      updatedAt: createdAt
    };
  }

  updateCadence(userId: string, cadence: Cadence): void {
    this.db
      .prepare("UPDATE users SET cadence = ?, updated_at = ? WHERE id = ?")
      .run(cadence, new Date().toISOString(), userId);
  }

  appendMessage(message: Omit<ConversationMessage, "createdAt"> & { createdAt?: string }): ConversationMessage {
    const createdAt = message.createdAt ?? new Date().toISOString();
    const result = this.db
      .prepare("INSERT INTO messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)")
      .run(message.userId, message.role, message.content, createdAt);

    return {
      id: Number(result.lastInsertRowid),
      userId: message.userId,
      role: message.role,
      content: message.content,
      createdAt
    };
  }

  listMessages(userId: string, limit = 50): ConversationMessage[] {
    const rows = this.db
      .prepare(
        "SELECT id, user_id, role, content, created_at FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?"
      )
      .all(userId, limit) as unknown as MessageRow[];

    return rows.reverse().map(mapMessage);
  }

  upsertMemory(userId: string, key: string, value: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO memories (user_id, key, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(userId, key, value, now);
  }

  listMemories(userId: string): Record<string, string> {
    const rows = this.db
      .prepare("SELECT key, value FROM memories WHERE user_id = ? ORDER BY key")
      .all(userId) as unknown as MemoryRow[];

    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  deleteMemory(userId: string, key: string): void {
    this.db.prepare("DELETE FROM memories WHERE user_id = ? AND key = ?").run(userId, key);
  }

  deleteAllMemories(userId: string): void {
    this.db.prepare("DELETE FROM memories WHERE user_id = ?").run(userId);
  }

  recordEvent(event: {
    userId: string;
    type: EventType;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }): ConversationEvent {
    const createdAt = event.createdAt ?? new Date().toISOString();
    const metadata = event.metadata ? JSON.stringify(event.metadata) : null;
    const result = this.db
      .prepare("INSERT INTO events (user_id, type, metadata_json, created_at) VALUES (?, ?, ?, ?)")
      .run(event.userId, event.type, metadata, createdAt);

    return {
      id: Number(result.lastInsertRowid),
      userId: event.userId,
      type: event.type,
      metadata: event.metadata,
      createdAt
    };
  }

  listEvents(userId: string, type?: EventType): ConversationEvent[] {
    const rows = type
      ? (this.db
          .prepare(
            "SELECT id, user_id, type, metadata_json, created_at FROM events WHERE user_id = ? AND type = ? ORDER BY id"
          )
          .all(userId, type) as unknown as EventRow[])
      : (this.db
          .prepare("SELECT id, user_id, type, metadata_json, created_at FROM events WHERE user_id = ? ORDER BY id")
          .all(userId) as unknown as EventRow[]);

    return rows.map(mapEvent);
  }

  listAllEvents(limit?: number): ConversationEvent[] {
    if (limit) {
      const rows = this.db
        .prepare("SELECT id, user_id, type, metadata_json, created_at FROM events ORDER BY id DESC LIMIT ?")
        .all(limit) as unknown as EventRow[];

      return rows.reverse().map(mapEvent);
    }

    const rows = this.db
      .prepare("SELECT id, user_id, type, metadata_json, created_at FROM events ORDER BY id")
      .all() as unknown as EventRow[];

    return rows.map(mapEvent);
  }

  getLastEvent(userId: string, type: EventType): ConversationEvent | undefined {
    const row = this.db
      .prepare(
        "SELECT id, user_id, type, metadata_json, created_at FROM events WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 1"
      )
      .get(userId, type) as EventRow | undefined;

    return row ? mapEvent(row) : undefined;
  }

  recordFakePaymentEvent(event: {
    userId: string;
    planId: FakePaymentPlanId;
    source: string;
  }): FakePaymentEvent {
    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare("INSERT INTO fake_payment_events (user_id, plan_id, source, created_at) VALUES (?, ?, ?, ?)")
      .run(event.userId, event.planId, event.source, createdAt);

    return {
      id: Number(result.lastInsertRowid),
      userId: event.userId,
      planId: event.planId,
      source: event.source,
      createdAt
    };
  }

  listFakePaymentEvents(userId: string): FakePaymentEvent[] {
    const rows = this.db
      .prepare(
        "SELECT id, user_id, plan_id, source, created_at FROM fake_payment_events WHERE user_id = ? ORDER BY id"
      )
      .all(userId) as unknown as FakePaymentRow[];

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      planId: row.plan_id,
      source: row.source,
      createdAt: row.created_at
    }));
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        cadence TEXT NOT NULL,
        experiment_group TEXT NOT NULL DEFAULT 'weekly_3',
        ai_disclosure_shown INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memories (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(user_id, key),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS fake_payment_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    this.ensureUsersExperimentGroupColumn();
  }

  private ensureUsersExperimentGroupColumn(): void {
    const columns = this.db.prepare("PRAGMA table_info(users)").all() as unknown as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "experiment_group")) {
      this.db.prepare("ALTER TABLE users ADD COLUMN experiment_group TEXT NOT NULL DEFAULT 'weekly_3'").run();
    }
  }
}

interface UserRow {
  id: string;
  cadence: Cadence;
  experiment_group: ExperimentGroup;
  ai_disclosure_shown: number;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: number;
  user_id: string;
  role: ConversationMessage["role"];
  content: string;
  created_at: string;
}

interface MemoryRow {
  key: string;
  value: string;
}

interface FakePaymentRow {
  id: number;
  user_id: string;
  plan_id: FakePaymentPlanId;
  source: string;
  created_at: string;
}

interface EventRow {
  id: number;
  user_id: string;
  type: EventType;
  metadata_json?: string | null;
  created_at: string;
}

export function assignExperimentGroup(userId: string): ExperimentGroup {
  const last = userId.charCodeAt(userId.length - 1) || 0;
  return last % 2 === 0 ? "daily_1" : "weekly_3";
}

export function cadenceForExperimentGroup(group: ExperimentGroup): Cadence {
  return group === "daily_1" ? "daily" : "three_per_week";
}

function mapUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    cadence: row.cadence,
    experimentGroup: row.experiment_group,
    aiDisclosureShown: row.ai_disclosure_shown === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  };
}

function mapEvent(row: EventRow): ConversationEvent {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined,
    createdAt: row.created_at
  };
}
