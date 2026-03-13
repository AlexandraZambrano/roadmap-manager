# Course Progress Info Implementation

## Overview

This implementation populates the progress info section below the course progress bar with:
- **Left**: Course start date
- **Center**: Active students count and dropouts
- **Right**: Course end date

---

## Components

### 1. **HTML Structure** (`promotion-detail.html`, lines 147-152)

```html
<div class="d-flex justify-content-between mt-2" style="font-size: 0.85rem;">
    <small class="text-muted" id="progress-start-info">-</small>
    <small class="text-muted" id="progress-week-info">-</small>
    <small class="text-muted" id="progress-end-info">-</small>
</div>
```

**Element IDs:**
- `progress-start-info` - Left side (start date)
- `progress-week-info` - Center (student counts)
- `progress-end-info` - Right side (end date)

---

## JavaScript Functions

### 1. **`calculateStudentCounts(students)`**

**Location:** `promotion-detail.js`, after `updateCourseProgressBar()`

**Purpose:** Calculate active and withdrawn student counts

**Parameters:**
```javascript
students: Array<{
    isWithdrawn: boolean,
    // ... other student properties
}>
```

**Returns:**
```javascript
{
    active: number,      // Count of active students (!isWithdrawn)
    withdrawn: number,   // Count of withdrawn students (isWithdrawn)
    total: number        // Total students
}
```

**Example:**
```javascript
const students = [
    { id: 1, name: 'Alice', isWithdrawn: false },
    { id: 2, name: 'Bob', isWithdrawn: false },
    { id: 3, name: 'Charlie', isWithdrawn: true },
    { id: 4, name: 'Diana', isWithdrawn: false }
];

const counts = calculateStudentCounts(students);
// Returns: { active: 3, withdrawn: 1, total: 4 }
```

**Key Logic:**
```javascript
function calculateStudentCounts(students) {
    if (!Array.isArray(students)) {
        return { active: 0, withdrawn: 0, total: 0 };
    }
    
    const active = students.filter(s => !s.isWithdrawn).length;
    const withdrawn = students.filter(s => s.isWithdrawn).length;
    
    return {
        active: active,
        withdrawn: withdrawn,
        total: students.length
    };
}
```

---

### 2. **`formatDateShort(date, locale)`**

**Purpose:** Format date to readable short format (e.g., "12 Feb 2026")

**Parameters:**
- `date` (string | Date): ISO date string or Date object
- `locale` (string, optional): Locale code (default: 'es-ES')

**Returns:** (string) Formatted date string or '-' if invalid

**Examples:**
```javascript
formatDateShort('2026-02-12');           // "12 feb 2026"
formatDateShort(new Date('2026-02-12')); // "12 feb 2026"
formatDateShort('invalid-date');         // "-"
formatDateShort(null);                   // "-"
```

**Key Logic:**
```javascript
function formatDateShort(date, locale = 'es-ES') {
    if (!date) return '-';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return '-';
    
    return dateObj.toLocaleDateString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}
```

---

### 3. **`updateProgressInfo(promotion, students)`**

**Purpose:** Update the progress info section with dates and student counts

**Parameters:**
```javascript
promotion: {
    startDate: string,    // ISO date string
    endDate: string       // ISO date string
}

students: Array<{
    isWithdrawn: boolean,
    // ... other properties
}>
```

**Side Effects:** Updates DOM elements:
- `#progress-start-info` - "Inicio: [date]"
- `#progress-week-info` - "[N] activos · [M] bajas"
- `#progress-end-info` - "Fin: [date]"

**Example Output:**
```
Inicio: 12 feb 2026
18 activos · 3 bajas
Fin: 30 jun 2026
```

**Key Logic:**
```javascript
function updateProgressInfo(promotion, students) {
    try {
        if (!promotion) return;
        
        // Calculate student counts
        const counts = calculateStudentCounts(students);
        
        // Update start date
        const startInfo = document.getElementById('progress-start-info');
        if (startInfo) {
            const startDate = formatDateShort(promotion.startDate);
            startInfo.textContent = 'Inicio: ' + startDate;
        }
        
        // Update student info
        const weekInfo = document.getElementById('progress-week-info');
        if (weekInfo) {
            if (counts.active > 0 || counts.withdrawn > 0) {
                let infoText = counts.active + ' activ' + 
                    (counts.active === 1 ? 'o' : 'os');
                
                if (counts.withdrawn > 0) {
                    infoText += ' · ' + counts.withdrawn + ' bajas';
                }
                
                weekInfo.textContent = infoText;
            } else {
                weekInfo.textContent = '-';
            }
        }
        
        // Update end date
        const endInfo = document.getElementById('progress-end-info');
        if (endInfo) {
            const endDate = formatDateShort(promotion.endDate);
            endInfo.textContent = 'Fin: ' + endDate;
        }
    } catch (error) {
        console.error('Error updating progress info:', error);
    }
}
```

---

## Integration Points

### Called From:

1. **`loadPromotion()`** (line ~2410)
   ```javascript
   // Update course progress bar and info
   updateCourseProgressBar(promotion);
   
   // Update progress info with students if available
   const students = window.currentStudents || [];
   updateProgressInfo(promotion, students);
   ```

2. **`switchTab('overview')`** (line ~2337)
   ```javascript
   if (tabId === 'overview') {
       loadOverviewCalendarId();
       loadOverviewPildoraAlert();
       loadOverviewAttendanceAlert();
       
       // Update progress info with current students
       if (window.currentPromotion) {
           const students = window.currentStudents || [];
           updateProgressInfo(window.currentPromotion, students);
       }
   }
   ```

