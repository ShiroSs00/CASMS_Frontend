# OceVie Web Design System

> Product design contract for `CASMS_WebAdmin` and `CASMS_WebBooking`.
> Brand baseline: OceVie navy, teal, gold, sand, and pearl; Be Vietnam Pro and Sora.
> Source baseline reviewed: `ShiroSs00/CASMS_Frontend`, branch `main`, commit `4b749869c9577f3d98faf4719b933daba69e5f8c`.

## 1. Purpose and design principles

OceVie is a cruise platform with two different web audiences:

- **Web Admin** supports staff who configure, review, prepare, and operate cruise-related records. The interface prioritizes task completion, data accuracy, permissions, traceability, and scanning efficiency.
- **Web Booking** supports customers exploring voyages and completing a booking. The interface prioritizes confidence, clear choices, itinerary discovery, transparent package information, and a low-friction booking journey.

The two applications share brand foundations, semantic tokens, accessibility rules, and component behavior. They must not be forced into the same page layout or information density.

Principles:
1. Task clarity before decoration.
2. One visual language, two experiences.
3. Progressive disclosure: show what is needed for the current task.
4. Preserve source values, status meanings, permissions, and business validation.
5. Accessibility is part of the component contract.
6. Improve existing components before introducing another library or abstraction.

## 2. Source hierarchy: product rules, OpenDesign, and Carbon

Use this priority order when guidance conflicts:

1. Explicit user-approved product and business decisions.
2. Existing API contracts, role permissions, domain states, and established product terminology.
3. This OceVie `DESIGN.md` and `tokens.css`.
4. IBM Carbon guidance for interaction patterns, accessibility, component anatomy, and design-system discipline.
5. OpenDesign and UI/UX skill recommendations where higher-priority sources are silent.

**OpenDesign's role:** agent workflow and design-system workspace. Treat this document as the OceVie brand contract. The package uses `manifest.json`, `DESIGN.md`, and `tokens.css`.

**Carbon's role:** design and behavior reference for controls and enterprise interaction patterns. Carbon does not replace OceVie's brand identity. Do not import IBM's default blue palette, IBM Plex typography, or square geometry into OceVie.

**Runtime library decision:** Carbon is not currently installed in either web app. Do not add `@carbon/react` or migrate screens as part of a design-guideline task. First validate this contract on a pilot screen. A later, explicitly approved implementation may selectively adopt Carbon components. Use a supported package line compatible with the repository's React version; never use deprecated `carbon-components-react`.

## 3. Brand color and semantic roles

### Existing brand palette

| Token | Value | Intended role |
|---|---|---|
| Midnight | `#061A2B` | Darkest brand surface and high-contrast chrome |
| Navy | `#0B2A4A` | Primary brand, headings, primary actions |
| Teal | `#0E6B7A` | Focus, secondary action, information accent |
| Gold | `#D4AF37` | Accent line and selected marker on dark surfaces; use sparingly |
| Sand | `#DBC9A7` | Warm secondary surface and decorative support |
| Pearl | `#F8F6EC` | Warm page canvas and brand background |
| Secondary text | `#506777` | Supporting text on light surfaces |
| Default border | `#D5E0E4` | Subtle dividers and non-critical boundaries |
| Success | `#167347` | Positive status |
| Danger | `#B42318` | Error and destructive status |

### Semantic color rules

- Use navy for the main action and primary text.
- Use teal for focus, information, and secondary interaction. Do not use it decoratively everywhere.
- Gold on pearl has insufficient contrast for normal text. Never use gold text on pearl or white backgrounds.
- Use semantic status tokens for success, warning, danger, and information. Always pair color with a readable label or icon; never communicate status by color alone.
- Keep page canvas and content surfaces distinct but calm. Avoid nesting multiple bordered cards around every block.
- Keep decorative borders separate from interactive control boundaries.

### Contrast observations

Calculated ratios for the current palette:
- Navy on pearl: approximately **13.42:1**.
- Teal on pearl: approximately **5.70:1**.
- Secondary text on pearl: approximately **5.46:1**.
- Gold on pearl: approximately **1.94:1** — not suitable for normal text.
- Existing `#8297A4` control border on pearl: approximately **2.80:1** — too weak as the only visible boundary for an interactive control.

Recommended stronger control boundary: `#718391` (approximately 3.62:1 on pearl and 3.92:1 on white). The web apps map this value to their existing `--border-control` token.

Target WCAG AA contrast: at least 4.5:1 for normal text and 3:1 for large text and meaningful UI component boundaries/focus indicators.

## 4. Typography

Preserve the current brand fonts:
- **Body and UI:** Be Vietnam Pro.
- **Headings and display:** Sora.
- Use self-hosted font files already present in each app. Do not add another font family without a clear reason and approval.

