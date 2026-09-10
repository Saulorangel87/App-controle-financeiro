import { ArrowRight, Bell, CheckCircle2, CircleDot, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Novidades.css';

const novidades = [
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
  'Fechamento mensal, filtros e exportação de dados',
];

export default function Novidades() {
  return (
    <div className="novidades">
      <section className="novidades-hero">
        <span className="label">Notas da versão</span>
        <h2>Mais clareza para cuidar do seu dinheiro.</h2>
        <p>A versão <strong>v1.8.0</strong> organiza as entradas, melhora a consulta mensal e mantém a confiabilidade da operação.</p>
        <span className="novidades-status"><span /> Versão atual em produção</span>
      </section>

      <section className="novidades-secao">
        <div className="novidades-secao-titulo"><span className="label">v1.8.0 · O que mudou</span><h3>Novidades desta versão</h3></div>
        <div className="novidades-grid">
          {novidades.map(([titulo, texto, icone]) => (
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
