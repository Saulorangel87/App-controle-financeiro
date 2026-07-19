import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import IconeCategoria from '../components/IconeCategoria';
import { formatarMoeda } from '../utils/formatters';
import { useRecarregarAoVirarMes } from '../utils/useRecarregarAoVirarMes';
import './Alertas.css';

function mesAtualISO() {
  return new Date().toISOString().slice(0, 7);
}

export default function Alertas() {
  const [categorias, setCategorias] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const [resCategorias, resDespesas] = await Promise.all([
      api.get('/categorias'),
      // "gasto" da categoria já é só do mês corrente, então a lista de despesas
      // mostrada aqui embaixo também precisa ser só do mês corrente — senão os
      // números não batem. Filtra direto no banco (?mes=), em vez de baixar
      // a tabela inteira e filtrar no navegador.
      api.get('/despesas', { params: { mes: mesAtualISO() } }),
    ]);
    setCategorias(resCategorias.data.filter((c) => c.status === 'EXCEDIDO'));
    setDespesas(resDespesas.data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRecarregarAoVirarMes(carregar);

  if (carregando) return <p className="label">Carregando...</p>;

  return (
    <div className="alertas-lista">
      <span className="label">{categorias.length} categorias com alerta ativo</span>

      {categorias.map((c) => {
        const despesasDaCategoria = despesas.filter((d) => d.categoria_id === c.id);
        const excesso = c.gasto - c.limite;

        return (
          <div className="panel card-alerta" key={c.id}>
            <div className="card-alerta-header">
              <span className="card-alerta-nome" style={{ color: c.cor }}>
                <IconeCategoria nome={c.icone} />
                <span>
                  <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{c.nome}</strong>
                  <span className="label">Limite excedido em {formatarMoeda(excesso)}</span>
                </span>
              </span>
              <span className="badge badge-excedido">EXCEDIDO</span>
            </div>

            <div className="alerta-valores">
              <div>
                <span className="label">Gasto</span>
                <strong style={{ color: 'var(--danger)', display: 'block' }}>{formatarMoeda(c.gasto)}</strong>
              </div>
              <div>
                <span className="label">Limite</span>
                <strong style={{ display: 'block' }}>{formatarMoeda(c.limite)}</strong>
              </div>
              <div>
                <span className="label">Excesso</span>
                <strong style={{ color: 'var(--danger)', display: 'block' }}>{formatarMoeda(excesso)}</strong>
              </div>
            </div>

            <div className="barra-fundo" style={{ marginTop: 4 }}>
              <div className="barra-preenchida" style={{ width: '100%', background: 'var(--danger)' }} />
            </div>

            <span className="label" style={{ marginTop: 16, display: 'block' }}>Despesas nessa categoria</span>
            <ul className="lista-despesas-alerta">
              {despesasDaCategoria.map((d) => (
                <li key={d.id}>
                  <span>{d.descricao}</span>
                  <strong>{formatarMoeda(d.valor)}</strong>
                </li>
              ))}
            </ul>

            <Link to="/categorias" className="botao-ajustar">
              Ajustar Limite
            </Link>
          </div>
        );
      })}

      {categorias.length === 0 && (
        <p className="label" style={{ padding: '24px 0' }}>Nenhuma categoria excedida no momento.</p>
      )}
    </div>
  );
}
