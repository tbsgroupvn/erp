#!/bin/bash

# Test script for Public Lead Capture API
# Usage: ./test-lead-capture.sh

API_URL="http://localhost:4000/api/public/leads"

echo "========================================="
echo "Testing Lead Capture Endpoint"
echo "========================================="
echo ""

# Test 1: New Customer
echo "Test 1: Creating new customer lead..."
echo "--------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Nguyen Van A",
    "phone": "0912345678",
    "email": "nguyenvana@example.com",
    "service": "VCT",
    "message": "Toi muon van chuyen hang tu Trung Quoc ve Viet Nam"
  }' | json_pp

echo ""
echo ""

# Test 2: Existing Customer (same phone)
echo "Test 2: Adding contact to existing customer..."
echo "--------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Nguyen Van A - Contact 2",
    "phone": "0912345678",
    "email": "contact2@example.com",
    "service": "MHH",
    "message": "Muon mua ho san pham"
  }' | json_pp

echo ""
echo ""

# Test 3: Phone normalization (+84 format)
echo "Test 3: Testing phone normalization (+84)..."
echo "--------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Tran Thi B",
    "phone": "+84987654321",
    "email": "tranthib@example.com",
    "service": "LCLCN"
  }' | json_pp

echo ""
echo ""

# Test 4: Validation Error (invalid phone)
echo "Test 4: Testing validation (invalid phone)..."
echo "--------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Invalid User",
    "phone": "123",
    "email": "invalid@example.com",
    "service": "VCT"
  }' | json_pp

echo ""
echo ""

# Test 5: Validation Error (invalid service)
echo "Test 5: Testing validation (invalid service)..."
echo "--------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Invalid Service",
    "phone": "0912345678",
    "email": "invalid@example.com",
    "service": "INVALID"
  }' | json_pp

echo ""
echo ""
echo "========================================="
echo "Tests completed!"
echo "========================================="