Recommended hierarchy:
- Page title: 28–36px, Sora, semibold; scale down responsively.
- Section heading: 18–22px, Sora, semibold.
- Body: 14–16px, Be Vietnam Pro, regular.
- Form label: 13–14px, Be Vietnam Pro, medium.
- Supporting metadata: 12–13px; do not use small metadata styling for essential instructions.
- Numeric data, dates, times, and currency should use tabular numerals where practical.

Use sentence case for new labels and headings. Reserve uppercase and letter spacing for short eyebrow labels or metadata, not long navigation names or form labels. Preserve Vietnamese diacritics and avoid condensed or decorative fonts for operational data.

## 5. Spacing, sizing, shape, and elevation

Use a 4px base spacing rhythm. Preferred scale: 4, 8, 12, 16, 24, 32, 48, 64, 80px.

Control sizes:
- Compact: 36px; only for dense secondary controls where context supports it.
- Default: 44px; standard buttons, inputs, selects, and search controls.
- Large: 48px; prominent customer-facing actions or spacious search controls.
- Do not mix sizes within the same button group.

Recommended shape tokens:
- Control radius: 6px.
- Admin panel radius: 8–10px.
- Booking card radius: 12–16px.
- Modal radius: 12px.
- Pill radius: 999px, only for compact tags or filter chips.

Use borders and surface layering before shadows. Reserve stronger elevation for dialogs, drawers, sticky summaries, and floating menus. Do not give every panel a large shadow.

## 6. Two application experience rules

### Web Admin — operational workspace

Visual direction: calm enterprise workspace, information-dense but not cramped.

- Keep the current navy masthead and light sidebar concept.
- Preserve role-aware navigation and the active item indicator.
- Page header contains a clear title, concise context, breadcrumb where useful, and a restrained action group.
- Use one high-emphasis primary action per page/action group. Use lower-emphasis actions for secondary operations.
- Prefer filter toolbar + result count + data table + pagination for management lists.
- Use structured form sections for create/edit flows. Keep field labels, hints, and errors aligned.
- Use tabs only for sibling views of the same record or workspace. Use a stepper for a sequential workflow.
- Keep operational statuses visible and understandable without relying on color.
- Use compact density only where repeated data scanning benefits; do not shrink text to fit a table.

### Web Booking — customer journey

Visual direction: premium, welcoming, editorial travel experience; retain current OceVie imagery and brand palette.

- Keep the public top navigation and footer model. Do not introduce the Admin sidebar.
- Use travel imagery to establish destination context, not as decoration that competes with the booking task.
- Voyage cards prioritize route, dates, duration, ship, key inclusions, and price information that is actually available.
- Filters should be easy to understand and removable when active.
- Detail pages make itinerary, departure information, package inclusions, and limitations easy to compare.
- Booking steps show progress, preserve entered information, and explain what happens next.
- Keep the booking summary visible when it materially helps the customer make a decision.
- Avoid admin-style dense tables for customer choices; use comparison cards or structured summaries when they improve comprehension.
- Use one dominant next action per booking step and make the back/edit path clear.

## 7. Component contracts

### Buttons and actions

Variants:
- **Primary:** main positive action for the current page or step.
- **Secondary:** paired with a primary action for a negative/return action such as Cancel or Back.
- **Tertiary/Ghost:** lower-emphasis independent actions, toolbar actions, and contextual actions.
- **Danger:** destructive actions such as Delete, Remove, or Stop; include a visible text label.

Rules:
- One high-emphasis primary button per page/action group, except independent application chrome or dialog contexts.
- Button labels describe the result: “Lưu thay đổi”, “Tạo chuyến đi”, “Mở bán” only when that is the actual action.
- Use links for navigation and buttons for actions.
- Avoid icon-only destructive actions. Give icon-only controls an accessible name and tooltip where needed.
- Disabled actions should explain the unmet prerequisite when the reason is not obvious.

### Text fields, select, and search

- Always show a visible label. Placeholder text is an example or hint, not a substitute for the label.
- Keep labels above fields in forms.
- Use one standard control height per context and align button, input, select, and search baselines.
- Put helper text and validation beside the relevant field.
- On error, set the invalid state, associate the message programmatically, and provide a clear correction instruction.
- Search is for a meaningful dataset or discovery task. Do not add a search box to a small list that is already easy to scan.
- Search should have clear, submit, filled, focus, and disabled states. Support keyboard submission and clearing.

### Checkbox and radio

- Use the same visual size, label alignment, spacing, and selected-state color.
- Use checkbox for independent choices; radio for one choice from a mutually exclusive set.
- Keep the clickable label area comfortable and preserve keyboard operation.
- Do not introduce switch or slider components unless a real product screen needs them.

