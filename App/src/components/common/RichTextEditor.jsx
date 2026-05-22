import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

const ToolbarButton = ({ active, onClick, children, title }) => (
    <button
        type="button"
        title={title}
        onMouseDown={(e)=> e.preventDefault()}
        onClick={onClick}
        className={active ? "is-active" : ""}
    >
        {children}
    </button>   
);

const RichTextEditor = ({
    value = "",
    onChange,
    placeholder = "Write your content here...",
    minRows = 4,
    editable = true,
    toolbar = true,
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [2, 3] }}),
            Underline,
            Link.configure({ openOnClick: false, autolink: true }),
            Placeholder.configure({ placeholder }),
        ],
        content: value || "",
        editable,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            // Treat empty editor as empty string for form validation parity with <textarea>
            onChange?.(html === "<p></p>" ? "" : html);
        },
    });

    // Keep editor in sync when parent replaces the value (e.g. AI draft loads)
    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (value !== current && value !== (current === "<p></p>" ? "" : current)) {
            editor.commands.setContent(value || "", false);
        }
    }, [value, editor]);

    if (!editor) return null;

    return (
        <div className="tiptap-shell">
            {toolbar && editable && (
                <div className="tiptap-toolbar">
                    <ToolbarButton title="Bold" active={editor.isActive("bold")}
                        onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
                    <ToolbarButton title="Italic" active={editor.isActive("italic")}
                        onClick={() => editor.chain().focus().toggleItalic().run()}>I</ToolbarButton>
                    <ToolbarButton title="Underline" active={editor.isActive("underline")}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}>U</ToolbarButton>
                    <ToolbarButton title="Strike" active={editor.isActive("strike")}
                        onClick={() => editor.chain().focus().toggleStrike().run()}>S</ToolbarButton>
                    <ToolbarButton title="H2" active={editor.isActive("heading", { level: 2 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
                    <ToolbarButton title="H3" active={editor.isActive("heading", { level: 3 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
                    <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarButton>
                    <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarButton>
                    <ToolbarButton title="Quote" active={editor.isActive("blockquote")}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}>"</ToolbarButton>
                    <ToolbarButton title="Link"
                        onClick={() => {
                        const url = window.prompt("URL", editor.getAttributes("link").href || "");
                        if (url === null) return;
                        if (url === "") {
                            editor.chain().focus().extendMarkRange("link").unsetLink().run();
                        } else {
                            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                        }
                        }}>🔗</ToolbarButton>
                    <ToolbarButton title="Clear formatting"
                        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>⌫</ToolbarButton>
                </div>
            )}
            <EditorContent editor={editor} style={{ minHeight: `${minRows * 1.5}rem` }} />
        </div>
    );
};

export default RichTextEditor;