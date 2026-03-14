# n8n Cloudflare Bridge (Mac Mini)

Este puente expone el `n8n` local (`localhost:5680`) por Cloudflare para que OCULOPS pueda operar con `N8N_API_URL` y `N8N_WEBHOOK_URL` remotos.

## 1) Levantar puente

```bash
npm run n8n:bridge:cloudflare -- --upstream http://127.0.0.1:5680 --write-env
```

Resultado:
- crea túnel `trycloudflare`
- actualiza `.env`:
  - `N8N_API_URL=https://...trycloudflare.com/api/v1`
  - `N8N_WEBHOOK_URL=https://...trycloudflare.com/webhook`
- guarda estado:
  - `reports/n8n-cloudflare-bridge.json`
  - `reports/n8n-cloudflare-bridge.log`

## 2) Validar n8n por puente

```bash
npm run audit:n8n-workflows -- --recent-hours 72
npm run reconcile:n8n-oculops -- --apply --recent-hours 72
```

## 3) Bajar puente

```bash
npm run n8n:bridge:cloudflare:down
```

## Notas

- El script mata un túnel previo si existe `reports/n8n-cloudflare-bridge.json`.
- Si `localhost:5680` no está escuchando, el túnel puede levantar igual pero n8n devolverá error al enrutar.
- Para producción estable y con control de acceso, usar Cloudflare Tunnel con dominio propio + Access policies.
