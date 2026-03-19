# Testing - Maquetación de Evaluación por Niveles

## Pasos de Testing

### 1. Verificación Visual en Desktop (1920px+)

**Acción:**
- Ir a una promoción con evaluaciones
- Abrir la sección "Evaluación" del área docente
- Navegar a una evaluación existente o crear una nueva

**Verificar:**
- ✅ Aparecen exactamente 3 columnas: **Inicial**, **Medio**, **Avanzado**
- ✅ Cada columna tiene su encabezado con color naranja correspondiente
- ✅ Las competencias aparecen distribuidas en sus columnas correctas basadas en sus niveles
- ✅ Los colores son:
  - Columna 1: Naranja claro (#FFE5CC)
  - Columna 2: Naranja medio (#FFCC99)
  - Columna 3: Naranja oscuro (#FF9966)

### 2. Verificación de Agrupación de Competencias

**Acción:**
- Abrir una evaluación con múltiples competencias
- Observar en qué columna aparece cada competencia

**Regla de Agrupación:**
- Una competencia aparece en la columna del **nivel más alto disponible** en sus indicadores
  - Si tiene indicadores de nivel 3 (Avanzado) → Columna 3
  - Si tiene indicadores de nivel 2 (Medio) pero no de 3 → Columna 2
  - Si solo tiene indicadores de nivel 1 (Inicial) → Columna 1
  - Si no tiene indicadores automáticos pero tiene nivel manual → Usa el nivel manual asignado

**Ejemplo:**
```
Competencia "Arquitectura Cloud":
  - indicators.initial: [ind1, ind2]
  - indicators.medio: [ind3, ind4]
  - indicators.advance: [] (vacío)
  → Debe aparecer en columna 2 (Medio)

Competencia "DevOps":
  - indicators.initial: [ind1]
  - indicators.medio: []
  - indicators.advance: []
  → Debe aparecer en columna 1 (Inicial)
```

### 3. Funcionalidad de Checkboxes

**Acción:**
- Marcar/desmarcar indicadores de competencia
- Observar cálculo de niveles en tiempo real

**Verificar:**
- ✅ Los checkboxes funcionan correctamente
- ✅ El badge de "Nivel calculado" se actualiza
- ✅ Los indicadores de progreso (Nv.1, Nv.2, Nv.3) se cuentan correctamente
- ✅ La columna de tarjeta NO cambia (competencia permanece en su columna original)

### 4. Responsividad en Tablet (768px - 1200px)

**Acción:**
- Redimensionar navegador a 1024px (tablet)
- Observar layout

**Verificar:**
- ✅ Las 3 columnas se reducen a 2 columnas
- ✅ La disposición es flexible y legible
- ✅ Los textos y bordes se adaptan proporcionalmente

### 5. Responsividad en Móvil (< 768px)

**Acción:**
- Redimensionar navegador a 480px (móvil)
- Hacer scroll vertical

**Verificar:**
- ✅ Las columnas se apilan en una sola columna (100% width)
- ✅ Cada columna aparece completa en su fila
- ✅ El scroll vertical funciona correctamente
- ✅ Los elementos son tocables/clickeables (tamaño apropiado)

### 6. Guardar Evaluación

**Acción:**
- Marcar algunos indicadores
- Hacer clic en "Guardar" o navegar fuera
- Volver a la evaluación

**Verificar:**
- ✅ Los cambios se persisten correctamente
- ✅ Las competencias aparecen en las mismas columnas
- ✅ Los checkboxes marcados siguen marcados

### 7. Eliminar Competencia

**Acción:**
- Hacer clic en botón "X" de una tarjeta de competencia
- Observar transición

**Verificar:**
- ✅ La tarjeta desaparece con transición suave (fade out)
- ✅ Las otras competencias permanecen en sus columnas
- ✅ Las columnas se reorganizan correctamente

### 8. Herramientas e Indicadores Mixtos

**Acción:**
- Abrir competencia que tiene TANTO indicadores de competencia como de herramientas

**Verificar:**
- ✅ Se muestra sección verde "Indicadores de Competencia"
- ✅ Se muestra sección azul "Indicadores de Herramientas"
- ✅ Las herramientas están en accordion
- ✅ Los indicadores de competencia agrupados por nivel (1, 2, 3)

## Checklist Final

- [ ] Las 3 columnas aparecen en desktop con colores correctos
- [ ] Competencias distribuidas en columna correcta según sus indicadores
- [ ] Checkboxes funcionan y actualizan niveles
- [ ] Responsividad funciona (2 cols tablet, 1 col móvil)
- [ ] Guardar/cargar evaluaciones preserva estado
- [ ] Eliminar competencias funciona con transición
- [ ] Sin errores de console (F12)
- [ ] Performance aceptable (sin lag al interactuar)
- [ ] Accesibilidad: tab navigation funciona correctamente

## Revertir si es necesario

Si encuentras problemas críticos, revert es sencillo:
```bash
git revert HEAD  # Revertir último commit
# o
git checkout HEAD~1 -- <file>  # Revertir archivo específico
```

---

**Documento creado:** 17 de marzo de 2026
