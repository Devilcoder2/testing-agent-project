CREATE TABLE qa_customers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE ROLE qa_fixture_writer LOGIN PASSWORD 'qa-fixture-writer-development-only';
CREATE ROLE qa_diagnostic LOGIN PASSWORD 'qa-diagnostic-read-only-development-only';
REVOKE ALL ON DATABASE qa_fixture FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE qa_fixture TO qa_fixture_writer, qa_diagnostic;
GRANT USAGE ON SCHEMA public TO qa_fixture_writer, qa_diagnostic;
GRANT SELECT, INSERT, UPDATE ON qa_customers TO qa_fixture_writer;
GRANT USAGE, SELECT ON SEQUENCE qa_customers_id_seq TO qa_fixture_writer;
GRANT SELECT ON qa_customers TO qa_diagnostic;
