# Developer Guide - Using the New Design System

## Quick Start Guide for TBS ERP Developers

---

## 🚀 Getting Started

### 1. Run the Application
```bash
cd tbs-erp-frontend
npm install
npm run dev
```

Visit: `http://localhost:3001`

---

## 🎨 Using the Design System

### Color Classes

#### Primary Colors (Blue)
```tsx
// Backgrounds
className="bg-primary"           // Main blue
className="bg-secondary"         // Lighter blue
className="bg-accent"            // Orange (CTA)

// Text
className="text-primary"
className="text-foreground"      // Dark blue text
className="text-muted-foreground" // Gray text
```

#### Example Usage
```tsx
<div className="bg-primary text-primary-foreground p-6 rounded-xl">
  Primary content
</div>

<button className="bg-accent text-accent-foreground hover:bg-accent/90">
  Call to Action
</button>
```

---

## 📝 Typography

### Using the Font System

```tsx
// Headings (Poppins)
<h1 className="font-heading text-3xl font-bold">
  Main Heading
</h1>

// Body text (Open Sans) - default
<p className="font-sans text-base">
  Body content here
</p>

// Font weights
className="font-normal"    // 400
className="font-medium"    // 500
className="font-semibold"  // 600
className="font-bold"      // 700
```

### Typography Hierarchy
```tsx
// Page titles
<h1 className="text-3xl font-bold font-heading">

// Section headings
<h2 className="text-2xl font-semibold font-heading">

// Subsection headings
<h3 className="text-xl font-semibold font-heading">

// Body text
<p className="text-base">

// Small text
<p className="text-sm text-muted-foreground">
```

---

## 🎴 Component Examples

### Stat Card
```tsx
import { StatCard } from '@/components/shared/stat-card';
import { Users } from 'lucide-react';

<StatCard
  title="Total Users"
  value="3,245"
  icon={Users}
  description="Active this month"
  trend={{ value: 12, label: "vs last month" }}
/>
```

### Status Badge
```tsx
import { StatusBadge } from '@/components/shared/status-badge';

<StatusBadge
  label="Active"
  colorClass="bg-green-100 text-green-700"
/>

<StatusBadge
  label="Pending"
  colorClass="bg-yellow-100 text-yellow-700"
/>

<StatusBadge
  label="Inactive"
  colorClass="bg-red-100 text-red-700"
/>
```

### Buttons
```tsx
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// Primary button
<Button>
  <Plus className="h-4 w-4" />
  Add New
</Button>

// Secondary button
<Button variant="secondary">
  Save Draft
</Button>

// Outline button
<Button variant="outline">
  Cancel
</Button>

// Large button
<Button size="lg">
  Get Started
</Button>
```

### Data Table
```tsx
import { DataTable } from '@/components/shared/data-table';

<DataTable
  columns={columns}
  data={data}
  pageCount={totalPages}
  page={currentPage}
  onPageChange={setCurrentPage}
  isLoading={isLoading}
/>
```

### Page Header
```tsx
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';

<PageHeader
  title="Employees"
  description="Manage your team members"
>
  <Button>Add Employee</Button>
</PageHeader>
```

---

## 🎭 Interactive States

### Hover Effects

```tsx
// Card hover
<div className="rounded-xl border bg-card p-6 transition-all duration-300
                hover:shadow-lg hover:-translate-y-1">
  Content
</div>

// Button hover
<button className="bg-primary text-primary-foreground
                   hover:bg-primary/90 hover:scale-105
                   transition-all duration-200">
  Hover me
</button>

// Link hover
<Link href="/path" className="group inline-flex items-center gap-1
                               text-primary hover:gap-2
                               transition-all">
  Learn more
  <ArrowRight className="h-4 w-4 transition-transform
                         group-hover:translate-x-1" />
</Link>
```

### Focus States (Automatic)
All interactive elements have proper focus states thanks to global CSS:
```css
*:focus-visible {
  outline: 2px solid primary;
  outline-offset: 2px;
  ring: 2px primary/20;
}
```