### Data Sources:

- `window.currentPromotion` - Promotion data (populated by `loadPromotion()`)
- `window.currentStudents` - Student list (populated by `loadStudents()`)

---

## Example Data Structure

### Promotion Object:
```javascript
{
    id: 'promo-001',
    name: 'Bootcamp IA - Cohorte 2026-1',
    description: 'Curso intensivo de Inteligencia Artificial',
    startDate: '2026-02-12T09:00:00Z',
    endDate: '2026-06-30T17:00:00Z',
    weeks: 19,
    teacherId: 'teacher-123',
    modules: [],
    // ... other properties
}
```

### Students Array:
```javascript
[
    {
        id: 'student-001',
        name: 'Alice',
        lastname: 'Johnson',
        email: 'alice@example.com',
        isWithdrawn: false
    },
    {
        id: 'student-002',
        name: 'Bob',
        lastname: 'Smith',
        email: 'bob@example.com',
        isWithdrawn: false
    },
    {
        id: 'student-003',
        name: 'Charlie',
        lastname: 'Brown',
        email: 'charlie@example.com',
        isWithdrawn: true  // Dropped out
    },
    // ... more students
]
```

---

## Grammar & Localization

The implementation uses Spanish grammar with proper singular/plural handling:

**Singular (1 active):**
- "1 activo" ✓

**Plural (2+ active):**
- "18 activos" ✓

**Dropouts:**
- "3 bajas" (always plural, even for 1)

### To Support Other Languages:

Modify the `updateProgressInfo()` function:

```javascript
// English example
const grammar = counts.active === 1 ? 'student' : 'students';
infoText = counts.active + ' ' + grammar + ' active';

if (counts.withdrawn > 0) {
    const withdrawnGrammar = counts.withdrawn === 1 ? 'dropout' : 'dropouts';
    infoText += ' · ' + counts.withdrawn + ' ' + withdrawnGrammar;
}
```

---

## Behavior & Edge Cases

### Case 1: All Active Students
```
Input: 25 active, 0 withdrawn
Output: "25 activos"
```

### Case 2: Some Dropouts
```
Input: 18 active, 3 withdrawn
Output: "18 activos · 3 bajas"
```

### Case 3: Only Dropouts
```
Input: 0 active, 5 withdrawn
Output: "5 bajas"
```

### Case 4: No Students
```
Input: 0 active, 0 withdrawn
Output: "-"
```

### Case 5: Invalid Dates
```
Input: null/undefined dates
Output: "Inicio: -"  and  "Fin: -"
```

### Case 6: No Student Data
```
Input: students = []
Output: "-" (from updateProgressInfo middle element)
```

---

## Performance Considerations

- **Time Complexity:** O(n) where n = number of students (single pass filter)
- **Space Complexity:** O(1) - only storing counts
- **DOM Updates:** 3 elements updated per call
- **Caching:** No caching needed; called only when tab accessed or promotion loaded

---

## Testing Scenarios

### Test 1: Initial Load
```javascript
// Setup
window.currentPromotion = {
    startDate: '2026-02-12',
    endDate: '2026-06-30'
};
window.currentStudents = [
    { id: 1, name: 'Alice', isWithdrawn: false },
    { id: 2, name: 'Bob', isWithdrawn: false },
    { id: 3, name: 'Charlie', isWithdrawn: true }
];

// Call
updateProgressInfo(window.currentPromotion, window.currentStudents);

// Expected Output
// #progress-start-info: "Inicio: 12 feb 2026"
// #progress-week-info: "2 activos · 1 bajas"
// #progress-end-info: "Fin: 30 jun 2026"
```

### Test 2: Tab Switch
```javascript
// Simulate switching to Overview tab
switchTab('overview');

// Should call:
// → updateProgressInfo() with current promotion and students
```

### Test 3: Dynamic Updates
```javascript
// Student added/removed and view refreshed
window.currentStudents.push({ id: 4, name: 'Diana', isWithdrawn: false });
updateProgressInfo(window.currentPromotion, window.currentStudents);

// Updates dynamically
```

---

## File Locations

| File | Changes | Lines |
|------|---------|-------|
| `promotion-detail.js` | Added `calculateStudentCounts()` | ~2440 |
| `promotion-detail.js` | Added `formatDateShort()` | ~2460 |
| `promotion-detail.js` | Added `updateProgressInfo()` | ~2485 |
| `promotion-detail.js` | Called from `loadPromotion()` | ~2410 |
| `promotion-detail.js` | Called from `switchTab()` | ~2337 |
| `promotion-detail.html` | HTML elements already present | 147-152 |

---

## Summary

✅ **Modular Functions:**
- `calculateStudentCounts()` - Pure data processing
- `formatDateShort()` - Date formatting utility
- `updateProgressInfo()` - DOM rendering

✅ **Automatic Updates:**
- On page load
- When switching to Overview tab
- When promotion/student data changes

✅ **Robust Error Handling:**
- Null/undefined checks
- Invalid date handling
- Try-catch blocks

✅ **Vanilla JavaScript:**
- No external libraries
- Works in all modern browsers
- Clean, maintainable code

✅ **Localization Ready:**
- Spanish grammar implemented
- Easy to switch to other languages
- Date locale-aware formatting
