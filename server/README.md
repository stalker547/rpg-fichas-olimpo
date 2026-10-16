# Servidor online do RPG Fichas

Este diretório contém PostgreSQL e a API segura do aplicativo.

## Subir na VPS

1. Instale Docker e Docker Compose.
2. Copie a pasta `server` para a VPS.
3. Copie `.env.example` para `.env`.
4. Troque todas as senhas e chaves do `.env`.
5. No painel de DNS, crie um registro `A` para `olimpo.astratoons.com` apontando para o IP público da VPS.
6. Libere as portas 80 e 443 no firewall da VPS.
7. Execute `docker compose up -d --build`.
8. Confirme em `https://olimpo.astratoons.com/health`.

No Ubuntu, os comandos principais são:

```bash
cp .env.example .env
nano .env
docker compose up -d --build
docker compose logs -f api
```

O Caddy incluído no pacote emite e renova automaticamente o certificado HTTPS. A porta do PostgreSQL não é publicada e a API só é acessada externamente por HTTPS.

## Criar a Mestre Principal

Faça uma única requisição `POST /setup`, enviando o cabeçalho `x-setup-secret` e o corpo:

```json
{"name":"Nome da mestre","username":"mestra","password":"senha com 8 ou mais caracteres"}
```

Depois da primeira conta, `/setup` se bloqueia automaticamente.

## Segurança recomendada

- Coloque a API atrás de HTTPS com Caddy ou Nginx.
- Não exponha a porta 5432 do PostgreSQL.
- Faça backup diário do volume `rpg_postgres`.
- Use senhas diferentes para PostgreSQL, JWT e instalação.

## Papéis

- `primary_master`: campanha real e administração.
- `developer`: somente campanhas de teste.
- `player`: somente personagens vinculados à sua conta.

O bloqueio de edição dura 120 segundos e deve ser renovado pelo aplicativo enquanto a ficha estiver aberta. As atualizações são avisadas em tempo real por WebSocket.

## Imagens e fichas engavetadas

As imagens são gravadas no volume persistente `rpg_media`, separado do PostgreSQL. O banco guarda somente os dados da imagem e o caminho seguro do arquivo. Inclua os volumes `rpg_postgres` e `rpg_media` no backup da VPS.

Fichas engavetadas permanecem no banco, com histórico e imagens, mas deixam de aparecer na lista normal e para o jogador. Somente a Mestre Principal pode engavetar ou restaurar uma ficha.
