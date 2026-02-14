# Public Website Structure

This directory contains the public-facing website for TBS ERP, using Next.js 14 App Router.

## Directory Structure

```
src/app/(public)/
├── components/
│   ├── navbar.tsx       # Main navigation component with responsive menu
│   └── footer.tsx       # Footer with company info, links, and social media
├── dang-ky/
│   └── page.tsx         # Registration page
├── layout.tsx           # Public layout with SEO metadata and JSON-LD
└── page.tsx             # Homepage with hero, services, stats, and CTA sections
```

## Features

### Layout (layout.tsx)
- Complete SEO metadata configuration
- Open Graph tags for social media sharing
- Twitter Card support
- JSON-LD structured data for Organization schema
- Responsive design with Navbar and Footer

### Homepage (page.tsx)
- **Hero Section**: Eye-catching banner with company tagline and CTAs
- **Services Grid**: 4 main services with icons (Order, Shipping, Customs, Tracking)
- **Stats Section**: Key metrics (10+ years, 5000+ orders/month, 3000+ customers, 98% satisfaction)
- **CTA Section**: Call-to-action encouraging users to sign up

### Navbar (navbar.tsx)
- Logo and branding
- Desktop menu with dropdown for services
- Mobile-responsive hamburger menu
- "Đăng nhập ERP" button
- Smooth transitions and hover effects

### Footer (footer.tsx)
- Company information with logo
- Quick links navigation
- Services list
- Contact information (address, phone, email, Zalo)
- Social media links (Facebook, LinkedIn, Zalo)
- Copyright and legal links

### Registration Page (dang-ky/page.tsx)
- Clean form layout for new user registration
- Required fields: company name, contact name, email, phone
- Optional message field for user needs
- Link back to homepage and login

## Public Routes Configuration

The following routes are configured as public in `middleware.ts`:

- `/` - Homepage
- `/login` - Login page
- `/doi-mat-khau` - Password reset
- `/dang-ky` - Registration
- `/dich-vu/*` - All service pages
- `/tin-tuc/*` - All news/blog pages
- `/lien-he` - Contact page
- `/gioi-thieu` - About page
- `/tinh-phi` - Shipping cost calculator
- `/tra-cuu` - Order tracking

## SEO Configuration

### Sitemap (src/app/sitemap.ts)
Automatically generates sitemap.xml with all public routes.

### Robots.txt (public/robots.txt)
Configured to allow search engines while protecting private routes.

## Styling

All components use:
- Tailwind CSS for styling
- Responsive design (mobile-first approach)
- Lucide React for icons
- Smooth transitions and hover effects
- Consistent color scheme (blue primary, gray neutrals)

## Next Steps

To extend this structure:

1. **Add Service Pages**: Create pages under `dich-vu/` directory
2. **Add News/Blog**: Implement blog functionality in `tin-tuc/`
3. **Add Contact Form**: Create contact page at `lien-he/`
4. **Add About Page**: Create company info page at `gioi-thieu/`
5. **Add Calculator**: Implement shipping calculator at `tinh-phi/`
6. **Add Tracking**: Create order tracking page at `tra-cuu/`

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Visit http://localhost:3000 to view the website.
