import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface AssignWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName: string;
}

export const AssignWorkDialog = ({ open, onOpenChange, vendorId, vendorName }: AssignWorkDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState("");

  // Fetch unassigned or pending maintenance requests
  const { data: requests = [] } = useQuery({
    queryKey: ["unassigned-maintenance-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select(`
          *,
          properties:property_id (name),
          units:unit_id (unit_number)
        `)
        .or("vendor_id.is.null,status.eq.pending")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const assignWorkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest) throw new Error("Please select a work order");

      const { error } = await supabase
        .from("maintenance_requests")
        .update({ 
          vendor_id: vendorId,
          assigned_at: new Date().toISOString(),
          status: "in_progress"
        })
        .eq("id", selectedRequest);
      
      if (error) throw error;

      // Notify tenant about vendor assignment
      try {
        await supabase.functions.invoke("notify-maintenance-update", {
          body: { requestId: selectedRequest, updateType: "vendor_assigned", vendorName },
        });
      } catch (err) {
        console.error("Failed to send notification:", err);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-maintenance-requests"] });
      toast.success(`Work order assigned to ${vendorName}`);
      onOpenChange(false);
      setSelectedRequest("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign work: ${error.message}`);
    },
  });

  const handleAssign = () => {
    assignWorkMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-background">
        <DialogHeader>
          <DialogTitle>Assign Work to {vendorName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Work Order</Label>
            <Select value={selectedRequest} onValueChange={setSelectedRequest}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a maintenance request..." />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover max-h-[300px]">
                {requests.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No available work orders
                  </div>
                ) : (
                  requests.map((request) => (
                    <SelectItem key={request.id} value={request.id}>
                      <div className="flex flex-col gap-1 py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{request.title}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              request.priority === "high" 
                                ? "bg-destructive/10 text-destructive border-destructive/20" 
                                : request.priority === "medium"
                                ? "bg-warning/10 text-warning border-warning/20"
                                : "bg-success/10 text-success border-success/20"
                            }
                          >
                            {request.priority}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {request.properties?.name} • Unit {request.units?.unit_number || "N/A"}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedRequest && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Selected Request Details:</p>
              {(() => {
                const request = requests.find(r => r.id === selectedRequest);
                return request ? (
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">{request.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created: {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setSelectedRequest("");
              }}
              disabled={assignWorkMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAssign}
              disabled={!selectedRequest || assignWorkMutation.isPending}
            >
              {assignWorkMutation.isPending ? "Assigning..." : "Assign Work"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
