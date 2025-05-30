# Todo - FlowWrite App Improvements

## Brainstorming & Feature Ideas

### Enhanced Writing Experience & Focus
- [ ] Focus Mode / Zen Mode (hide UI elements)
- [ ] Writing Targets (word count, time) with visual progress
- [ ] Soundscapes/Ambient Sounds
- [ ] Writing Prompts section
- [ ] Basic Markdown Support (with preview)
- [ ] Expand font choices

### Improved Session Management & Organization
- [ ] Session Tagging/Categorization & Filtering
- [ ] Searchable Sessions (content, title)
- [ ] Manual Session Renaming
- [ ] Archive/Delete Old Sessions
- [ ] (Optional - Larger Scope) Cloud Sync for sessions
- [ ] Implement Supabase session storage and cross-device sync via login

### Statistics and Progress Tracking
- [ ] Historical Stats (streaks, averages)
- [ ] Charts for writing activity
- [ ] Detailed per-session stats

### Customization & Personalization
- [ ] Customizable Timer Durations
- [ ] Advanced Theme Customization (accent colors)
- [ ] "No Delete Mode" variations
- [ ] Customizable Keyboard Shortcuts

### Technical & UI/UX Enhancements
- [ ] More prominent/persistent autosave indicator
- [ ] Improved Timeline UI (visual cues, pagination/scroll for many sessions)
- [ ] Accessibility (A11y) audit and improvements
- [ ] Performance testing for large texts
- [ ] Robust error handling for localStorage

### Code Refactoring & Maintainability
- [ ] Componentize `app/page.tsx` (e.g., BottomControls, Timeline, WritingArea)
- [ ] Evaluate need for more advanced state management if complexity grows
- [ ] Encapsulate logic into more custom hooks where appropriate

- Make bottom bar responsive
+ [x] Make bottom bar responsive
- [ ] Add subtle animations and hover effects for UI fluidity (placeholder, buttons, timeline, status messages, counts)
+ [x] Add subtle animations and hover effects for UI fluidity (placeholder, buttons, timeline, status messages, counts)
- [ ] Consider further UI enhancements like animating Select dropdowns or timestamp display.
- Implement Export Current Session feature (.txt) 
+ [x] Implement Export Current Session feature (.txt) (refactored to utils, uses toasts) 
- [ ] Implement no backspace/delete feature
  - [x] Add state for no-delete mode (default true)
  - [x] Persist no-delete mode in localStorage
  - [x] Handle Backspace/Delete keydown in textarea
    - [x] Prevent default deletion
    - [x] Prevent text replacement via selection
    - [x] Trigger shake animation
    - [x] Show toast notification (fixed visibility)
  - [x] Add toggle option in action menu
    - [x] Dynamic label (Enable/Disable Deleting)
    - [x] Icon for the menu item
  - [x] Add CSS for shake animation 