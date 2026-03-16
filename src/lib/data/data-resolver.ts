// src/lib/data/data-resolver.ts
// Routes the validated action to the correct query handler.
// Serialises structured result into a compact string for the prompt.

import type { IntentClassification } from "@/types/chat";
import type { DataResolution, CandidateResolution, ResolvedMatches } from "@/types/domain";
import { makeLogger } from "@/lib/utils/logger";
import {
  getCandidateByName,
  getCandidateStatus,
  getCandidateDocuments,
  getEmployerByName,
  getMatchesByCandidate,
  getMatchesByEmployer,
} from "./query-handlers";

const log = makeLogger("data-resolver");

export async function resolveData(
  classification: IntentClassification
): Promise<{ resolution: DataResolution | null; context: string | null }> {
  if (!classification.needsDatabase || classification.action === "none") {
    return { resolution: null, context: null };
  }

  const { action, entities } = classification;

  log.debug("Resolving data", { action, entities });

  try {
    let resolution: DataResolution;

    switch (action) {
      case "get_candidate_by_name":
        if (!entities.candidateName) return { resolution: null, context: noEntityContext("candidateName") };
        resolution = await getCandidateByName(entities.candidateName);
        break;

      case "get_candidate_status":
        if (!entities.candidateName) return { resolution: null, context: noEntityContext("candidateName") };
        resolution = await getCandidateStatus(entities.candidateName);
        break;

      case "get_candidate_documents":
        if (!entities.candidateName) return { resolution: null, context: noEntityContext("candidateName") };
        resolution = await getCandidateDocuments(entities.candidateName);
        break;

      case "get_employer_by_name":
        if (!entities.employerName) return { resolution: null, context: noEntityContext("employerName") };
        resolution = await getEmployerByName(entities.employerName);
        break;

      case "get_matches_by_candidate":
        if (!entities.candidateName) return { resolution: null, context: noEntityContext("candidateName") };
        resolution = await getMatchesByCandidate(entities.candidateName);
        break;

      case "get_matches_by_employer":
        if (!entities.employerName) return { resolution: null, context: noEntityContext("employerName") };
        resolution = await getMatchesByEmployer(entities.employerName);
        break;

      default:
        return { resolution: null, context: null };
    }

    const context = serializeResolution(action, resolution);
    return { resolution, context };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("Data resolution failed", { action, error: msg });
    return {
      resolution: null,
      context: `[ERRO] Não foi possível consultar os dados do sistema no momento. Tente novamente em alguns instantes.`,
    };
  }
}

// ─── Serialisers ──────────────────────────────────────────────────────────────

function noEntityContext(field: string): string {
  return `[AVISO] Não foi possível identificar ${field} na pergunta. Para consultar dados específicos, informe o nome completo.`;
}

function serializeResolution(action: string, r: DataResolution): string | null {
  // Candidate not found
  if ("found" in r && !r.found) {
    if ("error" in r) return `[ERRO] ${r.error}`;
    return "[DADOS] Candidato não encontrado no sistema.";
  }

  // Ambiguous candidate
  if ("found" in r && r.found && "ambiguous" in r && r.ambiguous && "candidates" in r) {
    const names = r.candidates.map((c) => `• ${c.name} (status: ${c.status})`).join("\n");
    return `[AMBIGUIDADE] Encontrei ${r.candidates.length} candidatos com esse nome:\n${names}\nInforme o nome completo para continuar.`;
  }

  // Single candidate
  if ("found" in r && r.found && !("ambiguous" in r && r.ambiguous) && "candidate" in r) {
    const c = r.candidate;
    const lines = [
      `Nome: ${c.name}`,
      `Status: ${c.status}`,
      c.substatus ? `Substatus: ${c.substatus}` : null,
      c.nextStep ? `Próxima etapa: ${c.nextStep}` : null,
      c.germanLevel ? `Nível de alemão: ${c.germanLevel}` : null,
      c.employerName ? `Empregador vinculado: ${c.employerName}` : null,
      c.lastUpdate ? `Última atualização: ${c.lastUpdate}` : null,
      c.missingDocuments.length > 0
        ? `Documentos pendentes:\n${c.missingDocuments.map((d) => `  • ${d}`).join("\n")}`
        : (action === "get_candidate_documents" ? "Nenhum documento pendente." : null),
    ].filter(Boolean);
    return `[DADOS DO CANDIDATO]\n${lines.join("\n")}`;
  }

  // Employer
  if ("employer" in r && r.employer) {
    const e = r.employer;
    const lines = [
      `Empregador: ${e.name}`,
      e.country ? `País: ${e.country}` : null,
      e.sector ? `Setor: ${e.sector}` : null,
      e.partnerStatus ? `Status parceria: ${e.partnerStatus}` : null,
    ].filter(Boolean);
    return `[DADOS DO EMPREGADOR]\n${lines.join("\n")}`;
  }

  // Matches
  if ("matches" in r) {
    const mr = r as ResolvedMatches;
    if (!mr.found || mr.matches.length === 0) return "[DADOS] Nenhum match encontrado.";
    const items = mr.matches
      .map((m) => `• ${m.employerName ?? m.candidateName ?? "—"} — ${m.status}${m.date ? ` (${m.date})` : ""}`)
      .join("\n");
    return `[MATCHES]\n${items}`;
  }

  return null;
}
