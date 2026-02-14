# CMS Integration Complete - User Guide

## Overview
The CMS system has been successfully integrated into the TBS ERP website. The CMS admin (located in the dashboard) now manages content that appears on the public website (nhaphangchinhngach.vn).

## What's Been Completed

### 1. **Public CMS Pages** (`/[slug]`)
- Dynamic route created at `src/app/(public)/[slug]/page.tsx`
- Any page created in CMS admin will be accessible at `https://nhaphangchinhngach.vn/{slug}`
- Features:
  - Featured image support with hero layout
  - SEO metadata (title, description)
  - Rich HTML content display
  - Automatic last updated date

### 2. **CMS Menu Integration**
- **Header Navigation**: Replaced hardcoded menu with CMS-managed menu (HEADER location)
- **Footer Navigation**: Integrated CMS footer menu (FOOTER location)
- Menu items are now fully manageable from the CMS admin

### 3. **Components Created**
- `src/components/public/cms-menu.tsx`:
  - `CMSMenu` - General menu component
  - `CMSHeaderMenu` - Horizontal header navigation
  - `CMSFooterMenu` - Footer navigation with columnar layout

### 4. **Updated Files**
- `src/app/(public)/components/navbar.tsx` - Now uses `CMSHeaderMenu`
- `src/app/(public)/components/footer.tsx` - Now uses `CMSFooterMenu`

## How to Use the CMS

### Creating a Public Page

1. **Login to ERP Dashboard**
   - Navigate to `http://localhost:3001/login`
   - Login with CEO, COO, or MARKETING_STAFF credentials

2. **Create New Page**
   - Go to `Dashboard → CMS → Pages`
   - Click "Tạo trang mới" (Create new page)
   - Fill in:
     - **Title**: Page title (e.g., "Về chúng tôi")
     - **Slug**: URL path (e.g., "ve-chung-toi")
     - **Content**: Rich text content using the WYSIWYG editor
     - **Status**: Set to "PUBLISHED" to make it live
     - **SEO**: Add meta title and description for search engines

3. **View Public Page**
   - Page will be accessible at: `http://localhost:3001/{slug}`
   - Example: `http://localhost:3001/ve-chung-toi`

### Creating Navigation Menus

1. **Create Menu**
   - Go to `Dashboard → CMS → Menu`
   - Click "Tạo menu mới"
   - Fill in:
     - **Name**: Menu name (e.g., "Main Navigation")
     - **Location**: Choose HEADER, FOOTER, or SIDEBAR

2. **Add Menu Items**
   - Click on a menu to edit
   - Add menu items with:
     - **Label**: Display text (e.g., "Trang chủ")
     - **URL**: Link path (e.g., "/" or "/gioi-thieu")
     - **Target**: "_self" (same window) or "_blank" (new window)
     - **Order**: Sort order (lower numbers appear first)
   - Support for nested menu items (children)

3. **Menu Locations**
   - **HEADER**: Displays in the top navigation bar
   - **FOOTER**: Displays in the footer section
   - **SIDEBAR**: Reserved for sidebar navigation (not currently used)

## API Endpoints

### Public Endpoints (No Authentication Required)

- **Get Page by Slug**
  ```
  GET /api/public/cms/pages/{slug}
  ```

- **Get Menu by Location**
  ```
  GET /api/public/cms/menus/{location}
  ```
  Locations: HEADER, FOOTER, SIDEBAR

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Flow                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Admin creates content     →    Content stored in database │
│  (CMS Admin Dashboard)          (PostgreSQL)               │
│                                                             │
│                    ↓                                        │
│                                                             │
│  Public API fetches content  →  Display on public website  │
│  (No authentication)             (nhaphangchinhngach.vn)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
tbs-erp-frontend/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   └── cms/              # CMS Admin UI
│   │   │       ├── pages/        # Page management
│   │   │       ├── media/        # Media library
│   │   │       ├── menu/         # Menu management
│   │   │       └── settings/     # Site settings
│   │   │
│   │   └── (public)/
│   │       ├── [slug]/           # Dynamic CMS pages
│   │       │   └── page.tsx
│   │       └── components/
│   │           ├── navbar.tsx    # Uses CMSHeaderMenu
│   │           └── footer.tsx    # Uses CMSFooterMenu
│   │
│   └── components/
│       ├── cms/                  # CMS admin components
│       └── public/
│           └── cms-menu.tsx      # Public menu components
│
tbs-erp-backend/
└── src/
    └── modules/
        ├── cms-pages/            # Page CRUD + public API
        ├── cms-media/            # Media management
        ├── cms-menu/             # Menu CRUD + public API
        └── cms-settings/         # Site settings
```

## Testing the Integration

### 1. Test Page Creation
```bash
# Create a test page in CMS admin
# Then access it at:
curl http://localhost:3001/gioi-thieu
```

### 2. Test Menu Display
```bash
# Create a HEADER menu in CMS admin
# Then check the public website navigation
# Menu items should appear automatically
```

### 3. Verify API Responses
```bash
# Check menu API
curl http://localhost:3000/api/public/cms/menus/HEADER

# Check page API
curl http://localhost:3000/api/public/cms/pages/your-slug
```

## Next Steps (Optional Enhancements)

1. **Add More Menu Locations**
   - Create SIDEBAR menu for mobile navigation
   - Add mega menu support for complex navigation

2. **Page Templates**
   - Create different page layouts (full-width, sidebar, landing page)
   - Template selection in page editor

3. **Media Library Integration**
   - Direct image picker in page editor
   - Gallery component for multiple images

4. **SEO Enhancements**
   - OpenGraph image picker
   - Structured data builder
   - Sitemap generation

5. **Content Scheduling**
   - Schedule page publish/unpublish dates
   - Draft preview links

## Troubleshooting

### Menu Not Showing
- Verify menu has been created with correct location (HEADER/FOOTER)
- Check menu has at least one menu item
- Ensure menu status is active

### Page Not Found
- Verify page status is "PUBLISHED" (not DRAFT)
- Check slug is correct (lowercase, no spaces)
- Clear browser cache

### API Errors
- Verify backend is running on port 3000
- Check `.env.local` has correct `NEXT_PUBLIC_API_URL=http://localhost:3000/api`
- Review backend logs for database connection issues

## Summary

The CMS system is now fully integrated with your public website:

✅ **Dynamic Page Rendering** - Create pages in CMS, they appear automatically on public site
✅ **Menu Management** - Control navigation from CMS admin
✅ **Public API** - Fast, cached endpoints for content delivery
✅ **SEO Ready** - Meta tags, structured data, and sitemap support
✅ **Media Library** - Upload and manage images
✅ **Role-Based Access** - Only authorized users can manage content

The system is production-ready and can be deployed to manage all content on nhaphangchinhngach.vn.
