import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { formatarMoeda } from '../utils/formatters';
import { analisarCSV, detectarColunas, analisarValor, analisarData } from '../utils/csv';
import './ImportarExtrato.css';

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

let proximoId = 1;

export default function ImportarExtrato() {
  const inputRef = useRef(null);
  const [categorias, setCategorias] = useState([]);
  const [itens, setItens] = useState([]);
  const [avisoColunas, setAvisoColunas] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [erroArquivo, setErroArquivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [resultado, setResultado] = useState(null);

  async function garantirCategorias() {
    if (categorias.length > 0) return categorias;
    const res = await api.get('/categorias');
    setCategorias(res.data);
    return res.data;
  }

  async function processarArquivo(arquivo) {
    setErroArquivo('');
    setResultado(null);
    setNomeArquivo(arquivo.name);

    const categoriasCarregadas = await garantirCategorias();
    const texto = await arquivo.text();
    const linhas = analisarCSV(texto);

    if (linhas.length < 2) {
      setErroArquivo('O arquivo não tem lançamentos (só cabeçalho ou vazio).');
      setItens([]);
      return;
    }

    const { indiceData, indiceDescricao, indiceValor, detectado } = detectarColunas(linhas[0]);
    setAvisoColunas(!detectado);

    const linhasDados = detectado ? linhas.slice(1) : linhas;
    const hoje = hojeISO();
    const categoriaPadraoId = categoriasCarregadas[0]?.id || '';

    const novosItens = linhasDados.map((linha) => {
      const descricaoBruta = (linha[indiceDescricao] || '').slice(0, 80) || 'Sem descrição';
      const valorNumero = analisarValor(linha[indiceValor]);
      const dataConvertida = analisarData(linha[indiceData]);

      let erro = null;
      if (valorNumero === null || valorNumero === 0) erro = 'Valor inválido';
      else if (!dataConvertida) erro = 'Data inválida';
      else if (dataConvertida > hoje) erro = 'Data futura';

      return {
        id: proximoId++,
        incluir: !erro,
        erro,
        tipo: valorNumero != null && valorNumero < 0 ? 'despesa' : 'entrada',
        descricao: descricaoBruta,
        valor: valorNumero != null ? Math.abs(valorNumero) : 0,
        data: dataConvertida || hoje,
        categoria_id: categoriaPadraoId,
      };
    });

    setItens(novosItens);
  }

  function selecionarArquivo(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    processarArquivo(arquivo).catch(() => {
      setErroArquivo('Não foi possível ler esse arquivo. Confirme que é um CSV válido.');
    });
  }

  function atualizarItem(id, campos) {
    setItens((atual) => atual.map((item) => (item.id === id ? { ...item, ...campos } : item)));
  }

  const itensIncluidos = itens.filter((item) => item.incluir && !item.erro);
  const totalDespesas = itensIncluidos.filter((i) => i.tipo === 'despesa').reduce((s, i) => s + i.valor, 0);
  const totalEntradas = itensIncluidos.filter((i) => i.tipo === 'entrada').reduce((s, i) => s + i.valor, 0);

  async function confirmarImportacao() {
    setErroEnvio('');

    if (itensIncluidos.some((item) => item.tipo === 'despesa' && !item.categoria_id)) {
      setErroEnvio('Escolha uma categoria para todas as despesas marcadas.');
      return;
    }

    setEnviando(true);
    try {
      const lancamentos = itensIncluidos.map((item) => (
        item.tipo === 'despesa'
          ? { tipo: 'despesa', descricao: item.descricao, valor: item.valor, data: item.data, categoria_id: Number(item.categoria_id) }
          : { tipo: 'entrada', origem: item.descricao, valor: item.valor, data: item.data }
      ));

      const res = await api.post('/importacao/extrato', { lancamentos });
      setResultado(res.data);
      setItens([]);
      setNomeArquivo('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setErroEnvio(err.response?.data?.erro || 'Não foi possível importar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="importar-extrato">
      <div className="importar-cabecalho">
        <Link to="/despesas" className="link-destacado"><ArrowLeft size={14} /> Voltar para Despesas</Link>
        <span className="label">Importar Extrato</span>
      </div>

      <div className="panel importar-upload">
        <p className="label">
          Envie o arquivo do extrato exportado pelo seu banco (formato .csv), com data, descrição e valor.
          Valores negativos viram despesas, positivos viram entradas — é o padrão da maioria dos extratos bancários.
        </p>
        <label className="btn-primary botao-upload" htmlFor="arquivo-csv">
          <Upload size={14} /> Escolher arquivo do extrato
        </label>
        <input
          id="arquivo-csv"
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={selecionarArquivo}
          className="sr-only"
        />
        {nomeArquivo && <span className="label">Arquivo: {nomeArquivo}</span>}
        {erroArquivo && <p className="erro-form" role="alert">{erroArquivo}</p>}
        {avisoColunas && itens.length > 0 && (
          <p className="erro-form" role="alert">
            Não identificamos as colunas pelo cabeçalho — assumimos a ordem Data, Descrição, Valor. Confira antes de importar.
          </p>
        )}
      </div>

      {resultado && (
        <div className="panel importar-resultado">
          <span className="label">Importação concluída</span>
          <p>{resultado.despesasCriadas} despesa(s) e {resultado.entradasCriadas} entrada(s) importadas com sucesso.</p>
          <Link to="/despesas" className="link-destacado">Ver despesas</Link>
        </div>
      )}

      {itens.length > 0 && (
        <div className="panel importar-preview">
          <div className="importar-preview-header">
            <span className="label">{itens.length} lançamentos encontrados — {itensIncluidos.length} serão importados</span>
            <span className="label">
              Despesas: <strong style={{ color: 'var(--danger)' }}>-{formatarMoeda(totalDespesas)}</strong>
              {' · '}
              Entradas: <strong style={{ color: 'var(--ok)' }}>+{formatarMoeda(totalEntradas)}</strong>
            </span>
          </div>

          <div className="tabela-importar-wrap">
            <table className="tabela-importar">
              <thead>
                <tr>
                  <th></th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Categoria</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className={item.erro ? 'linha-com-erro' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={item.incluir}
                        disabled={Boolean(item.erro)}
                        onChange={(e) => atualizarItem(item.id, { incluir: e.target.checked })}
                        aria-label={`Incluir lançamento ${item.descricao}`}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={item.data}
                        max={hojeISO()}
                        onChange={(e) => atualizarItem(item.id, { data: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.descricao}
                        maxLength={80}
                        onChange={(e) => atualizarItem(item.id, { descricao: e.target.value })}
                      />
                    </td>
                    <td>
                      <select value={item.tipo} onChange={(e) => atualizarItem(item.id, { tipo: e.target.value })}>
                        <option value="despesa">Despesa</option>
                        <option value="entrada">Entrada</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.valor}
                        onChange={(e) => atualizarItem(item.id, { valor: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      {item.tipo === 'despesa' ? (
                        <select value={item.categoria_id} onChange={(e) => atualizarItem(item.id, { categoria_id: e.target.value })}>
                          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      ) : (
                        <span className="label">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {itens.some((item) => item.erro) && (
            <p className="label" style={{ color: 'var(--danger)' }}>
              Algumas linhas têm data ou valor inválido e não podem ser importadas (destacadas acima).
            </p>
          )}

          {erroEnvio && <p className="erro-form" role="alert">{erroEnvio}</p>}

          <button
            type="button"
            className="btn-primary"
            disabled={enviando || itensIncluidos.length === 0}
            onClick={confirmarImportacao}
            style={{ width: '100%', padding: 14 }}
          >
            {enviando ? 'Importando...' : `Importar ${itensIncluidos.length} lançamento(s)`}
          </button>
        </div>
      )}
    </div>
  );
}
