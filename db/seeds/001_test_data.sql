-- db/seeds/001_test_data.sql
-- Sample data for local testing only. Do NOT run in production.

-- Candidatos de teste
INSERT INTO candidatos (id, nome_completo, status, substatus, nivel_alemao, profissao, proxima_etapa)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Maria Silva Santos', 'Documentação pendente', 'Aguardando certidão', 'B1', 'Enfermeira', 'Enviar certidão de antecedentes'),
  ('11111111-0000-0000-0000-000000000002', 'João Carlos Pereira', 'Entrevista agendada', null, 'B2', 'Médico', 'Entrevista com Hospital Munique'),
  ('11111111-0000-0000-0000-000000000003', 'Ana Paula Costa', 'Em triagem', null, 'A2', 'Fisioterapeuta', 'Aguardar triagem documental'),
  ('11111111-0000-0000-0000-000000000004', 'Carlos Silva', 'Aprovado', null, 'B2', 'Enfermeiro', 'Aguardar visto de trabalho'),
  ('11111111-0000-0000-0000-000000000005', 'Carlos Silva Junior', 'Em triagem', null, 'B1', 'Enfermeiro', 'Concluir triagem')
ON CONFLICT (id) DO NOTHING;

-- Documentos para Maria Silva
INSERT INTO documentos_candidato (candidate_id, nome_documento, status)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Certidão de antecedentes criminais', 'pendente'),
  ('11111111-0000-0000-0000-000000000001', 'Diploma de graduação', 'aprovado'),
  ('11111111-0000-0000-0000-000000000001', 'Certificado B1 Goethe', 'aprovado'),
  ('11111111-0000-0000-0000-000000000001', 'Passaporte', 'pendente')
ON CONFLICT DO NOTHING;

-- Empregadores
INSERT INTO empregadores (id, nome, pais, setor, status_parceria)
VALUES
  ('22222222-0000-0000-0000-000000000001', 'Hospital Klinikum München', 'Alemanha', 'Saúde', 'Ativo'),
  ('22222222-0000-0000-0000-000000000002', 'Pflegeheim Berlin GmbH', 'Alemanha', 'Cuidados', 'Ativo')
ON CONFLICT (id) DO NOTHING;

-- Matches
INSERT INTO matches (candidate_id, employer_id, status)
VALUES
  ('11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'Entrevista agendada'),
  ('11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002', 'Aprovado')
ON CONFLICT DO NOTHING;
