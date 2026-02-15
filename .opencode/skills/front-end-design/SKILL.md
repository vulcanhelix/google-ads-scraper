---
name: front-end-design
description: Front-end UI/UX design guidance and implementation patterns (typography, color, motion, layouts). Use for Tailwind/React/Vue styling, responsive composition, and visual polish.
license: MIT
compatibility: opencode
metadata:
  audience: designers-developers
  workflow: frontend
---

## What I do

- Provide intentional, polished UI/UX guidance for components and pages
- Suggest typography, color systems, spacing scales, and responsive rules
- Propose Tailwind-first utility implementations and fallback custom CSS
- Recommend motion patterns (page load, hovers, scroll triggers)
- Produce copy-pasteable component snippets (HTML/CSS/JS/TSX/Vue)

## When to use me

Use this skill when you need front-end visual design or implementation help. Ask me to:

- Design a responsive landing page or dashboard with a clear visual hierarchy
- Convert a design vision into Tailwind classes and component code
- Improve accessibility and color contrast for an existing UI
- Add meaningful motion and interactive states without overwhelming users

## Design Principles

- Typography: pick expressive font pairs, avoid default system stacks when you want character
- Color & Theme: define CSS variables, commit to dominant + accent colors
- Motion: prefer a few high-impact animations (staggered reveals, subtle parallax)
- Layout: use asymmetry, overlap, and generous negative space intentionally
- Styling: default to Tailwind utilities when available; use custom CSS for advanced effects

## Examples

1. Tailwind card snippet:

```html
<!-- info-card.html -->
<article class="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-lg hover:scale-[1.02] transition-transform">
  <h3 class="text-lg font-semibold">Feature title</h3>
  <p class="mt-2 text-sm text-slate-600">Short description that explains the feature in one line.</p>
  <div class="mt-4 flex items-center gap-3">
    <button class="btn-primary px-4 py-2 rounded-md">Action</button>
  </div>
</article>
```

2. Motion suggestion: on page load, fade + slide up the main column with a 150ms stagger between children.

## Constraints

- Respect existing design systems and component libraries in the repo
- Prioritize accessibility (contrast, focus states, reduced-motion media query)

## How agents call me

Agents should call the `skill` tool with `name: "front-end-design"` to load extended guidance and examples.
