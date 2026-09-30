SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: violation_audit_logs_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.violation_audit_logs_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'violation_audit_logs is append-only (% not allowed)', TG_OP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ar_internal_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_internal_metadata (
    key character varying NOT NULL,
    value character varying,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: cameras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cameras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    stop_line jsonb,
    frame_width integer,
    frame_height integer,
    district character varying(100),
    municipality character varying(100),
    raw_stream_key character varying(255) NOT NULL,
    output_stream_key character varying(255),
    worker_status character varying(20) DEFAULT 'STOPPED'::character varying NOT NULL,
    last_heartbeat timestamp with time zone,
    signal_state character varying(10) DEFAULT 'GREEN'::character varying NOT NULL,
    signal_updated_at timestamp with time zone,
    red_grace_seconds numeric(3,1) DEFAULT 0.0 NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    installed_at date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cameras_frame_height_check CHECK ((frame_height > 0)),
    CONSTRAINT cameras_frame_width_check CHECK ((frame_width > 0)),
    CONSTRAINT cameras_red_grace_check CHECK ((red_grace_seconds >= (0)::numeric)),
    CONSTRAINT cameras_signal_state_check CHECK (((signal_state)::text = ANY ((ARRAY['RED'::character varying, 'YELLOW'::character varying, 'GREEN'::character varying])::text[]))),
    CONSTRAINT cameras_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'MAINTENANCE'::character varying])::text[]))),
    CONSTRAINT cameras_stop_line_requires_frame CHECK (((stop_line IS NULL) OR ((frame_width IS NOT NULL) AND (frame_height IS NOT NULL)))),
    CONSTRAINT cameras_stop_line_shape CHECK (((stop_line IS NULL) OR (jsonb_exists(stop_line, 'p1'::text) AND jsonb_exists(stop_line, 'p2'::text)))),
    CONSTRAINT cameras_worker_status_check CHECK (((worker_status)::text = ANY ((ARRAY['STOPPED'::character varying, 'STARTING'::character varying, 'RUNNING'::character varying, 'ERROR'::character varying])::text[])))
);


--
-- Name: evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    violation_id uuid NOT NULL,
    media_type character varying(10) NOT NULL,
    evidence_role character varying(20) NOT NULL,
    storage_key character varying(512) NOT NULL,
    storage_provider character varying(20) NOT NULL,
    file_size_byte bigint,
    duration_seconds numeric(6,2),
    checksum_sha256 character(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT evidence_checksum_check CHECK ((checksum_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT evidence_duration_check CHECK ((duration_seconds >= (0)::numeric)),
    CONSTRAINT evidence_duration_video_only CHECK ((((media_type)::text = 'VIDEO'::text) OR (duration_seconds IS NULL))),
    CONSTRAINT evidence_media_type_check CHECK (((media_type)::text = ANY ((ARRAY['IMAGE'::character varying, 'VIDEO'::character varying])::text[]))),
    CONSTRAINT evidence_provider_check CHECK (((storage_provider)::text = ANY ((ARRAY['S3'::character varying, 'MINIO'::character varying, 'GCS'::character varying])::text[]))),
    CONSTRAINT evidence_role_check CHECK (((evidence_role)::text = ANY ((ARRAY['FULL_FRAME'::character varying, 'PLATE_CROP'::character varying, 'CLIP'::character varying])::text[]))),
    CONSTRAINT evidence_size_check CHECK ((file_size_byte >= 0))
);


--
-- Name: officers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.officers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    badge_number character varying(30) NOT NULL,
    role character varying(20) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT officers_role_check CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'OFFICER'::character varying])::text[])))
);


--
-- Name: owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    email character varying(255),
    phone_number character varying(20),
    license_number character varying(50)
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plate_number character varying(30) NOT NULL,
    province_code character varying(10),
    vehicle_category character varying(30),
    vehicle_type character varying(30),
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: violation_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.violation_audit_logs (
    id bigint NOT NULL,
    violation_id uuid NOT NULL,
    officer_id uuid,
    action character varying(30) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT violation_audit_logs_action_check CHECK (((action)::text = ANY ((ARRAY['CREATED'::character varying, 'CONFIRMED'::character varying, 'REJECTED'::character varying, 'REOPENED'::character varying, 'VEHICLE_LINKED'::character varying, 'NOTE_ADDED'::character varying])::text[])))
);


--
-- Name: violation_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.violation_audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: violation_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.violation_audit_logs_id_seq OWNED BY public.violation_audit_logs.id;


--
-- Name: violation_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.violation_types (
    id smallint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    fine_amount_npr numeric(10,2) NOT NULL,
    CONSTRAINT violation_types_fine_check CHECK ((fine_amount_npr >= (0)::numeric))
);


--
-- Name: violation_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.violation_types_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: violation_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.violation_types_id_seq OWNED BY public.violation_types.id;


--
-- Name: violations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camera_id uuid NOT NULL,
    violation_type_id smallint NOT NULL,
    vehicle_id uuid,
    track_id integer,
    session_id uuid,
    detected_plate_raw character varying(50),
    plate_confidence numeric(4,3),
    detection_confidence numeric(4,3) NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    signal_state character varying(10),
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    reviewed_by_id uuid,
    reviewed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT violations_detection_conf_check CHECK (((detection_confidence >= (0)::numeric) AND (detection_confidence <= (1)::numeric))),
    CONSTRAINT violations_plate_conf_check CHECK (((plate_confidence >= (0)::numeric) AND (plate_confidence <= (1)::numeric))),
    CONSTRAINT violations_review_consistency CHECK (((reviewed_by_id IS NULL) = (reviewed_at IS NULL))),
    CONSTRAINT violations_signal_state_check CHECK (((signal_state)::text = ANY ((ARRAY['RED'::character varying, 'YELLOW'::character varying, 'GREEN'::character varying])::text[]))),
    CONSTRAINT violations_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'CONFIRMED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: violation_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violation_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.violation_audit_logs_id_seq'::regclass);


