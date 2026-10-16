"use client";

import { useState, useTransition, type FormEvent } from "react";

import { createTagAction } from "@/app/(app)/drills/actions";
import type { TagRead } from "@/lib/api-client";

import { Button } from "../ui/button";
import { Chip } from "../ui/chip";
import { TextField } from "../ui/text-field";

type TagPickerProps = {
  tags: TagRead[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  /** Called with a tag the person just created, so the parent can list it. */
  onTagCreated: (tag: TagRead) => void;
  error?: string;
};

/** Toggle the tags a drill has, or make a new one. */
export function TagPicker({ tags, selectedIds, onChange, onTagCreated, error }: TagPickerProps) {
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((tagId) => tagId !== id) : [...selectedIds, id]);
  }

  function create(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") return;
    setCreateError(null);
    startTransition(async () => {
      const result = await createTagAction(trimmed);
      if (result.ok) {
        onTagCreated(result.data);
        onChange([...selectedIds, result.data.id]);
        setName("");
      } else {
        setCreateError(
          result.code === "duplicate_tag_name" ? `There is already a tag called "${trimmed}".` : result.error,
        );
      }
    });
  }

  return (
    <fieldset className="flex flex-col gap-2" data-testid="drill-editor-tags">
      <legend className="mb-1 text-[13px] font-medium">Tags</legend>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              pressed={selectedIds.includes(tag.id)}
              data-testid={`drill-editor-tag-${tag.id}`}
              onClick={() => toggle(tag.id)}
            >
              {tag.name}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted" data-testid="drill-editor-tags-empty">
          No tags yet. Add the first one below.
        </p>
      )}
      {error && (
        <p className="text-xs text-miss" data-testid="drill-editor-tags-error">
          {error}
        </p>
      )}
      <form onSubmit={create} className="flex items-end gap-2">
        <TextField
          label="New tag"
          value={name}
          maxLength={50}
          error={createError ?? undefined}
          data-testid="drill-editor-tag-new"
          data-field="tags"
          className="flex-1"
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="submit"
          disabled={isPending || name.trim() === ""}
          className="mb-0"
          data-testid="drill-editor-tag-add"
        >
          Add tag
        </Button>
      </form>
    </fieldset>
  );
}
