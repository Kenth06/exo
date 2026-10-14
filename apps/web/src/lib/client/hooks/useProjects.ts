import { useCallback } from "react";
import { projectService } from "../services/project.service";
import { useAsync } from "./useAsync";

export const useProjects = () => {
  const state = useAsync(() => projectService.list(), []);
  const { refresh } = state;

  const create = useCallback((name: string) => projectService.create(name), []);
  const remove = useCallback(
    async (id: string) => {
      await projectService.remove(id);
      await refresh();
    },
    [refresh],
  );
  return { ...state, create, remove };
};
