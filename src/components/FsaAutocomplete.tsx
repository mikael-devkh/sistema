import { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { searchFsaByNumber } from '../lib/fsa';

interface FsaAutocompleteProps {
  value?: string;
  onSelect: (fsaNumber: string) => void;
  placeholder?: string;
}

export function FsaAutocomplete({ value, onSelect, placeholder = "Buscar FSA..." }: FsaAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Buscar histórico do localStorage
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('fsa-search-history') || '[]');
    setSuggestions(history.slice(0, 5));
  }, []);

  // Buscar FSA quando o usuário digitar
  useEffect(() => {
    if (searchTerm.length >= 4 && /^\d+$/.test(searchTerm)) {
      // Buscar e mostrar sugestões
      searchFsaByNumber(searchTerm).then(() => {
        // Adicionar ao histórico
        const history = JSON.parse(localStorage.getItem('fsa-search-history') || '[]');
        if (!history.includes(searchTerm)) {
          const updated = [searchTerm, ...history].slice(0, 10);
          localStorage.setItem('fsa-search-history', JSON.stringify(updated));
        }
      }).catch(() => {
        // Silenciar erro se não encontrar
      });
    }
  }, [searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput 
            placeholder={placeholder}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>Nenhuma FSA encontrada.</CommandEmpty>
            {suggestions.length > 0 && (
              <CommandGroup heading="Histórico">
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    onSelect={() => {
                      onSelect(suggestion);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === suggestion ? "opacity-100" : "opacity-0"
                      )}
                    />
                    FSA-{suggestion}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
