# Deploy manual pelo GitHub Actions

O repositório permanece público para o portfólio. Por isso, o deploy não usa
runner auto-hospedado na VM de produção.

O workflow `Deploy produção` usa um runner temporário hospedado pelo GitHub e
só pode ser acionado pelo botão **Run workflow** na branch `main`.

## Fluxo

```text
Run workflow → confirmação → CI aprovado → Tailscale temporária → SSH → Docker → smoke test
```

O workflow:

1. exige confirmação explícita da publicação;
2. verifica se o commit selecionado já passou pelo workflow `CI`;
3. conecta o runner GitHub-hosted à Tailscale apenas durante a execução;
4. usa uma chave SSH exclusiva de deploy e host key fixada;
5. atualiza a VM com `git pull --ff-only`;
6. reconstrói os containers e valida frontend/API.

O workflow não contém valores de segredos. Eles ficam no ambiente protegido
`production` do GitHub.

## Segredos do ambiente `production`

Em **Settings → Environments → production → Environment secrets**, crie:

- `TAILSCALE_AUTHKEY`: chave Tailscale reutilizável, efêmera e associada a uma
  tag exclusiva para o GitHub Actions. Essa tag deve ter permissão de acessar a
  VM na porta SSH.
- `DEPLOY_SSH_KEY`: chave privada SSH exclusiva para o deploy automático. Não
  reutilize a chave administrativa pessoal.
- `DEPLOY_KNOWN_HOSTS`: a linha da host key da VM para
  `100.67.151.30`, obtida do arquivo local de hosts conhecidos. Não desative a
  validação de host.

Na Tailscale, a tag da chave deve permitir somente o acesso necessário à VM e
à porta `22`. A chave deve ser criada como efêmera e pré-aprovada quando o
tailnet exigir aprovação de dispositivos.

## Proteção do ambiente

Em **Settings → Environments → production**:

- permita apenas a branch `main`;
- mantenha a aprovação obrigatória ativada para exigir uma confirmação antes
  de acessar os segredos e publicar;
- não salve nenhum segredo no README, no workflow ou no `.env` versionado.

## Como publicar

1. Abra **Actions → Deploy produção**.
2. Clique em **Run workflow**.
3. Selecione `main`.
4. Marque a confirmação de produção.
5. Inicie o workflow.
6. Se o ambiente solicitar, aprove o deployment.

O job será interrompido se não houver CI aprovado para o commit, se a conexão
Tailscale falhar, se a host key não corresponder, se a VM tiver alterações
locais ou se o smoke test falhar.

## Remoção do runner antigo

Como o repositório é público, o runner auto-hospedado instalado anteriormente
na VM deve ser desativado e removido depois que esta configuração for
versionada:

```bash
cd ~/actions-runner
sudo ./svc.sh stop
sudo ./svc.sh uninstall
```

Depois remova o runner em **Settings → Actions → Runners**.
