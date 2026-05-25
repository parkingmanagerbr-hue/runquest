import Link from 'next/link';
import { LogoMark } from '@/components/LogoMark';

export const metadata = {
  title: 'Termos de Uso — RunQuest',
  description: 'Termos e condições de uso do app RunQuest.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-rq-aurora px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <LogoMark className="w-10 h-10" />
          <span className="font-display text-xl">RunQuest</span>
        </Link>

        <article className="glass p-10 prose prose-invert max-w-none">
          <h1 className="font-display text-4xl font-black mb-2">Termos de Uso</h1>
          <p className="text-white/50 text-sm mb-8">Última atualização: 24 de maio de 2026</p>

          <h2 className="text-2xl font-bold mt-8 mb-3">1. Aceitação</h2>
          <p>
            Ao criar conta ou usar o RunQuest, você concorda com estes Termos e com a{' '}
            <Link href="/legal/privacy" className="text-rq-lime hover:underline">Política de Privacidade</Link>.
            Se não concorda, não use o serviço.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">2. Descrição do serviço</h2>
          <p>
            RunQuest é um app de corrida com gamificação (conquista de territórios, missões, XP, ranking)
            e, no tier Premium, um Personal Trainer com IA (planos adaptativos, coach por voz, análise pós-corrida).
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">3. Conta de usuário</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Você deve ter no mínimo 13 anos para usar o serviço (16 anos sem consentimento parental para conta UE).</li>
            <li>Suas credenciais são pessoais e intransferíveis.</li>
            <li>Você é responsável por toda atividade na sua conta.</li>
            <li>Notifique imediatamente se suspeitar de acesso não autorizado.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-3">4. Plano Premium</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Mensal: R$ 19,90</strong> · renovação automática mensal.</li>
            <li><strong>Anual: R$ 149,90</strong> · renovação automática anual.</li>
            <li>Cobranças via Mercado Pago. Cancele a qualquer momento pelo painel — acesso permanece até o fim do período pago.</li>
            <li>Reembolso integral em até 7 dias da primeira cobrança (Código de Defesa do Consumidor).</li>
            <li>Não há reembolso parcial de períodos já consumidos.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-3">5. Conduta do usuário</h2>
          <p>Você concorda em <strong>não</strong>:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Trapacear (registrar corridas falsas, manipular GPS, scripts).</li>
            <li>Usar o serviço para atividade ilegal.</li>
            <li>Tentar comprometer a segurança ou disponibilidade.</li>
            <li>Fazer engenharia reversa ou raspagem automatizada.</li>
            <li>Assediar outros usuários ou postar conteúdo ofensivo.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-3">6. Conteúdo do usuário</h2>
          <p>
            Você mantém todos os direitos sobre suas corridas e dados pessoais.
            Concede ao RunQuest licença não-exclusiva, mundial e gratuita para processar,
            armazenar e exibir tais dados conforme necessário para operar o serviço.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">7. Integrações de terceiros</h2>
          <p>
            Strava, Google e Mercado Pago são serviços de terceiros com seus próprios termos.
            Não nos responsabilizamos por indisponibilidade ou alterações nessas APIs.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">8. Saúde e segurança física</h2>
          <p>
            <strong>RunQuest não substitui orientação médica.</strong> Consulte um profissional antes de iniciar
            qualquer atividade física. Pare se sentir dor, tontura ou desconforto. Não corra distraído com o celular
            em vias de risco. Use o app por sua conta e risco.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">9. IA e recomendações</h2>
          <p>
            Recomendações geradas por IA (Personal Trainer Premium) são <strong>sugestões automáticas</strong>{' '}
            e podem conter imprecisões. Use seu julgamento. Não somos responsáveis por lesões resultantes
            de seguir cegamente recomendações da IA.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">10. Propriedade intelectual</h2>
          <p>
            Marca, logo, código, design e conteúdo do RunQuest são propriedade exclusiva da Rovariz Serviços de Informática.
            Reprodução não autorizada é vedada.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">11. Limitação de responsabilidade</h2>
          <p>
            Na máxima extensão permitida por lei, nossa responsabilidade total fica limitada ao valor pago
            pelo plano Premium nos últimos 12 meses. Não respondemos por lucros cessantes, perda de dados
            decorrente de força maior, ou uso indevido por terceiros.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">12. Suspensão e encerramento</h2>
          <p>
            Podemos suspender ou encerrar contas que violarem estes Termos. Você pode encerrar a sua a qualquer momento
            via <code className="bg-white/10 px-2 py-0.5 rounded">/app/profile</code> ou e-mail para o DPO.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">13. Lei aplicável</h2>
          <p>
            Regido pelas leis da República Federativa do Brasil. Foro: Cambuí — MG.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-3">14. Contato</h2>
          <p>
            Dúvidas: <a href="mailto:contato@runquest.veloxisit.com.br" className="text-rq-lime hover:underline">contato@runquest.veloxisit.com.br</a>
          </p>

          <hr className="my-8 border-white/10" />
          <p className="text-sm text-white/50">
            Veja também a <Link href="/legal/privacy" className="text-rq-lime hover:underline">Política de Privacidade</Link>.
          </p>
        </article>
      </div>
    </main>
  );
}
