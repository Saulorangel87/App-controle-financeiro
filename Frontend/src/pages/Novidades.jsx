import {
  ArrowRight, CheckCircle2, CreditCard, FileUp, FolderKanban,
  History, Repeat, Search, ShieldCheck, Sparkles, SunMoon,
  TrendingUp, PiggyBank, Users, Wand2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './Novidades.css';

const novidades = [
  ['Conta recorrente paga vira despesa', 'Ao marcar uma conta fixa ou parcela como paga, confirme categoria e forma de pagamento para já lançá-la nas despesas do mês. Se desmarcar, o lançamento é desfeito sozinho.', <Repeat size={18} />],
  ['Orçamento recorrente todo mês', 'Ative "Repetir todo mês" no orçamento ou copie o valor do mês anterior com um clique quando o mês começar.', <Sparkles size={18} />],
  ['Projeção do mês e fatura do cartão', 'Acompanhe na Visão Geral a projeção de fechamento do mês no ritmo atual e o total da fatura aberta do cartão de crédito com dia de fechamento configurável.', <CreditCard size={18} />],
  ['Gerenciar categorias e editar entradas', 'Crie novas categorias com escolha de ícone e cor, edite ou exclua categorias sem gastos e edite entradas com ajuste automático do orçamento.', <FolderKanban size={18} />],
  ['Busca, filtros e desfazer exclusão', 'Busque despesas por descrição, filtre por categoria e forma de pagamento e desfaça exclusões acidentais de despesas ou entradas com um clique — ou restaure depois pela tela Histórico, que mostra tudo o que foi criado, editado e excluído.', <Search size={18} />],
  ['Extrato OFX, sem duplicados e mais segurança', 'Importe arquivos .csv e .ofx com detecção automática de lançamentos repetidos, troque sua senha logado e encerre sessões em todos os dispositivos.', <History size={18} />],
];

const novidadesAnteriores = [
  ['Tema claro e escuro', 'Alterne o visual do app pelo ícone no cabeçalho. A escolha fica salva neste dispositivo e, na primeira vez, respeita a preferência do seu sistema.', <SunMoon size={18} />],
  ['Categoria sugerida automaticamente', 'Ao repetir uma descrição já usada antes (ex: "Uber"), a categoria certa é sugerida sozinha — só confirme ou troque se quiser.', <Wand2 size={18} />],
  ['Comparativo ano a ano no relatório', 'Veja como o mês atual se compara ao mesmo mês do ano passado, além de um gráfico de tendência dos últimos 6 meses.', <TrendingUp size={18} />],
  ['Metas de economia', 'Defina um valor e um período — o progresso é calculado sozinho pelo saldo (entradas menos despesas) de cada mês, sem lançamento manual extra.', <PiggyBank size={18} />],
  ['Dividir despesa com alguém', 'Marque que uma despesa foi dividida com outra pessoa (sem precisar que ela tenha conta) e acompanhe sua parte separada do valor total.', <Users size={18} />],
  ['Importar extrato bancário', 'Envie o extrato do seu banco, revise os lançamentos detectados e importe despesas e entradas de uma vez, com categoria já sugerida.', <FileUp size={18} />],
];

const entreguesV2 = [
  'Node.js 24 LTS, Express 5, Content-Security-Policy (CSP) e container sem privilégios de root',
  'Fuso horário configurável (America/Sao_Paulo) evitando virada de dia antecipada às 21h',
  'Somas monetárias em centavos inteiros no banco e índices compostos nas consultas por mês',
  'Rotação de sessão resiliente a abas simultâneas, troca de senha e encerramento global de sessões',
];

export default function Novidades() {
  return (
    <div className="novidades">
      <section className="novidades-hero">
        <span className="label">Notas da versão</span>
        <h2>Confiabilidade profissional e controle completo.</h2>
        <p>A versão <strong>v2.0.0</strong> integra contas recorrentes às despesas, traz projeção mensal, fatura do cartão, gerenciamento completo de categorias, opção de desfazer exclusões e segurança reforçada.</p>
        <span className="novidades-status"><span /> Versão atual em produção</span>
      </section>

      <section className="novidades-secao">
        <div className="novidades-secao-titulo"><span className="label">v2.0.0 · O que mudou</span><h3>Novidades desta versão</h3></div>
        <div className="novidades-grid">
          {novidades.map(([titulo, texto, icone]) => (
            <article className="panel novidade-card" key={titulo}>
              <span className="novidade-icone">{icone}</span><h4>{titulo}</h4><p>{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="novidades-secao">
        <div className="novidades-secao-titulo"><span className="label">v1.9.0 · Versão anterior</span><h3>Também disponível</h3></div>
        <div className="novidades-grid">
          {novidadesAnteriores.map(([titulo, texto, icone]) => (
            <article className="panel novidade-card" key={titulo}>
              <span className="novidade-icone">{icone}</span><h4>{titulo}</h4><p>{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel plano-v2">
        <div className="plano-v2-cabecalho"><span className="novidade-icone"><ShieldCheck size={18} /></span><div><span className="label">Arquitetura e segurança</span><h3>Ciclo v2.0 · Base concluída</h3></div></div>
        <p className="plano-intro">Além das novas funcionalidades, a fundação do app foi atualizada de ponta a ponta para garantir precisão financeira, proteção de sessão e estabilidade em produção.</p>
        <ul className="plano-lista">{entreguesV2.map((item) => <li key={item}><CheckCircle2 size={15} /> {item}</li>)}</ul>
        <Link to="/" className="link-destacado novidades-voltar">Voltar para a visão geral <ArrowRight size={14} /></Link>
      </section>
    </div>
  );
}
