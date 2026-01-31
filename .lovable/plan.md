

# Remove "View Permissions" Option

## Overview
Remove the "View permissions" menu item from the user row dropdown in the Teams & Users admin page.

## Change Required

**File:** `src/pages/admin/AdminUsers.tsx`

Remove this line from the `DropdownMenuContent` inside the user table:
```tsx
<DropdownMenuItem>View permissions</DropdownMenuItem>
```

The dropdown will then only contain:
- Edit
- Deactivate

## Result
The three-dot menu on each user row will no longer show the "View permissions" option.

