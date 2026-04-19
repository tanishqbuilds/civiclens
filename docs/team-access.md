# Team Access Notes

This document is for teammate onboarding and day-to-day access to API/env setup.

## API Endpoints (Current)

Node API base (local): `http://localhost:3001`

- `GET /api/tickets`
- `POST /api/tickets`
- `PATCH /api/tickets/:id`

Flask AI base (local): `http://localhost:5000`

- `POST /classify`
- `GET /health`

## Where to find key setup

- Environment keys: `docs/env-keys.md`
- API contracts: `docs/api-contracts.md`
- System design overview: `docs/architecture.md`

## Run Commands

Backend:
```bash
cd server
npm install
npm run dev
```

Frontend:
```bash
cd client
npm install
npm run dev
```

AI service (if needed):
```bash
cd ai-service
pip install -r requirements.txt
python app.py
```

## Collaboration Rules

- Do not commit real secrets.
- Share secrets through approved team channel/vault.
- Keep API/env docs updated when keys or endpoint contracts change.
