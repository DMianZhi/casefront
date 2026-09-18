import type { InventoryElement } from '@/lib/inventory';
import ElementItem from './ElementItem';

export default function ElementList({ elements, isPending, onToggle }: {
  elements: InventoryElement[];
  isPending: (id: string) => boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <ul className="list-scroll m-0 max-h-[300px] overflow-y-auto rounded-[14px] border-[0.5px] border-sep bg-card p-0 shadow-sm"
        style={{ listStyle: 'none' }}>
      {elements.map(el => (
        <ElementItem key={el.id} el={el} checked={isPending(el.id)} onToggle={onToggle} />
      ))}
    </ul>
  );
}
