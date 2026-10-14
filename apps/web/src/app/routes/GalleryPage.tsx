import { Banner, Button, Empty, Tabs } from "@cloudflare/kumo";
import type { RenderView } from "@exo/shared";
import { DownloadSimpleIcon, ImagesIcon, TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRenders } from "@/lib/client/hooks/useRenders";

type Filter = "all" | "image" | "video";

const TileSkeleton = () => (
  <li aria-hidden="true">
    <div className="aspect-square animate-pulse rounded-lg bg-[var(--exo-line)]" />
    <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-[var(--exo-line)]" />
  </li>
);

export const GalleryPage = () => {
  const { data: renders, loading, error, remove } = useRenders();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<RenderView | null>(null);
  const shown = (renders ?? []).filter((r) => filter === "all" || r.kind === filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">Gallery</h1>
        <Tabs
          className="ml-auto"
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          tabs={[
            { value: "all", label: "All" },
            { value: "image", label: "Images" },
            { value: "video", label: "Videos" },
          ]}
        />
      </div>
      {error && <Banner variant="error" title={error.message} />}
      {renders && shown.length === 0 && (
        <Empty
          icon={<ImagesIcon size={40} className="opacity-60" />}
          title="No renders yet"
          description="Images and videos you render in a project are saved here."
          contents={<Button onClick={() => navigate("/app")}>Go to projects</Button>}
        />
      )}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
        {loading && !renders && Array.from({ length: 8 }, (_, i) => <TileSkeleton key={i} />)}
        {shown.map((r) => (
          <li key={r.id}>
            {r.kind === "video" ? (
              <video
                src={r.url}
                muted
                loop
                playsInline
                controls
                className="exo-outline aspect-square w-full rounded-lg bg-black object-contain"
                aria-label={r.label}
              />
            ) : (
              <img
                src={r.url}
                alt={r.label}
                loading="lazy"
                className="exo-outline exo-surface aspect-square w-full rounded-lg object-contain"
              />
            )}
            <p className="mt-2 line-clamp-2 text-sm" title={r.label}>
              {r.label}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <span className="font-mono text-xs tabular-nums exo-fg-soft">
                {r.meta.width} × {r.meta.height}
              </span>
              <a
                href={`${r.url}?download=1`}
                aria-label={`Download ${r.label}`}
                className="ml-auto inline-grid size-9 place-items-center rounded-md hover:bg-[var(--exo-line)]"
              >
                <DownloadSimpleIcon size={16} />
              </a>
              <Button
                size="sm"
                variant="ghost"
                shape="square"
                icon={<TrashIcon />}
                aria-label={`Delete ${r.label}`}
                onClick={() => setDeleting(r)}
              />
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this render?"
        description="The file is removed from storage. You can render it again from its project."
        confirmLabel="Delete render"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
        }}
      />
    </div>
  );
};
