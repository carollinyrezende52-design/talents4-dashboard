// src/lib/knowledge/knowledge-index.ts
import type { KnowledgeBlock } from "@/types/knowledge";

export const KNOWLEDGE_BLOCKS: KnowledgeBlock[] = [
  {
    slug: "company_overview",
    category: "company_overview",
    title: "Visão geral da Talents4",
    content: `A Talents4 é uma empresa especializada em recrutamento internacional, conectando profissionais de saúde (enfermeiros, médicos, fisioterapeutas) com empregadores europeus, principalmente alemães. Atuamos com candidatos do Brasil, Portugal, Espanha e países africanos de língua portuguesa. Oferecemos suporte completo: reconhecimento de diploma, preparação para o exame de alemão, acompanhamento jurídico e documental.`,
    keywords: ["empresa", "talents4", "o que é", "missão", "sobre", "recrutamento", "internacional"],
    priority: 1,
    version: "1.0",
    isActive: true,
  },
  {
    slug: "process_rules_overview",
    category: "process_rules",
    title: "Etapas do processo de recrutamento",
    content: `O processo da Talents4 segue estas etapas principais:
1. Triagem inicial: análise do currículo e documentação básica
2. Entrevista com o consultor
3. Preparação documental: diploma, histórico, certidões
4. Nível de alemão: exame mínimo exigido varia por empregador (geralmente B1 ou B2)
5. Matching com empregador: apresentação ao parceiro europeu
6. Entrevista com empregador
7. Reconhecimento de diploma no país de destino
8. Visto de trabalho e migração
9. Integração no empregador`,
    keywords: ["etapas", "processo", "como funciona", "passos", "fases", "fluxo", "recrutamento"],
    priority: 1,
    version: "1.0",
    isActive: true,
  },
  {
    slug: "faq_documents_required",
    category: "faq_documents",
    title: "Documentos obrigatórios para o processo",
    content: `Documentos geralmente exigidos no processo:
- Diploma de graduação (reconhecido ou em processo de reconhecimento)
- Histórico escolar
- Certidão de nascimento
- Passaporte válido
- Comprovante de nível de alemão (certificado Goethe, telc ou similar)
- Carta de motivação
- Currículo atualizado em alemão ou inglês
- Certidão de antecedentes criminais
- Comprovante de experiência profissional

Os documentos específicos variam de acordo com o país de destino e o empregador.`,
    keywords: ["documento", "documentos", "certidão", "diploma", "passaporte", "lista", "obrigatório", "necessário"],
    priority: 1,
    version: "1.0",
    isActive: true,
  },
  {
    slug: "faq_language_course",
    category: "faq_language_course",
    title: "Requisitos de idioma alemão",
    content: `O nível de alemão é um requisito central para trabalhar na Alemanha na área da saúde:
- Nível mínimo para maioria dos empregadores: B1 (comunicação básica)
- Nível exigido para reconhecimento pleno: B2 ou C1
- Certificações aceitas: Goethe-Institut, telc, ÖSD
- A Talents4 orienta sobre cursos preparatórios e oferece indicações de parceiros de ensino
- O prazo médio para atingir B2 a partir do zero é de 12 a 18 meses com dedicação`,
    keywords: ["alemão", "idioma", "língua", "nível", "b1", "b2", "c1", "curso", "goethe", "telc", "certificado"],
    priority: 2,
    version: "1.0",
    isActive: true,
  },
  {
    slug: "faq_application_status",
    category: "faq_application_status",
    title: "Status do processo — o que cada etapa significa",
    content: `Status possíveis no CRM e seu significado:
- Novo: candidato recém-cadastrado, triagem ainda não iniciada
- Em triagem: documentação sendo analisada
- Entrevista agendada: entrevista com consultor ou empregador marcada
- Documentação pendente: documentos faltantes identificados, candidato precisa enviar
- Aprovado: candidato aprovado para a próxima fase
- Reprovado: candidato não avançou no processo
- Contratado: processo finalizado com sucesso, contrato assinado
- Inativo: processo pausado ou candidato não responsivo`,
    keywords: ["status", "etapa", "fase", "significado", "triagem", "aprovado", "reprovado", "inativo", "contratado"],
    priority: 2,
    version: "1.0",
    isActive: true,
  },
  {
    slug: "compliance_rules",
    category: "compliance_rules",
    title: "Regras de conformidade e LGPD",
    content: `A Talents4 opera em conformidade com a LGPD (Lei Geral de Proteção de Dados) no Brasil e com o RGPD europeu. Os dados dos candidatos são utilizados exclusivamente para fins do processo de recrutamento. O candidato pode solicitar exclusão de seus dados a qualquer momento através do consultor responsável. Documentos sensíveis são armazenados com acesso restrito.`,
    keywords: ["lgpd", "rgpd", "dados", "privacidade", "conformidade", "proteção", "exclusão"],
    priority: 3,
    version: "1.0",
    isActive: true,
  },
  {
    slug: "matching_logic",
    category: "matching_logic",
    title: "Como funciona o matching candidato-empregador",
    content: `O matching conecta candidatos a empregadores parceiros com base em:
- Especialidade profissional (enfermagem, medicina, fisioterapia etc.)
- Nível de alemão atual e projetado
- Disponibilidade para migração
- Preferências de região na Alemanha
- Requisitos específicos do empregador (ex: experiência em UTI, home care)
- Situação documental atual

Um candidato pode ter múltiplos matches com diferentes empregadores. O status do match indica em qual fase a negociação se encontra.`,
    keywords: ["match", "matching", "vinculação", "empregador", "candidato", "como funciona", "critério"],
    priority: 2,
    version: "1.0",
    isActive: true,
  },
  {
    slug: "employer_process_notes",
    category: "employer_process_notes",
    title: "Processo do lado do empregador",
    content: `Os empregadores parceiros da Talents4 são instituições de saúde europeias verificadas. Eles participam do processo com:
- Definição de vagas e requisitos
- Entrevistas com candidatos pré-selecionados
- Emissão de carta de intenção de contratação
- Suporte ao processo de visto e reconhecimento de diploma
- Integração e acompanhamento inicial do profissional

O empregador é notificado pelo consultor quando um candidato compatível está disponível.`,
    keywords: ["empregador", "empresa parceira", "hospital", "clínica", "parceiro", "vaga", "contratação"],
    priority: 2,
    version: "1.0",
    isActive: true,
  },
];
