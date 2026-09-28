import {
  ArrowRight, Bell, CheckCircle2, CircleDot, ShieldCheck, Sparkles,
  SunMoon, Wand2, TrendingUp, PiggyBank, Users, FileUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './Novidades.css';

const novidades = [
  ['Tema claro e escuro', 'Alterne o visual do app pelo ícone no cabeçalho. A escolha fica salva neste dispositivo e, na primeira vez, respeita a preferência do seu sistema.', <SunMoon size={18} />],
  ['Categoria sugerida automaticamente', 'Ao repetir uma descrição já usada antes (ex: "Uber"), a categoria certa é sugerida sozinha — só confirme ou troque se quiser.', <Wand2 size={18} />],
  ['Comparativo ano a ano no relatório', 'Veja como o mês atual se compara ao mesmo mês do ano passado, além de um gráfico de tendência dos últimos 6 meses.', <TrendingUp size={18} />],
  ['Metas de economia', 'Defina um valor e um período — o progresso é calculado sozinho pelo saldo (entradas menos despesas) de cada mês, sem lançamento manual extra.', <PiggyBank size={18} />],
  ['Dividir despesa com alguém', 'Marque que uma despesa foi dividida com outra pessoa (sem precisar que ela tenha conta) e acompanhe sua parte separada do valor total.', <Users size={18} />],
  ['Importar extrato bancário', 'Envie o extrato do seu banco, revise os lançamentos detectados e importe despesas e entradas de uma vez, com categoria já sugerida.', <FileUp size={18} />],
];

const novidadesAnteriores = [
  ['Entradas em aba própria', 'Consulte salários, bônus, freelas e reembolsos em uma área separada das despesas, sem misturar dinheiro recebido com dinheiro gasto.', <ArrowRight size={18} />],
  ['Filtro mensal de entradas', 'Selecione um mês para ver somente os lançamentos daquele período ou mantenha Todos os meses para consultar o total completo.', <CheckCircle2 size={18} />],
  ['Notificações no celular', 'Ative o push na tela Alertas e receba avisos automáticos 3 e 1 dia antes do vencimento das suas despesas recorrentes.', <Bell size={18} />],
  ['Fechamento mensal', 'Confira no relatório quais categorias ultrapassaram o limite no mês selecionado e encerre sua conferência com mais clareza.', <CheckCircle2 size={18} />],
  ['Mais precisão financeira', 'A API passou a priorizar valores em centavos, reduzindo efeitos de arredondamento em somas, saldos e relatórios.', <Sparkles size={18} />],
  ['Qualidade de produção', 'Backups criptografados com verificação, CI automatizada e testes cobrindo os fluxos financeiros mais importantes.', <ShieldCheck size={18} />],
  ['Compras parceladas', 'Cadastre o total de parcelas e acompanhe automaticamente a parcela atual a cada virada de mês.', <CircleDot size={18} />],
  ['Recorrentes mais completas', 'Veja o total das contas ativas e mantenha o histórico das despesas fixas e parcelamentos quitados.', <CheckCircle2 size={18} />],
  ['Orçamento por mês', 'O orçamento começa de forma independente a cada mês, sem carregar valores antigos por engano.', <Sparkles size={18} />],
];

const plano = [
  'Preferências de horário e tipos de notificação',
  'Operações financeiras protegidas por transações',
  'Testes automatizados para API e fluxos principais',
  'Sessão e headers de segurança reforçados',
];

export default function Novidades() {
  return (
    <div className="novidades">
      <section className="novidades-hero">
        <span className="label">Notas da versão</span>
        <h2>Mais clareza para cuidar do seu dinheiro.</h2>
        <p>A versão <strong>v1.9.0</strong> traz metas de economia, divisão de despesas, importação de extrato e mais inteligência no relatório.</p>
        <span className="novidades-status"><span /> Versão atual em produção</span>
      </section>

      <section className="novidades-secao">
        <div className="novidades-secao-titulo"><span className="label">v1.9.0 · O que mudou</span><h3>Novidades desta versão</h3></div>
        <div className="novidades-grid">
          {novidades.map(([titulo, texto, icone]) => (
            <article className="panel novidade-card" key={titulo}>
              <span className="novidade-icone">{icone}</span><h4>{titulo}</h4><p>{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="novidades-secao">
        <div className="novidades-secao-titulo"><span className="label">v1.8.0 · Versão anterior</span><h3>Também disponível</h3></div>
        <div className="novidades-grid">
          {novidadesAnteriores.map(([titulo, texto, icone]) => (
            <article className="panel novidade-card" key={titulo}>
              <span className="novidade-icone">{icone}</span><h4>{titulo}</h4><p>{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel plano-v2">
        <div className="plano-v2-cabecalho"><span className="novidade-icone"><ShieldCheck size={18} /></span><div><span className="label">Próxima evolução</span><h3>Plano v2.0 · Confiabilidade profissional</h3></div></div>
        <p className="plano-intro">O próximo ciclo prioriza segurança, consistência e tranquilidade para que os dados financeiros continuem corretos mesmo em situações de erro.</p>
        <ul className="plano-lista">{plano.map((item) => <li key={item}><CheckCircle2 size={15} /> {item}</li>)}</ul>
        <Link to="/" className="link-destacado novidades-voltar">Voltar para a visão geral <ArrowRight size={14} /></Link>
      </section>
    </div>
  );
}