### Table, list row, badge, and chip

- Align names and descriptions left.
- Align numeric values, totals, and currency consistently; use tabular numerals.
- Align dates and times consistently and keep their format stable within a table.
- Put row-level actions in a predictable final column or contextual menu; avoid a row full of equally prominent buttons.
- Keep row density consistent within a table.
- Use a **badge/tag** for a record's status.
- Use a **chip** for an active, removable filter or selected criterion. Do not turn every metadata value into a chip.
- Avoid nested panels around each table row. Use row separators, whitespace, and subtle hover feedback.
- Empty, loading, and error states belong in the results region and should preserve page context.

### Tabs and navigation

- Use one consistent tab typography, spacing, selected indicator, and focus style within each application.
- Use tabs for sibling content views, not sequential steps.
- Selected tabs must be visually distinct and programmatically exposed with `aria-selected`.
- Support arrow-key movement and Home/End where the tab pattern is used.
- Keep Admin sidebar navigation and Booking top navigation distinct; standardize active-state clarity, focus, and labels rather than forcing one navigation component on both.

### Modal, drawer, alert, and toast

- Modal anatomy: header (title and optional description), body (task content), footer (actions).
- Keep the close action predictable and protect unsaved changes.
- Use a modal for a focused decision or short task; use a drawer for contextual editing that benefits from keeping the underlying record visible.
- Do not place a long multi-step workflow inside a small modal.
- Use inline field errors for corrections. Use an error alert for a blocking page-level failure.
- Use toast for short, non-blocking confirmation such as a successful save. Do not use toast as the only place for important failure details.

### Loading, empty, and error states

- Loading state explains what is loading when the wait is not immediate.
- Empty state explains why there is no result and offers a relevant next action when one exists.
- Error state explains what failed, what the user can do, and whether retry is safe.
- Preserve user-entered values after recoverable failures.
- Do not show success feedback before the server confirms the operation.

## 8. Carbon component reference map

Use Carbon as the behavior and specification reference for these mappings:

| OceVie component | Carbon reference |
|---|---|
| Button | Button variants and hierarchy |
| Text field | Text Input / Number Input |
| Select | Select / Dropdown / Multiselect |
| Search | Search |
| Checkbox / Radio | Checkbox / Radio Button |
| Table | Data Table |
| Status badge | Tag |
| Tabs | Tabs |
| Modal | Modal |
| Drawer | Side panel / tearsheet patterns where appropriate |
| Inline alert | Inline Notification |
| Toast | Toast |
| Tooltip | Tooltip |
| Pagination | Pagination |

Do not import IBM's brand colors or typography because Carbon is the reference. Map Carbon's semantic behavior to OceVie's tokens. Avoid using two component libraries on the same screen without a deliberate migration boundary.

## 9. Accessibility and interaction

- Meet WCAG AA color contrast: 4.5:1 normal text; 3:1 large text and meaningful UI component/focus boundaries.
- Every interactive control has a visible focus state that is not removed by CSS.
- All actions are keyboard operable; focus order follows visual and task order.
- Form controls have visible labels and programmatically associated hints/errors.
- Dialogs manage focus, return focus to the invoking control, and prevent accidental loss of unsaved changes.
- Do not rely on color, hover, or icon shape alone to communicate meaning.
- Respect `prefers-reduced-motion`.
- Use semantic HTML before adding ARIA roles. When a tab pattern is used, implement its complete keyboard and ARIA behavior.

## 10. Motion and visual craft

- Motion must explain state change, spatial relationship, or feedback.
- Prefer opacity and transform over layout-changing animation.
- Keep transitions short and restrained in Admin; Booking may use slightly more expressive transitions for discovery and step progression.
- Never delay an important action with decorative motion.
- Respect reduced-motion settings.
- Avoid generic AI-generated patterns: random gradients, excessive glassmorphism, decorative blobs, repeated floating cards, arbitrary icon rows, and animation without task meaning.

## 11. Current repository baseline and implementation mapping

Reviewed repository: `ShiroSs00/CASMS_Frontend`, branch `main`, commit `4b749869c9577f3d98faf4719b933daba69e5f8c`.

Both web apps use React 19.2.8, TypeScript 6.0.2, Vite 8.3.0, React Router 8.4.0, CSS Modules, and custom UI components. Neither app currently declares Carbon as a dependency.

Existing component entry points:
- Admin: `CASMS_WebAdmin/src/shared/ui/AdminUI.tsx`.
- Booking: `CASMS_WebBooking/src/shared/ui/Primitives.tsx`.
- Admin shell: `CASMS_WebAdmin/src/shared/ui/admin-v3/AdminShell.tsx`.
- Booking shell: `CASMS_WebBooking/src/app/layouts/PublicLayout.tsx`.
- Overlay: `src/shared/ui/Overlay.tsx` in both apps.
- Tokens: `src/styles/tokens.css` in both apps.

