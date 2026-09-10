# Deploy manual pelo GitHub Actions

O deploy deste projeto segue o mesmo padrão do CDD Campos e permanece manual:

```text
Run workflow → build-check → Tailscale → SSH → Docker → smoke test
```

O repositório pode permanecer público para o portfólio porque a VM não é usada
como runner do GitHub. O workflow executa o build em um runner GitHub-hosted e
acessa a VM somente durante o job de deploy, pela rede privada Tailscale.

## Fluxo

O workflow `Deploy Produção (VPS)`:

1. é iniciado manualmente em **Actions → Deploy Produção (VPS) → Run workflow**;
2. executa testes do backend, lint e build do frontend;
3. só inicia o deploy se `build-check` passar;
4. conecta o runner temporariamente à Tailscale;
5. acessa a VPS por SSH usando chave exclusiva e fingerprint da host key;
6. atualiza o checkout com `git pull --ff-only`;
7. confirma que a VPS está na mesma revisão validada;
8. reconstrói os containers e valida frontend/API.

O workflow não contém valores de segredos.

## Secrets do ambiente `production`

Em **Settings → Environments → production → Environment secrets**, crie estes
secrets:

- `TAILSCALE_AUTHKEY`: auth key Tailscale efêmera, reutilizável, pré-aprovada
  quando necessário e associada a uma tag exclusiva do GitHub Actions.
- `VPS_HOST`: `100.67.151.30`.
- `VPS_USER`: `ubuntu`.
- `VPS_SSH_KEY`: chave privada SSH exclusiva para este deploy. Não reutilize a
  chave administrativa pessoal.
- `VPS_HOST_FINGERPRINT`: fingerprint SHA-256 da chave pública SSH da VPS.

Os três secrets `VPS_HOST`, `VPS_USER` e `VPS_SSH_KEY` seguem o mesmo padrão
usado no CDD Campos. O `VPS_HOST_FINGERPRINT` é uma proteção adicional para
evitar conexão com uma máquina diferente da VM validada.

## Tailscale

Na Tailscale, a tag usada pela auth key deve ter permissão somente para acessar
a VPS na porta `22`. A chave deve ser efêmera e pré-aprovada quando o tailnet
usar aprovação de dispositivos. Consulte a documentação da [Tailscale GitHub
Action](https://tailscale.com/docs/integrations/github/github-action).

## Ambiente de produção

Em **Settings → Environments → production**:

- permita somente a branch `main`;
- mantenha aprovação obrigatória antes do deploy;
- não salve secrets no README, workflow ou arquivos versionados.

Ambientes do GitHub podem restringir branches e liberar secrets somente após as
regras de proteção serem atendidas ([documentação do GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)).

## Publicar

1. Faça push do workflow para a branch `main`.
2. Abra **Actions → Deploy Produção (VPS)**.
3. Clique em **Run workflow** e selecione `main`.
4. Aguarde o `build-check`.
5. Aprove o ambiente `production`, se solicitado.
6. Confirme o smoke test da API e do frontend.

## Runner antigo

O runner auto-hospedado da VM não é necessário para este padrão. O serviço já
foi parado; depois de confirmar que ele não aparece mais na interface do
GitHub, não o reinstale.
