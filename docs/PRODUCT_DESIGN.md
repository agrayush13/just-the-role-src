# Product and interaction design

## Design principles

1. **The role stays primary.** Employer-written content and primary job actions remain intact.
2. **The user supplies meaning.** Keyword colors reflect explicit rules; the product never infers fit or importance.
3. **Every change has an exit.** Show original, Undo, view switching, and section expansion make transformations reversible.
4. **Uncertainty stays visible.** Unknown DOM structures and ambiguous labels are not changed.
5. **Privacy is part of the interface.** Sync is off by default, sensitive settings are disclosed, and diagnostics state what they omit.

## Main journeys

### First use

Chrome opens the full settings page once after a fresh installation, while the off-by-default Focus Mode prevents the page from changing unexpectedly. The popup shows an explicit Focus Mode: Off state; enabling it applies the preselected Balanced view. If the independently enabled Focus Bar remains visible, both extension surfaces explain that it can be used to enable Focus Mode from a job page.

### Choosing a view

The popup, options page, and Focus Bar expose the same named views. Balanced is the starting point, Minimal removes more supported optional content, and Native restores LinkedIn modules while allowing independent reading tools. Custom is always selectable, starts with Balanced choices on first use, remembers one independent category configuration, and exposes category-level controls in the popup and full settings.

Changing a preset does not reload the page or move scroll position. The most recent view or category change is undoable from the Focus Bar. A Custom view can be restored to its source preset.

### Customizing the page

Selecting Custom reveals the same saved category checkboxes in the popup, options page, and Focus Bar. Changes apply immediately and persist only the category choices; no job-page text, DOM path, or element identity is stored.

### Reviewing a description

Keyword markers use three deliberately non-evaluative labels:

- **Desired** for criteria the user wants to notice positively.
- **Notice** for neutral facts worth spotting.
- **Check** for criteria the user wants to investigate.

Text labels accompany color so meaning is not color-dependent. Links and controls are not marked. Counts summarize occurrences only.

When two or more reviewed headings are present, the Focus Bar offers jump links and the page adds collapse/expand controls. Collapse state resets on navigation and is never stored.

## Interface surfaces

### Popup

The popup is a compact quick-control surface: logo and name on the left, current-page status icon and settings gear on the right, explicit Focus Mode state, independent on-page widget switch, view selection, and a compact reading summary. Selecting Custom reveals every supported category as a direct hide/show checkbox and recalls the same saved Custom choices regardless of the previous preset. The status icon uses an accessible label and tooltip; it does not repeat the active preset. Privacy and the explicitly labeled Copy diagnostics action sit together as visually matching secondary footer actions. Turning off the widget removes only the Focus Bar; the chosen page cleanup and reading tools continue to run. Turning off Focus Mode restores LinkedIn content while leaving the independently enabled Focus Bar available with an Enable action.

### Options page

The options page is the durable configuration surface: views, module categories, keyword-rule editing, reading tools, Sync disclosure, and reset-to-defaults.

### Focus Bar

The Focus Bar sits immediately before the AI/profile-match module when that module is recognized, falling back to immediately before the job description. It uses Shadow DOM to isolate its UI styles and provides contextual controls without covering job content. The packaged logo appears directly before the JUSTTHEROLE name. Branding and view selection form a stable header, while actions and status occupy deliberate rows so wrapping does not split the interface arbitrarily. For built-in presets, the Focus Bar mirrors the popup's **Hidden on this page** category chips instead of reducing the result to a numeric count. Custom is always selectable and reveals the same saved category controls as the popup, using a two-column layout when space allows and a single column in narrow containers; the current-page chip summary is hidden in Custom.

## Accessibility

- Controls use native buttons and checkboxes plus an ARIA listbox pattern for extension-styled dropdowns.
- Focus-visible outlines remain strong in extension surfaces and injected controls.
- Live regions announce page state, saves, failures, and validation.
- Keyword meaning is expressed with text labels as well as color and border style.
- System reduced-motion preferences disable animation and smooth scrolling; a stored `reduce` override forces non-smooth section navigation.
- Section controls appear only when recognition confidence is high enough to avoid misleading navigation.

## Content style

Use concise, literal labels. Avoid claims that the extension understands, evaluates, or improves a user's fit. Prefer “match count” over “score,” “Check” over “dealbreaker” in visible UI, and “supported” when behavior depends on reviewed LinkedIn markup.

## Responsive and theme behavior

The popup uses an extension-sized layout with single-line control descriptions and places the on-page widget before view selection. The options page lets hero and explanatory copy use the available desktop width before switching to a stacked narrow layout. Helper text uses readable contrast and checkbox rows provide generous click targets. Extension dropdowns share one interaction model, maintain a 10-pixel chevron inset, and align their menus to their triggers. Injected markers define light and dark colors. The Focus Bar detects the page's rendered light or dark appearance, follows page-theme changes, and applies the same cream, green, surface, border, text, and focus-token family as the extension surfaces. No control relies on hover alone.
