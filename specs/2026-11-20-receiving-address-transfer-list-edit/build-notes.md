# Build Notes: Receiving Addresses Dual Listbox Transfer Picker & Inline Edit

## Implementation Strategy
- Use native HTML5 Drag and Drop events (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) to guarantee lightweight client bundle, Safari 15.4 compatibility, and zero external NPM dependencies.
- Pair drag-and-drop with click-to-transfer buttons (`Add →`, `← Remove`, `Add all →`, `← Clear all`) ensuring complete accessibility for touch devices and keyboard users.
- Provide inline editing directly within the receiving addresses list so platform admins can update destinations with zero friction.
