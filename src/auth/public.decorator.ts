import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC = 'isPublic';
/** Cách DUY NHẤT mở một endpoint ra ngoài. Mặc định toàn hệ là ĐÓNG. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
