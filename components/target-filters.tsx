"use client";

import { useState, useEffect } from "react";
import { Search, Filter, X, Tag, Folder } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/error-handling";

interface TargetFiltersProps {
  onFiltersChange: (filters: {
    query: string;
    category?: string;
    tags: string[];
  }) => void;
  initialFilters?: {
    query: string;
    category?: string;
    tags: string[];
  };
}

export function TargetFilters({ onFiltersChange, initialFilters }: TargetFiltersProps) {
  const [query, setQuery] = useState(initialFilters?.query || "");
  const [selectedCategory, setSelectedCategory] = useState(initialFilters?.category || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialFilters?.tags || []);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch available categories and tags
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setLoading(true);
      try {
        const [categories, tags] = await Promise.all([
          apiRequest<string[]>('/api/targets/categories'),
          apiRequest<string[]>('/api/targets/tags'),
        ]);
        setAvailableCategories(categories);
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFilterOptions();
  }, []);

  // Apply filters when they change
  useEffect(() => {
    // Temporarily disabled to prevent infinite re-render
    // TODO: Fix the re-render loop
    // onFiltersChange({
    //   query,
    //   category: selectedCategory || undefined,
    //   tags: selectedTags,
    // });
  }, [query, selectedCategory, selectedTags]);

  const clearFilters = () => {
    setQuery("");
    setSelectedCategory("");
    setSelectedTags([]);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const hasActiveFilters = query || selectedCategory || selectedTags.length > 0;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search targets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={showAdvanced} onOpenChange={setShowAdvanced}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {(selectedCategory ? 1 : 0) + selectedTags.length}
                </span>
              )}
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Filter Targets</DialogTitle>
              <DialogDescription>
                Filter targets by category and tags to find what you're looking for.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Category Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  Category
                </Label>
                <div className="space-y-2">
                  <Button
                    variant={selectedCategory === "" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory("")}
                    className="w-full justify-start"
                  >
                    All Categories
                  </Button>
                  {availableCategories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className="w-full justify-start"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tags Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {availableTags.map((tag) => (
                    <Button
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleTag(tag)}
                      className="text-xs"
                    >
                      {tag}
                    </Button>
                  ))}
                  {availableTags.length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground">No tags available</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={clearFilters}>
                Clear All
              </Button>
              <Button onClick={() => setShowAdvanced(false)}>
                Apply Filters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 text-sm">
          {selectedCategory && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
              <Folder className="h-3 w-3" />
              {selectedCategory}
              <button
                onClick={() => setSelectedCategory("")}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-md"
            >
              <Tag className="h-3 w-3" />
              {tag}
              <button
                onClick={() => toggleTag(tag)}
                className="hover:bg-green-200 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}