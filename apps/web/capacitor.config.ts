import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuração do app nativo (Android/iOS) que envolve o PWA RunQuest.
 *
 * ESTRATÉGIA: server.url
 * ----------------------
 * Em vez de gerar um export estático (incompatível com as rotas dinâmicas
 * e o next-pwa deste projeto, que usa `output: 'standalone'`), o app nativo
 * carrega o web app já hospedado. O valor real do GPS em segundo plano vem
 * do plugin nativo (@capacitor-community/background-geolocation), que o
 * código web aciona através de `src/lib/geolocation.ts`.
 *
 * Defina CAP_SERVER_URL no ambiente de build para apontar para produção.
 * Em desenvolvimento, aponte para o seu dev server na LAN, ex:
 *   CAP_SERVER_URL=http://192.168.0.10:3000 npx cap sync
 */
const SERVER_URL = process.env.CAP_SERVER_URL ?? 'https://runquest.veloxisit.com.br';

const config: CapacitorConfig = {
  appId: 'com.veloxisit.runquest',
  appName: 'RunQuest',
  // webDir é exigido pelo Capacitor mesmo no modo server.url; serve só de fallback.
  webDir: 'public',
  server: {
    url: SERVER_URL,
    cleartext: SERVER_URL.startsWith('http://'), // permite HTTP só em dev local
    androidScheme: 'https',
  },
  plugins: {
    // O plugin de background-geolocation não tem config aqui — as opções
    // (título/mensagem da notificação, permissões) são passadas em addWatcher().
  },
};

export default config;
