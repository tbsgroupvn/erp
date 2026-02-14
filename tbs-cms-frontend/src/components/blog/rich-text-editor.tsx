'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

// Dynamically import ReactQuill to avoid SSR issues
const QuillEditor = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-lg border bg-slate-50">
      <p className="text-sm text-slate-500">Đang tải trình soạn thảo...</p>
    </div>
  ),
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Nhập nội dung bài viết...',
  className,
}: RichTextEditorProps) {
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          [{ font: [] }],
          [{ size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ script: 'sub' }, { script: 'super' }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          [{ direction: 'rtl' }],
          [{ align: [] }],
          ['blockquote', 'code-block'],
          ['link', 'image', 'video'],
          ['clean'],
        ],
      },
      clipboard: {
        matchVisual: false,
      },
    }),
    [],
  );

  const formats = [
    'header',
    'font',
    'size',
    'bold',
    'italic',
    'underline',
    'strike',
    'color',
    'background',
    'script',
    'list',
    'bullet',
    'indent',
    'direction',
    'align',
    'blockquote',
    'code-block',
    'link',
    'image',
    'video',
  ];

  return (
    <div className={className}>
      <QuillEditor
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="bg-white"
        style={{
          height: '400px',
          marginBottom: '42px',
        }}
      />
      <style jsx global>{`
        .ql-container {
          font-size: 16px;
          font-family: inherit;
        }
        .ql-editor {
          min-height: 400px;
          max-height: 600px;
          overflow-y: auto;
        }
        .ql-editor.ql-blank::before {
          color: #94a3b8;
          font-style: normal;
        }
        .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background: #f8fafc;
          border-color: #e2e8f0;
        }
        .ql-container {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          border-color: #e2e8f0;
        }
        .ql-editor h1 {
          font-size: 2em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        .ql-editor h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        .ql-editor h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        .ql-editor p {
          margin-bottom: 1em;
          line-height: 1.75;
        }
        .ql-editor ul,
        .ql-editor ol {
          margin-bottom: 1em;
          padding-left: 1.5em;
        }
        .ql-editor blockquote {
          border-left: 4px solid #e2e8f0;
          padding-left: 1em;
          margin-bottom: 1em;
          color: #64748b;
        }
        .ql-editor pre {
          background-color: #f1f5f9;
          padding: 1em;
          border-radius: 0.5rem;
          margin-bottom: 1em;
          overflow-x: auto;
        }
        .ql-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1em 0;
        }
        .ql-editor a {
          color: #3b82f6;
          text-decoration: none;
        }
        .ql-editor a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
