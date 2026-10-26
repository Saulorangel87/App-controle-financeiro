import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { formatarMoeda } from '../utils/formatters';
import {
  analisarCSV,
  analisarOFX,
  ehArquivoOFX,
  chaveDuplicata,
  detectarColunas,
  analisarValor,
  analisarData,
} from '../utils/csv';
import { hojeISO } from '../utils/datas';
import './ImportarExtrato.css';

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

    const [categoriasCarregadas, despesasExistentes, entradasExistentes] = await Promise.all([
      garantirCategorias(),
      api.get('/despesas').then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
      api.get('/entradas').then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
    ]);
    const texto = await arquivo.text();
    const hoje = hojeISO();
    const categoriaPadraoId = categoriasCarregadas[0]?.id || '';

    let brutos = [];
    if (ehArquivoOFX(arquivo.name, texto)) {
      setAvisoColunas(false);
      brutos = analisarOFX(texto);
      if (brutos.length === 0) {
        setErroArquivo('O arquivo OFX não tem lançamentos válidos.');
        setItens([]);
        return;
      }
    } else {
      const linhas = analisarCSV(texto);
      if (linhas.length < 2) {
        setErroArquivo('O arquivo não tem lançamentos (só cabeçalho ou vazio).');
        setItens([]);
        return;
      }

      const { indiceData, indiceDescricao, indiceValor, detectado } = detectarColunas(linhas[0]);
      setAvisoColunas(!detectado);

      const linhasDados = detectado ? linhas.slice(1) : linhas;
      brutos = linhasDados.map((linha) => ({
        descricao: (linha[indiceDescricao] || '').slice(0, 80) || 'Sem descrição',
        valor: analisarValor(linha[indiceValor]),
        data: analisarData(linha[indiceData]),
      }));
    }

    const chavesNoBanco = new Set([
      ...despesasExistentes.map((d) => chaveDuplicata('despesa', d.data, d.valor, d.descricao)),
      ...entradasExistentes.map((e) => chaveDuplicata('entrada', e.data, e.valor, e.origem)),
    ]);
    const chavesNoArquivo = new Set();

    const novosItens = brutos.map((registro) => {
      const descricaoBruta = (registro.descricao || '').slice(0, 80) || 'Sem descrição';
      const valorNumero = registro.valor;
      const dataConvertida = registro.data;

      let erro = null;
      if (valorNumero === null || valorNumero === 0) erro = 'Valor inválido';
      else if (!dataConvertida) erro = 'Data inválida';
      else if (dataConvertida > hoje) erro = 'Data futura';

      const tipo = valorNumero != null && valorNumero < 0 ? 'despesa' : 'entrada';
      const valorAbs = valorNumero != null ? Math.abs(valorNumero) : 0;
      const chave = chaveDuplicata(tipo, dataConvertida, valorAbs, descricaoBruta);
      const jaNoBanco = !erro && chavesNoBanco.has(chave);
      const repetidoNoArquivo = !erro && !jaNoBanco && chavesNoArquivo.has(chave);
      if (!erro) {
        chavesNoArquivo.add(chave);
      }
      const duplicado = jaNoBanco || repetidoNoArquivo;
      const motivoDuplicado = jaNoBanco
        ? 'Já importado'
        : repetidoNoArquivo
        ? 'Repetido no arquivo'
        : null;

      return {
        id: proximoId++,
        incluir: !erro && !duplicado,
        erro,
        duplicado,
        motivoDuplicado,
        tipo,
        descricao: descricaoBruta,
        valor: valorAbs,
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
  const totalDuplicados = itens.filter((item) => item.duplicado).length;
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
          Envie o arquivo do extrato exportado pelo seu banco (formatos .csv ou .ofx), com data, descrição e valor.
          Valores negativos viram despesas, positivos viram entradas — lançamentos já existentes vêm desmarcados para evitar duplicidade.
        </p>
        <label className="btn-primary botao-upload" htmlFor="arquivo-csv">
          <Upload size={14} /> Escolher arquivo do extrato
        </label>
        <input
          id="arquivo-csv"
          ref={inputRef}
          type="file"
          accept=".csv,.ofx,text/csv,application/x-ofx"
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
            {totalDuplicados > 0 && (
              <span className="label aviso-duplicados">
                {totalDuplicados} possível(is) duplicado(s) desmarcado(s) automaticamente (você pode remarcar se quiser importar mesmo assim).
              </span>
            )}
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
                  <tr
                    key={item.id}
                    className={item.erro ? 'linha-com-erro' : item.duplicado ? 'linha-duplicada' : ''}
                  >
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
                      <div className="celula-descricao-importar">
                        <input
                          type="text"
                          value={item.descricao}
                          maxLength={80}
                          onChange={(e) => atualizarItem(item.id, { descricao: e.target.value })}
                        />
                        {item.duplicado && (
                          <span className="badge-duplicado">{item.motivoDuplicado}</span>
                        )}
                      </div>
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
