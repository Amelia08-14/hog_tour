## Déploiement (GitHub → VPS)

Objectif : 1 domaine, Nginx en reverse-proxy
- `/` → frontend Next.js (port 3000)
- `/v1/*` → backend Express (port 4000)

Le frontend appelle `/v1/registrations` (même origine), donc pas besoin de CORS ni de `NEXT_PUBLIC_API_BASE_URL` en prod.

### Prérequis VPS

- Ubuntu/Debian
- Node.js (recommandé 20+)
- Nginx

### Variables d’environnement

Créer `/etc/hogtour/backend.env` à partir de `deploy/env/backend.env.example` :

- `PUBLIC_BASE_URL` doit être l’URL publique réelle (ex: `https://hogtour2026.com`)
- `QR_SIGNING_SECRET` et `PAYMENT_API_KEY` doivent être des valeurs fortes

### Systemd

Copier :
- `deploy/systemd/hogtour-backend.service` → `/etc/systemd/system/hogtour-backend.service`
- `deploy/systemd/hogtour-frontend.service` → `/etc/systemd/system/hogtour-frontend.service`

Puis :
- `systemctl daemon-reload`
- `systemctl enable --now hogtour-backend hogtour-frontend`

### Nginx

Copier :
- `deploy/nginx/hogtour.conf` → `/etc/nginx/sites-available/hogtour`

Activer :
- `ln -s /etc/nginx/sites-available/hogtour /etc/nginx/sites-enabled/hogtour`
- `nginx -t && systemctl reload nginx`

### HTTPS (optionnel mais recommandé)

Une fois le domaine pointé vers le VPS :
- installer certbot (nginx)
- générer le certificat Let’s Encrypt
