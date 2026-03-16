# Blog System Documentation

## Overview

A complete blog system for TBS ERP with public blog pages and admin CMS interface. The system includes blog listing, detail pages, rich text editor, and full CRUD operations.

## Features

### Public Blog Pages (No Authentication Required)

1. **Blog Listing Page** - `/tin-tuc`
   - Paginated blog post grid
   - Search functionality
   - Tag filtering
   - Responsive design with professional typography
   - SEO optimized

2. **Blog Detail Page** - `/tin-tuc/[slug]`
   - Full blog post content with rich formatting
   - Cover image display
   - Author information
   - View count tracking
   - Social sharing buttons (Facebook, Twitter, LinkedIn, Copy Link)
   - Related metadata (published date, tags)
   - Responsive layout

### Admin CMS (Authentication Required)

3. **Blog Admin Dashboard** - `/bai-viet`
   - List all blog posts in a table
   - Search and filter by status (draft, published, archived)
   - Quick actions (edit, delete, preview)
   - View counts display
   - Status badges

4. **Create Blog Post** - `/bai-viet/tao-moi`
   - Rich text WYSIWYG editor (Quill)
   - Title and auto-generated slug
   - Excerpt/description
   - Cover image URL
   - Tags management
   - Status selection (draft/published)
   - Publish date scheduling

5. **Edit Blog Post** - `/bai-viet/[id]/chinh-sua`
   - Edit existing blog posts
   - Preview changes
   - Same features as create page

## File Structure

```
tbs-erp-frontend/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   └── tin-tuc/
│   │   │       ├── page.tsx              # Blog listing page
│   │   │       └── [slug]/
│   │   │           └── page.tsx          # Blog detail page
│   │   └── (blog-admin)/
│   │       ├── layout.tsx                # Blog admin layout
│   │       └── bai-viet/
│   │           ├── page.tsx              # Blog admin list
│   │           ├── tao-moi/
│   │           │   └── page.tsx          # Create blog post
│   │           └── [id]/
│   │               └── chinh-sua/
│   │                   └── page.tsx      # Edit blog post
│   ├── components/
│   │   └── blog/
│   │       ├── blog-post-form.tsx        # Blog post form component
│   │       └── rich-text-editor.tsx      # Quill editor wrapper
│   ├── lib/
│   │   ├── api/
│   │   │   └── blog.ts                   # Blog API client
│   │   └── hooks/
│   │       └── use-blog-posts.ts         # React Query hooks
│   └── types/
│       └── react-quill.d.ts              # TypeScript declarations
└── middleware.ts                          # Already configured
```

## API Endpoints

The frontend expects the following backend API endpoints:

### Public Endpoints

```
GET    /api/blog-posts                    # List blog posts (with pagination, search, filters)
GET    /api/blog-posts/slug/:slug         # Get blog post by slug
GET    /api/blog-posts/tags               # Get all unique tags
POST   /api/blog-posts/slug/:slug/view    # Increment view count
```

### Protected Endpoints (Require Authentication)

```
GET    /api/blog-posts/:id                # Get blog post by ID
POST   /api/blog-posts                    # Create new blog post
PATCH  /api/blog-posts/:id                # Update blog post
DELETE /api/blog-posts/:id                # Delete blog post
```

### Request/Response Types

**BlogPost**
```typescript
{
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;              // HTML content
  coverImage?: string;          // URL to image
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string;         // ISO 8601 date
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
}
```

**List Response**
```typescript
{
  data: {
    items: BlogPostListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
}
```

**Query Parameters**
```typescript
{
  page?: number;
  limit?: number;
  search?: string;              // Search in title and content
  tag?: string;                 // Filter by tag
  status?: 'draft' | 'published' | 'archived';
  sortBy?: 'publishedAt' | 'viewCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
```

## Dependencies

### New Dependencies Added

```json
{
  "react-quill": "^2.0.0",      // Rich text editor
  "quill": "^2.0.0"             // Quill editor core
}
```

### Required Existing Dependencies

- `@tanstack/react-query` - Data fetching
- `react-hook-form` - Form management
- `zod` - Form validation
- `@hookform/resolvers` - Zod resolver for react-hook-form
- `date-fns` - Date formatting
- `lucide-react` - Icons
- `sonner` - Toast notifications
- All shadcn/ui components

