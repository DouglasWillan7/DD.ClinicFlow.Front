# CI/CD do frontend ClinicFlow na VPS

O frontend é empacotado como imagem imutável, publicado no GHCR e atualizado
automaticamente na VPS a cada push na `main`.

## Topologia

```text
GitHub Actions
  ├── lint + testes
  ├── build da imagem com VITE_API_URL de produção
  ├── push para ghcr.io/douglaswillan7/dd.clinicflow.front
  └── SSH para atualizar /opt/dwexpenses/clinicflow-front

Internet
  └── Caddy compartilhado -> clinicflow-web:8080
```

O Compose do frontend é isolado em `/opt/dwexpenses/clinicflow-front` e compartilha
somente a rede Docker externa `dwexpenses_default`. O deploy da API permanece
independente em `/opt/clinicflow`.

## Pipeline

O workflow `.github/workflows/deploy.yml` também pode ser iniciado manualmente por
`Actions > deploy > Run workflow`. Ele executa, em ordem:

1. `npm ci`, lint e testes;
2. build da imagem com `VITE_API_URL=https://clinicflow-api.dwsolucoes.tech`;
3. publicação das tags `latest` e SHA no GHCR;
4. pull e recriação somente do serviço `clinicflow-web`;
5. espera de até 120 segundos pelo healthcheck.

Falhas de validação ou build impedem a publicação. Um container `unhealthy` faz o job
falhar e inclui os logs recentes no GitHub Actions.

## Secrets do GitHub

Configure no repositório `DouglasWillan7/DD.ClinicFlow.Front`:

| Secret | Valor |
| --- | --- |
| `VPS_HOST` | host ou IP da VPS |
| `VPS_USER` | `deploy` |
| `VPS_PORT` | porta SSH |
| `VPS_SSH_KEY` | chave privada exclusiva do workflow |

A chave pública correspondente deve existir em `/home/deploy/.ssh/authorized_keys`.
A chave não concede `sudo`; o workflow pode alterar somente recursos já acessíveis ao
usuário `deploy`.

## Instalação inicial na VPS

Copie `deploy/vps/docker-compose.yml` para
`/opt/dwexpenses/clinicflow-front/docker-compose.yml`. A rota pública em
`deploy/vps/Caddyfile.edge` deve estar anexada ao Caddyfile compartilhado.

A VPS precisa estar autenticada no GHCR com permissão `read:packages`:

```bash
docker login ghcr.io -u douglaswillan7
```

O Caddy de borda e `clinicflow-web` devem participar da rede
`dwexpenses_default`.

## Verificação

```bash
cd /opt/dwexpenses/clinicflow-front
docker compose ps
docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q clinicflow-web)"
curl --fail --show-error https://clinicflow.dwsolucoes.tech/
curl --fail --show-error https://clinicflow.dwsolucoes.tech/entrar
```

## Rollback por SHA

Use uma tag SHA publicada por uma execução anterior bem-sucedida:

```bash
cd /opt/dwexpenses/clinicflow-front
CLINICFLOW_FRONT_IMAGE_TAG=SHA docker compose pull clinicflow-web
CLINICFLOW_FRONT_IMAGE_TAG=SHA docker compose up -d --force-recreate clinicflow-web
```

O próximo workflow bem-sucedido volta a implantar `latest`.

## Atualização da infraestrutura

O workflow atualiza a imagem, não o `docker-compose.yml` nem o Caddyfile de borda.
Quando esses arquivos mudarem, copie-os manualmente para a VPS e valide antes de
recriar containers.
