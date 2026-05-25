# Product

## Register

product

## Users

Developers reviewing AI agent work from their own coding sessions. They open a shareable diff, inspect checkpointed changes, leave feedback, and expect that feedback to return to the waiting agent without ceremony.

The hardest context is mobile review: a developer away from the main workstation trying to understand changes, line context, and risk on a small screen. Desktop should still feel like a serious technical product for focused review, but mobile clarity is the primary design constraint.

## Product Purpose

letmediff is a review handoff tool for agent-driven coding. The MCP CLI captures repository diffs and checkpoints, posts them to the web app, and keeps a feedback channel open so reviewers can respond from a shareable URL.

Success means a reviewer can understand what changed, identify risk, and send actionable feedback faster than switching tools or copying diffs into chat. The interface should reduce friction around agent review rather than becoming another code review platform to manage.

## Brand Personality

Sharp expert console. Technical, compact, and precise, with creative details that make mobile review feel considered rather than compromised.

The product should borrow enough from GitHub-style diff review to feel immediately legible, but it should not feel like a clone. It can have a sprinkle of fun in microcopy, motion, and empty states, as long as the core review surface stays serious and trustworthy.

## Anti-references

Avoid generic SaaS dashboard patterns: interchangeable cards, blue gradients, hero metrics, and marketing-template polish.

Avoid toy AI-product aesthetics: purple glow, chat-bubble metaphors everywhere, novelty controls, or language that makes the review workflow feel unserious.

Avoid cloning GitHub wholesale. Diff conventions are useful; the surrounding product should have its own compact, mobile-aware review character.

## Design Principles

1. Mobile review is the stress test. If a diff is hard to scan, comment on, or submit from a phone, the design is not finished.
2. Familiar diff conventions are affordances. Keep the code review model recognizable, then improve the moments where existing tools are weakest.
3. Serious first, playful in small doses. Use personality for confidence and memory, not decoration that interrupts review.
4. Make agent handoff feel continuous. Checkpoints, feedback, and waiting states should reinforce that the coding session is still alive.
5. Optimize for decisive feedback. The interface should help reviewers move from reading to specific, actionable notes quickly.

## Accessibility & Inclusion

Target WCAG AA as the baseline. Prioritize strong contrast, keyboard access, visible focus states, reduced-motion support, and mobile touch targets that do not require precision tapping.

Diff readability needs extra care: additions, deletions, selected lines, and future-edit markers should not rely on color alone, and code should remain readable on narrow screens.