## Usage

### For Content Creators (Blog Admin)

1. **Login** to the system at `/login`
2. **Navigate** to blog admin at `/bai-viet`
3. **Create** a new post:
   - Click "Tạo bài viết mới"
   - Enter title (slug auto-generates)
   - Write content using the rich text editor
   - Add cover image URL
   - Add tags
   - Choose status (draft or published)
   - Set publish date
   - Click "Lưu bài viết"
4. **Edit** existing posts by clicking the edit icon
5. **Preview** posts by clicking the eye icon
6. **Delete** posts using the delete action

### Rich Text Editor Features

The Quill editor supports:
- Headings (H1-H6)
- Text formatting (bold, italic, underline, strike)
- Colors and backgrounds
- Lists (ordered, unordered)
- Indentation
- Alignment
- Blockquotes and code blocks
- Links, images, and videos
- Copy/paste from Word or other sources

### For Public Users

1. **Browse** blog posts at `/tin-tuc`
2. **Search** using the search bar
3. **Filter** by tags
4. **Read** full articles by clicking on any post
5. **Share** articles on social media

## Security

### Authentication

- Public blog pages (`/tin-tuc/*`) are accessible without authentication
- Admin pages (`/bai-viet/*`) require authentication via middleware
- The middleware checks for the `tbs-auth` cookie
- Unauthenticated users are redirected to `/login`

### Authorization

Backend should implement:
- Role-based access control (only admins can create/edit/delete)
- User ownership validation
- Input sanitization to prevent XSS attacks
- Rate limiting on view count endpoint

## SEO Optimization

### Public Layout Already Includes

- OpenGraph meta tags
- Twitter cards
- Schema.org JSON-LD
- Proper heading hierarchy
- Semantic HTML

### Blog Pages Include

- Dynamic page titles
- Meta descriptions from excerpt
- Canonical URLs
- Social sharing preview images
- Proper content structure

## Styling

The blog system uses:
- **Tailwind CSS** for utility classes
- **Professional typography** with proper line heights and spacing
- **Responsive design** for mobile, tablet, and desktop
- **shadcn/ui components** for consistent design
- **Custom Quill styles** for content rendering

### Typography Classes

Blog content uses prose classes for optimal readability:
```css
prose prose-slate max-w-none
prose-headings:font-bold
prose-h1:text-3xl
prose-p:leading-relaxed
```

## Testing

Test the following scenarios:

### Public Pages
- [ ] Blog listing loads with posts
- [ ] Pagination works correctly
- [ ] Search returns relevant results
- [ ] Tag filtering works
- [ ] Blog detail page displays full content
- [ ] View count increments
- [ ] Social sharing buttons work
- [ ] Responsive layout on mobile

### Admin Pages
- [ ] Authentication required
- [ ] Blog list displays all posts
- [ ] Create new post
- [ ] Edit existing post
- [ ] Delete post with confirmation
- [ ] Rich text editor saves HTML
- [ ] Auto-slug generation works
- [ ] Tag management works
- [ ] Status changes persist
- [ ] Preview opens in new tab

## Future Enhancements

Potential improvements:
- [ ] Categories in addition to tags
- [ ] Comments system
- [ ] Related posts suggestions
- [ ] Featured posts
- [ ] Draft preview sharing
- [ ] Image upload (currently URL-based)
- [ ] Version history
- [ ] Scheduled publishing
- [ ] Analytics dashboard
- [ ] RSS feed
- [ ] Email notifications for new posts

## Troubleshooting

### Common Issues

1. **Editor not loading**
   - Quill is loaded dynamically to avoid SSR issues
   - Check browser console for errors
   - Verify `react-quill` is installed

2. **Authentication redirect loop**
   - Check middleware configuration
   - Verify auth cookie is set
   - Check token expiration

3. **Images not displaying**
   - Verify image URLs are valid
   - Check CORS settings if images are external
   - Ensure images are publicly accessible

4. **Slug conflicts**
   - Backend should validate unique slugs
   - Frontend auto-generates from title
   - Manually edit if needed

## Contact

For issues or questions about the blog system, contact the development team.
