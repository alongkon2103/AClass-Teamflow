import { Fragment, type ReactNode } from "react";
import {
  plainToRichText,
  type RichNode,
  type RichTextDoc,
} from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Renders a stored document as React elements.
 *
 * Deliberately not dangerouslySetInnerHTML: only the node types below can ever
 * become markup, so nothing a user typed can turn into script or styling
 * (SPEC section 7). Anything unrecognised is skipped rather than rendered raw.
 */
function renderNodes(nodes: RichNode[] | undefined): ReactNode {
  if (!nodes) return null;

  return nodes.map((node, index) => {
    const key = index;

    switch (node.type) {
      case "text": {
        let element: ReactNode = node.text;
        for (const mark of node.marks ?? []) {
          if (mark.type === "bold")
            element = <strong key={key}>{element}</strong>;
          if (mark.type === "italic") element = <em key={key}>{element}</em>;
          if (mark.type === "strike") element = <s key={key}>{element}</s>;
          if (mark.type === "code") {
            element = (
              <code
                key={key}
                className="bg-hover rounded px-1 py-0.5 font-mono text-[0.9em]"
              >
                {element}
              </code>
            );
          }
        }
        return <Fragment key={key}>{element}</Fragment>;
      }

      case "mention":
        return (
          <span
            key={key}
            className="text-primary-ink rounded px-1 font-semibold"
            style={{
              background:
                "color-mix(in srgb, var(--color-primary) 14%, transparent)",
            }}
          >
            @{node.attrs.label}
          </span>
        );

      case "hardBreak":
        return <br key={key} />;

      case "paragraph":
        return (
          <p key={key} className="whitespace-pre-wrap">
            {renderNodes(node.content)}
          </p>
        );

      case "heading":
        return node.attrs.level === 2 ? (
          <h4 key={key} className="mt-3 text-[15px] font-bold first:mt-0">
            {renderNodes(node.content)}
          </h4>
        ) : (
          <h5 key={key} className="mt-2 text-[13.5px] font-bold first:mt-0">
            {renderNodes(node.content)}
          </h5>
        );

      case "bulletList":
        return (
          <ul key={key} className="list-disc pl-5">
            {renderNodes(node.content)}
          </ul>
        );

      case "orderedList":
        return (
          <ol key={key} className="list-decimal pl-5">
            {renderNodes(node.content)}
          </ol>
        );

      case "listItem":
        return <li key={key}>{renderNodes(node.content)}</li>;

      case "blockquote":
        return (
          <blockquote
            key={key}
            className="border-line text-muted-foreground border-l-2 pl-3"
          >
            {renderNodes(node.content)}
          </blockquote>
        );

      case "codeBlock":
        return (
          <pre
            key={key}
            className="bg-hover overflow-x-auto rounded-lg p-3 font-mono text-xs"
          >
            <code>{renderNodes(node.content)}</code>
          </pre>
        );

      default:
        return null;
    }
  });
}

export function RichTextView({
  doc,
  className,
}: {
  /**
   * A stored document, or plain text. The string case is a safety net: a row
   * the rich-text migration never reached must still show what it says rather
   * than render blank.
   */
  doc: RichTextDoc | string | null | undefined;
  className?: string;
}) {
  const value = typeof doc === "string" ? plainToRichText(doc) : doc;
  if (!value?.content?.length) return null;

  return (
    <div className={cn("flex flex-col gap-2 leading-relaxed", className)}>
      {renderNodes(value.content)}
    </div>
  );
}
