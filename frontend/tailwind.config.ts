import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      /* ── Couleurs ── */
      colors: {
        orange:       '#FF6B00',
        'orange-dark':'#CC4E00',
        bg:    '#0A0A08',
        bg2:   '#111109',
        bg3:   '#181814',
        bg4:   '#1E1E18',
        htext: '#F0EBE0',
        muted: '#7A7568',
        muted2:'#5A5550',
      },
      /* ── Typographie ── */
      fontFamily: {
        display:   ['"Bebas Neue"', 'cursive'],
        condensed: ['"Barlow Condensed"', 'sans-serif'],
        body:      ['Barlow', 'sans-serif'],
      },
      /* ── Container ── */
      maxWidth: {
        container: '1160px',
      },
    },
  },
  plugins: [],
}

export default config
