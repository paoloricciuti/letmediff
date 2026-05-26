---
name: letmediff
description: Mobile-first diff review for live agent handoff.
colors:
  diff-slate-canvas: "oklch(12% 0.008 240)"
  diff-slate-panel: "oklch(14% 0.01 240)"
  diff-slate-raised: "oklch(16% 0.012 240)"
  diff-slate-ink: "oklch(98% 0.005 240)"
  diff-slate-text: "oklch(92% 0.006 240)"
  diff-slate-muted: "oklch(55% 0.012 240)"
  diff-slate-border: "oklch(22% 0.012 240)"
  handoff-green: "oklch(75% 0.18 165)"
  handoff-green-hover: "oklch(80% 0.18 165)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif"
    fontSize: "clamp(1.7rem, 5vw, 2.2rem)"
    fontWeight: 580
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 560
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "ui-monospace, SF Mono, monospace"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.handoff-green}"
    textColor: "oklch(13% 0.04 165)"
    rounded: "{rounded.md}"
    padding: "0.65rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.handoff-green-hover}"
    textColor: "oklch(13% 0.04 165)"
    rounded: "{rounded.md}"
    padding: "0.65rem 1rem"
  input-feedback:
    backgroundColor: "oklch(10% 0.008 240)"
    textColor: "oklch(95% 0.006 240)"
    rounded: "{rounded.lg}"
    padding: "0.8rem 0.9rem"
  checkpoint-pill:
    backgroundColor: "oklch(15% 0.011 240)"
    textColor: "oklch(94% 0.008 240)"
    rounded: "{rounded.lg}"
    padding: "0.7rem 0.85rem"
---

# Design System: letmediff

## 1. Overview

**Creative North Star: "Pocket Review Console"**

letmediff is a compact, surgical review surface for developers reading agent-produced diffs away from their main workstation. The interface should feel like a serious console compressed for a phone: dark enough for focused code inspection, dense enough to preserve context, and direct enough that feedback can leave the reviewer's thumb and reach the waiting agent without ceremony.

The system uses familiar diff-review grammar, but the surrounding chrome has its own mobile-aware character. Sticky feedback, checkpoint pills, live-state dots, mono metadata, and sharply bounded panels make the agent handoff feel continuous while keeping the diff itself in charge.

This design explicitly rejects generic SaaS dashboard patterns, toy AI-product aesthetics, and wholesale GitHub cloning. Blue gradients, purple glow, novelty chat controls, interchangeable card grids, and marketing-template polish are prohibited.

**Key Characteristics:**
- Compact dark console surfaces with blue-slate tinting, never pure black.
- One decisive action color, Handoff Green, reserved for feedback, live state, focus, and targeted review state.
- Dense but touchable mobile controls: small visual footprint, forgiving hit areas.
- Familiar review primitives with small live-session details, not decorative spectacle.

## 2. Colors

The palette is Diff Slate plus Handoff Green: cool technical neutrals carry the review workload, while one crisp green signal marks the live agent return path.

### Primary
- **Handoff Green**: The only saturated action color. Use it for send actions, live indicators, focus rings, selected checkpoint target state, and active handoff affordances.
- **Handoff Green Hover**: The brighter interaction state for primary actions only. Do not use it as a decorative highlight.

### Neutral
- **Diff Slate Canvas**: The page background. It is dark, cool, and tinted; never replace it with pure black.
- **Diff Slate Panel**: The default panel and checkpoint container surface.
- **Diff Slate Raised**: The slightly lifted header, summary, and toolbar layer.
- **Diff Slate Ink**: Highest-emphasis text for page titles and critical labels.
- **Diff Slate Text**: Default readable text on dark surfaces.
- **Diff Slate Muted**: Metadata, timestamps, inactive labels, and quiet helper copy.
- **Diff Slate Border**: Structural dividers and panel outlines.

### Named Rules
**The One Signal Rule.** Handoff Green is rare on purpose. If more than one thing on a mobile viewport looks equally green, the reviewer cannot tell what returns feedback to the agent.

**The Tinted Dark Rule.** Every neutral must stay blue-slate tinted. Pure `#000` and `#fff` are forbidden because they flatten code review into generic terminal cosplay.

## 3. Typography

**Display Font:** System sans stack with Inter if present.
**Body Font:** System sans stack with Inter if present.
**Label/Mono Font:** `ui-monospace, SF Mono, monospace` for IDs, checkpoint numbers, timestamps, keyboard hints, and live-state labels.

**Character:** Typography is product-native and compact. The sans stack keeps the review surface fast and familiar; the mono layer gives checkpoints and session metadata the precision of a developer console.

