// src/lib/data/query-handlers.ts
// Each handler is a closed, parameterised query. No free-form SQL ever.

import { getSupabaseServer } from "@/lib/supabase/server";
import type {
  CandidateResolution,
  ResolvedEmployer,
  ResolvedMatches,
} from "@/types/domain";
import { makeLogger } from "@/lib/utils/logger";

const log = makeLogger("query-handlers");

const MAX_RESULTS = 5; // never return unbounded result sets

// ─── Candidate ────────────────────────────────────────────────────────────────

export async function getCandidateByName(
  name: string
): Promise<CandidateResolution> {
  const db = getSupabaseServer();

  const { data, error } = await db
    .from("candidatos")
    .select(
      "id, nome_completo, status, substatus, profissao, nivel_alemao, ultima_atualizacao"
    )
    .ilike("nome_completo", `%${name}%`)
    .limit(MAX_RESULTS);

  if (error) {
    log.error("getCandidateByName DB error", { error: error.message });
    throw new Error(`Database error: ${error.message}`);
  }

  if (!data || data.length === 0) return { found: false, ambiguous: false };

  if (data.length > 1) {
    return {
      found: true,
      ambiguous: true,
      candidates: data.map((c) => ({
        id: String(c.id),
        name: String(c.nome_completo ?? ""),
        status: String(c.status ?? ""),
      })),
    };
  }

  const c = data[0]!;
  return {
    found: true,
    ambiguous: false,
    candidate: {
      id: String(c.id),
      name: String(c.nome_completo ?? ""),
      status: String(c.status ?? ""),
      substatus: c.substatus ? String(c.substatus) : null,
      nextStep: null, // resolved separately if needed
      missingDocuments: [],
      employerName: null,
      lastUpdate: c.ultima_atualizacao ? String(c.ultima_atualizacao) : null,
      germanLevel: c.nivel_alemao ? String(c.nivel_alemao) : null,
    },
  };
}

export async function getCandidateStatus(
  name: string
): Promise<CandidateResolution> {
  const db = getSupabaseServer();

  const { data, error } = await db
    .from("candidatos")
    .select(
      "id, nome_completo, status, substatus, proxima_etapa, ultima_atualizacao"
    )
    .ilike("nome_completo", `%${name}%`)
    .limit(MAX_RESULTS);

  if (error) throw new Error(`Database error: ${error.message}`);
  if (!data || data.length === 0) return { found: false, ambiguous: false };

  if (data.length > 1) {
    return {
      found: true,
      ambiguous: true,
      candidates: data.map((c) => ({
        id: String(c.id),
        name: String(c.nome_completo ?? ""),
        status: String(c.status ?? ""),
      })),
    };
  }

  const c = data[0]!;
  return {
    found: true,
    ambiguous: false,
    candidate: {
      id: String(c.id),
      name: String(c.nome_completo ?? ""),
      status: String(c.status ?? ""),
      substatus: c.substatus ? String(c.substatus) : null,
      nextStep: c.proxima_etapa ? String(c.proxima_etapa) : null,
      missingDocuments: [],
      employerName: null,
      lastUpdate: c.ultima_atualizacao ? String(c.ultima_atualizacao) : null,
      germanLevel: null,
    },
  };
}

