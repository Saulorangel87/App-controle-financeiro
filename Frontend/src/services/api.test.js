import axios from 'axios';
import { renovarSessao } from './api';

vi.mock('axios', () => {
  const instancia = {
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };
  return { default: { create: vi.fn(() => instancia), post: vi.fn() } };
});

describe('renovarSessao', () => {
  beforeEach(() => axios.post.mockReset());

  it('requisições simultâneas compartilham uma única renovação', async () => {
    let concluir;
    axios.post.mockReturnValue(new Promise((resolve) => { concluir = resolve; }));

    const renovacoes = [renovarSessao(), renovarSessao(), renovarSessao()];
    concluir({ data: { token: 'novo', usuario: { id: 1 } } });
    const resultados = await Promise.all(renovacoes);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(resultados.every((r) => r.token === 'novo')).toBe(true);
  });

  it('depois de concluída, a próxima expiração faz uma renovação nova', async () => {
    axios.post.mockResolvedValue({ data: { token: 'a' } });
    await renovarSessao();
    await renovarSessao();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('uma falha também libera a próxima tentativa', async () => {
    axios.post.mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce({ data: { token: 'b' } });
    await expect(renovarSessao()).rejects.toThrow('401');
    await expect(renovarSessao()).resolves.toEqual({ token: 'b' });
  });
});
