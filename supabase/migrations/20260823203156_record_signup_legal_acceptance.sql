-- Immutable evidence that an account owner accepted the exact legal-document
-- versions presented during signup. Writes are server-only through the
-- service-role signup action; browser roles receive no table privileges.
CREATE TABLE public.legal_document_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('terms', 'privacy')),
    document_version TEXT NOT NULL CHECK (char_length(document_version) BETWEEN 1 AND 40),
    document_identifier TEXT NOT NULL CHECK (
        document_identifier = document_type || ':' || document_version
    ),
    document_path TEXT NOT NULL CHECK (document_path IN ('/terms', '/privacy')),
    acceptance_method TEXT NOT NULL CHECK (acceptance_method = 'signup_checkbox'),
    language_code TEXT NOT NULL DEFAULT 'en' CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    user_agent TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (actor_user_id, document_identifier)
);

CREATE INDEX legal_document_acceptances_org_accepted_idx
    ON public.legal_document_acceptances (org_id, accepted_at DESC);

CREATE INDEX legal_document_acceptances_actor_accepted_idx
    ON public.legal_document_acceptances (actor_user_id, accepted_at DESC);

ALTER TABLE public.legal_document_acceptances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.legal_document_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_document_acceptances TO service_role;

COMMENT ON TABLE public.legal_document_acceptances IS
    'Server-recorded evidence of the legal-document versions accepted by an account actor.';
COMMENT ON COLUMN public.legal_document_acceptances.document_identifier IS
    'Immutable identifier composed as document_type:document_version.';
COMMENT ON COLUMN public.legal_document_acceptances.user_agent IS
    'Optional browser evidence disclosed as technical/device data; limited to 512 characters.';
