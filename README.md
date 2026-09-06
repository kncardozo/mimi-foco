# Mimi Foco

Aplicativo web de foco e recompensa para incentivar os estudos da Milena.

A cada ciclo de 30 minutos de foco, o sistema libera 30 minutos de lazer. O ciclo pode ser concluido pelo contador ou registrado manualmente pelo botao `+30 foco`.

## Objetivos

- Registrar ciclos de foco de 30 minutos.
- Identificar os perfis Kah e Mimi.
- Gerar saldo de lazer a partir do foco concluido.
- Permitir marcar 30 minutos de lazer como cumpridos.
- Mostrar o saldo de lazer de todos os perfis.
- Registrar data e hora de cada evento.
- Oferecer modo claro e modo noturno.
- Exibir mensagens motivacionais ao concluir um ciclo.
- Permitir alteracao de senha pelo Supabase Auth.

## Arquitetura

O projeto e uma aplicacao frontend estatica, sem backend proprio.

```text
index.html
  |
  +-- styles.css       Interface e responsividade
  +-- app.js           Timer, login, regras de saldo e Supabase
  +-- site.webmanifest Instalacao como app no celular
  +-- kahdela-clock.svg Icone complementar
```

### Frontend

- `index.html` define a estrutura da tela de login, cronometro, saldo e dialogo de troca de senha.
- `styles.css` concentra o visual mobile, tema claro/escuro e estados dos componentes.
- `app.js` controla o estado da aplicacao, cronometro, notificacoes, autenticacao e persistencia.
- Supabase JS e carregado via CDN.

### Persistencia local

O `localStorage` e usado como cache para tema, pessoa atual e ultimo estado visual. Ele nao e a fonte oficial dos registros quando o Supabase esta configurado.

### Supabase

O Supabase fornece:

- Supabase Auth para login por senha.
- PostgreSQL para os registros de foco e lazer.
- RLS para proteger insercao e exclusao por usuario autenticado.

As credenciais publicas do Supabase podem aparecer no frontend. A chave `service_role` e qualquer segredo administrativo nunca devem ser publicados.

## Dados e autenticacao

O app usa Supabase Auth para autenticar os perfis e um banco PostgreSQL para sincronizar os ciclos entre dispositivos.

Os registros ficam associados ao usuario autenticado e o saldo e calculado a partir dos eventos de foco e lazer. As regras de acesso sao aplicadas no banco por RLS.

As credenciais de login ficam somente no Supabase. O frontend usa apenas credenciais publicas necessarias para acessar a API.

## Publicacao

O app pode ser publicado gratuitamente no GitHub Pages:

1. Mantenha `index.html` na raiz do repositorio.
2. Envie tambem `app.js`, `styles.css`, `site.webmanifest` e os arquivos de icone.
3. Em **Settings -> Pages**, selecione `Deploy from a branch`.
4. Escolha a branch `main` e a pasta `/ (root)`.
5. Acesse o endereco `https://usuario.github.io/repositorio/`.

O HTTPS do GitHub Pages e necessario para notificacoes e instalacao no celular.

## Observacoes

- O projeto e uma aplicacao frontend estatica publicada no GitHub Pages.
- A sincronizacao depende da configuracao do projeto Supabase.
- O codigo publico nao deve conter senhas, tokens administrativos ou chaves `service_role`.
