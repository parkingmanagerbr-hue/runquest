import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rq: {
          lime: '#A8FF3E',
          emerald: '#3DD68C',
          violet: '#5B2EFF',
          orange: '#FF7A1A',
          gold: '#FFE15A',
          ink: '#0E0A2A',
          night: '#1A1240',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'rq-aurora':
          'radial-gradient(ellipse 1200px 600px at 10% -10%, rgba(91,46,255,0.35), transparent 60%), radial-gradient(ellipse 1000px 500px at 110% 110%, rgba(168,255,62,0.18), transparent 60%), linear-gradient(180deg, #0E0A2A 0%, #1A1240 60%, #0E0A2A 100%)',
      },
    },
  },
  plugins: [],
};
export default config;
