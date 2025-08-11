CREATE TABLE IF NOT EXISTS kyc_documents (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  kra_pin_url TEXT,
  national_id_url TEXT,
  bank_proof_url TEXT,
  passport_photo_url TEXT,
  kyc_status TEXT DEFAULT 'pending', -- 'verified', 'failed'
  kyc_tier INT DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS kyc_national_id (
  id SERIAL PRIMARY KEY,
  kyc_document_id INT NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  file_type VARCHAR(50), -- e.g., jpg, png
  file_size_kb INT,
  issuing_country VARCHAR(100),
  id_number VARCHAR(100),
  full_name TEXT,
  date_of_birth DATE,
  expiry_date DATE,
  gender VARCHAR(20),
  verification_status TEXT DEFAULT 'pending',
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kyc_kra_pin (
  id SERIAL PRIMARY KEY,
  kyc_document_id INT NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  file_type VARCHAR(50), -- e.g., pdf, jpg, png
  file_size_kb INT,
  issuing_authority VARCHAR(255), -- e.g., "Kenya Revenue Authority"
  document_number VARCHAR(100), -- KRA PIN number
  expiry_date DATE, -- if applicable
  verification_status TEXT DEFAULT 'pending',
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kyc_bank_proof (
  id SERIAL PRIMARY KEY,
  kyc_document_id INT NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  file_type VARCHAR(50), -- e.g., pdf, jpg
  file_size_kb INT,
  bank_name VARCHAR(255),
  account_number VARCHAR(50),
  account_holder_name VARCHAR(255),
  statement_period TEXT, -- e.g., "Jan 2025 - Mar 2025"
  verification_status TEXT DEFAULT 'pending',
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kyc_passport_photo (
  id SERIAL PRIMARY KEY,
  kyc_document_id INT NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  file_type VARCHAR(50), -- jpg, png
  file_size_kb INT,
  face_match_score NUMERIC(5,2), -- biometric comparison
  image_quality_score NUMERIC(5,2), -- optional, from an image quality check
  verification_status TEXT DEFAULT 'pending',
  verified_by VARCHAR(255),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
