# Course Progress Bar Implementation

## Overview

A course progress indicator has been implemented for the Overview dashboard. It displays:
- **Progress percentage** of course completion
- **Visual progress bar** with smooth animations
- **Current week** information (Week X of Y)
- **Remaining days** until course completion
- **Course status** (Upcoming, Active, Completed)

---

## Components

### 1. **HTML Structure** (`promotion-detail.html`, lines 135-152)

```html
<!-- Course Progress Bar -->
<div class="mb-4">
    <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0 text-dark">
            <i class="bi bi-graph-up me-2 text-info"></i>Progreso del Curso
        </h6>
        <small class="text-muted" id="progress-label">-</small>
    </div>
    <div class="progress" style="height: 24px; border-radius: 8px; background-color: #f0f0f0;">
        <div id="progress-bar" class="progress-bar progress-bar-striped" role="progressbar" 
             style="width: 0%; border-radius: 8px; background: linear-gradient(90deg, #0d6efd, #0d9efd); font-size: 12px; font-weight: bold; color: white; display: flex; align-items: center; justify-content: center; transition: width 0.3s ease;"
             aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
        </div>
    </div>
    <div class="d-flex justify-content-between mt-2" style="font-size: 0.85rem;">
        <small class="text-muted" id="progress-start-info">-</small>
        <small class="text-muted" id="progress-week-info">-</small>
        <small class="text-muted" id="progress-end-info">-</small>
    </div>
</div>
```

**Key HTML Elements:**
- `progress-label`: Displays status text (e.g., "65% completado", "Próximo a comenzar")
- `progress-bar`: The visual progress bar element that fills based on percentage
- `progress-start-info`: Shows course start date
- `progress-week-info`: Shows current week or total weeks
- `progress-end-info`: Shows remaining days or end date

---

### 2. **JavaScript Function** (`promotion-detail.js`, lines 2432-2510)

#### Main Function: `updateCourseProgressBar(promotion)`

**Location:** After `loadPromotion()` function

**Parameters:**
- `promotion` (Object): Contains `startDate` and `endDate` properties

**Functionality:**

```javascript
function updateCourseProgressBar(promotion) {
    // 1. Validate input
    if (!promotion.startDate || !promotion.endDate) return;
    
    // 2. Parse dates
    const startDate = new Date(promotion.startDate);
    const endDate = new Date(promotion.endDate);
    const now = new Date();
    
    // 3. Calculate progress percentage (0-100)
    const totalDuration = endDate - startDate;
    const elapsed = now - startDate;
    let progressPercent = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
    progressPercent = Math.round(progressPercent);
    
    // 4. Calculate remaining days
    const remainingMs = endDate - now;
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    
    // 5. Calculate current week
    const totalWeeks = Math.ceil(totalDuration / (1000 * 60 * 60 * 24 * 7));
    const elapsedWeeks = Math.floor(elapsed / (1000 * 60 * 60 * 24 * 7)) + 1;
    const currentWeek = Math.min(elapsedWeeks, totalWeeks);
    
    // 6. Update DOM elements with calculated values
    // ... (see full implementation)
}
```

**Calculation Logic:**

1. **Progress Percentage:**
   ```
   progressPercent = (elapsed / totalDuration) * 100
   ```
   - Clamped between 0% and 100%
   - Rounded to nearest integer

2. **Remaining Days:**
   ```
   remainingDays = ceil((endDate - now) / milliseconds_per_day)
   ```

3. **Current Week:**
   ```
   currentWeek = min(floor(elapsed / milliseconds_per_week) + 1, totalWeeks)
   ```

---

### 3. **CSS Styling** (`promotion-detail.css`, lines 1765-1799)

```css
/* Course Progress Bar Styles */
.progress {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.progress-bar {
    background: linear-gradient(90deg, #0d6efd, #0d9efd);
    transition: width 0.3s ease;
}

.progress-bar.progress-bar-striped::after {
    animation: progress-bar-stripes 1s linear infinite;
}

@keyframes progress-bar-stripes {
    0% { background-position: 0; }
    100% { background-position: 40px; }
}

#progress-bar {
    font-weight: bold;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

**Visual Features:**
- Blue gradient background (`#0d6efd` to `#0d9efd`)
- Subtle box shadow for depth
- Smooth 0.3s transition when width changes
- Diagonal striped animation pattern
- Centered percentage text

