// DB-backed MCP session adapter.
//
// Implements mcp-lite's SessionAdapter interface against a Supabase table
// (mcp_sessions) so that the Mcp-Session-Id issued at initialize survives
// across Supabase Edge Function instances. The previous InMemorySessionAdapter
// lost every session when a serverless container was recycled, which could
// break long-lived Gemini connections.
//
// Design notes:
//   - Session existence + meta (create/has/get/delete) are persisted to the DB,
//     which is the part that must be consistent across instances.
//   - SSE event buffers (appendEvent/replay), used only for stream
//     resumability after a mid-stream disconnect, are kept best-effort in
//     memory. Persisting every SSE event to Postgres would be costly and is
//     unnecessary for this short-lived, request/response workload. On a cold
//     instance an unreplayable event simply means the client re-requests —
//     acceptable for our tools.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// deno-lint-ignore no-explicit-any
type SessionMeta = any;

interface StreamState {
  nextEventId: number;
  eventBuffer: Array<{ id: string; message: unknown }>;
}

interface SessionData {
  meta: SessionMeta;
  streams: Map<string, StreamState>;
}

function encodeEventId(seq: number, streamId: string): string {
  return `${seq}#${streamId}`;
}

function decodeEventId(eventId: string): { sequenceNumber: number; streamId: string } {
  const idx = eventId.lastIndexOf('#');
  if (idx === -1) throw new Error(`Invalid event ID: ${eventId}`);
  return {
    sequenceNumber: Number(eventId.slice(0, idx)),
    streamId: eventId.slice(idx + 1),
  };
}

export class SupabaseSessionAdapter {
  #supabase: SupabaseClient;
  #maxEventBufferSize: number;
  // Per-instance stream buffers for SSE resumability (best-effort, not shared).
  #streams = new Map<string, Map<string, StreamState>>();

  constructor(opts?: { maxEventBufferSize?: number }) {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.#supabase = createClient(url, key);
    this.#maxEventBufferSize = opts?.maxEventBufferSize ?? 1024;
  }

  generateSessionId(): string {
    return crypto.randomUUID();
  }

  async create(id: string, meta: SessionMeta): Promise<SessionData> {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const { error } = await this.#supabase.from('mcp_sessions').insert({
      session_id: id,
      meta: meta ?? {},
      expires_at: expiresAt,
    });
    if (error) console.error('[session] create failed:', error.message);
    const streams = new Map<string, StreamState>();
    this.#streams.set(id, streams);
    return { meta, streams };
  }

  async has(id: string): Promise<boolean> {
    const { data } = await this.#supabase
      .from('mcp_sessions')
      .select('session_id, expires_at')
      .eq('session_id', id)
      .single();
    if (!data) return false;
    if (new Date(data.expires_at).getTime() < Date.now()) return false;
    return true;
  }

  async get(id: string): Promise<SessionData | undefined> {
    const { data } = await this.#supabase
      .from('mcp_sessions')
      .select('meta, expires_at')
      .eq('session_id', id)
      .single();
    if (!data) return undefined;
    if (new Date(data.expires_at).getTime() < Date.now()) return undefined;

    // Touch last_seen_at (fire-and-forget) to keep active sessions warm.
    this.#supabase
      .from('mcp_sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('session_id', id)
      .then(() => {}, () => {});

    const streams = this.#streams.get(id) ?? new Map<string, StreamState>();
    this.#streams.set(id, streams);
    return { meta: data.meta, streams };
  }

  async delete(id: string): Promise<void> {
    this.#streams.delete(id);
    const { error } = await this.#supabase.from('mcp_sessions').delete().eq('session_id', id);
    if (error) console.error('[session] delete failed:', error.message);
  }

  // --- SSE resumability (in-memory, best-effort) --------------------------

  appendEvent(id: string, streamId: string, message: unknown): string | undefined {
    const streams = this.#streams.get(id);
    if (!streams) return undefined;
    let stream = streams.get(streamId);
    if (!stream) {
      stream = { nextEventId: 1, eventBuffer: [] };
      streams.set(streamId, stream);
    }
    const eventId = encodeEventId(stream.nextEventId++, streamId);
    stream.eventBuffer.push({ id: eventId, message });
    if (stream.eventBuffer.length > this.#maxEventBufferSize) {
      stream.eventBuffer = stream.eventBuffer.slice(-this.#maxEventBufferSize);
    }
    return eventId;
  }

  async replay(
    id: string,
    lastEventId: string,
    write: (id: string, message: unknown) => Promise<void> | void
  ): Promise<void> {
    const streams = this.#streams.get(id);
    if (!streams) return;
    const { sequenceNumber, streamId } = decodeEventId(lastEventId);
    const stream = streams.get(streamId);
    if (!stream) return;
    for (const evt of stream.eventBuffer) {
      const { sequenceNumber: seq } = decodeEventId(evt.id);
      if (seq > sequenceNumber) await write(evt.id, evt.message);
    }
  }
}
