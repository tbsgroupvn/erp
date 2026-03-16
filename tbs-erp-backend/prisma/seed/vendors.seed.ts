import { PrismaClient } from '@prisma/client';

/**
 * Seeds 6 Chinese vendors for MHH (Mua hàng hộ) service.
 * Upsert by vendor code for idempotency.
 */
export async function seedVendors(prisma: PrismaClient) {
  if (process.env.APP_ENV === 'production') {
    console.log('  → Skipping vendors seed in production');
    return;
  }

  console.log('  → Seeding Chinese vendors (6)...');

  const vendors = [
    {
      code: 'NCC-GZ-001',
      name: 'Guangzhou YiDa Trading Co., Ltd',
      contactPerson: 'Wang Wei',
      phone: '+86-20-8888-1001',
      email: 'wang@yida-gz.com',
      address: '88 Huanshi East Rd, Yuexiu District, Guangzhou, Guangdong',
      country: 'CN',
      paymentTerms: 'T/T 30% deposit, 70% before shipment',
    },
    {
      code: 'NCC-SZ-001',
      name: 'Shenzhen HuaXin Electronics Co., Ltd',
      contactPerson: 'Li Na',
      phone: '+86-755-2888-2002',
      email: 'lina@huaxin-sz.com',
      address: '168 Shennan Blvd, Nanshan District, Shenzhen, Guangdong',
      country: 'CN',
      paymentTerms: 'T/T 50% deposit, 50% after QC',
    },
    {
      code: 'NCC-YW-001',
      name: 'Yiwu MingFeng Commodity Co., Ltd',
      contactPerson: 'Zhang Lei',
      phone: '+86-579-8518-3003',
      email: 'zhang@mingfeng-yw.com',
      address: '1688 Chouzhou North Rd, Yiwu, Zhejiang',
      country: 'CN',
      paymentTerms: 'T/T 100% before shipment',
    },
    {
      code: 'NCC-FS-001',
      name: 'Foshan JiaHe Furniture Co., Ltd',
      contactPerson: 'Chen Ming',
      phone: '+86-757-8288-4004',
      email: 'chen@jiahe-fs.com',
      address: '56 Lingnan Ave, Shunde District, Foshan, Guangdong',
      country: 'CN',
      paymentTerms: 'L/C 60 days',
    },
    {
      code: 'NCC-HZ-001',
      name: 'Hangzhou SiLu Textile Co., Ltd',
      contactPerson: 'Liu Fang',
      phone: '+86-571-8799-5005',
      email: 'liu@silu-hz.com',
      address: '299 Qiutao Rd, Jianggan District, Hangzhou, Zhejiang',
      country: 'CN',
      paymentTerms: 'T/T 30% deposit, 70% against B/L',
    },
    {
      code: 'NCC-DG-001',
      name: 'Dongguan WeiLi Plastics Co., Ltd',
      contactPerson: 'Zhao Qiang',
      phone: '+86-769-2288-6006',
      email: 'zhao@weili-dg.com',
      address: '18 Songshan Lake High-Tech Zone, Dongguan, Guangdong',
      country: 'CN',
      paymentTerms: 'T/T 50% deposit, 50% before shipment',
    },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { code: v.code },
      update: {
        name: v.name,
        contactPerson: v.contactPerson,
        phone: v.phone,
        email: v.email,
        address: v.address,
      },
      create: {
        ...v,
        isApproved: true,
      },
    });
  }

  console.log(`  ✅ ${vendors.length} vendors seeded`);
}
