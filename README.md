# anxavi.github.io — ARACHNE

Aplicación editorial de armario inteligente para GitHub Pages.

## Estado actual

### Implementado

- UI principal en `index.html` preservando navegación, armario, captura, historial, perfiles e idiomas ES/EN/CA.
- Motor de outfits modular y comprobable en `src/engine/`:
  - validación y normalización de prendas/contexto con errores y advertencias estructurados,
  - reglas de cobertura por categoría (obligatorias: `top`, `bottom`, `footwear`; opcional: `outerwear`),
  - filtrado térmico por categoría con relajación trazable,
  - búsqueda acotada de combinaciones,
  - scoring heurístico determinista (sin `Math.random`, sin banda fija 91-99),
  - afinados (`warmer`, `formal`, `shoes`, `lighter`, `active`, `effortless`) con comportamiento explícito,
  - jornada doble con evaluación de transición modular,
  - contratos versionados request/response y revalidación de salida remota.
- Generación asíncrona real en frontend con estados `idle/loading/success/error`, cancelación, timeout configurable, control de carreras y fallback local explícito.
- Scaffold de gateway server-side en `server/` separado de archivos públicos.

### Probado

- Pruebas automáticas del motor y contratos en `test/engine.test.js`.
- Pruebas del gateway para auth, CORS e input inválido en `test/gateway.test.js`.
- CI sin secretos en `.github/workflows/ci.yml`.

### Pendiente

- Integración real con Vertex AI desde el gateway (actualmente scaffold explícito).
- Persistencia confiable, cuotas/rate limiting y autorización de inventario por usuario.
- Endurecimiento adicional de producción (observabilidad, abuso, gobernanza de claves).

## Desarrollo local

```bash
npm test
```

## Gateway local (scaffold)

```bash
cp server/.env.example server/.env
npm run gateway
```

## Documentación

- Arquitectura: `docs/architecture.md`
- Contratos: `docs/contracts.md`
- Conexión cloud/gateway: `docs/cloud-gateway.md`
