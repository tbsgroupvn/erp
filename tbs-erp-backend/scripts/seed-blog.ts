import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBlog() {
  console.log('🌱 Seeding blog data...');

  try {
    // Get admin user
    let adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { role: 'CEO' },
          { role: 'COO' },
          { email: { contains: 'admin' } }
        ]
      }
    });

    // If no specific admin, get any user
    if (!adminUser) {
      adminUser = await prisma.user.findFirst();
    }

    if (!adminUser) {
      console.error('❌ No users found in database! Please run: npx prisma db seed');
      return;
    }

    console.log(`✓ Found admin user: ${adminUser.email}`);

    // Create categories
    const categories = [
      {
        name: 'Tin tức',
        slug: 'tin-tuc',
        description: 'Các tin tức mới nhất về vận chuyển và logistics',
      },
      {
        name: 'Hướng dẫn',
        slug: 'huong-dan',
        description: 'Hướng dẫn sử dụng dịch vụ',
      },
      {
        name: 'Khuyến mãi',
        slug: 'khuyen-mai',
        description: 'Các chương trình khuyến mãi',
      },
    ];

    console.log('📁 Creating categories...');
    const createdCategories = [];
    for (const cat of categories) {
      const category = await prisma.blogCategory.upsert({
        where: { slug: cat.slug },
        update: cat,
        create: cat,
      });
      createdCategories.push(category);
      console.log(`  ✓ Created category: ${category.name}`);
    }

    // Create blog posts
    console.log('📝 Creating blog posts...');
    const posts = [
      {
        title: 'Chào mừng đến với TBS Blog',
        slug: 'chao-mung-den-voi-tbs-blog',
        content: `# Chào mừng bạn đến với TBS Blog

Chúng tôi rất vui mừng được giới thiệu blog chính thức của TBS - nơi chia sẻ những thông tin hữu ích về vận chuyển và logistics Trung Quốc - Việt Nam.

## Tại sao nên theo dõi blog của chúng tôi?

- **Cập nhật tin tức mới nhất** về ngành vận chuyển
- **Hướng dẫn chi tiết** các dịch vụ của TBS
- **Chia sẻ kinh nghiệm** nhập hàng từ Trung Quốc
- **Thông báo khuyến mãi** và ưu đãi đặc biệt

## Cam kết của TBS

Chúng tôi cam kết mang đến dịch vụ vận chuyển:
- Nhanh chóng
- An toàn
- Giá cả cạnh tranh
- Hỗ trợ 24/7

Hãy theo dõi blog của chúng tôi để không bỏ lỡ những thông tin quan trọng!`,
        excerpt: 'Giới thiệu về TBS Blog - nơi cập nhật tin tức và chia sẻ kiến thức về vận chuyển Trung Quốc - Việt Nam',
        coverImage: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=630&fit=crop',
        categoryId: createdCategories[0].id,
        authorId: adminUser.id,
        authorName: adminUser.fullName || 'Admin',
        status: 'PUBLISHED' as any,
        metaTitle: 'Chào mừng đến với TBS Blog - Tin tức vận chuyển',
        metaDescription: 'Blog chính thức của TBS - Chia sẻ tin tức, hướng dẫn và kinh nghiệm về vận chuyển hàng Trung Quốc',
        metaKeywords: ['blog', 'tin tức', 'vận chuyển', 'logistics', 'TBS'],
        views: 0,
      },
      {
        title: 'Hướng dẫn tra cứu đơn hàng',
        slug: 'huong-dan-tra-cuu-don-hang',
        content: `# Hướng dẫn tra cứu đơn hàng

Tra cứu đơn hàng giúp bạn theo dõi hành trình vận chuyển một cách dễ dàng.

## Các bước tra cứu

### Bước 1: Truy cập trang tra cứu
Vào trang web TBS và click vào mục "Tra cứu"

### Bước 2: Nhập mã đơn hàng
Nhập mã đơn hàng hoặc mã vận đơn vào ô tìm kiếm

### Bước 3: Xem kết quả
Hệ thống sẽ hiển thị:
- Trạng thái đơn hàng
- Vị trí hiện tại
- Lịch sử di chuyển
- Thời gian dự kiến giao hàng

## Lưu ý

- Mã đơn hàng có thể mất 2-4 giờ để cập nhật vào hệ thống
- Liên hệ hotline nếu cần hỗ trợ: 1900-xxxx`,
        excerpt: 'Hướng dẫn chi tiết cách tra cứu đơn hàng trên hệ thống TBS',
        coverImage: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=1200&h=630&fit=crop',
        categoryId: createdCategories[1].id,
        authorId: adminUser.id,
        authorName: adminUser.fullName || 'Admin',
        status: 'PUBLISHED' as any,
        metaTitle: 'Hướng dẫn tra cứu đơn hàng - TBS',
        metaDescription: 'Hướng dẫn chi tiết cách tra cứu và theo dõi đơn hàng vận chuyển tại TBS',
        metaKeywords: ['tra cứu', 'đơn hàng', 'hướng dẫn', 'tracking'],
        views: 0,
      },
      {
        title: 'Khuyến mãi tháng 2 - Giảm 20% phí vận chuyển',
        slug: 'khuyen-mai-thang-2-giam-20-phi-van-chuyen',
        content: `# 🎉 Khuyến mãi tháng 2 - Giảm 20% phí vận chuyển

Chào mừng tháng 2, TBS dành tặng quý khách hàng chương trình ưu đãi đặc biệt!

## Nội dung chương trình

- **Giảm 20%** phí vận chuyển cho tất cả đơn hàng
- **Miễn phí** đóng gói với đơn hàng > 10kg
- **Tặng voucher 100K** cho khách hàng mới

## Thời gian áp dụng

- Từ ngày: 01/02/2024
- Đến ngày: 29/02/2024

## Điều kiện

- Áp dụng cho tất cả tuyến đường
- Không giới hạn số lượng đơn hàng
- Không áp dụng đồng thời với chương trình khác

## Cách thức tham gia

1. Đăng ký tài khoản tại TBS
2. Tạo đơn hàng trong thời gian khuyến mãi
3. Mã giảm giá tự động áp dụng tại checkout

**Liên hệ ngay** để được tư vấn chi tiết!`,
        excerpt: 'Chương trình khuyến mãi tháng 2 - Giảm 20% phí vận chuyển và nhiều ưu đãi hấp dẫn',
        coverImage: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=1200&h=630&fit=crop',
        categoryId: createdCategories[2].id,
        authorId: adminUser.id,
        authorName: adminUser.fullName || 'Admin',
        status: 'PUBLISHED' as any,
        metaTitle: 'Khuyến mãi tháng 2 - Giảm 20% - TBS',
        metaDescription: 'Chương trình khuyến mãi tháng 2 tại TBS - Giảm 20% phí vận chuyển cùng nhiều ưu đãi khác',
        metaKeywords: ['khuyến mãi', 'giảm giá', 'ưu đãi', 'tháng 2'],
        views: 0,
      },
    ];

    for (const post of posts) {
      const createdPost = await prisma.blogPost.upsert({
        where: { slug: post.slug },
        update: post,
        create: post,
      });
      console.log(`  ✓ Created post: ${createdPost.title}`);
    }

    console.log('\n✅ Blog data seeded successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ${createdCategories.length} categories`);
    console.log(`   - ${posts.length} blog posts`);

  } catch (error) {
    console.error('❌ Error seeding blog data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedBlog()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
