# RPG Fichas — Olimpo

Aplicativo Electron local para gerenciar fichas, habilidades, ideias, informações, companheiros, imagens e histórico de alterações.

Também permite colar uma ficha TXT para atualizar os campos, guardar imagens individuais dos pets e ler por OCR uma imagem da tabela de habilidades. O OCR em português funciona localmente e não envia a imagem para a internet.

## Uso

- Execute `TESTAR.bat` para abrir a versão de teste.
- Execute `ATUALIZAR E GERAR EXE.bat` para instalar/atualizar apenas as dependências da pasta, testar e gerar `dist\RPG Fichas.exe`.
- O executável é portátil. Ele salva as informações em `RPG Fichas - Dados`, ao lado do `.exe`.
- A versão de teste salva em `data`, dentro do projeto.

## Atualizações automáticas

O aplicativo procura atualizações publicadas nas Releases deste repositório. Quando uma nova versão termina de baixar, o usuário recebe a opção **Reiniciar e atualizar**. As fichas e imagens continuam guardadas fora da instalação e não são apagadas.

Cada envio para a branch `main` executa os testes, cria uma versão nova e publica automaticamente o instalador pelo GitHub Actions.

Nenhuma instalação global de Node ou Electron é necessária para usar o programa. O Node só é necessário para desenvolvimento; o instalador final funciona sozinho.
