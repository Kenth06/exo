import { Banner, Button, Dialog, DropdownMenu, Empty, Input } from "@cloudflare/kumo";
import type { ProjectSummary } from "@exo/shared";
import { DotsThreeIcon, FolderSimplePlusIcon, PlusIcon } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useProjects } from "@/lib/client/hooks/useProjects";

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const ProjectRowSkeleton = () => (
  <li className="flex items-center gap-4 py-4" aria-hidden="true">
    <div className="h-4 w-48 animate-pulse rounded bg-[var(--exo-line)]" />
    <div className="ml-auto h-4 w-24 animate-pulse rounded bg-[var(--exo-line)]" />
  </li>
);

export const DashboardPage = () => {
  const { data: projects, loading, error, create, remove } = useProjects();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const p = await create(name.trim());
      navigate(`/app/projects/${p.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            render={(p) => (
              <Button {...p} variant="primary" icon={<PlusIcon />} className="ml-auto">
                New project
              </Button>
            )}
          />
          <Dialog className="p-6">
            <Dialog.Title className="text-lg font-semibold">New project</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm exo-fg-soft">
              A project is one product, with up to 4 sliced parts.
            </Dialog.Description>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <Input
                label="Name"
                autoFocus
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ribbed lamp"
              />
              <div className="flex justify-end gap-2">
                <Dialog.Close
                  render={(p) => (
                    <Button {...p} variant="secondary">
                      Cancel
                    </Button>
                  )}
                />
                <Button type="submit" variant="primary" loading={creating}>
                  Create
                </Button>
              </div>
            </form>
          </Dialog>
        </Dialog.Root>
      </div>

      {error && <Banner variant="error" title={error.message} />}
      {loading && !projects && (
        <ul className="divide-y exo-border border-y exo-border">
          <ProjectRowSkeleton />
          <ProjectRowSkeleton />
          <ProjectRowSkeleton />
        </ul>
      )}
      {projects && projects.length === 0 && (
        <Empty
          icon={<FolderSimplePlusIcon size={40} className="opacity-60" />}
          title="No projects yet"
          description="Create a project, then drop in a sliced file."
          contents={
            <Button variant="primary" onClick={() => setOpen(true)}>
              New project
            </Button>
          }
        />
      )}
      {projects && projects.length > 0 && (
        <ul className="divide-y exo-border border-y exo-border">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-4 py-3">
              <Link to={`/app/projects/${p.id}`} className="min-w-0 flex-1 rounded-md py-1 hover:underline">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-sm exo-fg-soft">
                  {p.files.length === 0 ? "No files yet" : p.files.map((f) => f.filename).join(", ")}
                </span>
              </Link>
              <span className="hidden text-sm tabular-nums exo-fg-soft sm:block">{formatDate(p.updatedAt)}</span>
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      shape="square"
                      icon={<DotsThreeIcon />}
                      aria-label={`Actions for ${p.name}`}
                    />
                  }
                />
                <DropdownMenu.Content>
                  <DropdownMenu.Item variant="danger" onClick={() => setDeleting(p)}>
                    Delete project
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "project"}?`}
        description="This deletes the project and its uploaded files. Renders you saved stay in your gallery."
        confirmLabel="Delete project"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
        }}
      />
    </div>
  );
};
