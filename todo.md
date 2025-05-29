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