"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import {
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import { EMPTY_DOC, type RichTextDoc } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { MentionList, type MentionCandidate } from "./mention-list";

/** What the @-suggestion popup needs to draw itself and act on a choice. */
type MentionPopup = {
  items: MentionCandidate[];
  command: (item: { id: string; label: string }) => void;
  left: number;
  top: number;
  /** Set when there is no room below the caret and the list sits above it. */
  above: boolean;
};

/** Enough room for the six candidates the list shows at most. */
const POPUP_MAX_HEIGHT = 232;

/**
 * Rich text input backed by TipTap. Emits the ProseMirror document, never HTML,
 * so what is stored is the same shape the server validates and the view renders.
 */
export function RichTextEditor({
  value,
  onChange,
  members,
  placeholder,
  ariaLabel,
  minHeight = 96,
  className,
}: {
  value: RichTextDoc | null;
  onChange: (doc: RichTextDoc) => void;
  /** People who can be @-mentioned here. */
  members: MentionCandidate[];
  placeholder?: string;
  ariaLabel: string;
  minHeight?: number;
  className?: string;
}) {
  // The suggestion plugin is created once, so it reads members through a ref
  // rather than closing over a stale array.
  const membersRef = useRef(members);
  membersRef.current = members;

  // The popup is ordinary React state, so the list is a real child and picks up
  // the app's theme. Keys arrive at the editor, so the editor owns the
  // selection; the suggestion plugin is built once and reads it through refs.
  const [popup, setPopupState] = useState<MentionPopup | null>(null);
  const popupRef = useRef<MentionPopup | null>(null);
  const [selected, setSelectedState] = useState(0);
  const selectedRef = useRef(0);

  const setPopup = (next: MentionPopup | null) => {
    popupRef.current = next;
    setPopupState(next);
  };
  const setSelected = (index: number) => {
    selectedRef.current = index;
    setSelectedState(index);
  };

  const editor = useEditor({
    immediatelyRender: false,
    // Toolbar buttons show the mark under the cursor, which needs a render per
    // transaction; TipTap 3 does not do that by default.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Only the marks and blocks the stored schema allows.
        horizontalRule: false,
        link: false,
        underline: false,
      }),
      Mention.configure({
        HTMLAttributes: { class: "tf-mention" },
        suggestion: {
          char: "@",
          items: ({ query }) => {
            const needle = query.trim().toLowerCase();
            return membersRef.current
              .filter(
                (member) =>
                  needle === "" ||
                  member.name.toLowerCase().includes(needle) ||
                  (member.jobTitle ?? "").toLowerCase().includes(needle),
              )
              .slice(0, 6);
          },
          render: () => {
            const show = (props: {
              items: MentionCandidate[];
              command: (item: { id: string; label: string }) => void;
              clientRect?: (() => DOMRect | null) | null;
            }) => {
              const rect = props.clientRect?.();
              if (!rect) return;
              // Near the bottom of the window the list would be cut off, so it
              // flips above the caret instead.
              const above =
                rect.bottom + POPUP_MAX_HEIGHT > window.innerHeight &&
                rect.top > POPUP_MAX_HEIGHT;
              setPopup({
                items: props.items,
                command: props.command,
                left: rect.left,
                top: above ? rect.top - 6 : rect.bottom + 6,
                above,
              });
              setSelected(0);
            };

            return {
              onStart: show,
              onUpdate: show,
              onKeyDown: ({ event }) => {
                const current = popupRef.current;
                if (!current) return false;

                if (event.key === "Escape") {
                  // Handled here so the surrounding dialog stays open.
                  setPopup(null);
                  return true;
                }
                if (current.items.length === 0) return false;

                if (event.key === "ArrowDown") {
                  setSelected((selectedRef.current + 1) % current.items.length);
                  return true;
                }
                if (event.key === "ArrowUp") {
                  setSelected(
                    (selectedRef.current + current.items.length - 1) %
                      current.items.length,
                  );
                  return true;
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  const item = current.items[selectedRef.current];
                  if (!item) return false;
                  current.command({ id: item.id, label: item.name });
                  return true;
                }
                return false;
              },
              onExit: () => setPopup(null),
            };
          },
        },
      }),
    ],
    content: value ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: "tf-prose outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor: instance }) => {
      // ProseMirror builds node attrs with Object.create(null), and a Server
      // Action refuses to serialise a null-prototype object — a mention would
      // arrive with its attrs missing. The JSON round trip makes them plain.
      onChange(JSON.parse(JSON.stringify(instance.getJSON())) as RichTextDoc);
    },
  });

  // Refill when the form resets to a different record.
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(value ?? EMPTY_DOC);
    if (current !== next) editor.commands.setContent(value ?? EMPTY_DOC);
    // Comparing serialised docs avoids a loop with onUpdate.
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className="border-line bg-input-bg rounded-xl border"
        style={{ minHeight: minHeight + 44 }}
      />
    );
  }

  const tools = [
    {
      icon: Bold,
      label: "ตัวหนา",
      isActive: "bold",
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: "ตัวเอียง",
      isActive: "italic",
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: Strikethrough,
      label: "ขีดฆ่า",
      isActive: "strike",
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      icon: Code,
      label: "โค้ด",
      isActive: "code",
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      icon: List,
      label: "รายการแบบจุด",
      isActive: "bulletList",
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: "รายการแบบตัวเลข",
      isActive: "orderedList",
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: Quote,
      label: "ยกคำพูด",
      isActive: "blockquote",
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ] as const;

  return (
    <div className={cn("border-line bg-input-bg rounded-xl border", className)}>
      <div className="border-line flex flex-wrap gap-1 border-b p-1.5">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={tool.run}
            aria-label={tool.label}
            title={tool.label}
            aria-pressed={editor.isActive(tool.isActive)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-lg transition-colors duration-150",
              editor.isActive(tool.isActive)
                ? "bg-primary-soft text-primary-ink"
                : "text-muted-foreground hover:bg-hover",
            )}
          >
            <tool.icon size={14} strokeWidth={2} />
          </button>
        ))}
        <span className="text-muted-foreground ml-auto self-center pr-1 text-[10.5px]">
          พิมพ์ @ เพื่อกล่าวถึงเพื่อนร่วมทีม
        </span>
      </div>

      <div className="relative px-3 py-2">
        {placeholder && editor.isEmpty ? (
          <p className="text-muted-foreground pointer-events-none absolute text-sm">
            {placeholder}
          </p>
        ) : null}
        <EditorContent editor={editor} />
      </div>

      {/* Portalled so the popup is not clipped by a dialog's overflow, and so
          `position: fixed` measures against the viewport rather than against a
          transformed dialog. */}
      {popup
        ? createPortal(
            <div
              className="fixed z-[300]"
              style={{
                left: popup.left,
                top: popup.top,
                transform: popup.above ? "translateY(-100%)" : undefined,
              }}
            >
              <MentionList
                items={popup.items}
                selected={selected}
                onHover={setSelected}
                onPick={(index) => {
                  const item = popup.items[index];
                  if (item) popup.command({ id: item.id, label: item.name });
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
