'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function Editor({ value, onChange, placeholder, readOnly }: EditorProps) {
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        [{ align: [] }],
        ['blockquote', 'code-block'],
        [{ color: [] }, { background: [] }],
        ['link', 'image', 'video'],
        ['clean'],
      ],
      clipboard: {
        matchVisual: false,
      },
    }),
    [],
  );

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'indent',
    'align',
    'blockquote',
    'code-block',
    'color',
    'background',
    'link',
    'image',
    'video',
  ];

  return (
    <div className="prose-editor">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
        className="h-96 mb-12"
      />
    </div>
  );
}