---

## Integration Points

### Called From:
1. **`loadPromotion()` function** (line 2403)
   - Called when the promotion data is loaded
   - Updates the progress bar whenever promotion data changes

2. **Page Load (`DOMContentLoaded`)** (line 443)
   - Initial call to load and display all promotion data including progress

3. **Overview Tab Access**
   - Automatically triggered through `switchTab('overview')`

### Data Source:
- `promotion.startDate` (string, ISO format)
- `promotion.endDate` (string, ISO format)
- `promotion.weeks` (number, already calculated elsewhere)

---

## States & Display Logic

The progress bar displays different information based on course status:

### 1. **Upcoming Course** (now < startDate)
- **Progress:** 0%
- **Label:** "Próximo a comenzar"
- **Week Info:** "Total: X semanas"
- **End Info:** "Fin: [date]"

### 2. **Active Course** (startDate ≤ now ≤ endDate)
- **Progress:** X% (calculated)
- **Label:** "X% completado"
- **Week Info:** "Semana X de Y"
- **End Info:** "X días restantes"

### 3. **Completed Course** (now > endDate)
- **Progress:** 100%
- **Label:** "Curso finalizado"
- **Week Info:** "Finalizado"
- **End Info:** (empty)

---

## Accessibility Features

- **ARIA Attributes:**
  - `role="progressbar"` - Semantic role
  - `aria-valuenow` - Current progress value
  - `aria-valuemin="0"` - Minimum value
  - `aria-valuemax="100"` - Maximum value

- **Semantic HTML:** Uses `<small>` for supplementary info, proper heading hierarchy

---

## Code Quality

### Error Handling
```javascript
try {
    if (!promotion.startDate || !promotion.endDate) return;
    // ... calculation logic
} catch (error) {
    console.error('Error updating course progress bar:', error);
}
```

### Performance
- Single DOM query per element ID
- Efficient date calculations
- No external dependencies (vanilla JavaScript)

### Maintainability
- Clear variable names (`progressPercent`, `remainingDays`, `currentWeek`)
- Comments explaining each calculation step
- Modular function design (single responsibility)

---

## Testing Scenarios

### Test Case 1: Course Not Started
```
startDate: 2026-03-20
endDate: 2026-06-20
now: 2026-03-10
Expected: 0%, "Próximo a comenzar"
```

### Test Case 2: Course In Progress
```
startDate: 2026-02-01
endDate: 2026-06-01
now: 2026-04-01 (midway)
Expected: ~50%, "Semana 9 de 17"
```

### Test Case 3: Course Completed
```
startDate: 2026-01-01
endDate: 2026-03-01
now: 2026-04-01
Expected: 100%, "Curso finalizado"
```

---

## Browser Compatibility

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ ES6 features (Date, Math, const/let)
- ✅ CSS Grid & Flexbox
- ✅ CSS Transitions & Animations

---

## Future Enhancements

Possible improvements:
1. **Milestone markers** - Show module completion dates on the bar
2. **Progress history** - Track progress over time
3. **Custom colors** - Theme-based progress bar colors
4. **Responsive text** - Shorter labels on mobile devices
5. **Audio alerts** - Notification when course is nearing completion

---

## File Locations

| File | Changes | Lines |
|------|---------|-------|
| `promotion-detail.html` | Added progress bar HTML | 135-152 |
| `promotion-detail.js` | Added `updateCourseProgressBar()` function | 2432-2510 |
| `promotion-detail.js` | Added function call in `loadPromotion()` | 2403 |
| `promotion-detail.css` | Added progress bar styles | 1765-1799 |

---

## Summary

The course progress bar is a **clean, modular implementation** that:
- ✅ Calculates progress based on start/end dates
- ✅ Displays visually with a blue gradient bar
- ✅ Shows contextual information (week, remaining days)
- ✅ Handles all course states (upcoming, active, completed)
- ✅ Uses vanilla JavaScript with no dependencies
- ✅ Includes proper accessibility features
- ✅ Integrates seamlessly into existing dashboard
