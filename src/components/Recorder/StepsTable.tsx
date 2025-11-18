import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "../Ui/table";
import { Input } from '../Ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Ui/select';
import { Button } from '../Ui/button';
import { Trash2, GripVertical } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';

const eventTypes = ["open", "click", "input", "select", "Enter"];

interface Step {
  id?: string | number;
  name: string;
  event: string;
  path: string;
  value: string;
  label: string;
}

interface StepsTableProps {
  steps: Step[];
  onUpdateStep: (index: number, updatedFields: Partial<Step>) => void;
  onDeleteStep: (index: number) => void;
}

export default function StepsTable({ steps, onUpdateStep, onDeleteStep }: StepsTableProps) {
  const inputClass = "bg-slate-200 text-slate-900 border-slate-400 placeholder:text-slate-500 focus:bg-white focus:border-blue-500 focus:ring-blue-500";

  return (
    <div className="h-full">
      <Table>
        <Droppable droppableId="steps-droppable">
          {(provided) => (
            <TableBody {...provided.droppableProps} ref={provided.innerRef}>
              {steps.map((step, index) => (
                <Draggable key={String(step.id ?? index)} draggableId={String(step.id ?? index)} index={index}>
                  {(provided, snapshot) => (
                    <TableRow
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="border-b-0"
                      style={{
                        ...provided.draggableProps.style,
                        backgroundColor: snapshot.isDragging ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      }}
                    >
                      <TableCell className="w-10 cursor-move py-2" {...provided.dragHandleProps}>
                        <GripVertical className="text-slate-500" />
                      </TableCell>
                      <TableCell className="w-1/4 py-2">
                        <Input
                          value={
                            step.event === "open" && !step.label
                              ? "Open Page"
                              : step.label
                          }
                          onChange={(e) => onUpdateStep(index, {
                            label: e.target.value,
                            name: step.name
                          })}
                          className={inputClass}
                        />
                      </TableCell>
                      <TableCell className="w-48 py-2">
                        <Select
                          value={step.event}
                          onValueChange={(value) => onUpdateStep(index, { event: value, name: value })}
                        >
                          <SelectTrigger className={inputClass}>
                            <SelectValue placeholder="Select event" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            {eventTypes.map(type => (
                              <SelectItem key={type} value={type} className="hover:bg-slate-700">
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="w-1/3 py-2">
                        <Input
                          value={step.path}
                          onChange={(e) => onUpdateStep(index, { path: e.target.value })}
                          placeholder="URL or element selector..."
                          className={inputClass}
                        />
                      </TableCell>
                      <TableCell className="w-1/4 py-2">
                        <Input
                          value={step.value}
                          onChange={(e) => onUpdateStep(index, { value: e.target.value })}
                          placeholder="Input value..."
                          //disabled={step.event !== 'Input' && step.event !== 'Select'}
                          className={inputClass}
                        />
                      </TableCell>
                      <TableCell className="w-20 text-right py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteStep(index)}
                          className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </TableBody>
          )}
        </Droppable>
      </Table>
    </div>
  );
}
