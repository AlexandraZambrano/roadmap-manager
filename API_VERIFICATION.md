# Verificación de Consumo de API Externa para Evaluación de Competencias

## Resumen
El sistema de evaluación de competencias ahora consume TODOS los datos de la API externa:
- **Base API:** `https://evaluation.coderf5.es/v1`
- **Autenticación:** Token JWT del usuario local (Bearer token)
- **Fallback:** Base de datos local si la API externa no está disponible

---

## Flujo de Datos: API Externa → Servidor → Frontend

### 1. COMPETENCIAS (`/api/competences`)

**Servidor (server.js, línea 605):**
```
GET /api/competences
  ↓
  Intenta: evalApiGet('/competences/', userToken)
  ↓
  URL: https://evaluation.coderf5.es/v1/competences/?page_size=200
  Headers: Authorization: Bearer <userToken>
  ↓
  Normalización: normaliseEvalCompetence(comp)
  ↓
  Respuesta:
  {
    id, name, description,
    areas: [{id, name, icon}],         // De comp.area (array de strings)
    tools: [{id, name, description}],  // De comp.tools (array de objetos)
    levels: [{levelId, levelName, indicators: [...]}],  // Construido desde tool.indicators
    indicators: {                       // De comp.indicators (competencia indicators)
      initial: [{id, name, description}],
      medio: [{id, name, description}],
      advance: [{id, name, description}]
    }
  }
```

**Frontend (promotion-detail.js, línea 7748):**
```
fetch('${API_URL}/api/competences', {
  headers: { 'Authorization': `Bearer ${token}` }
})
  ↓
  catalogRaw = respuesta
  ↓
  Procesa: comp.indicators (competence indicators by level)
  Procesa: comp.tools (tool indicators with their indicators)
```

---

### 2. HERRAMIENTAS (`/api/tools`)

**Servidor (server.js, línea 529):**
```
GET /api/tools
  ↓
  Intenta: evalApiGet('/tools/', userToken)
  ↓
  URL: https://evaluation.coderf5.es/v1/tools/?page_size=200
  Headers: Authorization: Bearer <userToken>
  ↓
  Respuesta (sin normalización):
  [{
    id, name, description,
    indicators: [{id, name, description, levelId}],
    referents: [...],
    resources: [...]
  }]
```

---

### 3. INDICADORES (`/api/indicators`)

**Servidor (server.js, línea 549):**
```
GET /api/indicators
  ↓
  Intenta: evalApiGet('/indicators/', userToken)
  ↓
  URL: https://evaluation.coderf5.es/v1/indicators/?page_size=200
  Headers: Authorization: Bearer <userToken>
  ↓
  Respuesta:
  [{
    id, name, description, levelId
  }]
```

---

### 4. ÁREAS (`/api/areas`)

**Servidor (server.js, línea 500):**
```
GET /api/areas
  ↓
  Intenta: evalApiGet('/areas/', userToken)
  ↓
  URL: https://evaluation.coderf5.es/v1/areas/?page_size=200
  Headers: Authorization: Bearer <userToken>
```

---

### 5. NIVELES (`/api/levels`)

**Servidor (server.js, línea 562):**
```
GET /api/levels
  ↓
  Intenta: evalApiGet('/levels/', userToken)
  ↓
  URL: https://evaluation.coderf5.es/v1/levels/?page_size=200
  Headers: Authorization: Bearer <userToken>
```

---

## Logs de Verificación

Para verificar que el sistema está funcionando correctamente, busca estos logs en:

### En la Terminal (servidor):
```
[GET /api/competences] 🔄 Attempting to fetch from external API: https://evaluation.coderf5.es/v1/competences/
[GET /api/competences] ✓ Successfully fetched X raw competences from external API
[GET /api/competences] ✓ Normalised data includes: X competences with areas, tools, indicators
[GET /api/competences] ✓ Sample competence structure: {...}

[GET /api/tools] 🔄 Attempting to fetch from external API: https://evaluation.coderf5.es/v1/tools/
[GET /api/tools] ✓ Successfully fetched X tools from external API

[GET /api/indicators] 🔄 Attempting to fetch from external API: https://evaluation.coderf5.es/v1/indicators/
[GET /api/indicators] ✓ Successfully fetched X indicators from external API
```

### En la Consola del Navegador (F12):
```
✅ [VERIFICATION] Competences received from API https://evaluation.coderf5.es/v1/competences
[Eval] catalogRaw.length: X competences
[Eval] catalogRaw[0].id: ...
[Eval] catalogRaw[0].areas: [...]
[Eval] catalogRaw[0].tools count: X (from API)
[Eval] catalogRaw[0].indicators (COMPETENCE INDICATORS): {...}
```

---

## Troubleshooting

### Si ves logs con ⚠️ (warning):
```
[GET /api/competences] ⚠️ External API unavailable, using local DB fallback
```

**Significa:**
- La API externa `https://evaluation.coderf5.es/v1/competences` retornó un error
- El sistema automáticamente usa la BD local como fallback
- Verifica el token JWT y la conectividad de red

**Próximos pasos:**
- Revisa el error exacto en los logs del servidor: `Response body: ...`
- Verifica que el token tiene permisos para `evaluation.coderf5.es`
- Comprueba la conectividad: `curl -H "Authorization: Bearer <token>" https://evaluation.coderf5.es/v1/competences/`

---

## Estructura de Datos Esperada

### Competencia con Indicadores De Competencia y De Herramientas:

```javascript
{
  id: "comp-001",
  name: "Arquitectura de Soluciones Cloud",
  description: "Capacidad de diseñar soluciones cloud escalables",
  
  // Indicadores de COMPETENCIA (determinan nivel de competencia)
  indicators: {
    initial: [
      { id: "ind-1", name: "Conoce conceptos básicos", description: "..." }
    ],
    medio: [
      { id: "ind-2", name: "Diseña arquitecturas", description: "..." }
    ],
    advance: [
      { id: "ind-3", name: "Optimiza en producción", description: "..." }
    ]
  },
  
  // Herramientas asociadas (se evalúan independientemente)
  tools: [
    {
      id: "tool-aws",
      name: "AWS",
      description: "Amazon Web Services",
      indicators: [  // Indicadores de HERRAMIENTA
        { id: "tool-ind-1", name: "Usa consola", levelId: 1 },
        { id: "tool-ind-2", name: "Configura instancias", levelId: 2 }
      ]
    }
  ],
  
  // Áreas de conocimiento
  areas: [
    { id: "area-1", name: "Cloud Computing", icon: "☁️" }
  ],
  
  // Niveles con indicadores de herramientas agrupados
  levels: [
    {
      levelId: 1,
      levelName: "Inicial",
      indicators: [
        { id: "tool-ind-1", name: "Usa consola", toolName: "AWS" }
      ]
    }
  ]
}
```

---

## Cambios Realizados

1. **Separación de indicadores:**
   - `indicators` (competencia): Determina el nivel de competencia
   - `tools.indicators` (herramienta): Se evalúan independientemente

2. **Logs mejorados:**
   - Cada endpoint de API ahora muestra intentos de conexión y fallbacks
   - Se incluyen muestras de estructura de datos para debugging

3. **Normalización completa:**
   - `normaliseEvalCompetence()` incluye competence indicators
   - Se preservan todas las herramientas con sus indicadores

---

**Última actualización:** 17 de marzo de 2026
**Status:** ✅ Sistema consumiendo API externa `https://evaluation.coderf5.es/v1`
