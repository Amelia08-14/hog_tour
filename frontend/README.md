# HOG Algeria 2026 — Next.js + Tailwind

## Structure des fichiers à copier

```
src/
├── app/
│   ├── globals.css        ← Remplace ton globals.css actuel
│   ├── layout.tsx         ← Remplace ton layout.tsx actuel
│   └── page.tsx           ← Remplace ton page.tsx actuel
└── components/
    ├── Nav.tsx            ← Remplace ton Nav.tsx actuel
    ├── Hero.tsx           ← NOUVEAU
    ├── Ticker.tsx         ← NOUVEAU
    ├── StatsBar.tsx       ← NOUVEAU
    ├── About.tsx          ← NOUVEAU
    ├── Programme.tsx      ← Remplace ton Programme.tsx actuel
    ├── Destination.tsx    ← NOUVEAU
    ├── Inscription.tsx    ← NOUVEAU
    ├── Gallery.tsx        ← NOUVEAU
    ├── Contact.tsx        ← NOUVEAU
    ├── Footer.tsx         ← NOUVEAU
    └── ScrollReveal.tsx   ← NOUVEAU

tailwind.config.ts         ← Remplace ton tailwind.config.ts actuel
```

---

## 1. Tailwind config

Remplace ton `tailwind.config.ts` par le fichier fourni.
Il ajoute les couleurs custom (`orange`, `bg`, `bg2`, `bg3`, `htext`, `muted`…)
et les fonts (`font-display`, `font-condensed`, `font-body`).

---

## 2. Fonts (Google Fonts)

Le `globals.css` importe automatiquement via CDN :
- **Bebas Neue** — titres épiques (`font-display`)
- **Barlow Condensed** — sous-titres (`font-condensed`)
- **Barlow** — corps de texte (`font-body`)

Si tu préfères `next/font/google` (recommandé pour la performance) :

```tsx
// src/app/layout.tsx
import { Bebas_Neue, Barlow_Condensed, Barlow } from 'next/font/google'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
})
const barlowCondensed = Barlow_Condensed({
  weight: ['300','400','600','700'],
  subsets: ['latin'],
  variable: '--font-condensed',
})
const barlow = Barlow({
  weight: ['300','400','500'],
  subsets: ['latin'],
  variable: '--font-body',
})

// Dans <html> :
// className={`${bebasNeue.variable} ${barlowCondensed.variable} ${barlow.variable}`}
```

---

## 3. Photos / Images

Dans `Gallery.tsx`, remplace les `<div>` placeholder par :

```tsx
import Image from 'next/image'

<Image
  src="/photos/ride-1.jpg"
  alt="HOG Tour ride"
  fill
  style={{ objectFit: 'cover' }}
/>
```

Mets tes photos dans `public/photos/`.

---

## 4. Formulaire de contact

`Contact.tsx` a un `handleSubmit` vide avec un `TODO`.
Options recommandées :

### Resend (le plus simple)
```bash
npm install resend
```
```ts
// src/app/api/contact/route.ts
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { prenom, email, message } = await req.json()
  await resend.emails.send({
    from: 'noreply@tondomaine.com',
    to: 'contact@hogalgierschapteralgeria.com',
    subject: `Message de ${prenom}`,
    text: message,
    replyTo: email,
  })
  return Response.json({ ok: true })
}
```

### Formspree (sans backend)
```tsx
<form action="https://formspree.io/f/TON_ID" method="POST">
```

---

## 5. i18n (FR / AR / EN)

```bash
npm install next-intl
```
Voir : https://next-intl-docs.vercel.app/docs/getting-started/app-router

---

## 6. Deploy Vercel

```bash
git add .
git commit -m "feat: HOG Algeria redesign"
vercel deploy
```
