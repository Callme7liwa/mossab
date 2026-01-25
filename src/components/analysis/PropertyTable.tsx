import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Search, Filter, Loader2, RefreshCw, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProperties } from "@/hooks/useProperties";
import type { SimpleProperty } from "@/types/property";

type SortKey = keyof SimpleProperty;

const ITEMS_PER_PAGE = 20;

export function PropertyTable() {
  const { properties, loading, error, refetch } = useProperties({ top: 500 });
  
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Extract unique types and neighborhoods for filters
  const uniqueTypes = useMemo(() => 
    [...new Set(properties.map(p => p.type))].filter(Boolean).sort(),
    [properties]
  );
  
  const uniqueNeighborhoods = useMemo(() => 
    [...new Set(properties.map(p => p.neighborhood))].filter(Boolean).sort(),
    [properties]
  );

  const filteredAndSorted = useMemo(() => {
    let result = [...properties];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.address.toLowerCase().includes(searchLower) ||
          p.neighborhood.toLowerCase().includes(searchLower)
      );
    }

    // Filter by type
    if (typeFilter !== "all") {
      result = result.filter((p) => p.type === typeFilter);
    }

    // Filter by neighborhood
    if (neighborhoodFilter !== "all") {
      result = result.filter((p) => p.neighborhood === neighborhoodFilter);
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return result;
  }, [properties, search, sortKey, sortOrder, typeFilter, neighborhoodFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE);
  const paginatedProperties = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSorted, currentPage]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: Function) => (value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const SortableHeader = ({ column, label }: { column: SortKey; label: string }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown
          className={cn(
            "w-3 h-3 transition-colors",
            sortKey === column ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
    </TableHead>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bento-card"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            Property Comparison
          </h3>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : `${filteredAndSorted.length} properties found • Page ${currentPage} of ${totalPages}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search properties..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 w-[200px]"
            />
          </div>
          <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={neighborhoodFilter} onValueChange={handleFilterChange(setNeighborhoodFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Neighborhood" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              {uniqueNeighborhoods.slice(0, 20).map((area) => (
                <SelectItem key={area} value={area}>{area}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          Error loading properties: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Fetching live data...</span>
        </div>
      ) : (
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <SortableHeader column="address" label="Address" />
              <SortableHeader column="neighborhood" label="Neighborhood" />
              <TableHead>Type</TableHead>
              <SortableHeader column="price" label="Price" />
              <SortableHeader column="sqft" label="Sq Ft" />
              <TableHead>Bed/Bath</TableHead>
              <SortableHeader column="dom" label="DOM" />
              <SortableHeader column="pricePerSqft" label="$/SqFt" />
              <SortableHeader column="photosCount" label="Photos" />
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProperties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No properties found matching your criteria
                </TableCell>
              </TableRow>
            ) : (
            paginatedProperties.map((property, index) => (
              <motion.tr
                key={property.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-muted/30 transition-colors"
              >
                <TableCell className="font-medium">{property.address}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{property.neighborhood}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{property.type}</TableCell>
                <TableCell className="font-semibold">
                  ${property.price.toLocaleString()}
                </TableCell>
                <TableCell>{property.sqft.toLocaleString()}</TableCell>
                <TableCell>
                  {property.beds}/{property.baths}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "font-medium",
                      property.dom <= 10
                        ? "text-primary"
                        : property.dom <= 30
                        ? "text-accent"
                        : "text-destructive"
                    )}
                  >
                    {property.dom}
                  </span>
                </TableCell>
                <TableCell className="font-medium">
                  ${property.pricePerSqft}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs">
                    {property.photosCount || 0} {property.photosCount === 1 ? 'photo' : 'photos'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Link to={`/property/${property.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </TableCell>
              </motion.tr>
            )))}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Pagination */}
      {!loading && filteredAndSorted.length > 0 && (
        <div className="flex items-center justify-between px-2 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSorted.length)} of {filteredAndSorted.length} properties
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-9 h-9 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
