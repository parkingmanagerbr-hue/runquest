import Link from 'next/link';
import { LogoMark } from '@/components/LogoMark';

export const metadata = {
  title: 'Política de Privacidade — RunQuest',
  description: 'Como o RunQuest coleta, usa e protege seus dados pessoais.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-rq-aurora px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <LogoMark className="w-10 h-10" />
          <span className="font-display text-xl">RunQuest</span>
        </Link>

        <article className="glass p-10 prose prose-invert max-w-none">
          <h1 className="font-display text-4xl font-black mb-2">Política de Privacidade</h1>
          <p className="text-white/50 text-sm mb-8">Última atualização: 24 de maio de 2026</p>

          <h2 className="text-2xl font-bold mt-8 mb-3">1. Quem somos</h2>
          <p>
            RunQuest é um aplicativo de corrida gamificado operado por Rovariz Serviços de Informática,
            sediado em Cambuí — MG, Brasil. Contato: <a href="mailto:contato@runquest.veloxisit.com.br" className="text-rq-lime hover:underline">contato@runquest.veloxisit.com.br</a>.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">2. Dados que coletamos</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Cadastro:</strong> nome, e-mail, senha (hash argon2id — nunca em texto claro).</li>
            <li><strong>Google OAuth:</strong> e-mail, nome, foto de perfil pública.</li>
            <li><strong>Strava (opcional):</strong> tokens OAuth criptografados (AES-256-GCM at-rest), histórico de corridas.</li>
            <li><strong>Atividade:</strong> trajetos GPS, distância, ritmo, calorias estimadas.</li>
            <li><strong>Dispositivo:</strong> user-agent e IP para auditoria de segurança de sessões.</li>
            <li><strong>Pagamento:</strong> processado integralmente pelo Mercado Pago — não armazenamos dados de cartão.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-3">3. Como usamos seus dados</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Autenticar e personalizar sua experiência.</li>
            <li>Calcular estatísticas, conquista de territórios e progresso de missões.</li>
            <li>Sincronizar atividades com o Strava (somente se você autorizar).</li>
            <li>Processar assinaturas Premium via Mercado Pago.</li>
            <li>Enviar notificações relevantes (opt-in).</li>
            <li>Melhorar o produto (analytics agregados e anonimizados).</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-3">4. Bases legais (LGPD)</h2>
          <p>
            Tratamos seus dados com base em: <strong>consentimento</strong> (cadastro, integrações),
            <strong> execução de contrato</strong> (assinatura Premium), <strong>obrigação legal</strong> (registros fiscais),
            e <strong>legítimo interesse</strong> (segurança, prevenção de fraude).
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">5. Compartilhamento</h2>
          <p>
            Não vendemos seus dados. Compartilhamos apenas com:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Mercado Pago</strong> — para processar pagamentos.</li>
            <li><strong>Google</strong> — quando você optar pelo login com Google (escopo: e-mail e perfil).</li>
            <li><strong>Strava</strong> — quando você conectar e autorizar a sincronização.</li>
            <li><strong>OpenAI/Anthropic/Gemini</strong> — apenas para gerar recomendações da IA (sem identificadores pessoais).</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-3">6. Segurança</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>HTTPS/TLS 1.2+ em todas as comunicações.</li>
            <li>Senhas via <strong>argon2id</strong> (64MB cost).</li>
            <li>Tokens de terceiros criptografados em repouso (<strong>AES-256-GCM</strong>).</li>
            <li>JWT com rotação de refresh + revogação por <em>jti</em>.</li>
            <li>Rate limiting e proteção CSRF/HMAC nos webhooks.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-3">7. Seus direitos (LGPD Art. 18)</h2>
          <p>Você pode a qualquer momento solicitar:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Confirmação de tratamento dos dados.</li>
            <li>Acesso e portabilidade.</li>
            <li>Correção de dados incompletos ou desatualizados.</li>
            <li>Anonimização, bloqueio ou eliminação.</li>
            <li>Revogação do consentimento.</li>
          </ul>
          <p>
            Envie pedidos para <a href="mailto:dpo@runquest.veloxisit.com.br" className="text-rq-lime hover:underline">dpo@runquest.veloxisit.com.br</a> — respondemos em até 15 dias.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">8. Retenção</h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão, dados são removidos em até 30 dias,
            exceto registros financeiros (mantidos por 5 anos por obrigação fiscal).
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">9. Cookies e PWA</h2>
          <p>
            Usamos <strong>localStorage</strong> para sessão (tokens JWT) e cache da PWA via Service Worker.
            Não usamos cookies de rastreamento de terceiros.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">10. Alterações</h2>
          <p>
            Atualizações desta política serão notificadas por e-mail e/ou banner no app com pelo menos 7 dias de antecedência.
          </p>

          <hr className="my-8 border-white/10" />
          <p className="text-sm text-white/50">
            Veja também os <Link href="/legal/terms" className="text-rq-lime hover:underline">Termos de Uso</Link>.
          </p>
        </article>
      </div>
    </main>
  );
}
