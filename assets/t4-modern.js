/* V2.3: apresentação apenas. Nenhuma escrita, rede ou inferência de aprovação. */
(function () {
  'use strict';
  const palette = ['#007A88','#A13D77','#6052B8','#B65D16','#2468B4','#28734F','#A53F4B','#65523E','#436F93','#855DA1','#56721C','#9C521F'];
  function color(row = {}) {
    for (const value of [row.color, row.cor, row.cor_hex, row.payload?.color, row.payload?.cor]) if (/^#[0-9a-f]{6}$/i.test(value || '')) return value;
    let hash = 0; for (const c of String(row.id || row.nome || row.employer_name || 'Talents 4')) hash = (Math.imul(hash,31) + c.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length];
  }
  function employer(row) {
    if (!row) return '';
    return `<span class="mx-employer" style="--employer-color:${color(row)}"><i aria-hidden="true"></i>${window.T4V2.esc(row.nome || row.employer_name || 'Empregador')}</span>`;
  }
  function nextActions(state, id) {
    const M = window.T4Models, same = (x) => M.same(x,id);
    return [
      ...(state.activities || []).filter(r => same(r.talent_id) && M.isOpen(r.status)).map(r => ({text:r.title, due:r.due_at, owner:r.owner_username, source:'Agenda'})),
      ...(state.selections?.rows || []).filter(r => same(r.talent_id) && !['closed','hired'].includes(M.selectionBucket(r)) && r.next_action).map(r => ({text:r.next_action,due:r.next_action_at,owner:r.owner_username,source:'Seleção'})),
      ...(state.enrollments || []).filter(r => same(r.candidate_id) && ['Ativo','Matriculado','Pausado'].includes(r.status) && r.next_action).map(r => ({text:r.next_action,due:r.next_action_due,owner:r.owner_name,source:'Alemão'}))
    ].sort((x,y) => String(x.due || '9999').localeCompare(String(y.due || '9999')));
  }
  function manual() {
    return `<article class="mx-manual"><span class="mx-eyebrow">GUIA DE USO</span><h2>Uma pessoa. Um cadastro. Próximos passos claros.</h2><p>Talentos, Organizacional, Alemão e Contatos são áreas do mesmo trabalho. Não crie uma segunda pessoa para mudar de área.</p>
    <section><h3>1. Comece por Talentos</h3><p>Busque por nome, profissão, cidade ou e-mail. Use Lista para o dia a dia, Cartões para uma visão compacta ou Tabela completa para conferir os campos. Abra <strong>Acompanhar</strong> para trabalhar com uma pessoa. Ficha completa mantém perfil, seleções, alemão, documentos, histórico e todos os dados anteriores.</p><p>Filtros aceitam várias opções. Duas etapas selecionadas significam uma OU outra. Etapa + alemão significa atender aos dois grupos. Meus talentos, Atenção e Em aulas também podem ser combinados. Limpar filtros remove o recorte, não os registros.</p></section>
    <section><h3>2. Defina o próximo passo</h3><p>No acompanhamento, registre uma atividade com prazo e responsável. A Visão geral mostra ações reais da agenda, seleções e alemão. Sem ação registrada significa que a equipe precisa definir uma; o sistema não inventa uma tarefa.</p><p><strong>Etapa do perfil</strong> é uma classificação interna editada na ficha. <strong>Etapa da seleção</strong> pertence à relação com uma empresa/vaga. <strong>Alemão e documentação</strong> evoluem em paralelo. Alterar uma dessas informações não aprova automaticamente as outras.</p></section>
    <section><h3>3. Liberar para apresentação</h3><p>Abra Acompanhar → Visão geral → Revisar liberação. Selecione Sim somente depois da revisão humana do perfil, autorização e requisitos da oportunidade. Um Talento ativo com liberação Sim aparece em <strong>Apresentações</strong>. Parcial e Não ficam fora. Nenhum score, nível de idioma ou nome de etapa concede essa liberação.</p><p>A liberação não envia currículo nem e-mail. Na seção Apresentação da pessoa, confira as 18 informações antes de preparar o PDF; selecione os campos adequados ao destinatário.</p></section>
    <section><h3>4. Entender o Radar NectaNet</h3><p>Abra Empresas e vagas e crie ou complemente um alvo. Uma linha com <strong>NectaNet? = Sim</strong> aparece em Mercado → Radar NectaNet. Se a linha não tem classificação própria, vale a classificação do parceiro. Não explícito prevalece sobre o parceiro.</p><p>O Radar mostra oportunidades relacionadas aos Talentos ativos, não uma etapa da pessoa. Não exige liberação para apresentação. Uma pessoa pode estar no Radar e ainda em preparação. O campo <strong>Lista Nectanet</strong> é outra classificação, usada na apresentação; não libera nem cria oportunidades.</p></section>
    <section><h3>5. Avaliar sem confundir futuro com presente</h3><p>Aderência profissional, viabilidade atual e viabilidade projetada B1 são avaliações manuais independentes, de 0 a 100. Vazio significa não avaliado. B1 em três meses é hipótese, não nível atual nem garantia. Registre barreiras, fonte e data da verificação. Melhor alvo é uma decisão da equipe.</p></section>
    <section><h3>6. Empresas e cores</h3><p>As cores identificam empresas em Talentos e Organizacional. A cor salva é usada quando disponível; na ausência, uma cor estável é calculada pelo identificador. Cores podem se repetir: confira sempre o nome. Cor não indica aprovação, urgência ou saúde do processo.</p></section>
    <section><h3>7. Segurança e limites</h3><p>Na demonstração, os dados são fictícios e alterações desaparecem ao recarregar. Na versão conectada, salvar altera os dados reais. Arquivar preserva a ficha; filtros não excluem informações. Atualizar recarrega as fontes autorizadas.</p><p>Se aparecer Dados parciais ou fonte não disponível, não conclua que os registros foram apagados. Verifique a fonte antes de cadastrar novamente.</p></section></article>`;
  }
  window.T4Modern = Object.freeze({color, employer, nextActions, manual});
})();
