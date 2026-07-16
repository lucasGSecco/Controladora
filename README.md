# Uniserv Voucher App

Aplicação para gerar, listar e revogar vouchers de internet (hotspot)
consumindo a API da controladora UniFi Network Application (instalação
self-hosted).

## Pré-requisitos

- Node.js 18 ou superior
- Um admin local criado na controladora com a role **Hotspot Manager**
  (veja `.env.example` para os campos necessários)
- A controladora acessível pela rede a partir do computador onde essa
  aplicação vai rodar

## Instalação

```bash
cd uniserv-voucher-app
npm install
cp .env.example .env
```

Edite o `.env` com os dados da sua controladora:

```
UNIFI_HOST=https://10.150.28.96:8443
UNIFI_USERNAME=api
UNIFI_PASSWORD=12345678
UNIFI_SITE=default
PORT=3000
```

> **UNIFI_SITE**: confirme o nome curto do site acessando o painel da
> controladora e olhando a URL — algo como `.../manage/site/default/...`.
> Na maioria das instalações com um site só, o valor é `default`.

## Rodando

```bash
npm start
```

Acesse `http://localhost:3000` no navegador.

Para desenvolvimento com reinício automático ao salvar arquivos:

```bash
npm run dev
```

## Estrutura do projeto

```
uniserv-voucher-app/
├── server.js                     # ponto de entrada do Express
├── src/
│   ├── services/
│   │   └── unifiService.js       # login e chamadas à API da UniFi
│   └── routes/
│       └── voucherRoutes.js      # rotas /api/vouchers
├── public/                       # frontend estático
│   ├── index.html
│   ├── style.css
│   └── app.js
└── .env.example
```

## Endpoints da API criados nessa aplicação

| Método | Rota                | Descrição                          |
|--------|----------------------|-------------------------------------|
| GET    | `/api/vouchers`      | Lista todos os vouchers             |
| POST   | `/api/vouchers`      | Cria um ou mais vouchers            |
| DELETE | `/api/vouchers/:id`  | Revoga um voucher pelo `_id`        |

### Corpo esperado no POST `/api/vouchers`

```json
{
  "minutes": 480,
  "count": 1,
  "usageLimit": 1,
  "note": "Cliente Mesa 5"
}
```

- `minutes`: validade do voucher em minutos (obrigatório)
- `count`: quantos vouchers gerar de uma vez (padrão: 1)
- `usageLimit`: `1` para uso único, `0` para múltiplos usos
- `note`: texto livre para identificar o voucher (opcional)

## Notas importantes

- A controladora usa certificado autoassinado, então o serviço
  `unifiService.js` desativa a verificação TLS **apenas** para as
  chamadas feitas a ela (`rejectUnauthorized: false`). Isso é aceitável
  em rede local/ambiente de testes, mas não é recomendado se a
  controladora for exposta pela internet.
- A sessão de login é reaproveitada em memória entre as requisições e
  renovada automaticamente se expirar (erro 401).
- Nunca commite o arquivo `.env` com credenciais reais em um repositório
  Git — ele já está pronto para ser adicionado ao `.gitignore`.
