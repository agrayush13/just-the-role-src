# Product and interaction design

## Design principles

1. **The role stays primary.** Employer-written content and primary job actions remain intact.
2. **The user supplies meaning.** Keyword colors reflect explicit rules; the product never infers fit or importance.
3. **Every change has an exit.** Show original, Undo, view switching, section expansion, and search counters make transformations reversible.
4. **Uncertainty stays visible.** Unknown DOM structures and ambiguous labels are not changed.
5. **Privacy is part of the interface.** Sync is off by default, sensitive settings are disclosed, and diagnostics state what they omit.

## Main journeys

### First use

The popup explains whether the current page is supported and presents an off-by-default Focus Mode switch. Enabling it applies the preselected Balanced view. Deliberate activation prevents a new install from unexpectedly changing LinkedIn.

### Choosing a view

The popup, options page, and Focus Bar expose the same named views. Balanced is the starting point, Minimal removes more supported optional content, and Native restores LinkedIn modules while allowing independent reading tools. Custom appears only after the user changes a category.

Changing a preset does not reload the page or move scroll position. The most recent view or category change is undoable from the Focus Bar. A Custom view can be restored to its source preset.

### Customizing the page

**Customize page** outlines only detected blocks from the reviewed selector registry. The user can select an outlined block directly or use the modal category list. Escape and Cancel leave settings unchanged and return focus to the trigger. Only the category toggle is saved.

### Reviewing a description

Keyword markers use three deliberately non-evaluative labels:

- **Desired** for criteria the user wants to notice positively.
- **Notice** for neutral facts worth spotting.
- **Check** for criteria the user wants to investigate.

Text labels accompany color so meaning is not color-dependent. Links and controls are not marked. Counts summarize occurrences only.

When two or more reviewed headings are present, the Focus Bar offers jump links and the page adds collapse/expand controls. Collapse state resets on navigation and is never stored.

### Cleaning a search list

Search cleanup is visually separated as an optional beta and starts off. Explicit Viewed or Applied labels may drive reversible collapsing. A Sponsored or Promoted label always exempts the card, even if another recognized status is present.

## Interface surfaces

### Popup

The popup is the quick control surface: current-page status, Focus Mode, view selection, a compact reading summary, full-settings access, and privacy-safe diagnostics.

### Options page

The options page is the durable configuration surface: views, module categories, keyword-rule editing, reading tools, Sync disclosure, search-list settings, and reset-to-defaults.

### Focus Bar

The Focus Bar sits immediately before the job description and uses Shadow DOM to isolate its UI styles. It provides contextual controls without covering job content. Its theme follows the nearest opaque page background.

## Accessibility

- Controls use native buttons, checkboxes, selects, and dialog semantics.
- Focus-visible outlines remain strong in extension surfaces and injected controls.
- The picker dialog receives initial focus and returns focus on cancellation.
- Escape cancels picker mode.
- Live regions announce page state, saves, failures, and validation.
- Keyword meaning is expressed with text labels as well as color and border style.
- System reduced-motion preferences disable animation and smooth scrolling; a stored `reduce` override forces non-smooth section navigation.
- Section controls appear only when recognition confidence is high enough to avoid misleading navigation.

## Content style

Use concise, literal labels. Avoid claims that the extension understands, evaluates, or improves a user's fit. Prefer “match count” over “score,” “Check” over “dealbreaker” in visible UI, and “supported” when behavior depends on reviewed LinkedIn markup.

## Responsive and theme behavior

The popup uses an extension-sized layout. The options page adapts its grids for narrower windows. Injected markers define light and dark colors, while the Focus Bar uses system canvas colors and a detected light/dark scheme. No control relies on hover alone.
