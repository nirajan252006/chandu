# UI/UX + Accessibility Upgrade (UI-only)

## Phase 1 (Highest Priority)
- [x] Update `frontend/src/index.css` with consistent tokens, typography, spacing, focus rings, glass/shadows/border radius consistency
- [x] Add Better typography + spacing + card/border radius consistency (if any issues remain)
- [x] Implement focus ring for .tab-button, .cyber-button disabled/hover states if any missing
- [x] Add WCAG improvements + screen-reader utility classes (dedupe)
- [x] Add prefers-reduced-motion support (dedupe)
- [x] Ensure buttons avoid layout shift (no width/height animation) (dedupe)


## Phase 2
- [x] Optimize `frontend/src/components/ParticleBackground.tsx`
- [x] Respect reduced motion
- [x] Pause when tab hidden
- [x] Reduce particles on small screens
- [x] Cap FPS / lower CPU
- [x] Keep same appearance


  - [ ] Pause when tab hidden
  - [ ] Reduce particles on small screens
  - [ ] Cap FPS / lower CPU
  - [ ] Keep same appearance

## Phase 3
- [x] Improve dialogs (UI-only):

  - [ ] Login, Change Password, Session Timeout, Logout Confirm
  - [ ] Proper focus trap
  - [ ] aria-modal + aria-labelledby/describedby
  - [ ] ESC support (existing behavior only)
  - [ ] TAB cycling
  - [ ] Screen reader support
  - [ ] Spacing/typography/animations

## Phase 4
- [ ] Polish Login and Change Password pages (UI-only)
  - [ ] Alignment, spacing, label consistency
  - [ ] Validation UI polish (no auth logic changes)
  - [ ] Password strength meter UI
  - [ ] Error/success states
  - [ ] Keyboard shortcut compatibility
  - [ ] Reduced motion compatibility
  - [ ] Responsive layout

## After Phase 4 (page-by-page)
- [ ] Home
- [ ] Process
- [ ] Upload
- [ ] Live Results
- [ ] Live Logs
- [ ] Export