Source-level observations:
- Both apps currently carry the same `tokens.css`, `Experience.module.css`, and `Overlay.tsx` blob content.
- `AdminUI.module.css` and `Primitives.module.css` are byte-identical in the reviewed branch.
- Admin and Booking component entry points are not identical; Admin also wraps its admin shell and has app-specific exports.
- Admin already has shared `DataTable`, `Field`, `Button`, `Badge`, `Notice`, `Panel`, and `Modal` components.
- Booking has a matching primitive surface, but its public layout and booking pages have their own visual requirements.
- Tabs are implemented locally in multiple Admin screens. The Trip Schedule tabs and Departure Preparation tabs currently use different selected-state treatments. They should converge on one tab contract without changing business workflow.
- The apps are independently configured for development and deployment. Do not create cross-app imports or a shared-package migration as part of a visual-only task without checking build and deployment boundaries.

### Pilot screen: Web Admin → Quản lý lịch trình

Use this screen as the first acceptance surface because it exercises the highest-value shared patterns:
- Trip context and page header.
- Version selection and version context.
- Route/program tabs.
- Day navigation and itinerary editing.
- Validation summary and field-level errors.
- Stop/activity drawers and confirmation dialogs.
- Save, finalize, history, and conflict states according to the existing permissions and lifecycle.

The pilot must preserve existing behavior, including version selection, draft editability, unsaved-change protection, validation, and permission checks. Do not simplify or rename workflow actions in a way that changes their meaning.

After the pilot visual direction is approved, apply the shared component contract to the remaining Admin screens. Then apply the customer-specific rules to Booking:
- Cruise discovery/catalog.
- Cruise detail and itinerary.
- Cruise Package and cabin selection.
- Traveller information.
- Booking review and confirmation.

### Runtime token mapping

Both web entry points load their existing `src/styles/tokens.css`, which imports this directory's canonical stylesheet in the `ocevie` cascade layer. App tokens map the shared palette, typography, borders, control sizes, radii, and elevation to the names the current components consume. Existing unlayered spacing and panel aliases retain their current values where names overlap. Use an `--ocevie-*` canonical token for new values that need a stable name across those aliases. Keep the repository root design-system directory available during builds of either application. The generated app bundles include the CSS.

The shared primitives use 44px controls by default, 36px for explicitly compact buttons, and 48px inside the public Booking shell. Standard controls use a 6px radius and dialogs use a 12px radius. For a form overlay, mark footer actions that dismiss the dialog with `data-overlay-dismiss` and pass `busy` while submitting. Keep the draft intact while the discard prompt is open.

## 12. Rollout order

1. **Foundation:** use the shared semantic tokens, control sizing, typography, focus, and spacing through the runtime mapping.
2. **Core form actions:** Button, Field, Text Input, Select, Search, validation, Modal, Drawer.
3. **Data display:** Data Table, list row, Badge/Tag, filter Chip, pagination.
4. **Tabs and navigation:** unify selected state, spacing, and keyboard behavior while preserving each app's navigation model.
5. **Booking journey:** refine discovery cards, package comparison, cabin selection, step progress, summary, and booking feedback.
6. **Expansion:** apply approved components to remaining screens by feature area. Do not perform a whole-repository visual rewrite in one pass.

## 13. Source references

- OpenDesign repository: https://github.com/nexu-io/open-design
- OpenDesign design-system authoring guide: https://github.com/nexu-io/open-design/blob/main/docs/design-systems.md
- OpenDesign frontend-design skill: https://github.com/nexu-io/open-design/tree/main/skills/frontend-design
- IBM Carbon component overview: https://carbondesignsystem.com/building-blocks/core/components/overview/components
- Carbon button guidance: https://carbondesignsystem.com/building-blocks/core/components/button/guidelines
- Carbon form guidance: https://carbondesignsystem.com/building-blocks/core/components/form/guidelines
- Carbon search guidance: https://carbondesignsystem.com/building-blocks/core/components/search/guidelines
- Carbon data table guidance: https://carbondesignsystem.com/building-blocks/core/components/data-table/guidelines
- Carbon tabs guidance: https://carbondesignsystem.com/building-blocks/core/components/tabs/guidelines
- Carbon modal guidance: https://carbondesignsystem.com/building-blocks/core/components/modal/guidelines
- Carbon themes and tokens: https://carbondesignsystem.com/building-blocks/foundations/themes/overview
- Carbon accessibility color guidance: https://carbondesignsystem.com/building-blocks/foundations/accessibility/color
