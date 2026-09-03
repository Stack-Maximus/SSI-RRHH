-- ============================================================================
-- Corrige: "null value in column severidad... violates not-null constraint"
--
-- Causa: severidad se definía como NOT NULL desde la creación del ticket,
-- pero la severidad la asigna el Coordinador en el triage, DESPUÉS de que
-- el cliente reporta — el cliente no la conoce ni debería definirla.
-- ============================================================================

alter table pv_tickets alter column severidad drop not null;