export async function getCandidateDocuments(
  name: string
): Promise<CandidateResolution> {
  const db = getSupabaseServer();

  // First, find the candidate
  const { data: candidates, error: candErr } = await db
    .from("candidatos")
    .select("id, nome_completo, status")
    .ilike("nome_completo", `%${name}%`)
    .limit(MAX_RESULTS);

  if (candErr) throw new Error(`Database error: ${candErr.message}`);
  if (!candidates || candidates.length === 0) return { found: false, ambiguous: false };

  if (candidates.length > 1) {
    return {
      found: true,
      ambiguous: true,
      candidates: candidates.map((c) => ({
        id: String(c.id),
        name: String(c.nome_completo ?? ""),
        status: String(c.status ?? ""),
      })),
    };
  }

  const cand = candidates[0]!;

  // Then fetch their documents
  const { data: docs, error: docErr } = await db
    .from("documentos_candidato")
    .select("nome_documento, status")
    .eq("candidate_id", cand.id)
    .limit(30);

  if (docErr) {
    log.warn("Could not fetch documents", { error: docErr.message });
  }

  const missing =
    docs
      ?.filter((d) => d.status === "pendente" || d.status === "rejeitado")
      .map((d) => String(d.nome_documento ?? "")) ?? [];

  return {
    found: true,
    ambiguous: false,
    candidate: {
      id: String(cand.id),
      name: String(cand.nome_completo ?? ""),
      status: String(cand.status ?? ""),
      substatus: null,
      nextStep: null,
      missingDocuments: missing,
      employerName: null,
      lastUpdate: null,
      germanLevel: null,
    },
  };
}

// ─── Employer ─────────────────────────────────────────────────────────────────

export async function getEmployerByName(name: string): Promise<ResolvedEmployer> {
  const db = getSupabaseServer();

  const { data, error } = await db
    .from("empregadores")
    .select("id, nome, pais, setor, status_parceria")
    .ilike("nome", `%${name}%`)
    .limit(MAX_RESULTS);

  if (error) throw new Error(`Database error: ${error.message}`);
  if (!data || data.length === 0) return { found: false, ambiguous: false };

  if (data.length > 1) {
    return {
      found: true,
      ambiguous: true,
      employers: data.map((e) => ({ id: String(e.id), name: String(e.nome ?? "") })),
    };
  }

  const e = data[0]!;
  return {
    found: true,
    ambiguous: false,
    employer: {
      id: String(e.id),
      name: String(e.nome ?? ""),
      country: e.pais ? String(e.pais) : null,
      sector: e.setor ? String(e.setor) : null,
      partnerStatus: e.status_parceria ? String(e.status_parceria) : null,
    },
  };
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export async function getMatchesByCandidate(
  candidateName: string
): Promise<ResolvedMatches> {
  const db = getSupabaseServer();

  const { data: candidates } = await db
    .from("candidatos")
    .select("id, nome_completo")
    .ilike("nome_completo", `%${candidateName}%`)
    .limit(1);

  if (!candidates || candidates.length === 0) return { found: false, matches: [] };

  const candId = candidates[0]!.id;

  const { data, error } = await db
    .from("matches")
    .select("id, status, data_match, empregadores(nome)")
    .eq("candidate_id", candId)
    .limit(10);

  if (error) throw new Error(`Database error: ${error.message}`);

  return {
    found: true,
    matches: (data ?? []).map((m) => ({
      id: String(m.id),
      candidateName: String(candidates[0]!.nome_completo ?? ""),
      employerName: (m.empregadores as { nome?: string } | null)?.nome ?? undefined,
      status: String(m.status ?? ""),
      date: m.data_match ? String(m.data_match) : null,
    })),
  };
}

export async function getMatchesByEmployer(
  employerName: string
): Promise<ResolvedMatches> {
  const db = getSupabaseServer();

  const { data: employers } = await db
    .from("empregadores")
    .select("id, nome")
    .ilike("nome", `%${employerName}%`)
    .limit(1);

  if (!employers || employers.length === 0) return { found: false, matches: [] };

  const empId = employers[0]!.id;

  const { data, error } = await db
    .from("matches")
    .select("id, status, data_match, candidatos(nome_completo)")
    .eq("employer_id", empId)
    .limit(10);

  if (error) throw new Error(`Database error: ${error.message}`);

  return {
    found: true,
    matches: (data ?? []).map((m) => ({
      id: String(m.id),
      employerName: String(employers[0]!.nome ?? ""),
      candidateName: (m.candidatos as { nome_completo?: string } | null)?.nome_completo ?? undefined,
      status: String(m.status ?? ""),
      date: m.data_match ? String(m.data_match) : null,
    })),
  };
}
