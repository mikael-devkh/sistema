import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Edit, Save } from "lucide-react";
import { Procedure } from "../data/troubleshootingData";

interface ProcedureEditorDialogProps {
  procedure: Procedure;
  onSave: (updatedProcedure: Procedure) => void;
}

export const ProcedureEditorDialog = ({ procedure, onSave }: ProcedureEditorDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState(procedure.content);

  useEffect(() => {
    setContent(procedure.content);
  }, [procedure.content]);

  const handleSave = () => {
    onSave({ ...procedure, content });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5 ml-auto self-end shrink-0">
          <Edit className="h-4 w-4" />
          Editar Conteúdo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editor de Conteúdo: {procedure.title}</DialogTitle>
          <DialogDescription>
            Edite o corpo do procedimento. Use a formatação Markdown: `## Título`, `1. Lista`, `**Negrito**`.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className="font-mono text-sm bg-secondary"
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" /> Salvar Conteúdo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
