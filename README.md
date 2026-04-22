# Professional Real Estate Portal - Base System

Complete fullstack baseline for a professional real estate portal with:
- Public portal (properties, services, news, contact)
- CRM-like lead management
- Admin dashboard with metrics and CRUD
- Tokko Broker sync integration
- Email, PDF, and WhatsApp automation

## Tech Stack

### Backend
- PHP 8+ (REST API in backcrm)
- PostgreSQL
- JWT (access + refresh tokens)
- bcrypt (salt rounds: 10)
- AES-256 encryption for sensitive lead data
- cPanel cron for hourly Tokko sync
- mail() integration, Twilio API and dynamic PDF response
- CORS headers, sanitization and rate limiting

### Frontend
- React + Vite
- Tailwind CSS
- Axios
- AOS animations

## Project Structure

```text
.
├─ backcrm/
│  ├─ index.php
│  ├─ tokko_sync.php
│  ├─ .htaccess
│  ├─ config/
│  ├─ core/
│  └─ logs/
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ tailwind.config.js
│  └─ src/
│     ├─ App.jsx
│     ├─ components/
│     ├─ context/
│     ├─ layouts/
│     ├─ pages/
│     └─ services/
├─ database/
│  ├─ schema.sql
│  └─ seed.sql
├─ .env.example
└─ package.json
```

## Setup Instructions

1. Database (cPanel PostgreSQL already provided):
   - database: are_crm
   - user: are_user

2. Upload project in cPanel:
   - Upload backend PHP folder as backcrm
   - Upload frontend build as inmobiliario

3. Install frontend dependencies and build:

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

4. Run database scripts in PostgreSQL:

```bash
psql -U are_user -d are_crm -f database/schema.sql
psql -U are_user -d are_crm -f database/seed.sql
```

5. Local test (optional):

```bash
php -S localhost:8000 -t backcrm
npm --prefix frontend run dev
```

- Backend: http://localhost:8000/api
- Frontend: http://localhost:5173

6. cPanel Cron for Tokko sync (every hour):

php /home/USER/public_html/backcrm/tokko_sync.php

## Default Admin Access

- Email: `admin@portal.com`
- Password: `Admin123!`

## Main API Endpoints

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

- `GET /api/services`
- `POST /api/services`
- `PUT /api/services/:id`
- `DELETE /api/services/:id`
- `GET /api/services/:id/pdf`

- `GET /api/properties`
- `POST /api/properties`
- `PUT /api/properties/:id`
- `DELETE /api/properties/:id`
- `POST /api/properties/sync/tokko`

- `GET /api/articles`
- `POST /api/articles`
- `PUT /api/articles/:id`
- `DELETE /api/articles/:id`

- `POST /api/leads`
- `GET /api/leads`
- `PUT /api/leads/:id`
- `DELETE /api/leads/:id`

- `GET /api/dashboard/metrics`

## Security Notes

- Sensitive lead fields (`email`, `phone`) are encrypted using AES-256 before DB storage.
- Passwords are hashed with bcrypt (10 rounds).
- CORS, input validation, sanitization and rate limit are enabled.
- Use HTTPS in production behind reverse proxy.

## Tokko Integration

- Hourly sync configured via cPanel cron using backcrm/tokko_sync.php.
- If Tokko variables are missing, sync is skipped safely.

## Acceptance Coverage

- Backend modular structure: routes/controllers/models/middleware/services.
- Full CRUD implemented for services, leads, properties and articles.
- JWT login + refresh implemented.
- Lead notifications by email and WhatsApp integration implemented.
- Dynamic PDF generation by service endpoint implemented.
- Frontend fully connected with backend API and responsive pages.
