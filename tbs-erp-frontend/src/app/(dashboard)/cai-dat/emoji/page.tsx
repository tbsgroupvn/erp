import { PageHeader } from '@/components/shared/page-header';
import { CustomEmojiManager } from '@/features/emoji/custom-emoji-manager';

export const metadata = {
  title: 'Custom Emoji - Cai dat | TBS ERP',
};

export default function EmojiSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Emoji"
        description="Quan ly emoji va sticker rieng cua cong ty su dung trong he thong."
      />
      <CustomEmojiManager />
    </div>
  );
}
