# HOG Tour Backend

## Configuration

Copier `.env.example` en `.env` puis renseigner :

- `PORT`
- `DATABASE_PATH`
- `PUBLIC_BASE_URL`
- `QR_SIGNING_SECRET`
- `PAYMENT_API_KEY` (clé partagée pour l’équipe paiements)

## API

### Public

- `GET /health`
- `GET /v1/badge?token=...&sig=...`
  - Page HTML du badge (QR + infos de base)
- `POST /v1/registrations`
  - Crée un inscrit + paiement (unpaid) + badge (token)
  - Réponse: `{ id, badge: { url } }`

### Paiements (x-api-key requis)

Ajouter l’en-tête: `x-api-key: <PAYMENT_API_KEY>`

- `GET /v1/qr?token=...&sig=...`
  - Résout un QR code (URL signée) et renvoie l’inscrit + statut paiement
- `POST /v1/admin/qr/resolve`
  - Body: `{ url }` ou `{ token, sig }`
- `GET /v1/admin/registrations`
- `GET /v1/admin/registrations/:id`
- `PATCH /v1/admin/registrations/:id/payment`
  - Body exemple:
    - `status`: `unpaid|pending|paid|cancelled|refunded`
    - `amountCents`, `currency`, `method`, `reference`
