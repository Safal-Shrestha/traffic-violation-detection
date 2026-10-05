
# Backend

Focuses on Rails environment setup, database migrations, and API contracts.

**Purpose:** Serves as the central control plane, processing REST requests, broadcasting WebSockets via Action Cable, and managing PostgreSQL/MinIO storage.

## Bootstrap the first admin

Officer creation is intentionally admin-only. To create the first administrator, provide
these environment variables and run the seeds:

```bash
ADMIN_NAME="System Admin" \
ADMIN_BADGE_NUMBER="ADMIN-001" \
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="change-this-password" \
bin/rails db:seed
```

The seed is idempotent for the configured email. Once the first admin exists, log in through
`POST /api/v1/auth/login` and use the authenticated `POST /api/v1/officers` endpoint to add
additional officers or administrators.