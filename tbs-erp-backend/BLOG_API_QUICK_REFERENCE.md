# Blog CMS API Quick Reference

## Base URL
```
http://localhost:3000/api
```

## Endpoints Overview

### 🔓 Public Endpoints (No Auth)

#### 1. List Blog Posts
```http
GET /blog-posts?page=1&limit=10&status=PUBLISHED&tag=logistics&search=optimize
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page (max 100) |
| status | DRAFT\|PUBLISHED | - | Filter by status |
| tag | string | - | Filter by tag |
| search | string | - | Search in title/excerpt/content |
| sortBy | string | publishedAt | Sort field (createdAt, publishedAt, title) |
| sortOrder | asc\|desc | desc | Sort order |

**Example Response:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

#### 2. Get All Tags
```http
GET /blog-posts/tags
```

**Response:**
```json
{
  "success": true,
  "data": ["logistics", "optimization", "supply-chain"]
}
```

#### 3. Get Post by Slug
```http
GET /blog-posts/{slug}
```

**Example:**
```bash
GET /blog-posts/how-to-optimize-logistics
```

---

### 🔒 Protected Endpoints (Requires JWT)

#### 4. Create Blog Post
```http
POST /blog-posts
Authorization: Bearer {YOUR_JWT_TOKEN}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "How to Optimize Your Logistics Operations",
  "excerpt": "Learn the best practices for streamlining your supply chain.",
  "content": "<h2>Introduction</h2><p>Content here...</p>",
  "author": "John Doe",
  "tags": ["logistics", "optimization", "supply-chain"],
  "coverImage": "/uploads/blog/cover-123.jpg",
  "status": "PUBLISHED"
}
```

**Required Fields:**
- `title` (3-500 chars)
- `content` (not empty)
- `author` (max 255 chars)

**Optional Fields:**
- `excerpt` (max 1000 chars)
- `coverImage` (max 500 chars)
- `tags` (array of strings)
- `status` (DRAFT or PUBLISHED, default: DRAFT)

#### 5. Update Blog Post
```http
PATCH /blog-posts/{id}
Authorization: Bearer {YOUR_JWT_TOKEN}
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "status": "PUBLISHED",
  "tags": ["new-tag"]
}
```

**Note:** If title is updated, slug is auto-regenerated.

#### 6. Delete Blog Post
```http
DELETE /blog-posts/{id}
Authorization: Bearer {YOUR_JWT_TOKEN}
```

#### 7. Upload Cover Image
```http
POST /blog-posts/upload-cover
Authorization: Bearer {YOUR_JWT_TOKEN}
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
    "url": "/uploads/blog/cover-1234567890.jpg"
  }
}
```

---

## cURL Examples

### Public Endpoints

**List all published posts:**
```bash
curl http://localhost:3000/api/blog-posts?status=PUBLISHED
```

**Search posts:**
```bash
curl "http://localhost:3000/api/blog-posts?search=logistics&limit=5"
```

**Get post by slug:**
```bash
curl http://localhost:3000/api/blog-posts/how-to-optimize-logistics
```

**Get all tags:**
```bash
curl http://localhost:3000/api/blog-posts/tags
```

### Protected Endpoints (with JWT)

**Create a post:**
```bash
curl -X POST http://localhost:3000/api/blog-posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "New Blog Post",
    "content": "Post content here",
    "author": "Admin",
    "status": "PUBLISHED"
  }'
```

**Update a post:**
```bash
curl -X PATCH http://localhost:3000/api/blog-posts/{POST_ID} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "status": "DRAFT"
  }'
```

**Delete a post:**
```bash
curl -X DELETE http://localhost:3000/api/blog-posts/{POST_ID} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Upload cover image:**
```bash
curl -X POST http://localhost:3000/api/blog-posts/upload-cover \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/image.jpg"
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing or invalid JWT) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Common Use Cases

### 1. Website Blog Listing Page
```bash
# Get 10 latest published posts
GET /blog-posts?status=PUBLISHED&limit=10&sortBy=publishedAt&sortOrder=desc
```

### 2. Blog Post Detail Page
```bash
# Get post by slug (SEO-friendly URL)
GET /blog-posts/your-post-slug
```

### 3. Filter by Category/Tag
```bash
# Get all logistics posts
GET /blog-posts?status=PUBLISHED&tag=logistics
```

### 4. Search Functionality
```bash
# Search for "optimization" in all fields
GET /blog-posts?status=PUBLISHED&search=optimization
```

### 5. Admin: Create Draft Post
```bash
POST /blog-posts
{
  "title": "Work in Progress",
  "content": "Draft content...",
  "author": "Admin",
  "status": "DRAFT"
}
```

### 6. Admin: Publish Draft
```bash
PATCH /blog-posts/{id}
{
  "status": "PUBLISHED"
}
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Error type",
  "statusCode": 400
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 2,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

## Swagger Documentation

Interactive API documentation available at:
```
http://localhost:3000/api/docs
```

Look for the **"Blog"** section to test all endpoints interactively.

---

## Notes

1. **Slug Auto-generation**: Slugs are automatically created from titles:
   - "How to Optimize" → "how-to-optimize"
   - Uniqueness is enforced with numeric suffixes if needed

2. **Published Date**: When status changes from DRAFT to PUBLISHED, `publishedAt` is automatically set

3. **File Upload**: Images are validated for:
   - Type: jpg, jpeg, png, gif, webp
   - Size: Max 5MB

4. **Tags**: Use tags for categorization and filtering. Tags are indexed for performance.

5. **Search**: Searches across title, excerpt, and content fields (case-insensitive)
