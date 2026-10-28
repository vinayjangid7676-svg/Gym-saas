-- ================================================================
-- GYM MANAGEMENT SaaS - COMPLETE PostgreSQL MASTER SCHEMA
-- Version: 2.0
-- Purpose: Multi-tenant, multi-branch, production-oriented gym SaaS
-- Public identifiers: hash_id
-- Internal relationships: BIGINT id
-- PostgreSQL + pgcrypto
-- ================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 0. ENUMS
-- ================================================================
DO $$ BEGIN CREATE TYPE org_status_enum AS ENUM ('trial','active','suspended','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status_enum AS ENUM ('active','inactive','locked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE member_status_enum AS ENUM ('active','inactive','expired','frozen','blacklisted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE membership_status_enum AS ENUM ('upcoming','active','expired','frozen','cancelled','transferred'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invoice_status_enum AS ENUM ('unpaid','partially_paid','paid','refunded','void'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status_enum AS ENUM ('pending','success','failed','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method_enum AS ENUM ('cash','upi_qr','pos_machine','razorpay','stripe','bank_transfer','cheque','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE attendance_device_enum AS ENUM ('biometric','rfid_turnstile','qr_scanner','face_recognition'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE checkin_method_enum AS ENUM ('qr_dynamic','rfid','fingerprint','face','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE locker_status_enum AS ENUM ('available','occupied','under_repair','reserved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE class_booking_status_enum AS ENUM ('confirmed','waitlisted','cancelled','attended','no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lead_status_enum AS ENUM ('new','contacted','qualified','trial','converted','lost','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE gender_enum AS ENUM ('male','female','other','prefer_not_to_say'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payout_type_enum AS ENUM ('fixed','hourly','commission'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE expense_status_enum AS ENUM ('draft','approved','paid','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_status_enum AS ENUM ('queued','sent','delivered','failed','read'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE subscription_status_enum AS ENUM ('trial','active','past_due','paused','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ================================================================
-- 1. SAAS / TENANCY
-- ================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    legal_name VARCHAR(200),
    tax_id_gst VARCHAR(50),
    status org_status_enum DEFAULT 'trial' NOT NULL,
    owner_user_id BIGINT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS branches (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'India',
    pincode VARCHAR(10),
    geo_latitude DECIMAL(10,8),
    geo_longitude DECIMAL(11,8),
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    opening_time TIME,
    closing_time TIME,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_org_branch_code UNIQUE (organization_id, code)
);

-- ================================================================
-- 2. AUTH / RBAC
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    password_hash VARCHAR(255) NOT NULL,
    status user_status_enum DEFAULT 'active' NOT NULL,
    is_super_admin BOOLEAN DEFAULT FALSE NOT NULL,
    mfa_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    mfa_secret VARCHAR(128),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_user_phone UNIQUE (phone),
    CONSTRAINT uq_user_email UNIQUE (email)
);

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_org_owner'
    ) THEN 
        ALTER TABLE organizations 
        ADD CONSTRAINT fk_org_owner FOREIGN KEY (owner_user_id) REFERENCES users(id);
    END IF; 
END $$;
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_org_role_slug UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    module VARCHAR(80) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    CONSTRAINT uq_permission UNIQUE (module, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_branches (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_branch UNIQUE (user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS login_logs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 3. MEMBERS
-- ================================================================
CREATE TABLE IF NOT EXISTS members (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    primary_branch_id BIGINT NOT NULL REFERENCES branches(id),
    member_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(100),
    gender gender_enum,
    date_of_birth DATE,
    blood_group VARCHAR(10),
    marital_status VARCHAR(20),
    profile_image_url TEXT,
    barcode_rfid VARCHAR(64),
    status member_status_enum DEFAULT 'active' NOT NULL,
    join_date DATE NOT NULL,
    registration_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    referral_member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
    lead_source VARCHAR(50),
    whatsapp_opt_in BOOLEAN DEFAULT TRUE NOT NULL,
    sms_opt_in BOOLEAN DEFAULT TRUE NOT NULL,
    email_opt_in BOOLEAN DEFAULT TRUE NOT NULL,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_org_member_code UNIQUE (organization_id, member_code)
);

CREATE TABLE IF NOT EXISTS member_addresses (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    address_type VARCHAR(30) DEFAULT 'home',
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    is_primary BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS member_emergency_contacts (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50),
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS member_documents (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_number VARCHAR(150),
    document_url TEXT,
    issued_on DATE,
    expires_on DATE,
    verification_status VARCHAR(30) DEFAULT 'pending',
    verified_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS member_notes (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    author_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    note_type VARCHAR(50),
    note TEXT NOT NULL,
    is_private BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS member_tags (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20),
    CONSTRAINT uq_org_tag_name UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS member_tag_assignments (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES member_tags(id) ON DELETE CASCADE,
    CONSTRAINT uq_member_tag UNIQUE (member_id, tag_id)
);

-- ================================================================
-- 4. LEADS / CRM
-- ================================================================
CREATE TABLE IF NOT EXISTS lead_sources (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    CONSTRAINT uq_org_lead_source UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS leads (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    source_id BIGINT REFERENCES lead_sources(id) ON DELETE SET NULL,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    status lead_status_enum DEFAULT 'new' NOT NULL,
    interested_plan_id BIGINT,
    expected_join_date DATE,
    notes TEXT,
    converted_member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_followups (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    followup_at TIMESTAMPTZ NOT NULL,
    outcome VARCHAR(100),
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_status_history (
    id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    old_status lead_status_enum,
    new_status lead_status_enum NOT NULL,
    changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_activities (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    performed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 5. MEMBERSHIP / PLANS
-- ================================================================
CREATE TABLE IF NOT EXISTS membership_plans (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_days INT NOT NULL,
    session_count INT,
    base_price NUMERIC(12,2) NOT NULL,
    tax_percentage NUMERIC(5,2) DEFAULT 0 NOT NULL,
    allow_freezes BOOLEAN DEFAULT FALSE NOT NULL,
    max_freeze_days INT DEFAULT 0,
    auto_renew BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS membership_plan_features (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES membership_plans(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    feature_value VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    plan_id BIGINT NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status membership_status_enum DEFAULT 'active' NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    due_amount NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    discount_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    transferred_from_membership_id BIGINT REFERENCES memberships(id) ON DELETE SET NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS membership_freezes (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    membership_id BIGINT NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS membership_renewals (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    old_membership_id BIGINT NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
    new_membership_id BIGINT NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
    renewed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    renewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS membership_extensions (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    membership_id BIGINT NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    days_added INT NOT NULL,
    old_end_date DATE NOT NULL,
    new_end_date DATE NOT NULL,
    reason TEXT,
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS membership_transfers (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    membership_id BIGINT NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
    from_member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    to_member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    transfer_fee NUMERIC(12,2) DEFAULT 0 NOT NULL,
    reason TEXT,
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS membership_addons (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL,
    duration_days INT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS member_membership_addons (
    id BIGSERIAL PRIMARY KEY,
    membership_id BIGINT NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    addon_id BIGINT NOT NULL REFERENCES membership_addons(id) ON DELETE RESTRICT,
    quantity INT DEFAULT 1 NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 6. TRAINERS / STAFF
-- ================================================================
CREATE TABLE IF NOT EXISTS staff_profiles (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    designation VARCHAR(80),
    joining_date DATE,
    payout_type payout_type_enum DEFAULT 'fixed' NOT NULL,
    monthly_fixed_salary NUMERIC(12,2),
    hourly_rate NUMERIC(12,2),
    commission_percentage NUMERIC(5,2),
    shift_start_time TIME,
    shift_end_time TIME,
    weekly_off SMALLINT DEFAULT 0,
    late_grace_minutes INT DEFAULT 20,
    half_day_late_threshold_minutes INT DEFAULT 120,
    overtime_grace_minutes INT DEFAULT 20,
    overtime_multiplier NUMERIC(5,2) DEFAULT 1.5,
    early_departure_grace_minutes INT DEFAULT 20,
    permissions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_org_employee_code UNIQUE (organization_id, employee_code)
);

CREATE TABLE IF NOT EXISTS staff_attendance (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    staff_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
    attendance_date DATE NOT NULL,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    worked_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    late_minutes INT DEFAULT 0,
    early_departure_minutes INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'present' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_staff_attendance_day UNIQUE (staff_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS staff_shifts (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    name VARCHAR(80) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_shift_assignments (
    id BIGSERIAL PRIMARY KEY,
    staff_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    shift_id BIGINT NOT NULL REFERENCES staff_shifts(id) ON DELETE RESTRICT,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_leaves (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    leave_type VARCHAR(40) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days NUMERIC(5,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' NOT NULL,
    reason TEXT,
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_salary_runs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    month SMALLINT NOT NULL,
    year SMALLINT NOT NULL,
    status VARCHAR(30) DEFAULT 'draft' NOT NULL,
    processed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_salary_run UNIQUE (branch_id, month, year)
);

CREATE TABLE IF NOT EXISTS staff_salary_items (
    id BIGSERIAL PRIMARY KEY,
    salary_run_id BIGINT NOT NULL REFERENCES staff_salary_runs(id) ON DELETE CASCADE,
    staff_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
    basic_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    overtime_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    commission_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    deduction_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    net_amount NUMERIC(12,2) NOT NULL,
    payment_status VARCHAR(30) DEFAULT 'unpaid' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_salary_payments (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    salary_item_id BIGINT NOT NULL REFERENCES staff_salary_items(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL,
    payment_method payment_method_enum NOT NULL,
    transaction_reference VARCHAR(150),
    paid_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    paid_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS trainer_specializations (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_org_specialization UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS trainer_specialization_assignments (
    id BIGSERIAL PRIMARY KEY,
    trainer_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    specialization_id BIGINT NOT NULL REFERENCES trainer_specializations(id) ON DELETE CASCADE,
    CONSTRAINT uq_trainer_specialization UNIQUE (trainer_id, specialization_id)
);

CREATE TABLE IF NOT EXISTS trainer_members (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    trainer_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    assigned_from DATE NOT NULL,
    assigned_to DATE,
    status VARCHAR(30) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 7. HEALTH / FITNESS / MEASUREMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS member_health_profiles (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    medical_notes TEXT,
    allergies TEXT,
    medications TEXT,
    emergency_medical_notes TEXT,
    doctor_name VARCHAR(100),
    doctor_phone VARCHAR(20),
    fitness_clearance BOOLEAN,
    clearance_date DATE,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS member_medical_conditions (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    condition_name VARCHAR(150) NOT NULL,
    severity VARCHAR(30),
    notes TEXT,
    diagnosed_on DATE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS member_injuries (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    injury_name VARCHAR(150) NOT NULL,
    body_part VARCHAR(80),
    occurred_on DATE,
    recovery_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS member_fitness_profiles (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    fitness_level VARCHAR(30),
    primary_goal VARCHAR(100),
    target_weight NUMERIC(6,2),
    target_body_fat NUMERIC(5,2),
    preferred_workout_days SMALLINT,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS member_goals (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    target_value NUMERIC(10,2),
    unit VARCHAR(30),
    target_date DATE,
    status VARCHAR(30) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS member_measurements (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    measured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    weight_kg NUMERIC(6,2),
    height_cm NUMERIC(6,2),
    bmi NUMERIC(6,2),
    body_fat_percent NUMERIC(5,2),
    muscle_mass_kg NUMERIC(6,2),
    chest_cm NUMERIC(6,2),
    waist_cm NUMERIC(6,2),
    hip_cm NUMERIC(6,2),
    biceps_cm NUMERIC(6,2),
    thigh_cm NUMERIC(6,2),
    neck_cm NUMERIC(6,2),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS member_body_composition (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    visceral_fat NUMERIC(6,2),
    water_percent NUMERIC(5,2),
    bone_mass_kg NUMERIC(6,2),
    basal_metabolic_rate NUMERIC(8,2),
    metabolic_age INT,
    device_name VARCHAR(100),
    notes TEXT
);

-- ================================================================
-- 8. EXERCISE / WORKOUT
-- ================================================================
CREATE TABLE IF NOT EXISTS exercise_categories (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    CONSTRAINT uq_exercise_category UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS exercises (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES exercise_categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    muscle_group VARCHAR(100),
    equipment VARCHAR(100),
    difficulty VARCHAR(30),
    video_url TEXT,
    image_url TEXT,
    instructions TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_templates (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    goal_type VARCHAR(80),
    duration_weeks INT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    day_number INT NOT NULL,
    sequence_no INT NOT NULL,
    sets INT,
    reps VARCHAR(50),
    weight_kg NUMERIC(8,2),
    rest_seconds INT,
    duration_seconds INT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS member_workout_plans (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    template_id BIGINT REFERENCES workout_templates(id) ON DELETE SET NULL,
    trainer_id BIGINT REFERENCES staff_profiles(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(30) DEFAULT 'active' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS member_workout_days (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    workout_plan_id BIGINT NOT NULL REFERENCES member_workout_plans(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    day_name VARCHAR(50),
    focus_area VARCHAR(100),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS member_workout_exercises (
    id BIGSERIAL PRIMARY KEY,
    workout_day_id BIGINT NOT NULL REFERENCES member_workout_days(id) ON DELETE CASCADE,
    exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    sequence_no INT NOT NULL,
    sets INT,
    reps VARCHAR(50),
    target_weight_kg NUMERIC(8,2),
    rest_seconds INT,
    duration_seconds INT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS workout_logs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    workout_day_id BIGINT REFERENCES member_workout_days(id) ON DELETE SET NULL,
    exercise_id BIGINT REFERENCES exercises(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sets_completed INT,
    reps_completed VARCHAR(50),
    weight_kg NUMERIC(8,2),
    duration_seconds INT,
    calories_burned NUMERIC(8,2),
    notes TEXT
);

-- ================================================================
-- 9. DIET / NUTRITION
-- ================================================================
CREATE TABLE IF NOT EXISTS foods (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    serving_size VARCHAR(80),
    calories NUMERIC(8,2),
    protein_g NUMERIC(8,2),
    carbs_g NUMERIC(8,2),
    fat_g NUMERIC(8,2),
    fiber_g NUMERIC(8,2),
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS diet_plans (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    goal_type VARCHAR(80),
    daily_calories NUMERIC(8,2),
    protein_g NUMERIC(8,2),
    carbs_g NUMERIC(8,2),
    fat_g NUMERIC(8,2),
    duration_days INT,
    instructions TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS diet_plan_meals (
    id BIGSERIAL PRIMARY KEY,
    diet_plan_id BIGINT NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
    meal_name VARCHAR(80) NOT NULL,
    meal_time TIME,
    sequence_no INT NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS diet_plan_foods (
    id BIGSERIAL PRIMARY KEY,
    meal_id BIGINT NOT NULL REFERENCES diet_plan_meals(id) ON DELETE CASCADE,
    food_id BIGINT NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
    quantity NUMERIC(10,2) NOT NULL,
    unit VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS member_diet_plans (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    diet_plan_id BIGINT NOT NULL REFERENCES diet_plans(id) ON DELETE RESTRICT,
    assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(30) DEFAULT 'active' NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS nutrition_logs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    logged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    meal_name VARCHAR(80),
    calories NUMERIC(8,2),
    protein_g NUMERIC(8,2),
    carbs_g NUMERIC(8,2),
    fat_g NUMERIC(8,2),
    notes TEXT
);

-- ================================================================
-- 10. ATTENDANCE / ACCESS
-- ================================================================
CREATE TABLE IF NOT EXISTS attendance_devices (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    device_name VARCHAR(100) NOT NULL,
    device_type attendance_device_enum NOT NULL,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    ip_address INET,
    api_token_hash VARCHAR(255) NOT NULL,
    direction VARCHAR(20) DEFAULT 'bidirectional' NOT NULL,
    status VARCHAR(20) DEFAULT 'online' NOT NULL,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    device_id BIGINT REFERENCES attendance_devices(id) ON DELETE SET NULL,
    check_in_time TIMESTAMPTZ NOT NULL,
    check_out_time TIMESTAMPTZ,
    checkin_method checkin_method_enum NOT NULL,
    access_granted BOOLEAN DEFAULT TRUE NOT NULL,
    denial_reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS access_credentials (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    credential_type VARCHAR(30) NOT NULL,
    credential_value_hash VARCHAR(255) NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    revoked_at TIMESTAMPTZ
);

-- ================================================================
-- 11. CLASSES / BATCHES
-- ================================================================
CREATE TABLE IF NOT EXISTS classes (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    max_capacity INT DEFAULT 20 NOT NULL,
    duration_minutes INT DEFAULT 60 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    price NUMERIC(12,2) DEFAULT 0.00 NOT NULL;
);

CREATE TABLE IF NOT EXISTS class_schedules (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    trainer_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' NOT NULL
);

CREATE TABLE IF NOT EXISTS class_bookings (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    class_schedule_id BIGINT NOT NULL REFERENCES class_schedules(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    booking_status class_booking_status_enum DEFAULT 'confirmed' NOT NULL,
    booked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cancelled_at TIMESTAMPTZ,
    CONSTRAINT uq_member_schedule_booking UNIQUE (class_schedule_id, member_id)
);

CREATE TABLE IF NOT EXISTS class_waitlists (
    id BIGSERIAL PRIMARY KEY,
    class_schedule_id BIGINT NOT NULL REFERENCES class_schedules(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    queue_position INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_waitlist_pos UNIQUE (class_schedule_id, queue_position),
    CONSTRAINT uq_waitlist_member UNIQUE (class_schedule_id, member_id)
);

-- ================================================================
-- 12. PT SESSIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS personal_training_plans (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    session_count INT NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    validity_days INT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_training_enrollments (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    trainer_id BIGINT NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
    plan_id BIGINT NOT NULL REFERENCES personal_training_plans(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE,
    sessions_total INT NOT NULL,
    sessions_used INT DEFAULT 0 NOT NULL,
    status VARCHAR(30) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_training_sessions (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    enrollment_id BIGINT NOT NULL REFERENCES personal_training_enrollments(id) ON DELETE CASCADE,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'scheduled' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 13. BILLING / INVOICES / PAYMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    tax_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    payment_status invoice_status_enum DEFAULT 'unpaid' NOT NULL,
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_org_invoice_num UNIQUE (organization_id, invoice_number),
    ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL;
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    reference_id BIGINT,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) DEFAULT 1 NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    tax_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    total_price NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_method payment_method_enum NOT NULL,
    gateway_transaction_id VARCHAR(150),
    transaction_reference VARCHAR(150),
    status payment_status_enum DEFAULT 'success' NOT NULL,
    received_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_allocations (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(12,2) NOT NULL,
    CONSTRAINT uq_payment_invoice UNIQUE (payment_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS refunds (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL,
    reason TEXT,
    refund_reference VARCHAR(150),
    status payment_status_enum DEFAULT 'pending' NOT NULL,
    processed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL,
    discount_value NUMERIC(12,2) NOT NULL,
    start_date DATE,
    end_date DATE,
    max_uses INT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    offer_id BIGINT REFERENCES offers(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    max_uses INT,
    used_count INT DEFAULT 0 NOT NULL,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    CONSTRAINT uq_org_coupon UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS coupon_usages (
    id BIGSERIAL PRIMARY KEY,
    coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
    invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
    discount_amount NUMERIC(12,2) NOT NULL,
    used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 14. EXPENSES / VENDORS / CASH
-- ================================================================
CREATE TABLE IF NOT EXISTS expense_categories (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_org_expense_category UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS vendors (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    tax_id_gst VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    category_id BIGINT REFERENCES expense_categories(id) ON DELETE SET NULL,
    vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method payment_method_enum,
    description TEXT,
    receipt_url TEXT,
    status expense_status_enum DEFAULT 'draft' NOT NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_transactions (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    vendor_id BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    reference VARCHAR(150),
    transaction_date DATE NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS cash_registers (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    register_name VARCHAR(80) NOT NULL,
    opening_balance NUMERIC(12,2) DEFAULT 0 NOT NULL,
    opened_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    closed_at TIMESTAMPTZ,
    closing_balance NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS cash_register_transactions (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    register_id BIGINT NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 15. LOCKERS
-- ================================================================
CREATE TABLE IF NOT EXISTS lockers (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    locker_number VARCHAR(30) NOT NULL,
    status locker_status_enum DEFAULT 'available' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_branch_locker UNIQUE (branch_id, locker_number)
);

CREATE TABLE IF NOT EXISTS locker_allocations (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    locker_id BIGINT NOT NULL REFERENCES lockers(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    security_deposit NUMERIC(12,2) DEFAULT 0 NOT NULL,
    monthly_rent NUMERIC(12,2) DEFAULT 0 NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 16. INVENTORY / PRODUCTS
-- ================================================================
CREATE TABLE IF NOT EXISTS product_categories (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uq_org_product_category UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES product_categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(80),
    barcode VARCHAR(100),
    unit VARCHAR(30) NOT NULL,
    purchase_price NUMERIC(12,2) DEFAULT 0 NOT NULL,
    selling_price NUMERIC(12,2) DEFAULT 0 NOT NULL,
    reorder_level NUMERIC(12,2) DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    CONSTRAINT uq_org_sku UNIQUE (organization_id, sku),
    ADD COLUMN created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
    ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 18.00 NOT NULL;
);

CREATE TABLE IF NOT EXISTS purchases (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
    purchase_number VARCHAR(50) NOT NULL,
    purchase_date DATE NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    tax_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'received' NOT NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_org_purchase_num UNIQUE (organization_id, purchase_number),
    ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL;
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id BIGSERIAL PRIMARY KEY,
    purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,3) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL,
    total_cost NUMERIC(12,2) NOT NULL,
    expiry_date DATE,
    batch_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL;
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(30) NOT NULL,
    quantity NUMERIC(12,3) NOT NULL,
    unit_cost NUMERIC(12,2),
    reference_type VARCHAR(50),
    reference_id BIGINT,
    reason TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    system_quantity NUMERIC(12,3) NOT NULL,
    actual_quantity NUMERIC(12,3) NOT NULL,
    difference_quantity NUMERIC(12,3) NOT NULL,
    reason TEXT,
    adjusted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 17. NOTIFICATIONS / WHATSAPP
-- ================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    subject VARCHAR(200),
    body_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    membership_expiry BOOLEAN DEFAULT TRUE NOT NULL,
    payment_reminder BOOLEAN DEFAULT TRUE NOT NULL,
    birthday BOOLEAN DEFAULT TRUE NOT NULL,
    attendance BOOLEAN DEFAULT TRUE NOT NULL,
    promotions BOOLEAN DEFAULT TRUE NOT NULL,
    whatsapp BOOLEAN DEFAULT TRUE NOT NULL,
    sms BOOLEAN DEFAULT TRUE NOT NULL,
    email BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(30) NOT NULL,
    template_id BIGINT REFERENCES notification_templates(id) ON DELETE SET NULL,
    recipient VARCHAR(150) NOT NULL,
    subject VARCHAR(200),
    message TEXT NOT NULL,
    status notification_status_enum DEFAULT 'queued' NOT NULL,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_name VARCHAR(100) NOT NULL,
    meta_template_id VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    language VARCHAR(10) DEFAULT 'en' NOT NULL,
    body_content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_phone VARCHAR(20) NOT NULL,
    template_id BIGINT REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
    meta_message_id VARCHAR(150),
    delivery_status VARCHAR(30) DEFAULT 'sent' NOT NULL,
    error_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    notification_template_id BIGINT REFERENCES notification_templates(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 18. SAAS PLANS / SUBSCRIPTIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS saas_plans (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_price NUMERIC(12,2) NOT NULL,
    yearly_price NUMERIC(12,2),
    max_branches INT,
    max_users INT,
    max_members INT,
    features JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS saas_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id BIGINT NOT NULL REFERENCES saas_plans(id) ON DELETE RESTRICT,
    status subscription_status_enum DEFAULT 'trial' NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    trial_end_date DATE,
    auto_renew BOOLEAN DEFAULT TRUE NOT NULL,
    gateway_subscription_id VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS saas_invoices (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id BIGINT REFERENCES saas_subscriptions(id) ON DELETE SET NULL,
    invoice_number VARCHAR(60) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    tax_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    status invoice_status_enum DEFAULT 'unpaid' NOT NULL,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_org_saas_invoice UNIQUE (organization_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS saas_payments (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id BIGINT REFERENCES saas_subscriptions(id) ON DELETE SET NULL,
    invoice_id BIGINT REFERENCES saas_invoices(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_method payment_method_enum NOT NULL,
    gateway_transaction_id VARCHAR(150),
    status payment_status_enum DEFAULT 'success' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 19. AUDIT / API / WEBHOOK / BACKUP
-- ================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    branch_id BIGINT REFERENCES branches(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    external_event_id VARCHAR(150),
    payload JSONB,
    response_code INT,
    processed BOOLEAN DEFAULT FALSE NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_logs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    backup_type VARCHAR(30) NOT NULL,
    storage_provider VARCHAR(50),
    storage_path TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'started' NOT NULL,
    file_size_bytes BIGINT,
    checksum VARCHAR(128),
    error_message TEXT
);

-- ================================================================
-- 20. SYSTEM CONFIGURATION
-- ================================================================
CREATE TABLE IF NOT EXISTS organization_settings (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata' NOT NULL,
    date_format VARCHAR(30) DEFAULT 'DD-MM-YYYY',
    invoice_prefix VARCHAR(20) DEFAULT 'INV',
    member_code_prefix VARCHAR(20) DEFAULT 'MEM',
    tax_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS branch_settings (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ================================================================
-- 21. INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_members_org_branch ON members(organization_id, primary_branch_id);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(organization_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_rfid ON members(organization_id, barcode_rfid) WHERE barcode_rfid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_status ON members(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_members_join_date ON members(organization_id, join_date);

CREATE INDEX IF NOT EXISTS idx_leads_org_branch_status ON leads(organization_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_followups_time ON lead_followups(followup_at);

CREATE INDEX IF NOT EXISTS idx_memberships_member ON memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_status_end ON memberships(organization_id, status, end_date);
CREATE INDEX IF NOT EXISTS idx_memberships_branch_dates ON memberships(branch_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_freezes_membership ON membership_freezes(membership_id);

CREATE INDEX IF NOT EXISTS idx_staff_org_branch ON staff_profiles(organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_salary_run_branch_date ON staff_salary_runs(branch_id, year, month);

CREATE INDEX IF NOT EXISTS idx_measurements_member_date ON member_measurements(member_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_body_comp_member_date ON member_body_composition(member_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_workout_logs_member_date ON workout_logs(member_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_member_date ON nutrition_logs(member_id, logged_at);

CREATE INDEX IF NOT EXISTS idx_attendance_lookup ON attendance(organization_id, branch_id, member_id, check_in_time);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(check_in_time);
CREATE INDEX IF NOT EXISTS idx_access_credentials_member ON access_credentials(member_id);

CREATE INDEX IF NOT EXISTS idx_class_schedule_time ON class_schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_class_booking_member ON class_bookings(member_id);

CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(organization_id, branch_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_org_member_date ON payments(organization_id, member_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON payment_allocations(invoice_id);

CREATE INDEX IF NOT EXISTS idx_expenses_org_branch_date ON expenses(organization_id, branch_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_date ON stock_movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON stock_movements(organization_id, branch_id, product_id);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(organization_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON whatsapp_message_logs(organization_id, delivery_status, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_org_date ON audit_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_org_date ON login_logs(organization_id, created_at);

COMMIT;

-- ================================================================
-- HASH ID IMPLEMENTATION NOTE
-- ================================================================
-- Generate public hash IDs in the application using cryptographically
-- random values. Do NOT expose BIGSERIAL ids in API/URLs/QR codes.
--
-- Recommended:
--   id       BIGINT  -> internal PK/FK only
--   hash_id  VARCHAR(32) UNIQUE -> public identifier
--
-- Example API:
--   /api/members/mbr_xxxxxxxxxxxxxxxxxxxxx
--
-- Keep organization_id on tenant-owned tables and always enforce
-- organization/branch authorization in the application/service layer.
--
-- IMPORTANT:
-- 1. Run this schema on a fresh database first.
-- 2. Do not run this blindly over an existing production database.
-- 3. Add migrations for future changes.
-- 4. Add updated_at triggers in the application/migration layer.
-- 5. Validate tenant ownership whenever accepting public hash_id input.
-- ================================================================


BEGIN;

-- 1. Impersonation Audit Table
CREATE TABLE IF NOT EXISTS saas_impersonation_logs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    super_admin_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    reason TEXT,
    ip_address INET,
    user_agent TEXT,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at TIMESTAMPTZ
);

-- 2. Platform Announcements Table (Global Banners for Gym Portals)
CREATE TABLE IF NOT EXISTS platform_announcements (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    banner_type VARCHAR(30) DEFAULT 'info' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    target_plan_id BIGINT REFERENCES saas_plans(id) ON DELETE SET NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMPTZ
);

-- 3. Platform Global Settings Table
CREATE TABLE IF NOT EXISTS platform_settings (
    id BIGSERIAL PRIMARY KEY,
    platform_name VARCHAR(100) DEFAULT 'GymSaaS Core' NOT NULL,
    default_trial_days INT DEFAULT 14 NOT NULL,
    maintenance_mode BOOLEAN DEFAULT FALSE NOT NULL,
    support_email VARCHAR(100),
    support_phone VARCHAR(20),
    settings JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Default global setting row insert karein
INSERT INTO platform_settings (platform_name, default_trial_days, maintenance_mode, support_email)
VALUES ('GymSaaS Enterprise Platform', 14, FALSE, 'support@gymsaas.com')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON saas_impersonation_logs(super_admin_user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON platform_announcements(is_active, expires_at);

COMMIT;

BEGIN;

-- ============================================================
-- EQUIPMENT MANAGEMENT & MAINTENANCE MODULE
-- Gym SaaS - PostgreSQL
-- ============================================================


-- ============================================================
-- 1. EQUIPMENT CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS equipment_categories (
    id BIGSERIAL PRIMARY KEY,

    hash_id VARCHAR(32) NOT NULL UNIQUE,

    organization_id BIGINT NOT NULL,
    branch_id BIGINT,

    name VARCHAR(100) NOT NULL,
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);


-- ============================================================
-- 2. EQUIPMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS equipment (
    id BIGSERIAL PRIMARY KEY,

    hash_id VARCHAR(32) NOT NULL UNIQUE,

    organization_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,

    category_id BIGINT,

    equipment_code VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,

    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(150),

    equipment_type VARCHAR(100),

    description TEXT,

    purchase_date DATE,
    purchase_price NUMERIC(12,2),

    supplier_name VARCHAR(150),
    supplier_contact VARCHAR(50),

    invoice_number VARCHAR(100),
    invoice_date DATE,

    warranty_start_date DATE,
    warranty_end_date DATE,

    installation_date DATE,

    location VARCHAR(150),

    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'inactive',
                'under_maintenance',
                'out_of_order',
                'retired',
                'disposed'
            )
        ),

    condition VARCHAR(30) NOT NULL DEFAULT 'good'
        CHECK (
            condition IN (
                'excellent',
                'good',
                'fair',
                'poor',
                'critical'
            )
        ),

    last_maintenance_date DATE,
    next_maintenance_date DATE,

    maintenance_frequency_days INTEGER
        CHECK (
            maintenance_frequency_days IS NULL
            OR maintenance_frequency_days > 0
        ),

    expected_lifespan_years NUMERIC(5,2)
        CHECK (
            expected_lifespan_years IS NULL
            OR expected_lifespan_years > 0
        ),

    current_meter_reading NUMERIC(12,2),

    notes TEXT,

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_equipment_org_code
        UNIQUE (organization_id, equipment_code),

    CONSTRAINT uq_equipment_serial
        UNIQUE (organization_id, serial_number)
);


-- ============================================================
-- 3. EQUIPMENT MAINTENANCE SCHEDULE
-- ============================================================

CREATE TABLE IF NOT EXISTS equipment_maintenance (
    id BIGSERIAL PRIMARY KEY,

    hash_id VARCHAR(32) NOT NULL UNIQUE,

    organization_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,

    equipment_id BIGINT NOT NULL,

    maintenance_type VARCHAR(50) NOT NULL DEFAULT 'preventive'
        CHECK (
            maintenance_type IN (
                'preventive',
                'corrective',
                'inspection',
                'calibration',
                'cleaning',
                'lubrication',
                'safety_check',
                'other'
            )
        ),

    title VARCHAR(200) NOT NULL,

    description TEXT,

    scheduled_date DATE NOT NULL,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    status VARCHAR(30) NOT NULL DEFAULT 'scheduled'
        CHECK (
            status IN (
                'scheduled',
                'in_progress',
                'completed',
                'cancelled',
                'overdue'
            )
        ),

    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (
            priority IN (
                'low',
                'medium',
                'high',
                'critical'
            )
        ),

    assigned_to BIGINT,

    vendor_name VARCHAR(150),
    technician_name VARCHAR(150),
    technician_contact VARCHAR(50),

    estimated_cost NUMERIC(12,2)
        CHECK (
            estimated_cost IS NULL
            OR estimated_cost >= 0
        ),

    actual_cost NUMERIC(12,2)
        CHECK (
            actual_cost IS NULL
            OR actual_cost >= 0
        ),

    parts_cost NUMERIC(12,2)
        CHECK (
            parts_cost IS NULL
            OR parts_cost >= 0
        ),

    labor_cost NUMERIC(12,2)
        CHECK (
            labor_cost IS NULL
            OR labor_cost >= 0
        ),

    invoice_number VARCHAR(100),

    warranty_claim BOOLEAN NOT NULL DEFAULT FALSE,

    warranty_claim_number VARCHAR(100),

    work_performed TEXT,

    parts_replaced TEXT,

    before_condition VARCHAR(30),

    after_condition VARCHAR(30),

    next_maintenance_date DATE,

    notes TEXT,

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ
);


-- ============================================================
-- 4. EQUIPMENT SERVICE LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS equipment_service_logs (
    id BIGSERIAL PRIMARY KEY,

    hash_id VARCHAR(32) NOT NULL UNIQUE,

    organization_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,

    equipment_id BIGINT NOT NULL,

    maintenance_id BIGINT,

    service_date DATE NOT NULL,

    service_type VARCHAR(50) NOT NULL DEFAULT 'routine'
        CHECK (
            service_type IN (
                'routine',
                'repair',
                'inspection',
                'replacement',
                'installation',
                'calibration',
                'emergency',
                'other'
            )
        ),

    service_title VARCHAR(200) NOT NULL,

    service_description TEXT,

    performed_by_type VARCHAR(30)
        CHECK (
            performed_by_type IN (
                'staff',
                'vendor',
                'technician',
                'manufacturer',
                'other'
            )
        ),

    performed_by BIGINT,

    technician_name VARCHAR(150),
    technician_contact VARCHAR(50),

    vendor_name VARCHAR(150),
    vendor_contact VARCHAR(50),

    parts_used TEXT,

    labor_hours NUMERIC(8,2)
        CHECK (
            labor_hours IS NULL
            OR labor_hours >= 0
        ),

    service_cost NUMERIC(12,2)
        CHECK (
            service_cost IS NULL
            OR service_cost >= 0
        ),

    parts_cost NUMERIC(12,2)
        CHECK (
            parts_cost IS NULL
            OR parts_cost >= 0
        ),

    labor_cost NUMERIC(12,2)
        CHECK (
            labor_cost IS NULL
            OR labor_cost >= 0
        ),

    invoice_number VARCHAR(100),

    warranty_service BOOLEAN NOT NULL DEFAULT FALSE,

    warranty_claim_number VARCHAR(100),

    meter_reading NUMERIC(12,2),

    condition_before VARCHAR(30),

    condition_after VARCHAR(30),

    service_result VARCHAR(30) NOT NULL DEFAULT 'completed'
        CHECK (
            service_result IN (
                'completed',
                'partially_completed',
                'requires_followup',
                'failed'
            )
        ),

    next_service_date DATE,

    notes TEXT,

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ
);


-- ============================================================
-- 5. EQUIPMENT INCIDENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS equipment_incidents (
    id BIGSERIAL PRIMARY KEY,

    hash_id VARCHAR(32) NOT NULL UNIQUE,

    organization_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,

    equipment_id BIGINT NOT NULL,

    incident_number VARCHAR(100) NOT NULL,

    incident_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    incident_type VARCHAR(50) NOT NULL DEFAULT 'breakdown'
        CHECK (
            incident_type IN (
                'breakdown',
                'damage',
                'malfunction',
                'safety_issue',
                'user_damage',
                'electrical_issue',
                'water_damage',
                'other'
            )
        ),

    severity VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (
            severity IN (
                'low',
                'medium',
                'high',
                'critical'
            )
        ),

    title VARCHAR(200) NOT NULL,

    description TEXT NOT NULL,

    reported_by BIGINT,

    reported_by_name VARCHAR(150),

    immediate_action TEXT,

    equipment_stopped BOOLEAN NOT NULL DEFAULT FALSE,

    safety_risk BOOLEAN NOT NULL DEFAULT FALSE,

    maintenance_required BOOLEAN NOT NULL DEFAULT TRUE,

    maintenance_id BIGINT,

    resolution_status VARCHAR(30) NOT NULL DEFAULT 'open'
        CHECK (
            resolution_status IN (
                'open',
                'investigating',
                'maintenance_scheduled',
                'in_progress',
                'resolved',
                'closed',
                'cancelled'
            )
        ),

    resolved_at TIMESTAMPTZ,

    resolved_by BIGINT,

    resolution_notes TEXT,

    downtime_started_at TIMESTAMPTZ,

    downtime_ended_at TIMESTAMPTZ,

    downtime_minutes INTEGER
        CHECK (
            downtime_minutes IS NULL
            OR downtime_minutes >= 0
        ),

    estimated_loss NUMERIC(12,2)
        CHECK (
            estimated_loss IS NULL
            OR estimated_loss >= 0
        ),

    actual_repair_cost NUMERIC(12,2)
        CHECK (
            actual_repair_cost IS NULL
            OR actual_repair_cost >= 0
        ),

    attachments JSONB NOT NULL DEFAULT '[]'::JSONB,

    notes TEXT,

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_equipment_incident_number
        UNIQUE (organization_id, incident_number)
);


-- ============================================================
-- FOREIGN KEYS
-- ============================================================


-- Equipment Categories
ALTER TABLE equipment_categories
    ADD CONSTRAINT fk_equipment_categories_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id);

ALTER TABLE equipment_categories
    ADD CONSTRAINT fk_equipment_categories_branch
    FOREIGN KEY (branch_id)
    REFERENCES branches(id);


-- Equipment
ALTER TABLE equipment
    ADD CONSTRAINT fk_equipment_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id);

ALTER TABLE equipment
    ADD CONSTRAINT fk_equipment_branch
    FOREIGN KEY (branch_id)
    REFERENCES branches(id);

ALTER TABLE equipment
    ADD CONSTRAINT fk_equipment_category
    FOREIGN KEY (category_id)
    REFERENCES equipment_categories(id)
    ON DELETE SET NULL;


-- Maintenance
ALTER TABLE equipment_maintenance
    ADD CONSTRAINT fk_equipment_maintenance_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id);

ALTER TABLE equipment_maintenance
    ADD CONSTRAINT fk_equipment_maintenance_branch
    FOREIGN KEY (branch_id)
    REFERENCES branches(id);

ALTER TABLE equipment_maintenance
    ADD CONSTRAINT fk_equipment_maintenance_equipment
    FOREIGN KEY (equipment_id)
    REFERENCES equipment(id)
    ON DELETE RESTRICT;


-- Service Logs
ALTER TABLE equipment_service_logs
    ADD CONSTRAINT fk_equipment_service_logs_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id);

ALTER TABLE equipment_service_logs
    ADD CONSTRAINT fk_equipment_service_logs_branch
    FOREIGN KEY (branch_id)
    REFERENCES branches(id);

ALTER TABLE equipment_service_logs
    ADD CONSTRAINT fk_equipment_service_logs_equipment
    FOREIGN KEY (equipment_id)
    REFERENCES equipment(id)
    ON DELETE RESTRICT;

ALTER TABLE equipment_service_logs
    ADD CONSTRAINT fk_equipment_service_logs_maintenance
    FOREIGN KEY (maintenance_id)
    REFERENCES equipment_maintenance(id)
    ON DELETE SET NULL;


-- Incidents
ALTER TABLE equipment_incidents
    ADD CONSTRAINT fk_equipment_incidents_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id);

ALTER TABLE equipment_incidents
    ADD CONSTRAINT fk_equipment_incidents_branch
    FOREIGN KEY (branch_id)
    REFERENCES branches(id);

ALTER TABLE equipment_incidents
    ADD CONSTRAINT fk_equipment_incidents_equipment
    FOREIGN KEY (equipment_id)
    REFERENCES equipment(id)
    ON DELETE RESTRICT;

ALTER TABLE equipment_incidents
    ADD CONSTRAINT fk_equipment_incidents_maintenance
    FOREIGN KEY (maintenance_id)
    REFERENCES equipment_maintenance(id)
    ON DELETE SET NULL;


-- ============================================================
-- INDEXES
-- ============================================================


-- Equipment Categories
CREATE INDEX IF NOT EXISTS idx_equipment_categories_org
    ON equipment_categories(organization_id);

CREATE INDEX IF NOT EXISTS idx_equipment_categories_branch
    ON equipment_categories(branch_id);

CREATE INDEX IF NOT EXISTS idx_equipment_categories_active
    ON equipment_categories(organization_id, is_active);


-- Equipment
CREATE INDEX IF NOT EXISTS idx_equipment_org
    ON equipment(organization_id);

CREATE INDEX IF NOT EXISTS idx_equipment_branch
    ON equipment(branch_id);

CREATE INDEX IF NOT EXISTS idx_equipment_category
    ON equipment(category_id);

CREATE INDEX IF NOT EXISTS idx_equipment_status
    ON equipment(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_equipment_condition
    ON equipment(organization_id, condition);

CREATE INDEX IF NOT EXISTS idx_equipment_next_maintenance
    ON equipment(branch_id, next_maintenance_date);

CREATE INDEX IF NOT EXISTS idx_equipment_warranty
    ON equipment(organization_id, warranty_end_date);

CREATE INDEX IF NOT EXISTS idx_equipment_deleted
    ON equipment(organization_id, deleted_at);


-- Maintenance
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_org
    ON equipment_maintenance(organization_id);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_branch
    ON equipment_maintenance(branch_id);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment
    ON equipment_maintenance(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_status
    ON equipment_maintenance(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_schedule
    ON equipment_maintenance(branch_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_priority
    ON equipment_maintenance(organization_id, priority);


-- Service Logs
CREATE INDEX IF NOT EXISTS idx_equipment_service_logs_org
    ON equipment_service_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_equipment_service_logs_branch
    ON equipment_service_logs(branch_id);

CREATE INDEX IF NOT EXISTS idx_equipment_service_logs_equipment
    ON equipment_service_logs(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_service_logs_date
    ON equipment_service_logs(branch_id, service_date);

CREATE INDEX IF NOT EXISTS idx_equipment_service_logs_maintenance
    ON equipment_service_logs(maintenance_id);


-- Incidents
CREATE INDEX IF NOT EXISTS idx_equipment_incidents_org
    ON equipment_incidents(organization_id);

CREATE INDEX IF NOT EXISTS idx_equipment_incidents_branch
    ON equipment_incidents(branch_id);

CREATE INDEX IF NOT EXISTS idx_equipment_incidents_equipment
    ON equipment_incidents(equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_incidents_status
    ON equipment_incidents(organization_id, resolution_status);

CREATE INDEX IF NOT EXISTS idx_equipment_incidents_severity
    ON equipment_incidents(organization_id, severity);

CREATE INDEX IF NOT EXISTS idx_equipment_incidents_date
    ON equipment_incidents(branch_id, incident_date);


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_equipment_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


CREATE OR REPLACE TRIGGER trg_equipment_categories_updated_at
BEFORE UPDATE ON equipment_categories
FOR EACH ROW
EXECUTE FUNCTION update_equipment_updated_at();


CREATE OR REPLACE TRIGGER trg_equipment_updated_at
BEFORE UPDATE ON equipment
FOR EACH ROW
EXECUTE FUNCTION update_equipment_updated_at();


CREATE OR REPLACE TRIGGER trg_equipment_maintenance_updated_at
BEFORE UPDATE ON equipment_maintenance
FOR EACH ROW
EXECUTE FUNCTION update_equipment_updated_at();


CREATE OR REPLACE TRIGGER trg_equipment_service_logs_updated_at
BEFORE UPDATE ON equipment_service_logs
FOR EACH ROW
EXECUTE FUNCTION update_equipment_updated_at();


CREATE OR REPLACE TRIGGER trg_equipment_incidents_updated_at
BEFORE UPDATE ON equipment_incidents
FOR EACH ROW
EXECUTE FUNCTION update_equipment_updated_at();


COMMIT;
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. EQUIPMENT CATEGORIES
CREATE TABLE IF NOT EXISTS equipment_categories (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_category_name_active
    ON equipment_categories (organization_id, lower(name))
    WHERE deleted_at IS NULL;

-- 2. EQUIPMENT MASTER
CREATE TABLE IF NOT EXISTS equipment (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES equipment_categories(id) ON DELETE SET NULL,
    equipment_code VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(150),
    equipment_type VARCHAR(50) DEFAULT 'cardio',
    description TEXT,
    purchase_date DATE,
    purchase_price NUMERIC(12,2) DEFAULT 0.00,
    supplier_name VARCHAR(150),
    supplier_contact VARCHAR(50),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    warranty_start_date DATE,
    warranty_end_date DATE,
    installation_date DATE,
    location VARCHAR(150),
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'under_maintenance', 'out_of_order', 'retired', 'disposed')),
    condition VARCHAR(30) NOT NULL DEFAULT 'good'
        CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'critical')),
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_frequency_days INTEGER CHECK (maintenance_frequency_days IS NULL OR maintenance_frequency_days > 0),
    expected_lifespan_years NUMERIC(5,2) CHECK (expected_lifespan_years IS NULL OR expected_lifespan_years > 0),
    current_meter_reading NUMERIC(12,2),
    total_downtime_minutes BIGINT DEFAULT 0 NOT NULL,
    failure_count INT DEFAULT 0 NOT NULL,
    qr_token VARCHAR(64) NOT NULL UNIQUE,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_org_code_active
    ON equipment (organization_id, equipment_code)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_org_serial_active
    ON equipment (organization_id, serial_number)
    WHERE deleted_at IS NULL AND serial_number IS NOT NULL;

-- 3. STATUS CHANGE AUDIT TRAIL
CREATE TABLE IF NOT EXISTS equipment_status_history (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    equipment_id BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    old_condition VARCHAR(30),
    new_condition VARCHAR(30),
    reason TEXT,
    reference_type VARCHAR(30),
    reference_id BIGINT,
    changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. EQUIPMENT MAINTENANCE SCHEDULES & REPAIRS
CREATE TABLE IF NOT EXISTS equipment_maintenance (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    equipment_id BIGINT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
    maintenance_type VARCHAR(50) NOT NULL DEFAULT 'preventive'
        CHECK (maintenance_type IN ('preventive', 'corrective', 'inspection', 'calibration', 'cleaning', 'lubrication', 'safety_check', 'other')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'overdue')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name VARCHAR(150),
    technician_name VARCHAR(150),
    technician_contact VARCHAR(50),
    estimated_cost NUMERIC(12,2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    actual_cost NUMERIC(12,2) CHECK (actual_cost IS NULL OR actual_cost >= 0),
    parts_cost NUMERIC(12,2) CHECK (parts_cost IS NULL OR parts_cost >= 0),
    labor_cost NUMERIC(12,2) CHECK (labor_cost IS NULL OR labor_cost >= 0),
    invoice_number VARCHAR(100),
    warranty_claim BOOLEAN NOT NULL DEFAULT FALSE,
    warranty_claim_number VARCHAR(100),
    work_performed TEXT,
    parts_replaced TEXT,
    before_condition VARCHAR(30) CHECK (before_condition IS NULL OR before_condition IN ('excellent','good','fair','poor','critical')),
    after_condition VARCHAR(30) CHECK (after_condition IS NULL OR after_condition IN ('excellent','good','fair','poor','critical')),
    next_maintenance_date DATE,
    expense_id BIGINT REFERENCES expenses(id) ON DELETE SET NULL,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 5. PERMANENT SERVICE LOGS
CREATE TABLE IF NOT EXISTS equipment_service_logs (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    equipment_id BIGINT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
    maintenance_id BIGINT REFERENCES equipment_maintenance(id) ON DELETE SET NULL,
    service_date DATE NOT NULL,
    service_type VARCHAR(50) NOT NULL DEFAULT 'routine',
    service_title VARCHAR(200) NOT NULL,
    service_description TEXT,
    technician_name VARCHAR(150),
    technician_contact VARCHAR(50),
    vendor_name VARCHAR(150),
    parts_used TEXT,
    labor_hours NUMERIC(8,2),
    service_cost NUMERIC(12,2) DEFAULT 0.00,
    parts_cost NUMERIC(12,2) DEFAULT 0.00,
    labor_cost NUMERIC(12,2) DEFAULT 0.00,
    invoice_number VARCHAR(100),
    warranty_service BOOLEAN NOT NULL DEFAULT FALSE,
    meter_reading NUMERIC(12,2),
    condition_before VARCHAR(30),
    condition_after VARCHAR(30),
    service_result VARCHAR(30) NOT NULL DEFAULT 'completed',
    next_service_date DATE,
    expense_id BIGINT REFERENCES expenses(id) ON DELETE SET NULL,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. INCIDENTS / BREAKDOWN TICKETS
CREATE TABLE IF NOT EXISTS equipment_incidents (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    equipment_id BIGINT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
    incident_number VARCHAR(100) NOT NULL,
    incident_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    incident_type VARCHAR(50) NOT NULL DEFAULT 'breakdown',
    severity VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    reported_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reported_by_name VARCHAR(150),
    immediate_action TEXT,
    equipment_stopped BOOLEAN NOT NULL DEFAULT FALSE,
    safety_risk BOOLEAN NOT NULL DEFAULT FALSE,
    maintenance_required BOOLEAN NOT NULL DEFAULT TRUE,
    maintenance_id BIGINT REFERENCES equipment_maintenance(id) ON DELETE SET NULL,
    resolution_status VARCHAR(30) NOT NULL DEFAULT 'open'
        CHECK (resolution_status IN ('open', 'investigating', 'maintenance_scheduled', 'in_progress', 'resolved', 'closed', 'cancelled')),
    resolved_at TIMESTAMPTZ,
    resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    downtime_started_at TIMESTAMPTZ,
    downtime_ended_at TIMESTAMPTZ,
    downtime_minutes INTEGER,
    estimated_loss NUMERIC(12,2),
    attachments JSONB NOT NULL DEFAULT '[]'::JSONB,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_equipment_incident_number UNIQUE (organization_id, incident_number)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_eq_branch_status ON equipment(branch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_eq_next_maint ON equipment(branch_id, next_maintenance_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_eq_qr ON equipment(qr_token) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maint_branch_status ON equipment_maintenance(branch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_branch_status ON equipment_incidents(branch_id, resolution_status) WHERE deleted_at IS NULL;

-- Enable RLS on core tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- Create policy so queries can only ever view their own organization's records
CREATE POLICY org_isolation_members ON members
    FOR ALL
    USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::BIGINT);

CREATE POLICY org_isolation_invoices ON invoices
    FOR ALL
    USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::BIGINT);
COMMIT;
BEGIN;

-- 1. Membership plans par bhi RLS enable karein
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

-- 2. Organization Isolation Policy for Membership Plans
DROP POLICY IF EXISTS org_isolation_plans ON membership_plans;
CREATE POLICY org_isolation_plans ON membership_plans
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_org_id', true), '')::BIGINT
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- 3. Complete missing RLS Policy for Equipment
DROP POLICY IF EXISTS org_isolation_equipment ON equipment;
CREATE POLICY org_isolation_equipment ON equipment
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_org_id', true), '')::BIGINT
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- 4. Invoices aur Members ke Super Admin bypass policies update karein
DROP POLICY IF EXISTS org_isolation_members ON members;
CREATE POLICY org_isolation_members ON members
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_org_id', true), '')::BIGINT
        OR current_setting('app.is_super_admin', true) = 'true'
    );

DROP POLICY IF EXISTS org_isolation_invoices ON invoices;
CREATE POLICY org_isolation_invoices ON invoices
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_org_id', true), '')::BIGINT
        OR current_setting('app.is_super_admin', true) = 'true'
    );
-- 1. Subscription status enum me pending_approval add karein
ALTER TYPE subscription_status_enum ADD VALUE IF NOT EXISTS 'pending_approval';

-- 2. Organization status enum me bhi pending_approval add karein
ALTER TYPE org_status_enum ADD VALUE IF NOT EXISTS 'pending_approval';
COMMIT;
BEGIN;

-- 1. Purchases table me payment tracking columns add karein
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
ADD COLUMN IF NOT EXISTS due_amount NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'unpaid' NOT NULL;

-- 2. Index for quick vendor balance lookup
CREATE INDEX IF NOT EXISTS idx_purchases_vendor_payment ON purchases(organization_id, vendor_id, payment_status);

COMMIT;
BEGIN;

-- 1. Purchases table me columns add karein (without strict generated dependency crash)
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL;

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'unpaid' NOT NULL;

-- 2. Agar due_amount pehle se nahi hai toh as generated column add karein
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='purchases' AND column_name='due_amount'
  ) THEN 
    ALTER TABLE purchases 
    ADD COLUMN due_amount NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED;
  END IF; 
END $$;

-- 3. Existing records ke status sanitize karein
UPDATE purchases 
SET payment_status = CASE 
  WHEN COALESCE(paid_amount, 0) >= total_amount THEN 'paid'
  WHEN COALESCE(paid_amount, 0) > 0 THEN 'partially_paid'
  ELSE 'unpaid'
END
WHERE payment_status IS NULL OR payment_status = 'unpaid';

COMMIT;
BEGIN;

-- 1. Purchase Returns Master (Debit Note)
CREATE TABLE IF NOT EXISTS purchase_returns (
    id BIGSERIAL PRIMARY KEY,
    hash_id VARCHAR(32) NOT NULL UNIQUE,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
    vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
    debit_note_number VARCHAR(50) NOT NULL,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    tax_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    cgst_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    sgst_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    igst_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    reason TEXT NOT NULL,
    refund_type VARCHAR(30) DEFAULT 'debit_note' NOT NULL CHECK (refund_type IN ('debit_note', 'bank_refund', 'cash_refund')),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_org_debit_note UNIQUE (organization_id, debit_note_number)
);

-- 2. Line Items returned in Debit Note
CREATE TABLE IF NOT EXISTS purchase_return_items (
    id BIGSERIAL PRIMARY KEY,
    return_id BIGINT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,3) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL,
    tax_rate NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
    tax_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    batch_number VARCHAR(80),
    hsn_code VARCHAR(20)
);

-- 3. Indexes for Speed & Performance
CREATE INDEX IF NOT EXISTS idx_returns_org_purchase ON purchase_returns(organization_id, purchase_id);
CREATE INDEX IF NOT EXISTS idx_returns_branch_date ON purchase_returns(branch_id, return_date);
CREATE INDEX IF NOT EXISTS idx_return_items_prod ON purchase_return_items(product_id);

COMMIT;
BEGIN;

-- Failed attempts aur lockout timer track karne ke columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lockout_count INT DEFAULT 0 NOT NULL;

-- Query performance ke liye index
CREATE INDEX IF NOT EXISTS idx_users_login_lock ON users(phone, email, locked_until);

COMMIT;
BEGIN;

-- 1. Class bookings ko GST Invoices ke saath tie karein
ALTER TABLE class_bookings 
ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invoice_item_id BIGINT REFERENCES invoice_items(id) ON DELETE SET NULL;

-- 2. Performance indexes for real-time schedule & roster lookup
CREATE INDEX IF NOT EXISTS idx_class_bookings_schedule_invoice ON class_bookings(class_schedule_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_class_ref ON invoice_items(item_type, reference_id);

COMMIT;
BEGIN;

-- Receipt Sequence counter per Branch & Fiscal Year
CREATE TABLE IF NOT EXISTS receipt_sequences (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    fiscal_year VARCHAR(10) NOT NULL,
    current_counter BIGINT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_receipt_seq UNIQUE (organization_id, branch_id, fiscal_year)
);

-- Payments table me missing columns verify karein
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(60),
ADD COLUMN IF NOT EXISTS balance_after_payment NUMERIC(12,2) DEFAULT 0.00;

-- Class bookings ke saath invoice linkage
ALTER TABLE class_bookings 
ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invoice_item_id BIGINT REFERENCES invoice_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_bookings_invoice ON class_bookings(invoice_id);

COMMIT;
CREATE INDEX IF NOT EXISTS idx_locker_alloc_member ON locker_allocations(organization_id, member_id, status);
CREATE INDEX IF NOT EXISTS idx_locker_alloc_locker ON locker_allocations(locker_id, status);
CREATE INDEX IF NOT EXISTS idx_lockers_branch_status ON lockers(branch_id, status);
BEGIN;

-- Workout plan templates aur direct assignment indexing
CREATE INDEX IF NOT EXISTS idx_member_workout_active ON member_workout_plans(member_id, status);
CREATE INDEX IF NOT EXISTS idx_member_diet_active ON member_diet_plans(member_id, status);
CREATE INDEX IF NOT EXISTS idx_exercises_org_muscle ON exercises(organization_id, muscle_group);
CREATE INDEX IF NOT EXISTS idx_foods_org_name ON foods(organization_id, name);

-- Member weight & measurement index
CREATE INDEX IF NOT EXISTS idx_member_measurements_lookup ON member_measurements(member_id, measured_at DESC);

COMMIT;
BEGIN;

-- Add performance audit columns to personal_training_sessions
ALTER TABLE personal_training_sessions
ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 60 NOT NULL,
ADD COLUMN IF NOT EXISTS trainer_rating INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS verified_by_client BOOLEAN DEFAULT TRUE NOT NULL;

-- Add invoice reference to enrollments
ALTER TABLE personal_training_enrollments
ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- High-speed indexes for PT Desk
CREATE INDEX IF NOT EXISTS idx_pt_enroll_status ON personal_training_enrollments(member_id, trainer_id, status);
CREATE INDEX IF NOT EXISTS idx_pt_sess_enroll ON personal_training_sessions(enrollment_id, actual_start DESC);

COMMIT;
BEGIN;

ALTER TABLE vendor_transactions 
ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;

-- Existing records ko unke respective vendor ki organization ke sath link karein
UPDATE vendor_transactions vt
SET organization_id = v.organization_id
FROM vendors v
WHERE vt.vendor_id = v.id AND vt.organization_id IS NULL;

-- Fast ledger query ke liye index
CREATE INDEX IF NOT EXISTS idx_vendor_tx_org ON vendor_transactions(organization_id, vendor_id);

COMMIT;
BEGIN;

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS freight_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL;

COMMIT;
BEGIN;

-- 1. Purchases table me debit note adjustment track karne ka column
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS adjusted_debit_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL;

-- 2. Purchase Returns me settlement mode support
ALTER TABLE purchase_returns 
DROP CONSTRAINT IF EXISTS purchase_returns_refund_type_check;

ALTER TABLE purchase_returns 
ADD CONSTRAINT purchase_returns_refund_type_check 
CHECK (refund_type IN ('debit_note', 'bank_refund', 'cash_refund', 'vendor_credit'));

-- 3. Fast search index for vendor transactions
CREATE INDEX IF NOT EXISTS idx_vendor_tx_type ON vendor_transactions(vendor_id, transaction_type);

COMMIT;
BEGIN;

-- Ensure staff_profiles has complete payroll and shift parameters
ALTER TABLE staff_profiles
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS late_grace_minutes INT DEFAULT 20,
ADD COLUMN IF NOT EXISTS half_day_late_threshold_minutes INT DEFAULT 120,
ADD COLUMN IF NOT EXISTS overtime_grace_minutes INT DEFAULT 20,
ADD COLUMN IF NOT EXISTS overtime_multiplier NUMERIC(5,2) DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS early_departure_grace_minutes INT DEFAULT 20;

-- Ensure composite uniqueness for tenant integrity
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_user_branch_org 
ON staff_profiles (organization_id, user_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_lookup 
ON staff_profiles (organization_id, branch_id, is_active);

COMMIT;