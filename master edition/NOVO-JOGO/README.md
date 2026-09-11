# Fantasy Pixel — Novo Jogo

Primeiro núcleo jogável reconstruído fora do V28 legado.

## O que já funciona

- loop de jogo separado;
- estado centralizado;
- entrada de teclado e mouse;
- movimentação do jogador;
- inimigos com perseguição;
- combate com cooldown centralizado na entidade;
- projéteis teleguiados ao alvo;
- colisões;
- vida e invulnerabilidade temporária;
- ondas e spawn progressivo;
- pontuação;
- tela de derrota e reinício;
- renderer separado da lógica de gameplay.

## Estrutura

```text
NOVO-JOGO/
├── core/
├── data/
├── entities/
├── systems/
├── index.html
├── style.css
└── game.js
```

## Execução

Como o projeto usa módulos ES (`type="module"`), abra por um servidor local ou publique em uma hospedagem estática. Não é necessário executar o V28 antigo para testar este núcleo.

## Próxima etapa

Trocar as formas provisórias por uma camada de arte, adicionar mapa/dungeon modular e então conectar classes, armas, inventário e progressão sem voltar à arquitetura monolítica do V28.
