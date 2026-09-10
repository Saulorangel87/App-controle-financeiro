# Deploy automático pelo GitHub Actions

O projeto usa dois workflows:

- `CI`: executa testes do backend, lint do frontend e build em cada alteração na
  `main` ou pull request.
- `Deploy produção`: só publica depois que o `CI` da `main` termina com sucesso.

## Arquitetura

O deploy roda em um runner auto-hospedado instalado na própria VM Oracle. Essa
decisão é necessária porque a VM usa o endereço privado da Tailscale e não deve
ter SSH exposto na internet para o GitHub.

O job de produção:

1. atualiza o checkout da VM com `git pull --ff-only`;
2. exige que a revisão local seja exatamente a revisão aprovada pelo CI;
3. executa `docker compose up -d --build`;
4. valida o frontend na porta `8091` e a API na porta `3011`.

O workflow não contém chave SSH, token de acesso, senha ou variável de ambiente
de produção.

## Configuração única no GitHub

No repositório, acesse **Settings → Actions → Runners → New self-hosted
runner**. Selecione **Linux** e **ARM64**. Na VM, execute os comandos exibidos
nessa tela, na ordem indicada pelo GitHub, dentro de um diretório próprio, por
exemplo `~/actions-runner`.

Ao configurar o runner, use o label adicional:

```text
despesas-production
```

Depois instale o runner como serviço do sistema para que ele volte após
reinicializações da VM:

```bash
sudo ./svc.sh install ubuntu
sudo ./svc.sh start
```

O runner deve aparecer como **Idle/Online** em **Settings → Actions →
Runners**. O token mostrado pelo GitHub é temporário; não o salve no projeto,
em mensagens ou em arquivos versionados.

## Ambiente de produção

Em **Settings → Environments**, crie o ambiente `production`. Recomenda-se
adicionar a regra de branch permitida `main`. Um revisor obrigatório pode ser
ativado caso seja desejada uma aprovação manual antes de cada publicação; sem
essa regra, o deploy continua automático após o CI aprovado.

## Execução

Depois que o runner estiver online, um push na `main` seguirá esta sequência:

```text
push → CI → Deploy produção → smoke test frontend/API
```

Também é possível disparar o workflow manualmente pela aba **Actions**, usando
`Run workflow`. O modo manual ainda exige a revisão indicada pelo workflow e
não ignora a validação da revisão esperada.

## Diagnóstico rápido

- **Queued:** o runner está offline ou sem o label `despesas-production`.
- **CI concluído, deploy não iniciado:** confira se o CI terminou com sucesso e
  se o workflow de deploy está na `main`.
- **Alterações locais na VM:** o job para de propósito para não sobrescrever
  alterações manuais.
- **Revisão divergente:** houve outra publicação ou outro push antes do job;
  confirme a execução mais recente antes de repetir.
- **Smoke test falhou:** consulte os logs dos containers na VM com
  `docker compose logs --tail=100`.
