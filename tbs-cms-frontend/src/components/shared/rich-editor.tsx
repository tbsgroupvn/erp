'use client';

import { useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api/client';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false }) as any;

// Import quill styles (must be done in a client component)
import 'react-quill/dist/quill.snow.css';

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Rich text editor component using React Quill.
 *
 * Features:
 * - Bold, Italic, Underline, Strike
 * - Headings (H1, H2, H3)
 * - Ordered and unordered lists
 * - Links
 * - Image upload (posts to /cms/media/upload)
 * - Block quote, code block
 * - Text alignment
 * - Clean formatting
 */
export function RichEditor({ value, onChange, placeholder, className }: RichEditorProps) {
  const quillRef = useRef<any>(null);

  // Image upload handler
  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'editor');

        const response = await apiClient.post('/cms/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const imageUrl = response.data?.url || response.data?.data?.url;
        if (!imageUrl) {
          console.error('No image URL in response');
          return;
        }

        // Get the Quill editor instance
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, 'image', imageUrl);
          quill.setSelection(range.index + 1);
        }
      } catch (error) {
        console.error('Image upload failed:', error);
      }
    };
  }, []);

  // Quill modules configuration
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ align: [] }],
          ['link', 'image'],
          ['blockquote', 'code-block'],
          ['clean'],
        ],
        handlers: {
          image: imageHandler,
        },
      },
      clipboard: {
        matchVisual: false,
      },
    }),
    [imageHandler],
  );

  // Allowed formats
  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'align',
    'link',
    'image',
    'blockquote',
    'code-block',
  ];

  return (
    <div className={className}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || 'Nhap noi dung...'}
      />
      <style jsx global>{`
        .ql-container {
          min-height: 200px;
          font-size: 14px;
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
        }
        .ql-toolbar {
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
          background: hsl(var(--muted));
        }
        .ql-editor {
          min-height: 200px;
        }
        .ql-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 0.375rem;
        }
        .ql-snow .ql-tooltip {
          z-index: 100;
        }
      `}</style>
    </div>
  );
}

export default RichEditor;
