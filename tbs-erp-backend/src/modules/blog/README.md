# Blog CMS Module

A complete blog and content management system module for TBS ERP Backend.

## Features

- **CRUD Operations**: Create, Read, Update, Delete blog posts
- **Auto-slug Generation**: Automatically generates URL-friendly slugs from titles
- **Public & Protected Endpoints**: Public read access, protected write access
- **Image Upload Support**: Upload cover images for blog posts
- **Pagination**: Built-in pagination support
- **Search & Filtering**: Search by text, filter by status and tags
- **Status Management**: Draft and Published states
- **Tags Support**: Categorize posts with multiple tags

## Database Schema

```prisma
model BlogPost {
  id          String          @id @default(cuid())
  slug        String          @unique @db.VarChar(255)
  title       String          @db.VarChar(500)
  excerpt     String?         @db.VarChar(1000)
  content     String          @db.Text
  coverImage  String?         @db.VarChar(500)
  author      String          @db.VarChar(255)
  tags        String[]        @default([])
  status      BlogPostStatus  @default(DRAFT)
  publishedAt DateTime?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

enum BlogPostStatus {
  DRAFT
  PUBLISHED
}
```

## API Endpoints

### Public Endpoints (No Authentication)

#### 1. List Blog Posts
```http
GET /api/blog-posts
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 10, max: 100) - Items per page
- `status` (BlogPostStatus) - Filter by status (DRAFT/PUBLISHED)
- `tag` (string) - Filter by tag
- `search` (string) - Search in title, excerpt, or content
- `sortBy` (string) - Sort by field (createdAt, publishedAt, title)
- `sortOrder` (string) - Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxyz123",
      "slug": "how-to-optimize-logistics",
      "title": "How to Optimize Your Logistics Operations",
      "excerpt": "Learn the best practices...",
      "content": "<h2>Introduction</h2>...",
      "coverImage": "/uploads/blog/cover-123.jpg",
      "author": "John Doe",
      "tags": ["logistics", "optimization"],
      "status": "PUBLISHED",
      "publishedAt": "2024-02-09T10:00:00Z",
      "createdAt": "2024-02-09T09:00:00Z",
      "updatedAt": "2024-02-09T10:00:00Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

#### 2. Get Blog Post by Slug
```http
GET /api/blog-posts/:slug
```

**Example:**
```bash
GET /api/blog-posts/how-to-optimize-logistics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123",
    "slug": "how-to-optimize-logistics",
    "title": "How to Optimize Your Logistics Operations",
    ...
  }
}
```

#### 3. Get All Tags
```http
GET /api/blog-posts/tags
```

**Response:**
```json
{
  "success": true,
  "data": ["logistics", "optimization", "supply-chain", "warehouse"]
}
```

### Protected Endpoints (Requires JWT)

#### 4. Create Blog Post
```http
POST /api/blog-posts
Authorization: Bearer <JWT_TOKEN>
```

**Request Body:**
```json
{
  "title": "How to Optimize Your Logistics Operations",
  "excerpt": "Learn the best practices for streamlining your supply chain.",
  "content": "<h2>Introduction</h2><p>In today's logistics industry...</p>",
  "author": "John Doe",
  "tags": ["logistics", "optimization", "supply-chain"],
  "coverImage": "/uploads/blog/cover-123.jpg",
  "status": "PUBLISHED"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Blog post created successfully",
  "data": {
    "id": "clxyz123",
    "slug": "how-to-optimize-your-logistics-operations",
    ...
  }
}
```

#### 5. Update Blog Post
```http
PATCH /api/blog-posts/:id
Authorization: Bearer <JWT_TOKEN>
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "status": "PUBLISHED"
}
```

**Note:** If the title is updated, the slug is automatically regenerated and ensured to be unique.

#### 6. Delete Blog Post
```http
DELETE /api/blog-posts/:id
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Blog post deleted successfully"
  }
}
```

#### 7. Upload Cover Image
```http
POST /api/blog-posts/upload-cover
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Form Data:**
- `file` - Image file (jpg, jpeg, png, gif, webp, max 5MB)

**Response:**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "url": "/uploads/blog/cover-1234567890-123456789.jpg"
  }
}
```

## Features Explained

### 1. Auto-slug Generation

When creating or updating a blog post, the slug is automatically generated from the title:
- Converts to lowercase
- Removes special characters
- Replaces spaces with hyphens
- Ensures uniqueness by appending a number if needed

**Example:**
```
Title: "How to Optimize Your Logistics Operations"
Slug:  "how-to-optimize-your-logistics-operations"

If slug exists:
Slug:  "how-to-optimize-your-logistics-operations-1"
```

### 2. Publishing Workflow

- **DRAFT**: Not visible to public, `publishedAt` is null
- **PUBLISHED**: Visible to public, `publishedAt` is set to current timestamp

When changing status from DRAFT to PUBLISHED, the `publishedAt` timestamp is automatically set.

### 3. Search & Filtering

**Search:** Searches across title, excerpt, and content fields (case-insensitive)

**Filter by Status:**
```bash
GET /api/blog-posts?status=PUBLISHED
```

**Filter by Tag:**
```bash
GET /api/blog-posts?tag=logistics
```

**Combine Filters:**
```bash
GET /api/blog-posts?status=PUBLISHED&tag=logistics&search=optimization
```

### 4. Pagination

```bash
GET /api/blog-posts?page=2&limit=20
```

- Default page: 1
- Default limit: 10
- Maximum limit: 100

## Testing

### Using cURL

```bash
# List published posts
curl http://localhost:3000/api/blog-posts?status=PUBLISHED

# Get post by slug
curl http://localhost:3000/api/blog-posts/how-to-optimize-logistics

# Create post (requires JWT token)
curl -X POST http://localhost:3000/api/blog-posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Post",
    "content": "Test content",
    "author": "Admin",
    "status": "PUBLISHED"
  }'
```

### Using the Test Script

```bash
chmod +x test-blog-endpoints.sh
./test-blog-endpoints.sh
```

## Swagger Documentation

Access the Swagger UI at:
```
http://localhost:3000/api/docs
```

Look for the "Blog" tag section to see all endpoints with interactive testing capabilities.

## Files Structure

```
src/modules/blog/
├── dto/
│   ├── create-blog-post.dto.ts   # Create blog post DTO
│   ├── update-blog-post.dto.ts   # Update blog post DTO
│   └── blog-post-query.dto.ts    # Query parameters DTO
├── blog.controller.ts             # REST API endpoints
├── blog.service.ts                # Business logic
├── blog.module.ts                 # Module definition
└── README.md                      # This file
```

## Dependencies

- `@nestjs/common` - Core NestJS functionality
- `@nestjs/swagger` - API documentation
- `@prisma/client` - Database ORM
- `class-validator` - DTO validation
- `class-transformer` - DTO transformation

## Future Enhancements

- [ ] Categories support
- [ ] Comments system
- [ ] SEO metadata (meta description, keywords, OG tags)
- [ ] View counter
- [ ] Related posts
- [ ] Multi-language support
- [ ] Scheduled publishing
- [ ] Rich text editor integration
- [ ] Image optimization
- [ ] Draft auto-save
- [ ] Version history

## Security

- Write operations (create, update, delete) require JWT authentication
- Read operations are public (allowing website visitors to view blog)
- File upload validation (type and size)
- Input sanitization via class-validator
- Unique slug enforcement at database level

## Performance

- Indexed fields: `slug`, `status + publishedAt`, `tags`
- Efficient pagination with skip/take
- Selective field loading where appropriate
