#!/bin/bash

# Blog CMS Endpoints Test Script
# This script tests all blog endpoints

BASE_URL="http://localhost:3000/api/v1"
TOKEN=""  # Add JWT token here for protected endpoints

echo "======================================"
echo "Blog CMS Endpoint Tests"
echo "======================================"
echo ""

# Test 1: Create a blog post (requires JWT)
echo "1. Testing POST /blog-posts (Create blog post)"
echo "--------------------------------------"
curl -X POST "$BASE_URL/blog-posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "How to Optimize Your Logistics Operations",
    "excerpt": "Learn the best practices for streamlining your supply chain.",
    "content": "<h2>Introduction</h2><p>In today'\''s fast-paced logistics industry, efficiency is key...</p>",
    "author": "John Doe",
    "tags": ["logistics", "optimization", "supply-chain"],
    "status": "PUBLISHED"
  }' | jq .
echo ""
echo ""

# Test 2: Get all blog posts (public)
echo "2. Testing GET /blog-posts (List all posts)"
echo "--------------------------------------"
curl -X GET "$BASE_URL/blog-posts?limit=10&page=1" | jq .
echo ""
echo ""

# Test 3: Get blog posts by status (public)
echo "3. Testing GET /blog-posts?status=PUBLISHED (Filter by status)"
echo "--------------------------------------"
curl -X GET "$BASE_URL/blog-posts?status=PUBLISHED&limit=5" | jq .
echo ""
echo ""

# Test 4: Search blog posts (public)
echo "4. Testing GET /blog-posts?search=logistics (Search)"
echo "--------------------------------------"
curl -X GET "$BASE_URL/blog-posts?search=logistics" | jq .
echo ""
echo ""

# Test 5: Get all tags (public)
echo "5. Testing GET /blog-posts/tags (Get all tags)"
echo "--------------------------------------"
curl -X GET "$BASE_URL/blog-posts/tags" | jq .
echo ""
echo ""

# Test 6: Get blog post by slug (public)
echo "6. Testing GET /blog-posts/:slug (Get by slug)"
echo "--------------------------------------"
curl -X GET "$BASE_URL/blog-posts/how-to-optimize-your-logistics-operations" | jq .
echo ""
echo ""

# Test 7: Update a blog post (requires JWT)
echo "7. Testing PATCH /blog-posts/:id (Update post)"
echo "--------------------------------------"
echo "Note: Replace POST_ID with actual ID from creation response"
# curl -X PATCH "$BASE_URL/blog-posts/POST_ID" \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer $TOKEN" \
#   -d '{
#     "title": "Updated Title",
#     "status": "DRAFT"
#   }' | jq .
echo "Skipped - needs actual post ID"
echo ""
echo ""

# Test 8: Delete a blog post (requires JWT)
echo "8. Testing DELETE /blog-posts/:id (Delete post)"
echo "--------------------------------------"
echo "Note: Replace POST_ID with actual ID"
# curl -X DELETE "$BASE_URL/blog-posts/POST_ID" \
#   -H "Authorization: Bearer $TOKEN" | jq .
echo "Skipped - needs actual post ID"
echo ""
echo ""

echo "======================================"
echo "Tests completed!"
echo "======================================"
