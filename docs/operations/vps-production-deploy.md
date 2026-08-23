# Deploy do frontend ClinicFlow na VPS de produção

O frontend roda isolado em `/opt/dwexpenses/clinicflow-front` e compartilha apenas a rede Docker
`dwexpenses_default` com o Caddy de borda. A API permanece no deploy separado em
`/opt/clinicflow`.

## Build

Na raiz do repositório:

```bash
npm ci
npm run lint
npm test
VITE_API_URL=https://clinicflow-api.dwsolucoes.tech npm run build
```

`VITE_API_URL` é incorporada ao JavaScript durante o build. Não publique um `dist`
gerado sem essa variável.

## Layout da VPS

```text
/opt/dwexpenses/clinicflow-front/
  Caddyfile
  docker-compose.yml
  current -> releases/<release>
  releases/
    <release>/
```

O container `clinicflow-web` serve o release apontado por `current`. A troca do
symlink e a recriação do container tornam a atualização atômica e preservam releases
anteriores para rollback.

## Primeiro deploy

1. Crie `/opt/dwexpenses/clinicflow-front` com o usuário `deploy`.
2. Copie `deploy/vps/Caddyfile` e `deploy/vps/docker-compose.yml` para esse diretório.
3. Copie o conteúdo de `dist/` para um novo subdiretório de `releases/` e aponte
   `current` para ele.
4. Execute:

```bash
cd /opt/dwexpenses/clinicflow-front
docker compose config --quiet
docker compose up -d
```

5. Anexe `deploy/vps/Caddyfile.edge` a `/opt/dwexpenses/Caddyfile`, valide e
   recarregue o Caddy:

```bash
cd /opt/dwexpenses
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
```

## Verificação

```bash
cd /opt/dwexpenses/clinicflow-front
docker compose ps
docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q clinicflow-web)"
curl --fail --show-error --silent https://clinicflow.dwsolucoes.tech/
```

Além da página inicial, teste uma rota interna para confirmar o fallback da SPA:

```bash
curl --fail --show-error --silent https://clinicflow.dwsolucoes.tech/entrar
```

O login só alcançará a API quando o deploy separado do backend estiver saudável em
`https://clinicflow-api.dwsolucoes.tech/health`.

## Rollback

Aponte `current` para um release anterior e recrie somente o frontend:

```bash
cd /opt/dwexpenses/clinicflow-front
ln -s releases/RELEASE_ANTERIOR current.next
mv -Tf current.next current
docker compose up -d --force-recreate clinicflow-web
```

Não use `docker compose down` no diretório compartilhado `/opt/dwexpenses` para
atualizar o frontend.
