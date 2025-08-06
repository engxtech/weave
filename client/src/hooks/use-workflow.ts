import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Workflow, InsertWorkflow } from "@shared/schema";

export function useWorkflows() {
  return useQuery({
    queryKey: ["/api/workflows"],
  });
}

export function useWorkflow(id?: number) {
  return useQuery({
    queryKey: ["/api/workflows", id],
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertWorkflow): Promise<Workflow> => {
      const response = await apiRequest("POST", "/api/workflows", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertWorkflow> }): Promise<Workflow> => {
      const response = await apiRequest("PATCH", `/api/workflows/${id}`, data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", variables.id] });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/workflows/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
    },
  });
}

export function useExecuteWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number): Promise<{ message: string; updatedNodes?: any[]; results?: any[] }> => {
      const response = await fetch(`/api/workflows/${id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute workflow');
      }

      return response.json();
    },
    onSuccess: (data, id) => {
      // Invalidate and refetch workflow data
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
    },
  });
}

// Chat-related hooks
export function useWorkflowChat(workflowId: number) {
  return useQuery({
    queryKey: ["/api/workflows", workflowId, "chat"],
    enabled: !!workflowId,
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ workflowId, message }: { workflowId: number; message: string }): Promise<any> => {
      const response = await apiRequest("POST", `/api/workflows/${workflowId}/chat`, { message });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/workflows", variables.workflowId, "chat"] 
      });
    },
  });
}

// Settings hooks for compatibility
export function useUserSettings() {
  return useQuery({
    queryKey: ["/api/settings"],
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", "/api/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
}