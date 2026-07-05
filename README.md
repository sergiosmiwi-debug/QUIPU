# QuipuRecicla

PWA mobile-first en español peruano para rastrear el vencimiento de alimentos en el hogar, con guía de reciclaje integrada.

## Estructura

- `frontend/` — Next.js (App Router) + TypeScript + Tailwind v4 + Phosphor Icons. Deploy en Vercel.
- `backend/` — FastAPI + SQLAlchemy + SQLite. Visión por IA con Groq (Llama 4 Scout). Deploy en Railway.

## Desarrollo local

```bash
# Backend (puerto 8010)
cd backend
python -m venv venv
venv/Scripts/pip install -r requirements.txt
# crea backend/.env con GROQ_API_KEY=...
venv/Scripts/python -m uvicorn main:app --port 8010

# Frontend (puerto 3000)
cd frontend
npm install
# .env.local: BACKEND_URL=http://localhost:8010
npm run dev
```

## Variables de entorno

| Dónde | Variable | Valor |
|---|---|---|
| Railway (backend) | `GROQ_API_KEY` | API key de Groq |
| Vercel (frontend) | `BACKEND_URL` | URL pública del backend en Railway |

## Arquitectura multi-usuario sin login

Cada navegador genera un `crypto.randomUUID()` persistido en `localStorage("qr_device_id")` y lo envía como header `X-Device-Id` en todas las llamadas. El frontend nunca llama al backend directo: todo pasa por el proxy `/api/*` (`app/api/[...path]/route.ts`), que reenvía el header al backend. El backend filtra toda query por `device_id`.