---

## 🎨 Layout Utilities

### Cards
```tsx
// Basic card
<div className="rounded-xl border bg-card p-6 shadow-sm">
  Content
</div>

// Interactive card
<div className="rounded-xl border bg-card p-6 shadow-sm
                transition-all duration-300 hover:shadow-lg
                hover:-translate-y-1 cursor-pointer">
  Content
</div>
```

### Containers
```tsx
// Page container
<div className="container mx-auto max-w-7xl px-4">
  Content
</div>

// Section spacing
<section className="py-16 md:py-24">
  Content
</section>
```

### Grid Layouts
```tsx
// 4-column grid (responsive)
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
</div>
```

---

## 🎬 Animations

### Utility Classes
```tsx
// Hover lift
className="hover-lift"

// Hover scale
className="hover-scale"

// Card hover (lift + shadow)
className="card-hover"

// Smooth transition
className="smooth-transition"

// Pulse animation (for loading)
className="pulse-slow"
```

### Custom Animations
```tsx
// Fade in
className="animate-fade-in"

// Slide up
className="animate-slide-up"

// Scale in
className="animate-scale-in"
```

### Example
```tsx
<div className="rounded-xl bg-card p-6
                transition-all duration-300
                hover:shadow-xl hover:-translate-y-2">
  I lift and shadow on hover!
</div>
```

---

## 🎯 Common Patterns

### Service Card (Homepage Style)
```tsx
import { Package } from 'lucide-react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

<div className="group rounded-2xl border bg-white p-8 shadow-md
                transition-all duration-300 hover:shadow-xl
                hover:-translate-y-2 cursor-pointer">
  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center
                  rounded-xl bg-gradient-to-br from-blue-100 to-blue-50
                  text-blue-600 transition-all duration-300
                  group-hover:from-blue-600 group-hover:to-blue-500
                  group-hover:text-white group-hover:scale-110">
    <Package className="h-7 w-7" />
  </div>
  <h3 className="mb-3 text-xl font-heading font-bold">
    Service Name
  </h3>
  <p className="text-gray-600 mb-4">
    Service description here
  </p>
  <Link href="/path" className="group/link inline-flex items-center gap-1
                                 text-sm font-semibold text-blue-600
                                 hover:gap-2">
    Learn more
    <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1" />
  </Link>
</div>
```

### Hero Section
```tsx
<section className="relative overflow-hidden
                    bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900
                    px-4 py-24 text-white md:py-40">
  <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
  <div className="container relative mx-auto max-w-7xl">
    <h1 className="text-5xl font-bold font-heading md:text-7xl mb-8">
      Your Heading
    </h1>
    <p className="text-lg text-blue-100 mb-10">
      Your description
    </p>
    <div className="flex gap-4">
      <Button size="lg">Get Started</Button>
      <Button variant="outline" size="lg">Learn More</Button>
    </div>
  </div>
</section>
```

---

## ♿ Accessibility Checklist

When creating new components:

```tsx
// ✅ Add cursor-pointer to clickable elements
className="cursor-pointer"

// ✅ Add aria-label to icon-only buttons
<button aria-label="Close dialog">
  <X className="h-4 w-4" />
</button>

// ✅ Add loading states
{isLoading ? (
  <div className="flex items-center gap-2">
    <div className="h-4 w-4 animate-spin rounded-full
                    border-2 border-primary border-t-transparent" />
    Loading...
  </div>
) : (
  content
)}

// ✅ Use semantic HTML
<nav>...</nav>
<main>...</main>
<article>...</article>

// ✅ Respect reduced motion
// (Already handled globally in globals.css)
```

---

## 📱 Responsive Design

### Breakpoints
```tsx
// Mobile first approach
className="text-base md:text-lg lg:text-xl"

// Tailwind breakpoints:
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px
// 2xl: 1536px
```

