import { useCallback } from "react";
import { renderService } from "../services/render.service";
import { useAsync } from "./useAsync";

export const useRenders = (projectId?: string) => {
  const state = useAsync(() => renderService.list({ projectId, limit: 200 }), [projectId]);
  const { setData } = state;
  const remove = useCallback(
    async (id: string) => {
      await renderService.remove(id);
      setData((prev) => (prev ?? []).filter((r) => r.id !== id));
    },
    [setData],
  );
  return { ...state, remove };
};
