import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Check, Edit, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Textarea } from "./ui/textarea";

interface EditableTextProps {
  initialValue: string;
  onSave: (newValue: string) => void;
  className?: string;
  placeholder?: string;
  isTextarea?: boolean;
  disabled?: boolean;
}

export const EditableText = ({
  initialValue,
  onSave,
  className,
  placeholder = "Clique para editar",
  isTextarea = false,
  disabled = false,
}: EditableTextProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSave = () => {
    onSave(value);
    setIsEditing(false);
  };

  const Component = isTextarea ? Textarea : Input;

  if (disabled) {
    return (
      <div
        className={cn(
          "w-full rounded-sm px-1 py-0.5 text-base text-foreground/90",
          isTextarea && "whitespace-pre-wrap text-sm leading-relaxed",
          className,
        )}
      >
        {initialValue || <span className="text-muted-foreground">{placeholder}</span>}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={cn("flex gap-2 items-start", className)}>
        <Component
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isTextarea) {
              e.preventDefault();
              handleSave();
            }
          }}
          className={cn("flex-1", isTextarea ? "min-h-[100px]" : "h-10")}
          placeholder={placeholder}
          autoFocus
        />
        <div className={cn("flex gap-1", isTextarea ? "mt-1" : "self-center")}>
          <Button size="icon" variant="default" onClick={handleSave} className="h-8 w-8">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => setIsEditing(false)} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex justify-between items-center w-full group/editable",
        isTextarea ? "border border-input p-2 rounded-md hover:border-primary/50" : "hover:bg-accent/10 rounded-sm px-1 py-0.5"
      )}
      onClick={() => setIsEditing(true)}
    >
      <span
        className={cn(
          "text-base min-h-[20px] w-full cursor-pointer",
          className,
          isTextarea && "whitespace-pre-wrap text-sm"
        )}
      >
        {initialValue || <span className="text-muted-foreground">{placeholder}</span>}
      </span>
      <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover/editable:opacity-100 transition-opacity shrink-0 ml-2" />
    </div>
  );
};