### Example
```tsx
<div className="grid gap-6
                grid-cols-1
                md:grid-cols-2
                lg:grid-cols-3
                xl:grid-cols-4">
  {/* Items */}
</div>
```

---

## 🎨 Color Reference

### Status Colors
```tsx
// Success
className="bg-green-100 text-green-700"

// Warning
className="bg-yellow-100 text-yellow-700"

// Error
className="bg-red-100 text-red-700"

// Info
className="bg-blue-100 text-blue-700"
```

### Gradients
```tsx
// Blue gradient (hero sections)
className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900"

// Icon gradient backgrounds
className="bg-gradient-to-br from-blue-100 to-blue-50"
```

---

## 🛠️ Common Issues & Solutions

### Issue: Icon not showing
```tsx
// ❌ Wrong
import { Package } from 'lucide-react';
<Package />

// ✅ Correct - add size class
<Package className="h-5 w-5" />
```

### Issue: Hover state not smooth
```tsx
// ❌ Wrong
<div className="hover:bg-blue-500">

// ✅ Correct - add transition
<div className="hover:bg-blue-500 transition-all duration-200">
```

### Issue: Text too small on mobile
```tsx
// ❌ Wrong
<p className="text-sm">

// ✅ Correct - use responsive sizes
<p className="text-sm md:text-base">
```

### Issue: Focus state not visible
```tsx
// ❌ Wrong
<button className="outline-none">

// ✅ Correct - use focus-visible
<button className="focus-visible:ring-2 focus-visible:ring-primary">
```

---

## 📚 Resources

### Design System
- **Location:** `design-system/tbs-erp/MASTER.md`
- **Colors:** See globals.css CSS variables
- **Typography:** Poppins (headings) + Open Sans (body)

### Documentation
- **Summary:** `UI_IMPROVEMENTS_SUMMARY.md`
- **Comparison:** `BEFORE_AFTER_COMPARISON.md`
- **This Guide:** `DEVELOPER_GUIDE.md`

### External Resources
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/)
- [Radix UI](https://www.radix-ui.com/)
- [shadcn/ui](https://ui.shadcn.com/)

---

## 💡 Pro Tips

1. **Always use Lucide icons** - Never use emojis as icons
2. **Add transitions** - All interactive elements should have smooth transitions
3. **Use font-heading for titles** - Applies Poppins font automatically
4. **Add cursor-pointer** - On all clickable elements for clear affordance
5. **Test hover states** - Every interactive element should have visual feedback
6. **Check mobile** - Test on small screens (375px minimum)
7. **Use semantic HTML** - Improves accessibility and SEO
8. **Add loading states** - Show spinners during async operations

---

## 🎯 Quick Copy-Paste Templates

### New Page Template
```tsx
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function NewPage() {
  return (
    <div>
      <PageHeader
        title="Page Title"
        description="Page description"
      >
        <Button>
          <Plus className="h-4 w-4" />
          Add New
        </Button>
      </PageHeader>

      <div className="space-y-6">
        {/* Content here */}
      </div>
    </div>
  );
}
```

### Dashboard Stats Grid
```tsx
import { StatCard } from '@/components/shared/stat-card';
import { Users, Package, TrendingUp, DollarSign } from 'lucide-react';

<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
  <StatCard
    title="Total Users"
    value="3,245"
    icon={Users}
    trend={{ value: 12, label: "vs last month" }}
  />
  <StatCard
    title="Orders"
    value="1,892"
    icon={Package}
    trend={{ value: 8, label: "vs last month" }}
  />
  <StatCard
    title="Revenue"
    value="$45,231"
    icon={DollarSign}
    trend={{ value: 23, label: "vs last month" }}
  />
  <StatCard
    title="Growth"
    value="23%"
    icon={TrendingUp}
    trend={{ value: 5, label: "vs last month" }}
  />
</div>
```

---

**Happy Coding! 🚀**

If you have questions, refer to the design system documentation or check existing component implementations for examples.