--
-- Name: violation_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violation_types ALTER COLUMN id SET DEFAULT nextval('public.violation_types_id_seq'::regclass);


--
-- Name: ar_internal_metadata ar_internal_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_internal_metadata
    ADD CONSTRAINT ar_internal_metadata_pkey PRIMARY KEY (key);


--
-- Name: cameras cameras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_pkey PRIMARY KEY (id);


--
-- Name: evidence evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_pkey PRIMARY KEY (id);


--
-- Name: officers officers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.officers
    ADD CONSTRAINT officers_pkey PRIMARY KEY (id);


--
-- Name: owners owners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners
    ADD CONSTRAINT owners_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: violation_audit_logs violation_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violation_audit_logs
    ADD CONSTRAINT violation_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: violation_types violation_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violation_types
    ADD CONSTRAINT violation_types_pkey PRIMARY KEY (id);


--
-- Name: violations violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT violations_pkey PRIMARY KEY (id);


--
-- Name: idx_violation_audit_violation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_violation_audit_violation_created ON public.violation_audit_logs USING btree (violation_id, created_at);


--
-- Name: idx_violations_camera_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_violations_camera_occurred ON public.violations USING btree (camera_id, occurred_at DESC);


--
-- Name: idx_violations_status_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_violations_status_occurred ON public.violations USING btree (status, occurred_at DESC);


--
-- Name: index_cameras_on_output_stream_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_cameras_on_output_stream_key ON public.cameras USING btree (output_stream_key);


--
-- Name: index_cameras_on_raw_stream_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_cameras_on_raw_stream_key ON public.cameras USING btree (raw_stream_key);


--
-- Name: index_evidence_on_violation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_evidence_on_violation_id ON public.evidence USING btree (violation_id);


--
-- Name: index_officers_on_badge_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_officers_on_badge_number ON public.officers USING btree (badge_number);


--
-- Name: index_officers_on_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_officers_on_email ON public.officers USING btree (email);


--
-- Name: index_owners_on_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_owners_on_email ON public.owners USING btree (email);


--
-- Name: index_vehicles_on_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_vehicles_on_owner_id ON public.vehicles USING btree (owner_id);


--
-- Name: index_vehicles_on_plate_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_vehicles_on_plate_number ON public.vehicles USING btree (plate_number);


--
-- Name: index_violation_audit_logs_on_officer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_violation_audit_logs_on_officer_id ON public.violation_audit_logs USING btree (officer_id);


--
-- Name: index_violation_types_on_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_violation_types_on_code ON public.violation_types USING btree (code);


--
-- Name: index_violations_on_reviewed_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_violations_on_reviewed_by_id ON public.violations USING btree (reviewed_by_id);


--
-- Name: index_violations_on_vehicle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_violations_on_vehicle_id ON public.violations USING btree (vehicle_id);


--
-- Name: index_violations_on_violation_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_violations_on_violation_type_id ON public.violations USING btree (violation_type_id);


--
-- Name: uq_evidence_storage; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_evidence_storage ON public.evidence USING btree (storage_provider, storage_key);


--
-- Name: uq_violations_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_violations_dedup ON public.violations USING btree (camera_id, session_id, track_id, violation_type_id) WHERE ((track_id IS NOT NULL) AND (session_id IS NOT NULL));


--
-- Name: violation_audit_logs trg_violation_audit_logs_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_violation_audit_logs_immutable BEFORE DELETE OR UPDATE ON public.violation_audit_logs FOR EACH ROW EXECUTE FUNCTION public.violation_audit_logs_immutable();


--
-- Name: violation_audit_logs fk_rails_37f222e4c6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violation_audit_logs
    ADD CONSTRAINT fk_rails_37f222e4c6 FOREIGN KEY (violation_id) REFERENCES public.violations(id) ON DELETE RESTRICT;


--
-- Name: violation_audit_logs fk_rails_5e96d48b56; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violation_audit_logs
    ADD CONSTRAINT fk_rails_5e96d48b56 FOREIGN KEY (officer_id) REFERENCES public.officers(id) ON DELETE RESTRICT;


--
-- Name: violations fk_rails_6cd8eb231b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT fk_rails_6cd8eb231b FOREIGN KEY (reviewed_by_id) REFERENCES public.officers(id) ON DELETE RESTRICT;


--
-- Name: violations fk_rails_8053f82af9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT fk_rails_8053f82af9 FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: violations fk_rails_a2ba6ea6cf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT fk_rails_a2ba6ea6cf FOREIGN KEY (violation_type_id) REFERENCES public.violation_types(id) ON DELETE RESTRICT;


--
-- Name: violations fk_rails_b2c0d20945; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.violations
    ADD CONSTRAINT fk_rails_b2c0d20945 FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE RESTRICT;


--
-- Name: evidence fk_rails_e51ddf48f9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT fk_rails_e51ddf48f9 FOREIGN KEY (violation_id) REFERENCES public.violations(id) ON DELETE RESTRICT;


--
-- Name: vehicles fk_rails_ecc199169c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT fk_rails_ecc199169c FOREIGN KEY (owner_id) REFERENCES public.owners(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

SET search_path TO "$user", public;

INSERT INTO "schema_migrations" (version) VALUES
('20260930214250'),
('20260930214129'),
('20260930213801'),
('20260930213519'),
('20260930213144'),
('20260930212854'),
('20260930212727'),
('20260930212350'),
('20260930210259');

