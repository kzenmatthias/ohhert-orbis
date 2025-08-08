"use client";

import { useState } from "react";
import { 
  MoreHorizontal, 
  Trash2, 
  Edit, 
  Download, 
  Upload,
  CheckSquare,
  Square,
  Tag,
  Folder
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScreenshotTarget } from "@/lib/db";
import { apiRequest } from "@/lib/error-handling";
import { useToast } from "@/components/ui/toast";
import { createSuccessToast, createErrorToast } from "@/lib/error-handling";

interface BulkOperationsProps {
  targets: ScreenshotTarget[];
  selectedTargets: number[];
  onSelectionChange: (targetIds: number[]) => void;
  onTargetsUpdated: () => void;
}

export function BulkOperations({ 
  targets, 
  selectedTargets, 
  onSelectionChange, 
  onTargetsUpdated 
}: BulkOperationsProps) {
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    category: "",
    tags: [] as string[],
  });
  const [newTag, setNewTag] = useState("");
  const [importData, setImportData] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { addToast } = useToast();

  const toggleSelectAll = () => {
    if (selectedTargets.length === targets.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(targets.map(t => t.id!));
    }
  };

  const toggleTarget = (targetId: number) => {
    if (selectedTargets.includes(targetId)) {
      onSelectionChange(selectedTargets.filter(id => id !== targetId));
    } else {
      onSelectionChange([...selectedTargets, targetId]);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedTargets.length === 0) return;

    setIsProcessing(true);
    try {
      const updates: { category?: string; tags?: string[] } = {};
      if (bulkEditData.category) updates.category = bulkEditData.category;
      if (bulkEditData.tags.length > 0) updates.tags = bulkEditData.tags;

      const result = await apiRequest('/api/targets/bulk', {
        method: 'PUT',
        body: JSON.stringify({
          targetIds: selectedTargets,
          updates,
        }),
      });

      addToast(createSuccessToast(`Updated ${selectedTargets.length} targets successfully`));
      setShowBulkEdit(false);
      setBulkEditData({ category: "", tags: [] });
      onSelectionChange([]);
      onTargetsUpdated();
    } catch (error) {
      console.error('Bulk update failed:', error);
      addToast(createErrorToast(error as Error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTargets.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedTargets.length} targets? This action cannot be undone.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await apiRequest('/api/targets/bulk', {
        method: 'DELETE',
        body: JSON.stringify({
          targetIds: selectedTargets,
        }),
      });

      addToast(createSuccessToast(`Deleted ${selectedTargets.length} targets successfully`));
      onSelectionChange([]);
      onTargetsUpdated();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      addToast(createErrorToast(error as Error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      const targetIds = selectedTargets.length > 0 ? selectedTargets : undefined;
      const queryParams = targetIds ? `?targetIds=${targetIds.join(',')}` : '';
      
      const response = await fetch(`/api/targets/export${queryParams}`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'targets.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast(createSuccessToast(`Exported ${selectedTargets.length || targets.length} targets successfully`));
    } catch (error) {
      console.error('Export failed:', error);
      addToast(createErrorToast(error as Error));
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) return;

    setIsProcessing(true);
    try {
      const targets = JSON.parse(importData);
      
      const result = await apiRequest('/api/targets/import', {
        method: 'POST',
        body: JSON.stringify({
          targets,
          replaceExisting: false,
        }),
      });

      addToast(createSuccessToast(`Imported ${(result as any).imported} targets successfully`));
      setShowImport(false);
      setImportData("");
      onTargetsUpdated();
    } catch (error) {
      console.error('Import failed:', error);
      addToast(createErrorToast(error as Error));
    } finally {
      setIsProcessing(false);
    }
  };

  const addBulkTag = () => {
    const tag = newTag.trim();
    if (tag && !bulkEditData.tags.includes(tag)) {
      setBulkEditData(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setNewTag("");
    }
  };

  const removeBulkTag = (index: number) => {
    setBulkEditData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBulkTag();
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSelectAll}
          className="flex items-center gap-2"
        >
          {selectedTargets.length === targets.length ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {selectedTargets.length > 0 ? `${selectedTargets.length} selected` : 'Select All'}
        </Button>

        {selectedTargets.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkEdit(true)}
              disabled={isProcessing}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export {selectedTargets.length > 0 ? 'Selected' : 'All'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Targets
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {selectedTargets.length} Targets</DialogTitle>
            <DialogDescription>
              Update category and tags for the selected targets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-category">Category</Label>
              <Input
                id="bulk-category"
                value={bulkEditData.category}
                onChange={(e) => setBulkEditData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Enter category..."
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md">
                  {bulkEditData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeBulkTag(index)}
                        className="hover:bg-primary/20 rounded-full p-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {bulkEditData.tags.length === 0 && (
                    <span className="text-muted-foreground text-sm">No tags added</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBulkTag}
                    disabled={!newTag.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEdit(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpdate} disabled={isProcessing}>
              {isProcessing ? 'Updating...' : 'Update Targets'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Targets</DialogTitle>
            <DialogDescription>
              Paste the JSON data of targets to import. Existing targets with the same name will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-data">JSON Data</Label>
              <textarea
                id="import-data"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste JSON data here..."
                className="w-full h-32 p-2 border rounded-md resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isProcessing || !importData.trim()}>
              {isProcessing ? 'Importing...' : 'Import Targets'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual Target Selection */}
      <div className="hidden">
        {targets.map((target) => (
          <input
            key={target.id}
            type="checkbox"
            checked={selectedTargets.includes(target.id!)}
            onChange={() => toggleTarget(target.id!)}
          />
        ))}
      </div>
    </div>
  );
}