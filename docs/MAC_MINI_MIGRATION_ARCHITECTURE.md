# Plan Maestro de Migración y Arquitectura Distribuida OCULOPS (MacBook Pro + Mac Mini + Cloud)

Este documento traza la arquitectura final y el plan de migración paso a paso para transformar OCULOPS en una **Agencia Autónoma Híbrida**.

Al trasladar la carga cognitiva pesada (n8n, ComfyUI, y modelos Open Source como DeepSeek v4 y OpenClaw) al **Mac Mini (24GB RAM)**, liberamos el **MacBook Pro** para que funcione exclusivamente como el Centro de Mando ultraligero y rápido. Todo permanece sincronizado en tiempo real a través de Supabase en la nube.

---

## 1. Arquitectura del Sistema Distribuido ('El Triángulo Base')

```mermaid
graph TD
    %% Nodos principales
    MBP[💻 MacBook Pro\nCentro de Mando OCULOPS]
    CLOUD[☁️ Supabase Cloud\nMemoria y Cerebro Central]
    MINI[🖥️ Mac Mini Server\nMotor de IA y Agentes]

    %% Conexiones
    MBP <-.-> |"React/Vite (HTTP/WSS)"| CLOUD
    MINI <-.-> |"Webhooks / REST API"| CLOUD

    %% Sub-componentes MBP
    subgraph MacBook Pro (Frontend)
        UI[Dashboard de Agentes UI]
        DEV[Entorno de Desarrollo Dev]
    end
    MBP --- UI
    MBP --- DEV

    %% Sub-componentes Cloud
    subgraph Vercel / Supabase
        DB[(PostgreSQL\nVectors)]
        EDGE([Edge Functions\nOrquestador CORTEX])
        CRON((pg_cron\nSchedulers))
    end
    CLOUD --- DB
    CLOUD --- EDGE
    CLOUD --- CRON

    %% Sub-componentes Mini
    subgraph Mac Mini (24GB RAM)
        N8N[n8n Automation\n(Manos y Pies)]
        COMFY[ComfyUI\n(Creatividad Visual)]
        LLM[DeepSeek v4 & OpenClaw\n(Ollama/vLLM / 1M Contexto)]
    end
    MINI --- N8N
    MINI --- COMFY
    MINI --- LLM
```

### Roles Asignados:
1.  **Supabase Cloud (`vpjcwheuqmwbpcufbbkj`)**: Repositorio central de memoria. Aloja todas las identidades, leads, mensajes y los Webhooks que despiertan a los agentes.
2.  **Mac Mini (24GB RAM)**: Servidor de ejecución continua 24/7. Ejecuta inferencias LLM gratuitas (DeepSeek), generación gráfica pesada (ComfyUI) y workflows de recolección de leads (n8n).
3.  **MacBook Pro**: Dispositivo de acceso del CEO. Muestra métricas en tiempo real, permite revisar contenido generado y autoriza flujos de caja/ventas. Cero carga computacional pesada.

---

## 2. Inventario de Migración al Mac Mini

Para que el servidor del Mac Mini funcione perfectamente de manera independiente, debe alojar los siguientes bloques que hasta ahora residían en el MacBook:

| Componente | Origen Actual (MacBook) | Destino (Mac Mini) | Acción Requerida |
| :--- | :--- | :--- | :--- |
| **Pila de Contenedores** | `~/Downloads/N8N_AIRDROP_PACK/ai-stack` | `~/oculops/ai-stack` | Enviar carpeta via AirDrop y arrancar con `start.sh` |
| **Modelos Visuales** | Volumes de Docker en MacBook | ComfyUI Models en Mini | Las descargas pesadas de checkpoints sucederán nativamente al arrancar ComfyUI allí. |
| **Workflows de N8N** | Base de datos local n8n | JSON imports en Mini | Sincronizar importando los JSON desde el Pack Airdrop al nuevo dashboard de n8n del Mini. |
| **Cerebro LLM Open Source** | (Pendiente) | Mac Mini CLI | Instalar Ollama/LM Studio e ingestar: `deepseek-v4` y `openclaw`. |

---

## 3. Plan de Ejecución Paso a Paso

### Fase 1: Limpieza del Entorno de Comando (MacBook Pro)  ✅ COMPLETADO
- Cancelar contenedores locales que consumen batería (`docker compose down`).
- Limpiar volúmenes de Docker para liberar espacio crítico en disco (~40GB).
- Confirmar conexión limpia puerto 5173 -> Supabase Cloud.
- Validar subida total de código a Github Branch `main`.

### Fase 2: Configuración del Motor (Mac Mini)  [⚠️ PENDIENTE]
- [ ] Mover todo el archivo comprimido `N8N_AIRDROP_PACK` al Mac Mini por AirDrop.
- [ ] Instalar [Docker Desktop](https://www.docker.com/products/docker-desktop) en el Mac Mini.
- [ ] Abrir Terminal en el Mac Mini y ejecutar: `cd N8N_AIRDROP_PACK/n8n-workflows/ai-stack` y luego `./start.sh`.
- [ ] Configurar el archivo `.env` del Mac Mini con el Token de Supabase exacto.
- [ ] (Opcional) Instalar Ngrok o Cloudflare Tunnels en el Mac Mini si queremos que Supabase le envíe webhooks directos al puerto 5678 (n8n) desde internet.

### Fase 3: Integración de DeepSeek v4 y OpenClaw (Mac Mini) [⚠️ PENDIENTE]
- [ ] Instalar Ollama en el Mac Mini.
- [ ] Descargar los modelos con contexto masivo de 1 millón de tokens:
  ```bash
  ollama run deepseek-coder-v2  # O la variante de DeepSeek v4 adecuada 
  ollama run openclaw
  ```
- [ ] **Modificar n8n (o Agent Zero)**: Enlazar el nodo HTTP/OpenAI de n8n para que no apunte a `api.openai.com`, sino a la API local del Mac Mini (`http://localhost:11434/v1`). De esta forma, cada prompt viaja al modelo de OpenClaw/DeepSeek ahorrando el 100% de los costes de API.

### Fase 4: Sincronización de Webhooks y Cierre
- [ ] Actualizar la tabla `api_catalog` en Supabase para que las Edge Functions ("Agent Cortex") sepan que el orquestador n8n ahora vive en la IP o Túnel del Mac Mini.
- [ ] Hacer una prueba de humo (Smoke Test): Añadir un lead en el MacBook Pro -> Ver cómo el Mac Mini reacciona, genera el texto y lo devuelve mágicamente al dashboard del MacBook Pro.

---

## 4. Estrategia de Costes y Rendimiento

Al utilizar este sistema dividido:
- **Costes Fijos Mensuales (APIs)**: Caen drásticamente al desviar transcripciones infinitas de llamadas, generación de guiones y correos a OpenClaw/DeepSeek en lugar de OpenAI. Reducción estimada: de $200/mes a $0/mes en inferencia masiva.
- **Rendimiento Visual**: Los 24GB de Memoria Unificada del chip Silicon del Mac Mini son perfectos para ComfyUI. Generará imágenes para Instagram mucho más rápido sin calentar tu portátil personal.
- **Seguridad y Confidencialidad**: Todo el conocimiento profundo, las directrices de Oculops y los leads B2B son escaneados por tu propio DeepSeek/OpenClaw local, de forma privada sin enviar los datos a un servidor de terceros.

---
*Este plan establece la visión oficial para la maduración del nodo de infraestructura "Mac Mini" en el ecosistema OCULOPS-2026.*
