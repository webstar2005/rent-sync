CREATE TABLE IF NOT EXISTS stk_push_pending (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference VARCHAR(64) NOT NULL UNIQUE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  tier_id VARCHAR(32) NOT NULL,
  checkout_request_id VARCHAR(64),
  merchant_request_id VARCHAR(64),
  mpesa_receipt VARCHAR(64),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  result_code INTEGER,
  result_desc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stk_push_pending_user ON stk_push_pending (user_id);
CREATE INDEX IF NOT EXISTS idx_stk_push_pending_checkout ON stk_push_pending (checkout_request_id);
