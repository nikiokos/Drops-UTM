'use client';

import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Waypoint } from '@/store/missions.store';
import { cn } from '@/lib/utils';
import {
  GripVertical,
  MapPin,
  Trash2,
  ChevronRight,
  Play,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WaypointListProps {
  waypoints: Waypoint[];
  selectedWaypointId?: string | null;
  onSelect: (waypoint: Waypoint) => void;
  onDelete: (waypointId: string) => void;
  onReorder: (waypointIds: string[]) => void;
  disabled?: boolean;
}

export function WaypointList({
  waypoints,
  selectedWaypointId,
  onSelect,
  onDelete,
  onReorder,
  disabled = false,
}: WaypointListProps) {
  const sortedWaypoints = [...waypoints].sort((a, b) => a.sequence - b.sequence);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || disabled) return;

    const items = Array.from(sortedWaypoints);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onReorder(items.map((wp) => wp.id));
  };

  if (waypoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <MapPin className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">No waypoints yet</p>
        <p className="text-xs mt-1">Click on the map to add waypoints</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="waypoints" isDropDisabled={disabled}>
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="space-y-1"
          >
            {sortedWaypoints.map((waypoint, index) => (
              <Draggable
                key={waypoint.id}
                draggableId={waypoint.id}
                index={index}
                isDragDisabled={disabled}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                      'group flex items-center gap-2 p-2 rounded-lg border transition-colors',
                      selectedWaypointId === waypoint.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-card hover:bg-accent border-transparent',
                      snapshot.isDragging && 'shadow-lg',
                      disabled && 'opacity-60'
                    )}
                    onClick={() => !disabled && onSelect(waypoint)}
                  >
                    <div
                      {...provided.dragHandleProps}
                      className={cn(
                        'text-muted-foreground',
                        disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                      )}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <div
                      className={cn(
                        'flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold text-white',
                        index === 0
                          ? 'bg-green-500'
                          : index === sortedWaypoints.length - 1
                          ? 'bg-red-500'
                          : 'bg-indigo-500'
                      )}
                    >
                      {index === 0 ? (
                        <Play className="h-3 w-3" />
                      ) : index === sortedWaypoints.length - 1 ? (
                        <Flag className="h-3 w-3" />
                      ) : (
                        index + 1
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium truncate">
                          {waypoint.name || `Waypoint ${index + 1}`}
                        </span>
                        {waypoint.actions && waypoint.actions.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600">
                            {waypoint.actions.length} actions
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{waypoint.altitude}m</span>
                        {waypoint.speedToWaypoint && (
                          <>
                            <span>•</span>
                            <span>{waypoint.speedToWaypoint} m/s</span>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        selectedWaypointId === waypoint.id && 'rotate-90'
                      )}
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) onDelete(waypoint.id);
                      }}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