### Hierarchy
- **Display** (580, clamp 1.7rem to 2.2rem, 1.05 line-height): Page-level review title only.
- **Title** (560, 1.05rem, 1.2 line-height): Checkpoint names and dense section titles.
- **Body** (400, 14.5px, 1.55 line-height): Main UI text and feedback body. Keep prose at 65 to 75ch when it appears.
- **Compact Body** (400 to 540, 0.9rem to 0.95rem): Pills, sheet prompts, and textarea content.
- **Label** (mono, 0.7rem to 0.82rem, tracked): IDs, numbers, timestamps, state labels, and keyboard hints.

### Named Rules
**The Metadata Is Mono Rule.** Anything that identifies, timestamps, indexes, or routes the review uses mono. Human-readable decisions stay in the sans stack.

## 4. Elevation

letmediff uses subtle lift: surfaces are flat at rest, separated by tonal layering, borders, and sticky position. Shadows appear only as response or state: focus rings, live glows, and targeted checkpoint outlines. Broad ambient card shadows are not part of the system.

### Shadow Vocabulary
- **Focus Glow** (`0 0 0 3px oklch(75% 0.18 165 / 0.18)`): Textarea and actionable focus states.
- **Live Pulse** (`0 0 0 3px oklch(75% 0.18 165 / 0.2)`): Live-state dot only, animated off under reduced motion.
- **Target Ring** (`0 0 0 3px oklch(75% 0.18 165 / 0.12)`): Checkpoint targeted by anchor navigation.

### Named Rules
**The State Creates Lift Rule.** Nothing floats just to look premium. Lift must mean focus, target, live status, or active handoff.

## 5. Components

Review-first primitives are familiar controls tuned for fast mobile diff inspection: compact, clear, and easy to hit.

### Buttons
- **Shape:** Gently squared control radius (8px) with minimum 40px height for touch.
- **Primary:** Handoff Green background, dark green-tinted text, 0.65rem by 1rem padding, 600 weight.
- **Hover / Focus:** Hover brightens to Handoff Green Hover; focus uses the same green ring vocabulary as fields.
- **Motion:** Arrow icons may translate horizontally by 3px on hover. Do not animate layout or delay the user.

### Chips
- **Style:** Checkpoint pills use Diff Slate Panel, a 1px Diff Slate Border outline, 10px radius, and two-line compact content.
- **State:** The checkpoint number stays mono inside a darker small capsule. Hover raises the panel tone; focus uses a 2px Handoff Green outline.

### Cards / Containers
- **Corner Style:** Review containers use a 12px outer radius. Smaller nested controls use 4px to 10px radii.
- **Background:** Diff Slate Panel for containers; Diff Slate Raised for summaries and sticky command surfaces.
- **Shadow Strategy:** No ambient card shadows. Use borders and tonal layers at rest.
- **Border:** 1px Diff Slate Border is the default separator.
- **Internal Padding:** 0.75rem to 1rem on compact controls, 1rem to 1.5rem for page sections.

### Inputs / Fields
- **Style:** Feedback textarea uses a darker inset surface, 1px border, 10px radius, and inherited sans body type.
- **Focus:** Border switches to Handoff Green and receives the Focus Glow.
- **Error / Disabled:** Keep error and disabled states legible without relying on color alone. Pair color with text or iconography.

### Navigation
- **Style, typography, default/hover/active states, mobile treatment.** Checkpoint navigation is a horizontal snap rail, not a sidebar. Pills are touchable, scrollable, and link directly to checkpoint anchors. Active target state is indicated by Handoff Green border, ring, and a tinted checkpoint number capsule.

### Sticky Feedback Sheet
The feedback sheet is the signature component. It stays at the top of the viewport, collapses to one compact command row, expands inline for the textarea, and uses Handoff Green to make sending feedback to the agent unmistakable. Its translucency exists to preserve context while scrolling diffs; decorative glassmorphism is forbidden.

## 6. Do's and Don'ts

### Do:
- **Do** keep mobile review as the stress test. A checkpoint pill, feedback control, or diff header that works only on desktop is unfinished.
- **Do** reserve Handoff Green for send actions, live state, focus, selected checkpoint state, and direct agent handoff.
- **Do** use familiar diff-review conventions where they reduce learning cost.
- **Do** keep density high, but preserve touch targets around 40px for primary actions.
- **Do** use mono type for IDs, timestamps, checkpoint numbers, keyboard hints, and session metadata.
- **Do** support reduced motion by removing transitions and live pulse animation.

### Don't:
- **Don't** use generic SaaS dashboard patterns: interchangeable cards, blue gradients, hero metrics, or marketing-template polish.
- **Don't** use toy AI-product aesthetics: purple glow, chat-bubble metaphors everywhere, novelty controls, or unserious language.
- **Don't** clone GitHub wholesale. Diff conventions are useful; the product chrome needs its own compact, mobile-aware review character.
- **Don't** use side-stripe borders, gradient text, default glassmorphism, or identical icon-card grids.
- **Don't** let Handoff Green become decoration. If it does not mean action, live state, focus, or target, it should probably be slate.
- **Don't** use pure `#000` or `#fff`; tint every neutral toward the Diff Slate hue.
